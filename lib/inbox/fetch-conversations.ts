import { createAdminClient } from "@/lib/supabase/admin";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import type { UserRole } from "@/types";
import { formatDistanceToNow } from "date-fns";
import {
  breakdownFromIntelligence,
  breakdownFromRules,
  effectiveInboxScore,
  scoreLabel,
  SOURCE_LABELS,
  stageLabel,
} from "./scoring";
import { sortInboxConversations } from "./queue-filters";
import type { InboxConversation } from "./types";

type LeadRow = {
  id: string;
  client_id: string;
  contact_id: string | null;
  assigned_to_id: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: string;
  project_type: string | null;
  form_data: Record<string, unknown> | null;
  score: number | null;
  score_breakdown: Record<string, number> | null;
  follow_up_date: string | null;
  created_at: string;
  updated_at: string;
  budget?: string | null;
  timeline?: string | null;
  deal_value?: number | null;
};

function extractCompany(formData: Record<string, unknown> | null): string | null {
  if (!formData) return null;
  for (const key of Object.keys(formData)) {
    if (/company|business|organisation|organization/i.test(key)) {
      const v = formData[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return null;
}

function minutesSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 0;
  return Math.floor(ms / 60000);
}
function formMessageSnippet(formData: Record<string, unknown> | null): string | null {
  if (!formData) return null;
  for (const key of Object.keys(formData)) {
    if (/message|notes|detail|comment|describe/i.test(key)) {
      const v = formData[key];
      if (typeof v === "string" && v.trim().length >= 8) return v.trim();
    }
  }
  return null;
}

function contactLocation(
  contact: { location?: string | null } | null,
  intel: { location_extracted?: string | null } | null,
  formData: Record<string, unknown> | null
): string | null {
  if (contact?.location?.trim()) return contact.location.trim();
  if (intel?.location_extracted?.trim()) return intel.location_extracted.trim();
  if (!formData) return null;
  for (const key of Object.keys(formData)) {
    if (/location|city|area|region|state/i.test(key)) {
      const v = formData[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return null;
}

export async function fetchInboxConversations(opts: {
  role: UserRole;
  userId: string;
  clientId: string | null;
  alsoSells?: boolean;
}): Promise<InboxConversation[]> {
  const supabase = createAdminClient();
  const { role, userId, clientId, alsoSells } = opts;
  const salesScoped = canActAsSalesperson({ userId, role, alsoSells });

  if (!clientId && role !== "AGENCY_ADMIN") {
    return [];
  }

  let assignmentMode: "direct" | "pool" | "round_robin" = "direct";
  if (clientId) {
    const { data: client } = await supabase
      .from("clients")
      .select("assignment_mode, ai_enabled")
      .eq("id", clientId)
      .maybeSingle();
    const raw = client?.assignment_mode as string | null;
    if (raw === "pool" || raw === "round_robin") assignmentMode = raw;
    else assignmentMode = "direct";
  }

  const select =
    "id, client_id, contact_id, assigned_to_id, name, phone, email, source, status, project_type, form_data, score, score_breakdown, follow_up_date, created_at, updated_at, budget, timeline, deal_value";

  let query = supabase.from("leads").select(select);

  if (salesScoped && clientId) {
    if (assignmentMode === "pool" || assignmentMode === "direct") {
      query = query
        .eq("client_id", clientId)
        .or(`assigned_to_id.eq.${userId},assigned_to_id.is.null`);
    } else {
      query = query.eq("client_id", clientId).eq("assigned_to_id", userId);
    }
  } else if (role === "CLIENT_MANAGER" && clientId) {
    query = query.eq("client_id", clientId);
  } else if (role === "AGENCY_ADMIN" && clientId) {
    query = query.eq("client_id", clientId);
  } else if (role === "AGENCY_ADMIN") {
    // No client scope — empty unless clientId passed via query param at API layer
    return [];
  } else {
    return [];
  }

  query = query.eq("source", "WHATSAPP_INBOUND");
  query = query.or("is_archived.is.null,is_archived.eq.false");
  query = query.not("status", "in", '("WON","LOST","NOT_QUALIFIED")');

  const { data: leads, error } = await query.order("updated_at", { ascending: false }).limit(500);
  if (error) {
    const msg = String(error.message ?? "");
    if (msg.includes("is_archived") && clientId) {
      let retryQuery = supabase.from("leads").select(select);
      if (salesScoped) {
        if (assignmentMode === "pool" || assignmentMode === "direct") {
          retryQuery = retryQuery
            .eq("client_id", clientId)
            .or(`assigned_to_id.eq.${userId},assigned_to_id.is.null`);
        } else {
          retryQuery = retryQuery.eq("client_id", clientId).eq("assigned_to_id", userId);
        }
      } else {
        retryQuery = retryQuery.eq("client_id", clientId);
      }
      retryQuery = retryQuery.eq("source", "WHATSAPP_INBOUND");
      retryQuery = retryQuery.not("status", "in", '("WON","LOST","NOT_QUALIFIED")');
      const retry = await retryQuery.order("updated_at", { ascending: false }).limit(500);
      if (retry.error) return [];
      return buildConversations(retry.data as LeadRow[], userId, clientId, supabase);
    }
    return [];
  }

  return buildConversations((leads ?? []) as LeadRow[], userId, clientId!, supabase);
}

async function buildConversations(
  leads: LeadRow[],
  userId: string,
  clientId: string,
  supabase: ReturnType<typeof createAdminClient>
): Promise<InboxConversation[]> {
  if (!leads.length) return [];

  const leadIds = leads.map((l) => l.id);
  const contactIds = Array.from(new Set(leads.map((l) => l.contact_id).filter(Boolean))) as string[];
  const assigneeIds = Array.from(
    new Set(leads.map((l) => l.assigned_to_id).filter(Boolean))
  ) as string[];

  const [{ data: intelRows }, { data: contacts }, { data: users }, { data: client }] =
    await Promise.all([
      supabase.from("lead_intelligence").select("*").in("lead_id", leadIds),
      contactIds.length
        ? supabase
            .from("contacts")
            .select("id, location, name, whatsapp_profile_name, whatsapp_wa_id")
            .in("id", contactIds)
        : Promise.resolve({
            data: [] as {
              id: string;
              location: string | null;
              name: string | null;
              whatsapp_profile_name: string | null;
              whatsapp_wa_id: string | null;
            }[],
          }),
      assigneeIds.length
        ? supabase.from("users").select("id, name").in("id", assigneeIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      supabase.from("clients").select("ai_enabled").eq("id", clientId).maybeSingle(),
    ]);

  const aiEnabled = client?.ai_enabled === true;
  const intelByLead = new Map((intelRows ?? []).map((r) => [r.lead_id as string, r]));
  const contactById = new Map((contacts ?? []).map((c) => [c.id as string, c]));
  const userById = new Map((users ?? []).map((u) => [u.id as string, u]));

  const { data: waMessages } = await supabase
    .from("whatsapp_messages")
    .select("lead_id, body, created_at, message_type, direction")
    .in("lead_id", leadIds)
    .order("created_at", { ascending: false });

  const lastWaByLead = new Map<
    string,
    {
      body: string;
      created_at: string;
      message_type: string | null;
      direction: "inbound" | "outbound" | null;
    }
  >();
  const lastInboundByLead = new Map<string, string>();
  for (const m of waMessages ?? []) {
    const lid = m.lead_id as string;
    const direction = m.direction === "inbound" || m.direction === "outbound" ? m.direction : null;
    if (!lastWaByLead.has(lid)) {
      lastWaByLead.set(lid, {
        body: (m.body as string | null)?.trim() || previewForType(m.message_type as string | null),
        created_at: m.created_at as string,
        message_type: (m.message_type as string | null) ?? null,
        direction,
      });
    }
    if (direction === "inbound" && !lastInboundByLead.has(lid)) {
      lastInboundByLead.set(lid, m.created_at as string);
    }
  }

  const { data: quoteRows } = await supabase
    .from("quotations")
    .select("lead_id, quote_number, status, total, currency, sent_at, created_at")
    .in("lead_id", leadIds)
    .order("created_at", { ascending: false });

  const latestQuoteByLead = new Map<
    string,
    { quote_number: string | null; status: string; total: number | null; currency: string | null }
  >();
  for (const q of quoteRows ?? []) {
    const lid = q.lead_id as string;
    if (!latestQuoteByLead.has(lid)) {
      latestQuoteByLead.set(lid, {
        quote_number: (q.quote_number as string | null) ?? null,
        status: (q.status as string) ?? "draft",
        total: typeof q.total === "number" ? q.total : Number(q.total) || null,
        currency: (q.currency as string | null) ?? "USD",
      });
    }
  }

  const { data: unreadNotes } = await supabase
    .from("notifications")
    .select("lead_id")
    .eq("user_id", userId)
    .eq("read", false)
    .in("type", ["WHATSAPP_MESSAGE", "NEW_LEAD"])
    .in("lead_id", leadIds);

  const unreadByLead = new Map<string, number>();
  for (const n of unreadNotes ?? []) {
    if (!n.lead_id) continue;
    const lid = n.lead_id as string;
    unreadByLead.set(lid, (unreadByLead.get(lid) ?? 0) + 1);
  }

  const conversations: InboxConversation[] = leads.map((lead) => {
    const intel = intelByLead.get(lead.id) ?? null;
    const contact = lead.contact_id ? contactById.get(lead.contact_id) ?? null : null;
    const assigneeRow = lead.assigned_to_id ? userById.get(lead.assigned_to_id) : null;
    const aiScore =
      aiEnabled && typeof intel?.intent_score === "number" ? (intel.intent_score as number) : null;

    const score = effectiveInboxScore({
      ...lead,
      aiScore,
      aiEnabled,
      form_data: lead.form_data,
    });

    const breakdown = intel
      ? breakdownFromIntelligence(intel, lead.score_breakdown)
      : breakdownFromRules({
          status: lead.status,
          created_at: lead.created_at,
          follow_up_date: lead.follow_up_date,
          score: lead.score,
          budget: lead.budget,
          timeline: lead.timeline,
          project_type: lead.project_type,
          form_data: lead.form_data,
        });

    const waLast = lastWaByLead.get(lead.id);
    const latestQuote = latestQuoteByLead.get(lead.id) ?? null;
    const lastMessageDirection = waLast?.direction ?? null;
    const lastInboundAt = lastInboundByLead.get(lead.id) ?? null;
    const awaitingReplyMinutes =
      lastMessageDirection === "inbound" ? minutesSince(lastInboundAt ?? waLast?.created_at ?? null) : null;
    const dealValue =
      typeof lead.deal_value === "number" && lead.deal_value > 0
        ? lead.deal_value
        : latestQuote?.total && latestQuote.total > 0
          ? latestQuote.total
          : null;

    const displayName =
      lead.name?.trim()
      || (contact as { whatsapp_profile_name?: string | null } | null)?.whatsapp_profile_name?.trim()
      || (contact as { name?: string | null } | null)?.name?.trim()
      || null;
    const formSnippet =
      formMessageSnippet(lead.form_data) ||
      (typeof (lead.form_data as Record<string, unknown> | null)?.first_message === "string"
        ? String((lead.form_data as Record<string, unknown>).first_message).trim()
        : null);
    const lastMessage = waLast?.body || formSnippet || "No messages yet";
    const lastMessageAt = waLast?.created_at ?? lead.updated_at ?? lead.created_at;

    const unread =
      unreadByLead.get(lead.id) ?? (lead.status === "NEW" && lead.assigned_to_id === userId ? 1 : 0);

    return {
      id: lead.id,
      contactId: lead.contact_id,
      name: displayName,
      whatsappProfileName:
        (contact as { whatsapp_profile_name?: string | null } | null)?.whatsapp_profile_name?.trim() ?? null,
      phone: lead.phone,
      location: contactLocation(contact, intel, lead.form_data),
      source: lead.source,
      status: lead.status,
      stageLabel: stageLabel(lead.status, lead.follow_up_date),
      projectType: lead.project_type,
      assignedToId: lead.assigned_to_id,
      assignee: assigneeRow
        ? { id: assigneeRow.id as string, name: assigneeRow.name as string }
        : null,
      score,
      scoreLabel: scoreLabel(score),
      lastMessage,
      lastMessageAt,
      lastMessageType: waLast?.message_type ?? null,
      unread,
      tags: (intel?.tags as string[] | null) ?? [],
      leadSummary: (intel?.lead_summary as string | null) ?? null,
      breakdown,
      followUpDate: lead.follow_up_date,
      createdAt: lead.created_at,
      company: extractCompany(lead.form_data),
      dealValue,
      dealCurrency: latestQuote?.currency ?? "USD",
      sourceLabel: formatSource(lead.source),
      lastMessageDirection,
      awaitingReplyMinutes,
      latestQuoteNumber: latestQuote?.quote_number ?? null,
      latestQuoteStatus: latestQuote?.status ?? null,
      latestQuoteTotal: latestQuote?.total ?? null,
    };
  });

  return sortInboxConversations(conversations, "all");
}

function previewForType(messageType: string | null): string {
  if (messageType === "image") return "Photo";
  if (messageType === "audio") return "Voice message";
  if (messageType === "video") return "Video";
  if (messageType === "document") return "Document";
  if (messageType === "sticker") return "Sticker";
  return "Message";
}

export function formatInboxTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

export function formatSource(source: string | null): string {
  if (!source) return "Unknown";
  return SOURCE_LABELS[source] ?? source.replace(/_/g, " ");
}
