import { createAdminClient } from "@/lib/supabase/admin";
import { resolveClientSalesTimezone } from "@/lib/sales/intelligence/daily-plan-service";
import { loadQualificationFlow } from "@/lib/whatsapp/load-qualification-flow";
import { formatLocalDateTime } from "./dates";
import { loadCustomerMemory, memoryForContext } from "./memory";
import type { AgentCompanySettings, AgentCustomerMemory } from "./types";

/**
 * Context assembly — a compact, tenant-scoped snapshot the model reasons on.
 * Only records belonging to this company + customer are ever included, and
 * protected data (internal notes, cost, margin, other customers) is excluded.
 */

const RECENT_MESSAGE_LIMIT = 20;
const MESSAGE_CHAR_LIMIT = 400;

export type AgentMessageSnapshot = {
  direction: "inbound" | "outbound";
  senderSource: string;
  body: string;
  at: string;
};

export type AgentQualificationField = {
  field: string;
  label: string;
  currentValue: string | null;
};

export type AgentContext = {
  company: {
    name: string;
    industry: string | null;
    timezone: string;
  };
  customer: {
    name: string | null;
    phone: string | null;
    isNewLead: boolean;
    lifecycle: string | null;
  };
  conversation: {
    leadId: string;
    type: string;
    workflowStatus: string;
    messageCount: number;
    recentMessages: AgentMessageSnapshot[];
    olderMessagesNote: string | null;
    /** Latest message id — the conversation version this run reasons against. */
    latestMessageId: string | null;
  };
  lead: {
    id: string;
    status: string;
    source: string;
    ownerId: string | null;
    ownerName: string | null;
    followUpDate: string | null;
  };
  qualification: {
    fields: AgentQualificationField[];
    missing: string[];
  };
  deal: {
    id: string;
    name: string;
    stage: string;
    estimatedValue: number | null;
  } | null;
  quotation: {
    id: string;
    number: string;
    status: string;
    total: number;
    currency: string;
    validUntil: string | null;
  } | null;
  upcomingAppointment: { at: string; label: string } | null;
  memory: Record<string, string>;
  rawMemory: AgentCustomerMemory;
  contactId: string | null;
  settings: AgentCompanySettings;
};

const CORE_QUALIFICATION_FIELDS: Array<{ field: string; label: string; column: string }> = [
  { field: "customer_need", label: "What they need", column: "customer_need" },
  { field: "project_type", label: "Project / property type", column: "project_type" },
  { field: "location", label: "Location", column: "location" },
  { field: "budget", label: "Budget", column: "budget" },
  { field: "timeline", label: "Timeline", column: "timeline" },
];

