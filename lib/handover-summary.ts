import { createAdminClient } from "@/lib/supabase/admin";

export type HandoverSummary = {
  leadName: string;
  phone: string | null;
  source: string;
  daysActive: number;
  currentStatus: string;
  totalCalls: number;
  lastCallOutcome?: string;
  lastCallNotes?: string;
  nextFollowUp?: string;
  assetsSent: string[];
  previousSalesperson?: string;
  handoverNotes?: string;
};

const STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  NEGOTIATING: "Negotiating",
  PROPOSAL_SENT: "Proposal sent",
  WON: "Won",
  LOST: "Lost",
  NOT_QUALIFIED: "Not qualified",
};

const SOURCE_LABELS: Record<string, string> = {
  LANDING_PAGE: "Profile page",
  FACEBOOK: "Facebook",
  MANUAL: "Manual entry",
  REFERRAL: "Referral",
};

export async function generateHandoverSummary(
  leadId: string
): Promise<HandoverSummary | null> {
  const supabase = createAdminClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("id, name, phone, source, status, follow_up_date, created_at, client_id")
    .eq("id", leadId)
    .single();

  if (!lead) return null;

  const daysActive = Math.round(
    (Date.now() - new Date(lead.created_at as string).getTime()) / (1000 * 60 * 60 * 24)
  );

  const { data: callLogs } = await supabase
    .from("call_logs")
    .select("outcome, notes, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  const lastCall = callLogs?.[0] ?? null;

  const { data: events } = await supabase
    .from("lead_events")
    .select("event_type, event_data, actor_name, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  const eventList = events ?? [];

  const lastReassignment = eventList.find((e) => e.event_type === "LEAD_REASSIGNED");
  const handoverNotes =
    ((lastReassignment?.event_data as Record<string, unknown> | null)?.handover_notes as
      | string
      | undefined) ?? undefined;
  const previousSalesperson =
    ((lastReassignment?.event_data as Record<string, unknown> | null)?.from_name as
      | string
      | undefined) ?? undefined;

  const documentEvents = eventList.filter((e) => e.event_type === "DOCUMENT_SENT");
  const assetsSent = documentEvents.map((e) => {
    const data = (e.event_data as Record<string, unknown> | null) ?? {};
    const type = data.document_type as string | undefined;
    const name = data.document_name as string | undefined;
    const typeLabels: Record<string, string> = {
      PORTFOLIO: "Portfolio",
      PROJECT: `Project: ${name ?? ""}`,
      PRICING_PACKAGE: `Pricing: ${name ?? ""}`,
      TESTIMONIALS: "Testimonials",
      DOCUMENT: `Document: ${name ?? ""}`,
      CUSTOM_MESSAGE: "Custom message",
    };
    return (type ? typeLabels[type] : undefined) ?? name ?? type ?? "Asset";
  });

  return {
    leadName: (lead.name as string | null) ?? "Unknown",
    phone: (lead.phone as string | null) ?? null,
    source: SOURCE_LABELS[lead.source as string] ?? (lead.source as string) ?? "Unknown",
    daysActive,
    currentStatus: STATUS_LABELS[lead.status as string] ?? (lead.status as string) ?? "Unknown",
    totalCalls: callLogs?.length ?? 0,
    lastCallOutcome: (lastCall?.outcome as string | undefined) ?? undefined,
    lastCallNotes: (lastCall?.notes as string | null | undefined) ?? undefined,
    nextFollowUp: (lead.follow_up_date as string | null | undefined) ?? undefined,
    assetsSent,
    previousSalesperson,
    handoverNotes,
  };
}
