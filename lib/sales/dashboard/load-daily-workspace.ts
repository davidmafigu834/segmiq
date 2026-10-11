import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSalespersonTasks } from "@/lib/sales/tasks/sales-tasks-data";
import {
  buildWorkspaceBriefing,
  greetingPartInTimeZone,
  rankNextActions,
} from "./daily-workspace";
import { mapLeadEvent, mapQuotationEvent, selectRecentUpdates, type RecentUpdate } from "./recent-updates";
import { resolveDashboardVisit, type StoredDashboardVisit } from "./visit-cursor";

const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
const LEAD_EVENT_TYPES = ["MESSAGE_RECEIVED", "LEAD_ASSIGNED", "LEAD_REASSIGNED", "FOLLOW_UP_SET"];
const QUOTE_EVENT_TYPES = ["APPROVED", "ACCEPTED"];

export type DailyWorkspacePayload = {
  greetingPart: "morning" | "afternoon" | "evening";
  timezone: string;
  briefing: string;
  openCount: number;
  actions: Awaited<ReturnType<typeof fetchSalespersonTasks>>["tasks"];
  viewAllHref: string;
  copilotUnavailable: boolean;
  updates: {
    heading: "While you were away" | "Recent updates";
    timeframe: string | null;
    items: RecentUpdate[];
    unavailable: boolean;
  };
  visitId: string;
  generatedAt: string;
};

type LeadEventRow = {
  id: string;
  lead_id: string;
  event_type: string;
  event_data: Record<string, unknown> | null;
  created_at: string;
  leads: { name?: string | null; assigned_to_id?: string | null } | { name?: string | null; assigned_to_id?: string | null }[] | null;
};

type QuoteEventRow = {
  id: string;
  quotation_id: string;
  lead_id: string | null;
  event_type: string;
  created_at: string;
  leads: { name?: string | null; assigned_to_id?: string | null } | { name?: string | null; assigned_to_id?: string | null }[] | null;
};

function oneLead(
  value: LeadEventRow["leads"]
): { name?: string | null; assigned_to_id?: string | null } | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function missingRelation(message: string): boolean {
  return /does not exist|schema cache|relation/i.test(message);
}

async function readVisit(clientId: string, userId: string): Promise<StoredDashboardVisit | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_dashboard_visits")
    .select("since_at, visit_id, visit_started_at, updated_at")
    .eq("client_id", clientId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (missingRelation(error.message)) return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  const row = data as {
    since_at: string | null;
    visit_id: string;
    visit_started_at: string;
    updated_at: string;
  };
  return {
    sinceAt: row.since_at,
    visitId: row.visit_id,
    visitStartedAt: row.visit_started_at,
    updatedAt: row.updated_at,
  };
}

async function writeVisit(clientId: string, userId: string, visit: ReturnType<typeof resolveDashboardVisit>): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("sales_dashboard_visits").upsert(
    {
      client_id: clientId,
      user_id: userId,
      since_at: visit.sinceAt,
      visit_id: visit.visitId,
      visit_started_at: visit.visitStartedAt,
      updated_at: visit.updatedAt,
    },
    { onConflict: "client_id,user_id" }
  );
  if (error && !missingRelation(error.message)) {
    console.error("[daily-workspace] visit", error.message);
  }
}

