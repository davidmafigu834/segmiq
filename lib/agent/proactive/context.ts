import { createAdminClient } from "@/lib/supabase/admin";
import { getConversationAgentState } from "@/lib/agent/conversation-state";
import { getSafeWhatsAppConnection } from "@/lib/whatsapp/connections";
import { now } from "@/lib/clock";
import type { ProactiveJob } from "./types";
import type {
  AppointmentSnapshot,
  ChannelSnapshot,
  ContactSnapshot,
  ConversationSnapshot,
  DealSnapshot,
  LeadSnapshot,
  QuotationSnapshot,
  RateLimitSnapshot,
  SupportSnapshot,
} from "./policy";

export type EvaluationContext = {
  job: ProactiveJob;
  lead: LeadSnapshot;
  contact: ContactSnapshot;
  conversation: ConversationSnapshot;
  channel: ChannelSnapshot;
  support: SupportSnapshot;
  rateLimits: RateLimitSnapshot;
  quotation: QuotationSnapshot | null;
  deal: DealSnapshot | null;
  appointment: AppointmentSnapshot | null;
  upcomingAppointmentAt: string | null;
  customerRepliedAfterQuoteSend: boolean;
  humanContactedAfterQuoteSend: boolean;
  timezone: string;
  workingDays: number[];
  customerFirstName: string;
  ownerId: string | null;
  projectHint: string | null;
};

