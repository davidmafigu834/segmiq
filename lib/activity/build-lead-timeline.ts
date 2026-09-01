import { createAdminClient } from "@/lib/supabase/admin";
import {
  filterCategoryMatches,
  presentationForLeadEvent,
  presentationForQuotationEvent,
} from "@/lib/activity/presentation";
import type {
  ActivityActorType,
  ActivityFilterCategory,
  ActivityTimelineItem,
  LeadTimelineQueryResult,
} from "@/lib/activity/types";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;

type RawLeadEvent = {
  id: string;
  event_type: string;
  event_data: Record<string, unknown> | null;
  actor_id: string | null;
  actor_name: string;
  actor_role: string;
  channel: string | null;
  created_at: string;
  pinned_at: string | null;
  pinned_by: string | null;
};

type RawQuotationEvent = {
  id: string;
  event_type: string;
  event_data: Record<string, unknown> | null;
  actor_name: string;
  created_at: string;
  quotation_id: string;
};

function actorTypeFromRole(role: string | null | undefined): ActivityActorType {
  const r = (role ?? "").toUpperCase();
  if (r === "SYSTEM") return "SYSTEM";
  if (r === "AGENT" || r.includes("AGENT")) return "AGENT";
  if (r === "CUSTOMER" || r === "LEAD") return "CUSTOMER";
  return "USER";
}

function noteText(data: Record<string, unknown>): string | null {
  const note = data.note;
  const notes = data.notes;
  if (typeof note === "string" && note.trim()) return note.trim();
  if (typeof notes === "string" && notes.trim()) return notes.trim();
  return null;
}

function callSummary(data: Record<string, unknown>): string | null {
  const parts: string[] = [];
  const outcome = data.outcome as string | undefined;
  const reach = data.reach_outcome as string | undefined;
  const result = data.result as string | undefined;
  if (reach) parts.push(reach.replace(/_/g, " "));
  else if (outcome) parts.push(outcome.replace(/_/g, " "));
  if (result) parts.push(result.replace(/_/g, " "));
  const notes = noteText(data);
  if (notes) parts.push(notes);
  return parts.length ? parts.join(" · ") : null;
}

function whatsappSummary(data: Record<string, unknown>): string | null {
  const preview = data.body_preview ?? data.preview ?? data.message_preview ?? data.body;
  if (typeof preview === "string" && preview.trim()) {
    const t = preview.trim();
    return t.length > 140 ? `${t.slice(0, 137)}…` : t;
  }
  return null;
}

function normalizeLeadEvent(
  row: RawLeadEvent,
  pinnedByName?: string | null
): ActivityTimelineItem {
  const data = (row.event_data ?? {}) as Record<string, unknown>;
  const presentation = presentationForLeadEvent(row.event_type, data);
  let summary: string | null = null;

  if (row.event_type === "NOTE_ADDED") summary = noteText(data);
  else if (row.event_type === "CALL_LOGGED") summary = callSummary(data);
  else if (row.event_type === "MESSAGE_RECEIVED" || row.event_type === "MESSAGE_SENT") {
    summary = whatsappSummary(data);
  } else if (row.event_type === "STATUS_CHANGED") {
    const from = data.from_status as string | undefined;
    const to = data.to_status as string | undefined;
    if (from && to) summary = `${from.replace(/_/g, " ")} → ${to.replace(/_/g, " ")}`;
  } else if (row.event_type === "FOLLOW_UP_SET") {
    const date = data.follow_up_date as string | undefined;
    const notes = noteText(data);
    summary = [date ? `Due ${date.slice(0, 10)}` : null, notes].filter(Boolean).join(" · ") || null;
  } else if (row.event_type === "DOCUMENT_SENT") {
    summary = (data.document_name as string | undefined) ?? null;
  } else if (row.event_type === "LEAD_ASSIGNED" || row.event_type === "LEAD_REASSIGNED") {
    const toName = (data.assigned_to_name ?? data.to_name) as string | undefined;
    summary = toName ? `Assigned to ${toName}` : null;
  }

  return {
    id: `lead_event:${row.id}`,
    sourceType: "LEAD_EVENT",
    sourceId: row.id,
    activityType: row.event_type,
    title: presentation.label,
    summary,
    occurredAt: row.created_at,
    actorType: actorTypeFromRole(row.actor_role),
    actorName: row.actor_name || "System",
    actorRole: row.actor_role ?? null,
    actorUserId: row.actor_id,
    filterCategory: presentation.filterCategory,
    metadata: {
      ...data,
      channel: row.channel,
      iconKey: presentation.iconKey,
      tone: presentation.tone,
    },
    pinnedAt: row.pinned_at,
    pinnedByUserId: row.pinned_by,
    pinnedByName: pinnedByName ?? null,
    refType: row.event_type === "CALL_LOGGED" ? "call_log" : null,
    refId: row.event_type === "CALL_LOGGED" ? row.id : null,
  };
}

