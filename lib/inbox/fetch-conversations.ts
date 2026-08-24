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
import type { DealRow } from "@/types";
import { getDealCommercialValue } from "@/lib/sales/deals/commercial-value";
import {
  parseConversationQueue,
  parseConversationType,
  parseSupportCaseStatus,
  parseSupportReasonCategory,
} from "./conversation-type";
import { asRows } from "@/lib/agent/rows";

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
  active_deal_id?: string | null;
  whatsapp_conversation_status?: string | null;
  whatsapp_resolved_at?: string | null;
  whatsapp_conversation_type?: string | null;
  whatsapp_queue?: string | null;
  whatsapp_collaborator_ids?: string[] | null;
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

  if (!clientId && role !== "SUPER_ADMIN") {
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

  const baseSelect =
    "id, client_id, contact_id, assigned_to_id, name, phone, email, source, status, project_type, form_data, score, score_breakdown, follow_up_date, created_at, updated_at, budget, timeline, deal_value, active_deal_id";
  const select = `${baseSelect}, whatsapp_conversation_status, whatsapp_resolved_at, whatsapp_conversation_type, whatsapp_queue, whatsapp_collaborator_ids`;

  let query = supabase.from("leads").select(select);

  // A Company Manager always sees the company queue. `alsoSells` grants selling
  // capabilities; it must not narrow the manager's oversight to their own Leads.
  if (role === "CLIENT_MANAGER" && clientId) {
    query = query.eq("client_id", clientId);
  } else if (salesScoped && clientId) {
    if (assignmentMode === "pool" || assignmentMode === "direct") {
      query = query
        .eq("client_id", clientId)
        .or(`assigned_to_id.eq.${userId},assigned_to_id.is.null`);
    } else {
      query = query.eq("client_id", clientId).eq("assigned_to_id", userId);
    }
  } else if (role === "SUPER_ADMIN" && clientId) {
    query = query.eq("client_id", clientId);
  } else if (role === "SUPER_ADMIN") {
    // No client scope — empty unless clientId passed via query param at API layer
    return [];
  } else {
    return [];
  }

  query = query.eq("source", "WHATSAPP_INBOUND");
  query = query.or("is_archived.is.null,is_archived.eq.false");
  if (role !== "CLIENT_MANAGER") {
    query = query.not("status", "in", '("WON","LOST","NOT_QUALIFIED")');
  }

  const { data: leads, error } = await query.order("updated_at", { ascending: false }).limit(500);
  if (error) {
    const msg = String(error.message ?? "");
    if (
      (msg.includes("is_archived") ||
        msg.includes("whatsapp_conversation") ||
        msg.includes("whatsapp_queue") ||
        msg.includes("support_cases")) &&
      clientId
    ) {
      let retryQuery = supabase.from("leads").select(baseSelect);
      if (role === "CLIENT_MANAGER") {
        retryQuery = retryQuery.eq("client_id", clientId);
      } else if (salesScoped) {
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
      if (!msg.includes("is_archived")) {
        retryQuery = retryQuery.or("is_archived.is.null,is_archived.eq.false");
      }
      if (role !== "CLIENT_MANAGER") {
        retryQuery = retryQuery.not("status", "in", '("WON","LOST","NOT_QUALIFIED")');
      }
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
  const activeDealIds = Array.from(
    new Set(leads.map((l) => l.active_deal_id).filter(Boolean))
  ) as string[];

  const [{ data: intelRows }, { data: contacts }, { data: users }, { data: client }, { data: deals }] =
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
      activeDealIds.length
        ? supabase.from("deals").select("*").in("id", activeDealIds)
        : Promise.resolve({ data: [] as DealRow[] }),
    ]);

  const aiEnabled = client?.ai_enabled === true;
  const intelByLead = new Map((intelRows ?? []).map((r) => [r.lead_id as string, r]));
  const contactById = new Map((contacts ?? []).map((c) => [c.id as string, c]));
  const userById = new Map((users ?? []).map((u) => [u.id as string, u]));
  const dealById = new Map(
    ((deals ?? []) as DealRow[]).map((deal) => [deal.id, deal])
  );

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
  const messageCountByLead = new Map<string, number>();
  const firstInboundByLead = new Map<string, string>();
  const firstResponseSecondsByLead = new Map<string, number>();
  const { data: aggregateRows, error: aggregateError } = await supabase.rpc(
    "get_company_whatsapp_conversation_stats",
    { p_client_id: clientId, p_lead_ids: leadIds }
  );

  if (!aggregateError) {
    for (const raw of aggregateRows ?? []) {
      const row = raw as {
        lead_id: string;
        last_body: string | null;
        last_created_at: string;
        last_message_type: string | null;
        last_direction: string | null;
        last_inbound_at: string | null;
        first_inbound_at: string | null;
        first_response_at: string | null;
        message_count: number | string;
      };
      const direction =
        row.last_direction === "inbound" || row.last_direction === "outbound"
          ? row.last_direction
          : null;
      lastWaByLead.set(row.lead_id, {
        body: row.last_body?.trim() || previewForType(row.last_message_type),
        created_at: row.last_created_at,
        message_type: row.last_message_type,
        direction,
      });
      if (row.last_inbound_at) lastInboundByLead.set(row.lead_id, row.last_inbound_at);
      if (row.first_inbound_at) firstInboundByLead.set(row.lead_id, row.first_inbound_at);
      messageCountByLead.set(row.lead_id, Number(row.message_count) || 0);
      if (row.first_inbound_at && row.first_response_at) {
        firstResponseSecondsByLead.set(
          row.lead_id,
          Math.max(
            0,
            Math.round(
              (new Date(row.first_response_at).getTime() -
                new Date(row.first_inbound_at).getTime()) /
                1000
            )
          )
        );
      }
    }
  } else {
    // Compatibility fallback while migration 090 is being rolled out.
    const { data: waMessages } = await supabase
      .from("whatsapp_messages")
      .select("lead_id, body, created_at, message_type, direction")
      .in("lead_id", leadIds)
      .order("created_at", { ascending: false });

    for (const m of waMessages ?? []) {
      const lid = m.lead_id as string;
      const direction =
        m.direction === "inbound" || m.direction === "outbound" ? m.direction : null;
      if (!lastWaByLead.has(lid)) {
        lastWaByLead.set(lid, {
          body:
            (m.body as string | null)?.trim() || previewForType(m.message_type as string | null),
          created_at: m.created_at as string,
          message_type: (m.message_type as string | null) ?? null,
          direction,
        });
      }
      if (direction === "inbound" && !lastInboundByLead.has(lid)) {
        lastInboundByLead.set(lid, m.created_at as string);
      }
    }

    for (const m of [...(waMessages ?? [])].reverse()) {
      const leadId = m.lead_id as string;
      messageCountByLead.set(leadId, (messageCountByLead.get(leadId) ?? 0) + 1);
      const createdAt = m.created_at as string;
      if (m.direction === "inbound" && !firstInboundByLead.has(leadId)) {
        firstInboundByLead.set(leadId, createdAt);
      }
      if (
        m.direction === "outbound" &&
        firstInboundByLead.has(leadId) &&
        !firstResponseSecondsByLead.has(leadId)
      ) {
        const firstInboundAt = firstInboundByLead.get(leadId)!;
        firstResponseSecondsByLead.set(
          leadId,
          Math.max(
            0,
            Math.round(
              (new Date(createdAt).getTime() - new Date(firstInboundAt).getTime()) / 1000
            )
          )
        );
      }
    }
  }

  const { data: quoteRows } = await supabase
    .from("quotations")
    .select("lead_id, quote_number, status, total, currency, sent_at, viewed_at, created_at")
    .in("lead_id", leadIds)
    .order("created_at", { ascending: false });

  const latestQuoteByLead = new Map<
    string,
    {
      quote_number: string | null;
      status: string;
      total: number | null;
      currency: string | null;
      viewed_at: string | null;
    }
  >();
  for (const q of quoteRows ?? []) {
    const lid = q.lead_id as string;
    if (!latestQuoteByLead.has(lid)) {
      latestQuoteByLead.set(lid, {
        quote_number: (q.quote_number as string | null) ?? null,
        status: (q.status as string) ?? "draft",
        total: typeof q.total === "number" ? q.total : Number(q.total) || null,
        currency: (q.currency as string | null) ?? "USD",
        viewed_at: (q.viewed_at as string | null) ?? null,
      });
    }
  }

  const supportByLead = new Map<
    string,
    {
      id: string;
      status: ReturnType<typeof parseSupportCaseStatus>;
      reasonCategory: ReturnType<typeof parseSupportReasonCategory>;
      reason: string | null;
    }
  >();
  const { data: supportRows, error: supportError } = await supabase
    .from("support_cases")
    .select("id, lead_id, status, reason_category, reason")
    .in("lead_id", leadIds)
    .neq("status", "RESOLVED")
    .order("created_at", { ascending: false });
  if (!supportError) {
    for (const row of supportRows ?? []) {
      const lid = row.lead_id as string;
      if (supportByLead.has(lid)) continue;
      supportByLead.set(lid, {
        id: row.id as string,
        status: parseSupportCaseStatus(row.status),
        reasonCategory: parseSupportReasonCategory(row.reason_category),
        reason: (row.reason as string | null) ?? null,
      });
    }
  }

  const agentStateByLead = new Map<
    string,
    { status: InboxConversation["agentStatus"]; reason: string | null; humanTakeover: boolean }
  >();
  const { data: agentStateRows, error: agentStateError } = await supabase
    .from("agent_conversation_state")
    .select("lead_id, status, human_needed_reason, human_takeover")
    .eq("client_id", clientId)
    .in("lead_id", leadIds);
  if (!agentStateError) {
    for (const row of asRows<{
      lead_id: string;
      status: InboxConversation["agentStatus"] | null;
      human_needed_reason: string | null;
      human_takeover: boolean | null;
    }>(agentStateRows)) {
      agentStateByLead.set(row.lead_id, {
        status: row.status ?? "IDLE",
        reason: row.human_needed_reason ?? null,
        humanTakeover: row.human_takeover === true,
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
    const activeDeal = lead.active_deal_id
      ? dealById.get(lead.active_deal_id) ?? null
      : null;
    const lastMessageDirection = waLast?.direction ?? null;
    const lastInboundAt = lastInboundByLead.get(lead.id) ?? null;
    const awaitingReplyMinutes =
      lastMessageDirection === "inbound" ? minutesSince(lastInboundAt ?? waLast?.created_at ?? null) : null;
    const commercial = activeDeal
      ? getDealCommercialValue(activeDeal, { latestQuoteTotal: latestQuote?.total ?? null })
      : null;
    const dealValue = commercial?.kind === "amount"
      ? commercial.amount
      : commercial?.kind === "range"
        ? commercial.max
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

    // Unread comes only from unread WHATSAPP_MESSAGE / NEW_LEAD notifications.
    // Do NOT invent unread=1 for NEW leads — that left the green badge stuck after
    // the salesperson opened the chat and notifications were marked read.
    const unread = unreadByLead.get(lead.id) ?? 0;

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
      leadBudget: lead.budget ?? null,
      leadTimeline: lead.timeline ?? null,
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
      latestQuoteViewedAt: latestQuote?.viewed_at ?? null,
      conversationType: parseConversationType(lead.whatsapp_conversation_type),
      conversationQueue: parseConversationQueue(lead.whatsapp_queue),
      collaboratorIds: Array.isArray(lead.whatsapp_collaborator_ids)
        ? lead.whatsapp_collaborator_ids.filter((id): id is string => typeof id === "string")
        : [],
      supportCase: supportByLead.get(lead.id) ?? null,
      conversationStatus:
        lead.whatsapp_conversation_status === "RESOLVED" ? "RESOLVED" : "OPEN",
      resolvedAt: lead.whatsapp_resolved_at ?? null,
      firstContactAt: firstInboundByLead.get(lead.id) ?? lead.created_at,
      firstResponseSeconds: firstResponseSecondsByLead.get(lead.id) ?? null,
      messageCount: messageCountByLead.get(lead.id) ?? 0,
      activeDealId: lead.active_deal_id ?? null,
      dealName: activeDeal?.name ?? null,
      dealStage: activeDeal?.stage ?? null,
      dealNextActionAt: activeDeal?.next_action_at ?? null,
      dealNextActionLabel: activeDeal?.next_action_label ?? null,
      agentStatus: (() => {
        const agent = agentStateByLead.get(lead.id);
        if (!agent) return null;
        if (agent.humanTakeover) return "HUMAN_HANDLING";
        return agent.status;
      })(),
      agentHumanNeededReason: agentStateByLead.get(lead.id)?.reason ?? null,
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