async function loadUpdates(opts: {
  clientId: string;
  userId: string;
  timeZone: string;
  since: Date;
  now: Date;
}): Promise<{ items: RecentUpdate[]; unavailable: boolean }> {
  const supabase = createAdminClient();
  const sinceIso = opts.since.toISOString();
  const mapped: RecentUpdate[] = [];
  let unavailable = false;

  const leadQuery = await supabase
    .from("lead_events")
    .select("id, lead_id, event_type, event_data, created_at, leads!inner(name, assigned_to_id)")
    .eq("client_id", opts.clientId)
    .eq("leads.assigned_to_id", opts.userId)
    .in("event_type", LEAD_EVENT_TYPES)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(40);

  if (leadQuery.error) {
    unavailable = true;
    console.error("[daily-workspace] lead events", leadQuery.error.message);
  } else {
    for (const raw of (leadQuery.data ?? []) as LeadEventRow[]) {
      const lead = oneLead(raw.leads);
      if (!lead || lead.assigned_to_id !== opts.userId) continue;
      const item = mapLeadEvent({
        id: raw.id,
        eventType: raw.event_type,
        at: raw.created_at,
        leadId: raw.lead_id,
        leadName: lead.name?.trim() || "A customer",
        userId: opts.userId,
        data: raw.event_data ?? {},
        timeZone: opts.timeZone,
        now: opts.now,
      });
      if (item) mapped.push(item);
    }
  }

  const quoteQuery = await supabase
    .from("quotation_events")
    .select("id, quotation_id, lead_id, event_type, created_at, leads!inner(name, assigned_to_id)")
    .eq("client_id", opts.clientId)
    .eq("leads.assigned_to_id", opts.userId)
    .in("event_type", QUOTE_EVENT_TYPES)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(20);

  if (quoteQuery.error) {
    if (!missingRelation(quoteQuery.error.message)) {
      unavailable = true;
      console.error("[daily-workspace] quotation events", quoteQuery.error.message);
    }
  } else {
    for (const raw of (quoteQuery.data ?? []) as QuoteEventRow[]) {
      const lead = oneLead(raw.leads);
      if (!raw.lead_id || !lead || lead.assigned_to_id !== opts.userId) continue;
      const item = mapQuotationEvent({
        id: raw.id,
        eventType: raw.event_type,
        at: raw.created_at,
        leadId: raw.lead_id,
        leadName: lead.name?.trim() || "A customer",
        quotationId: raw.quotation_id,
      });
      if (item) mapped.push(item);
    }
  }

  return { items: selectRecentUpdates(mapped, 3), unavailable };
}

export async function loadDailyWorkspace(opts: {
  userId: string;
  clientId: string;
  incomingVisitId: string | null;
  now?: Date;
}): Promise<DailyWorkspacePayload> {
  const now = opts.now ?? new Date();
  const tasks = await fetchSalespersonTasks({
    userId: opts.userId,
    clientId: opts.clientId,
    view: "mine",
  });
  const timeZone = tasks.meta.timezone || "UTC";
  const summary = buildWorkspaceBriefing(tasks.tasks, now, timeZone);
  const actions = rankNextActions(tasks.tasks, now, timeZone, 3);

  let visit = resolveDashboardVisit({
    stored: null,
    incomingVisitId: opts.incomingVisitId,
    now,
    nextVisitId: crypto.randomUUID(),
  });
  try {
    const stored = await readVisit(opts.clientId, opts.userId);
    visit = resolveDashboardVisit({
      stored,
      incomingVisitId: opts.incomingVisitId,
      now,
      nextVisitId: visit.visitId,
    });
    await writeVisit(opts.clientId, opts.userId, visit);
  } catch (err) {
    console.error("[daily-workspace] visit cursor", err);
    visit = { ...visit, reliableAwayWindow: false, sinceAt: null };
  }

  const since = visit.reliableAwayWindow && visit.sinceAt ? new Date(visit.sinceAt) : new Date(now.getTime() - RECENT_WINDOW_MS);
  let updates: DailyWorkspacePayload["updates"];
  try {
    const loaded = await loadUpdates({
      clientId: opts.clientId,
      userId: opts.userId,
      timeZone,
      since,
      now,
    });
    updates = {
      heading: visit.reliableAwayWindow ? "While you were away" : "Recent updates",
      timeframe: visit.reliableAwayWindow ? null : "last 24 hours",
      items: loaded.items,
      unavailable: loaded.unavailable,
    };
  } catch (err) {
    console.error("[daily-workspace] updates", err);
    updates = {
      heading: visit.reliableAwayWindow ? "While you were away" : "Recent updates",
      timeframe: visit.reliableAwayWindow ? null : "last 24 hours",
      items: [],
      unavailable: true,
    };
  }

  return {
    greetingPart: greetingPartInTimeZone(now, timeZone),
    timezone: timeZone,
    briefing: summary.briefing,
    openCount: tasks.counts.mine,
    actions,
    viewAllHref: "/sales/tasks",
    copilotUnavailable: tasks.meta.copilotUnavailable,
    updates,
    visitId: visit.visitId,
    generatedAt: now.toISOString(),
  };
}