function normalizeLegacyCallLog(row: {
  id: string;
  outcome: string | null;
  notes: string | null;
  follow_up_date: string | null;
  created_at: string;
  users: { name: string } | null;
}): ActivityTimelineItem {
  const data = {
    outcome: row.outcome,
    notes: row.notes,
    follow_up_date: row.follow_up_date,
  };
  const presentation = presentationForLeadEvent("CALL_LOGGED", data);
  return {
    id: `call_log:${row.id}`,
    sourceType: "CALL_LOG",
    sourceId: row.id,
    activityType: "CALL_LOGGED",
    title: presentation.label,
    summary: callSummary(data),
    occurredAt: row.created_at,
    actorType: "USER",
    actorName: row.users?.name ?? "Unknown",
    actorRole: "SALESPERSON",
    actorUserId: null,
    filterCategory: "calls",
    metadata: { ...data, iconKey: presentation.iconKey, tone: presentation.tone },
    pinnedAt: null,
    pinnedByUserId: null,
    pinnedByName: null,
    refType: "call_log",
    refId: row.id,
  };
}

function normalizeQuotationEvent(row: RawQuotationEvent): ActivityTimelineItem {
  const data = (row.event_data ?? {}) as Record<string, unknown>;
  const presentation = presentationForQuotationEvent(row.event_type);
  const quoteNumber = data.quote_number as string | undefined;
  return {
    id: `quotation_event:${row.id}`,
    sourceType: "QUOTATION_EVENT",
    sourceId: row.id,
    activityType: `QUOTE_${row.event_type}`,
    title: presentation.label,
    summary: quoteNumber ? `Quote ${quoteNumber}` : null,
    occurredAt: row.created_at,
    actorType: "USER",
    actorName: row.actor_name || "System",
    actorRole: null,
    actorUserId: null,
    filterCategory: "quotes",
    metadata: {
      ...data,
      quotationId: row.quotation_id,
      iconKey: presentation.iconKey,
      tone: presentation.tone,
    },
    pinnedAt: null,
    pinnedByUserId: null,
    pinnedByName: null,
    refType: "quotation",
    refId: row.quotation_id,
  };
}

export function encodeTimelineCursor(at: string, sourceId: string): string {
  return `${at}|${sourceId}`;
}

export function parseTimelineCursor(cursor: string | null | undefined): { at: string; id: string } | null {
  if (!cursor) return null;
  const sep = cursor.lastIndexOf("|");
  if (sep <= 0) return null;
  return { at: cursor.slice(0, sep), id: cursor.slice(sep + 1) };
}

function sortItems(items: ActivityTimelineItem[]): ActivityTimelineItem[] {
  return [...items].sort((a, b) => {
    const ta = new Date(a.occurredAt).getTime();
    const tb = new Date(b.occurredAt).getTime();
    if (tb !== ta) return tb - ta;
    return b.sourceId.localeCompare(a.sourceId);
  });
}

function isBeforeCursor(item: ActivityTimelineItem, cursor: { at: string; id: string }): boolean {
  const t = new Date(item.occurredAt).getTime();
  const ct = new Date(cursor.at).getTime();
  if (t < ct) return true;
  if (t > ct) return false;
  return item.sourceId < cursor.id;
}