export async function assembleAgentContext(opts: {
  clientId: string;
  leadId: string;
  settings: AgentCompanySettings;
}): Promise<AgentContext | null> {
  const supabase = createAdminClient();

  const [{ data: lead }, { data: client }, timezone] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "id, client_id, name, phone, status, source, contact_id, assigned_to_id, active_deal_id, budget, project_type, timeline, location, customer_need, buying_timeframe, follow_up_date, whatsapp_conversation_type, whatsapp_conversation_status, whatsapp_queue, created_at, form_data"
      )
      .eq("id", opts.leadId)
      .eq("client_id", opts.clientId)
      .maybeSingle(),
    supabase.from("clients").select("id, name, industry").eq("id", opts.clientId).maybeSingle(),
    resolveClientSalesTimezone(opts.clientId),
  ]);
  if (!lead || !client) return null;

  const contactId = (lead.contact_id as string | null) ?? null;
  const ownerId = (lead.assigned_to_id as string | null) ?? null;

  const [
    { data: messages },
    { count: messageCount },
    { data: owner },
    { data: contact },
    memory,
    qualificationFlow,
  ] = await Promise.all([
    supabase
      .from("whatsapp_messages")
      .select("id, direction, sender_source, body, created_at")
      .eq("lead_id", opts.leadId)
      .eq("client_id", opts.clientId)
      .order("created_at", { ascending: false })
      .limit(RECENT_MESSAGE_LIMIT),
    supabase
      .from("whatsapp_messages")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", opts.leadId)
      .eq("client_id", opts.clientId),
    ownerId
      ? supabase.from("users").select("id, name").eq("id", ownerId).maybeSingle()
      : Promise.resolve({ data: null }),
    contactId
      ? supabase.from("contacts").select("lifecycle").eq("id", contactId).maybeSingle()
      : Promise.resolve({ data: null }),
    loadCustomerMemory(opts.clientId, contactId),
    loadQualificationFlow(opts.clientId).catch(() => null),
  ]);

  // Deal + quotation + upcoming appointment.
  const dealId = (lead.active_deal_id as string | null) ?? null;
  const [{ data: deal }, { data: quotes }, { data: upcoming }] = await Promise.all([
    dealId
      ? supabase
          .from("deals")
          .select("id, name, stage, estimated_value")
          .eq("id", dealId)
          .eq("client_id", opts.clientId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("quotations")
      .select("id, quote_number, status, total, currency, valid_until")
      .eq("lead_id", opts.leadId)
      .eq("client_id", opts.clientId)
      .neq("status", "superseded")
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("call_logs")
      .select("callback_at, notes")
      .eq("lead_id", opts.leadId)
      .gte("callback_at", new Date().toISOString())
      .not("callback_at", "is", null)
      .order("callback_at", { ascending: true })
      .limit(1),
  ]);

  const recent = (messages ?? [])
    .slice()
    .reverse()
    .map((m) => ({
      direction: m.direction as "inbound" | "outbound",
      senderSource: (m.sender_source as string) ?? "CUSTOMER",
      body: ((m.body as string) ?? "").slice(0, MESSAGE_CHAR_LIMIT),
      at: m.created_at as string,
    }));
  const latestMessageId = messages?.length ? (messages[0].id as string) : null;
  const totalCount = messageCount ?? recent.length;

  // Company-configured qualification schema first, core fields as fallback.
  const leadRecord = lead as Record<string, unknown>;
  const formData = (lead.form_data as Record<string, unknown> | null) ?? {};
  const fields: AgentQualificationField[] = [];
  const seen = new Set<string>();
  if (qualificationFlow?.questions?.length) {
    for (const question of qualificationFlow.questions) {
      const key = String(question.maps_to || question.id);
      if (seen.has(key)) continue;
      seen.add(key);
      const columnValue = leadRecord[key];
      const formValue = formData[key] ?? formData[question.label];
      fields.push({
        field: key,
        label: question.label,
        currentValue:
          (typeof columnValue === "string" && columnValue.trim()) ||
          (typeof formValue === "string" && formValue.trim()) ||
          null,
      });
    }
  }
  for (const core of CORE_QUALIFICATION_FIELDS) {
    if (seen.has(core.field)) continue;
    seen.add(core.field);
    const value = leadRecord[core.column];
    fields.push({
      field: core.field,
      label: core.label,
      currentValue: typeof value === "string" && value.trim() ? value : null,
    });
  }
  const missing = fields.filter((f) => !f.currentValue).map((f) => f.field);

  const quote = quotes?.[0] ?? null;
  const appointment = upcoming?.[0]
    ? {
        at: upcoming[0].callback_at as string,
        label: formatLocalDateTime(upcoming[0].callback_at as string, timezone),
      }
    : null;

  const isNewLead =
    Date.now() - new Date(lead.created_at as string).getTime() < 10 * 60 * 1000 &&
    totalCount <= 3;

  return {
    company: {
      name: client.name as string,
      industry: (client.industry as string | null) ?? null,
      timezone,
    },
    customer: {
      name: (lead.name as string | null) ?? null,
      phone: (lead.phone as string | null) ?? null,
      isNewLead,
      lifecycle: (contact?.lifecycle as string | null) ?? null,
    },
    conversation: {
      leadId: opts.leadId,
      type: (lead.whatsapp_conversation_type as string) ?? "SALES",
      workflowStatus: (lead.whatsapp_conversation_status as string) ?? "OPEN",
      messageCount: totalCount,
      recentMessages: recent,
      olderMessagesNote:
        totalCount > RECENT_MESSAGE_LIMIT
          ? `${totalCount - RECENT_MESSAGE_LIMIT} earlier messages are not shown; structured memory and qualification below carry the durable facts.`
          : null,
      latestMessageId,
    },
    lead: {
      id: lead.id as string,
      status: lead.status as string,
      source: lead.source as string,
      ownerId,
      ownerName: (owner?.name as string | null) ?? null,
      followUpDate: (lead.follow_up_date as string | null) ?? null,
    },
    qualification: { fields, missing },
    deal: deal
      ? {
          id: deal.id as string,
          name: deal.name as string,
          stage: deal.stage as string,
          estimatedValue: deal.estimated_value == null ? null : Number(deal.estimated_value),
        }
      : null,
    quotation: quote
      ? {
          id: quote.id as string,
          number: (quote.quote_number as string) ?? "",
          status: quote.status as string,
          total: Number(quote.total) || 0,
          currency: (quote.currency as string) || "USD",
          validUntil: (quote.valid_until as string | null) ?? null,
        }
      : null,
    upcomingAppointment: appointment,
    memory: memoryForContext(memory),
    rawMemory: memory,
    contactId,
    settings: opts.settings,
  };
}