export async function loadEvaluationContext(job: ProactiveJob): Promise<EvaluationContext | null> {
  if (!job.leadId) return null;
  const supabase = createAdminClient();
  const { data: leadRow } = await supabase
    .from("leads")
    .select(
      "id, client_id, name, contact_id, assigned_to_id, follow_up_date, follow_up_source, active_deal_id, project_type, whatsapp_conversation_type"
    )
    .eq("id", job.leadId)
    .eq("client_id", job.clientId)
    .maybeSingle();
  if (!leadRow) return null;

  const contactId = (job.contactId ?? (leadRow.contact_id as string | null)) || null;
  const [
    state,
    contactRow,
    prefs,
    quoteRow,
    dealRow,
    apptRow,
    upcomingAppt,
    openSupport,
    connection,
    customerToday,
    conversationHour,
    companyHour,
    afterSend,
  ] = await Promise.all([
    getConversationAgentState(job.clientId, job.leadId),
    contactId
      ? supabase
          .from("contacts")
          .select("id, name, do_not_contact")
          .eq("id", contactId)
          .eq("client_id", job.clientId)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
    contactId
      ? supabase
          .from("contact_communication_prefs")
          .select("suppressed")
          .eq("contact_id", contactId)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
    job.quotationId
      ? supabase
          .from("quotations")
          .select(
            "id, status, approval_status, revision_number, superseded_by_id, sent_at, valid_until, quote_number, customer_name, deal_id, view_count"
          )
          .eq("id", job.quotationId)
          .eq("client_id", job.clientId)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
    (job.dealId ?? (leadRow.active_deal_id as string | null))
      ? supabase
          .from("deals")
          .select("id, stage, last_meaningful_activity_at, next_action_at, next_action_label")
          .eq("id", job.dealId ?? (leadRow.active_deal_id as string))
          .eq("client_id", job.clientId)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
    job.appointmentId
      ? supabase
          .from("call_logs")
          .select("id, callback_at, notes")
          .eq("id", job.appointmentId)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
    supabase
      .from("call_logs")
      .select("callback_at")
      .eq("lead_id", job.leadId)
      .gt("callback_at", now().toISOString())
      .not("callback_at", "is", null)
      .order("callback_at", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then((r) => r.data),
    supabase
      .from("support_cases")
      .select("id, reason_category, status")
      .eq("lead_id", job.leadId)
      .in("status", ["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER"])
      .limit(5)
      .then((r) => r.data ?? []),
    getSafeWhatsAppConnection(job.clientId),
    countProactiveSends(job.clientId, { leadId: job.leadId, sinceHours: 24 }),
    countProactiveSends(job.clientId, { leadId: job.leadId, sinceHours: 1 }),
    countProactiveSends(job.clientId, { sinceHours: 1 }),
    quoteSentActivity(job),
  ]);

  const name = (contactRow?.name as string | null) ?? (leadRow.name as string | null) ?? "";
  const conversation: ConversationSnapshot = {
    agentEnabled: state?.agentEnabled ?? true,
    status: state?.status ?? "IDLE",
    humanTakeover: state?.humanTakeover ?? false,
    pausedUntil: state?.pausedUntil ?? null,
    lastCustomerMessageAt: state?.lastCustomerMessageAt ?? null,
    lastHumanMessageAt: state?.lastHumanMessageAt ?? null,
    lastAgentMessageAt: state?.lastAgentMessageAt ?? null,
    conversationType: ((leadRow.whatsapp_conversation_type as string) || "SALES") as
      | "SALES"
      | "SUPPORT"
      | "GENERAL",
  };

  return {
    job,
    lead: {
      id: leadRow.id as string,
      followUpDate: (leadRow.follow_up_date as string | null) ?? null,
      followUpSource: (leadRow.follow_up_source as string | null) ?? null,
      ownerId: (leadRow.assigned_to_id as string | null) ?? null,
      whatsappConversationType: (leadRow.whatsapp_conversation_type as string | null) ?? null,
    },
    contact: {
      id: contactId,
      name,
      doNotContact: Boolean(contactRow?.do_not_contact),
      marketingSuppressed: Boolean(prefs?.suppressed),
    },
    conversation,
    channel: {
      connected: Boolean(connection.connected),
      status: connection.status,
    },
    support: {
      openCase: openSupport.length > 0,
      openHighPriority: openSupport.some((c) =>
        ["TECHNICAL", "INSTALLATION", "WARRANTY"].includes(String(c.reason_category))
      ),
    },
    rateLimits: {
      customerMessagesToday: customerToday,
      conversationMessagesThisHour: conversationHour,
      companyMessagesThisHour: companyHour,
    },
    quotation: quoteRow
      ? {
          id: quoteRow.id as string,
          status: quoteRow.status as string,
          approvalStatus: (quoteRow.approval_status as string | null) ?? null,
          revisionNumber: Number(quoteRow.revision_number) || 1,
          supersededById: (quoteRow.superseded_by_id as string | null) ?? null,
          sentAt: (quoteRow.sent_at as string | null) ?? null,
          validUntil: (quoteRow.valid_until as string | null) ?? null,
          quoteNumber: (quoteRow.quote_number as string | null) ?? null,
          customerName: (quoteRow.customer_name as string | null) ?? null,
          dealId: (quoteRow.deal_id as string | null) ?? null,
          viewCount: Number(quoteRow.view_count) || 0,
        }
      : null,
    deal: dealRow
      ? {
          id: dealRow.id as string,
          stage: dealRow.stage as string,
          lastMeaningfulActivityAt: (dealRow.last_meaningful_activity_at as string | null) ?? null,
          nextActionAt: (dealRow.next_action_at as string | null) ?? null,
          nextActionLabel: (dealRow.next_action_label as string | null) ?? null,
        }
      : null,
    appointment: apptRow
      ? {
          id: apptRow.id as string,
          callbackAt: apptRow.callback_at as string,
          purpose: extractPurpose(apptRow.notes as string | null),
        }
      : null,
    upcomingAppointmentAt: (upcomingAppt?.callback_at as string | null) ?? null,
    customerRepliedAfterQuoteSend: afterSend.customer,
    humanContactedAfterQuoteSend: afterSend.human,
    timezone: "Africa/Harare",
    workingDays: [1, 2, 3, 4, 5],
    customerFirstName: (name.split(" ")[0] || "there").trim(),
    ownerId: (leadRow.assigned_to_id as string | null) ?? null,
    projectHint: (leadRow.project_type as string | null) ?? null,
  };
}

async function countProactiveSends(
  clientId: string,
  opts: { leadId?: string; sinceHours: number }
): Promise<number> {
  const supabase = createAdminClient();
  const since = new Date(now().getTime() - opts.sinceHours * 3600_000).toISOString();
  let q = supabase
    .from("agent_proactive_jobs")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("status", "COMPLETED")
    .eq("action_type", "CUSTOMER_MESSAGE")
    .gte("executed_at", since);
  if (opts.leadId) q = q.eq("lead_id", opts.leadId);
  const { count } = await q;
  return count ?? 0;
}

async function quoteSentActivity(
  job: ProactiveJob
): Promise<{ customer: boolean; human: boolean }> {
  if (!job.quotationId || !job.leadId) return { customer: false, human: false };
  const supabase = createAdminClient();
  const { data: quote } = await supabase
    .from("quotations")
    .select("sent_at")
    .eq("id", job.quotationId)
    .maybeSingle();
  const sentAt = quote?.sent_at as string | null;
  if (!sentAt) return { customer: false, human: false };
  const [{ data: inbound }, { data: outbound }] = await Promise.all([
    supabase
      .from("whatsapp_messages")
      .select("id")
      .eq("lead_id", job.leadId)
      .eq("client_id", job.clientId)
      .eq("direction", "inbound")
      .gt("created_at", sentAt)
      .limit(1),
    supabase
      .from("whatsapp_messages")
      .select("id, sender_source")
      .eq("lead_id", job.leadId)
      .eq("client_id", job.clientId)
      .eq("direction", "outbound")
      .gt("created_at", sentAt)
      .limit(5),
  ]);
  const human = (outbound ?? []).some((m) => m.sender_source === "SEGMIQ_USER");
  return { customer: Boolean(inbound?.length), human };
}

function extractPurpose(notes: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/Scheduled by SegmiQ Agent — (.+)$/);
  if (match) return match[1];
  return notes.slice(0, 80);
}