function matchesSearch(item: ActivityTimelineItem, q: string): boolean {
  const hay = `${item.title} ${item.summary ?? ""} ${item.actorName}`.toLowerCase();
  return hay.includes(q);
}

export async function buildLeadTimeline(opts: {
  leadId: string;
  limit?: number;
  cursor?: string | null;
  filter?: ActivityFilterCategory;
  search?: string | null;
  includePinned?: boolean;
}): Promise<LeadTimelineQueryResult> {
  const supabase = createAdminClient();
  const limit = Math.min(Math.max(opts.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const filter = opts.filter ?? "all";
  const search = opts.search?.trim().toLowerCase() ?? "";
  const cursor = parseTimelineCursor(opts.cursor);

  const [{ data: events }, { data: callLogs }, { data: quoteEvents }] = await Promise.all([
    supabase
      .from("lead_events")
      .select(
        "id, event_type, event_data, actor_id, actor_name, actor_role, channel, created_at, pinned_at, pinned_by"
      )
      .eq("lead_id", opts.leadId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(120),
    supabase
      .from("call_logs")
      .select("id, outcome, notes, follow_up_date, created_at, users ( name )")
      .eq("lead_id", opts.leadId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("quotation_events")
      .select("id, event_type, event_data, actor_name, created_at, quotation_id")
      .eq("lead_id", opts.leadId)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const eventCallTimestamps = new Set(
    (events ?? [])
      .filter((e) => e.event_type === "CALL_LOGGED")
      .map((e) => new Date(e.created_at as string).toISOString().slice(0, 19))
  );

  const pinUserIds = [
    ...new Set(
      (events ?? [])
        .map((e) => e.pinned_by as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const pinNameById = new Map<string, string>();
  if (pinUserIds.length) {
    const { data: pinUsers } = await supabase.from("users").select("id, name").in("id", pinUserIds);
    for (const u of pinUsers ?? []) {
      pinNameById.set(u.id as string, (u.name as string) ?? "Unknown");
    }
  }

  const items: ActivityTimelineItem[] = [];

  for (const ev of (events ?? []) as RawLeadEvent[]) {
    const pinName = ev.pinned_by ? pinNameById.get(ev.pinned_by) ?? null : null;
    items.push(normalizeLeadEvent(ev, pinName));
  }

  for (const cl of callLogs ?? []) {
    const ts = new Date(cl.created_at as string).toISOString().slice(0, 19);
    if (eventCallTimestamps.has(ts)) continue;
    items.push(
      normalizeLegacyCallLog({
        id: cl.id as string,
        outcome: cl.outcome as string | null,
        notes: cl.notes as string | null,
        follow_up_date: cl.follow_up_date as string | null,
        created_at: cl.created_at as string,
        users: (cl.users as { name: string } | null) ?? null,
      })
    );
  }

  for (const qe of (quoteEvents ?? []) as RawQuotationEvent[]) {
    items.push(normalizeQuotationEvent(qe));
  }

  const sorted = sortItems(items);

  const pinned = sorted
    .filter((i) => i.pinnedAt)
    .sort((a, b) => new Date(b.pinnedAt!).getTime() - new Date(a.pinnedAt!).getTime());

  let chronological = sorted;

  if (filter !== "all") {
    chronological = chronological.filter((i) => filterCategoryMatches(i.filterCategory, filter));
  }
  if (search) {
    chronological = chronological.filter((i) => matchesSearch(i, search));
  }

  if (cursor) {
    const cursorIdx = chronological.findIndex(
      (i) => i.occurredAt === cursor.at && i.sourceId === cursor.id
    );
    chronological =
      cursorIdx >= 0
        ? chronological.slice(cursorIdx + 1)
        : chronological.filter((i) => isBeforeCursor(i, cursor));
  }

  const page = chronological.slice(0, limit);
  const hasMore = chronological.length > limit;
  const last = page[page.length - 1];

  return {
    items: page,
    pinned: opts.includePinned === false ? [] : pinned,
    nextCursor: hasMore && last ? encodeTimelineCursor(last.occurredAt, last.sourceId) : null,
    hasMore,
    totalApprox: sorted.length,
  };
}
