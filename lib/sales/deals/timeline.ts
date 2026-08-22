/**
 * Combined Deal timeline: originating lead history + deal events + quote events.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { quotationEventLabel } from "@/lib/quotations/events";
import type { QuotationRow } from "@/types";

export type DealTimelineItem = {
  id: string;
  at: string;
  label: string;
  detail: string | null;
  eventType: string;
  source: "lead" | "deal" | "quote";
};

function humanEventLabel(eventType: string, data: Record<string, unknown> | null): string {
  switch (eventType) {
    case "LEAD_CREATED":
      return "Lead captured";
    case "LEAD_ASSIGNED":
    case "LEAD_REASSIGNED":
      return "Lead assigned";
    case "STATUS_CHANGED": {
      const to = data?.to_status as string | undefined;
      if (to === "CONTACTED") return "Customer contacted";
      if (to === "QUALIFIED") return "Lead qualified";
      if (to === "CONVERTED_TO_DEAL") return "Converted to deal";
      if (to === "NOT_QUALIFIED") return "Marked not qualified";
      return "Status updated";
    }
    case "CALL_LOGGED":
      return "Call logged";
    case "NOTE_ADDED":
      return "Note added";
    case "DOCUMENT_SENT":
      return "Document sent";
    case "FOLLOW_UP_SET":
      return "Follow-up scheduled";
    case "FOLLOW_UP_COMPLETED":
      return "Follow-up completed";
    case "DEAL_CREATED":
      return "Deal created";
    case "DEAL_MIGRATED":
      return "Deal migrated from pipeline";
    case "DEAL_STAGE_CHANGED": {
      const to = data?.to_stage as string | undefined;
      if (to === "SCOPING") return "Stage moved to Scoping";
      if (to === "PROPOSAL_SENT") return "Stage moved to Proposal sent";
      if (to === "NEGOTIATING") return "Stage moved to Negotiating";
      if (to === "QUALIFIED") return "Stage moved to Qualified";
      return "Stage updated";
    }
    case "DEAL_WON":
      return "Deal won";
    case "DEAL_LOST":
      return "Deal lost";
    case "DEAL_VALUE_CHANGED":
      return "Estimated value updated";
    case "DEAL_UPDATED":
      return "Deal updated";
    case "QUOTE_CREATED":
      return "Quote created";
    case "QUOTE_SENT":
      return "Quote sent";
    default:
      return eventType
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export async function getDealTimeline(opts: {
  dealId: string;
  originatingLeadId: string;
  limit?: number;
}): Promise<DealTimelineItem[]> {
  const supabase = createAdminClient();
  const limit = opts.limit ?? 80;

  const [{ data: events }, { data: quotes }, { data: quoteEvents }] = await Promise.all([
    supabase
      .from("lead_events")
      .select("id, created_at, event_type, event_data, deal_id")
      .eq("lead_id", opts.originatingLeadId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("quotations")
      .select("id, quote_number, status, total, created_at, sent_at, viewed_at, accepted_at, responded_at, deal_id")
      .or(`deal_id.eq.${opts.dealId},and(lead_id.eq.${opts.originatingLeadId},deal_id.is.null)`)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("quotation_events")
      .select("id, created_at, event_type, event_data, quotation_id")
      .or(`deal_id.eq.${opts.dealId},lead_id.eq.${opts.originatingLeadId}`)
      .in("event_type", [
        "SENT",
        "VIEWED",
        "CUSTOMER_SELECTED_OPTION",
        "CUSTOMER_REQUESTED_CHANGES",
        "CUSTOMER_ASKED_QUESTION",
        "ACCEPTED",
        "DECLINED",
        "APPROVED",
        "CHANGES_REQUESTED",
      ])
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  const items: DealTimelineItem[] = [];

  for (const ev of events ?? []) {
    const data = (ev.event_data ?? {}) as Record<string, unknown>;
    const isDeal = Boolean(ev.deal_id) || String(ev.event_type).startsWith("DEAL_");
    items.push({
      id: `evt-${ev.id}`,
      at: ev.created_at as string,
      label: humanEventLabel(String(ev.event_type), data),
      detail: null,
      eventType: String(ev.event_type),
      source: isDeal ? "deal" : "lead",
    });
  }

  for (const q of (quotes ?? []) as Pick<
    QuotationRow,
    | "id"
    | "quote_number"
    | "status"
    | "total"
    | "created_at"
    | "sent_at"
    | "viewed_at"
    | "accepted_at"
    | "responded_at"
  >[]) {
    items.push({
      id: `quote-created-${q.id}`,
      at: q.created_at,
      label: "Quote created",
      detail: q.quote_number ? `${q.quote_number}` : null,
      eventType: "QUOTE_CREATED",
      source: "quote",
    });
    const hasCanonicalEvents = (quoteEvents ?? []).length > 0;
    if (hasCanonicalEvents) continue;
    if (q.sent_at) {
      items.push({
        id: `quote-sent-${q.id}`,
        at: q.sent_at,
        label: "Quote sent",
        detail: q.quote_number ? `${q.quote_number}` : null,
        eventType: "QUOTE_SENT",
        source: "quote",
      });
    }
    if (q.viewed_at) {
      items.push({
        id: `quote-viewed-${q.id}`,
        at: q.viewed_at,
        label: "Quotation viewed",
        detail: q.quote_number ? `${q.quote_number}` : null,
        eventType: "QUOTE_VIEWED",
        source: "quote",
      });
    }
    if (q.status === "accepted" && q.accepted_at) {
      items.push({
        id: `quote-accepted-${q.id}`,
        at: q.accepted_at,
        label: "Quotation accepted",
        detail: q.quote_number ? `${q.quote_number} · ${q.total}` : String(q.total),
        eventType: "QUOTE_ACCEPTED",
        source: "quote",
      });
    }
    if (q.status === "rejected" && q.responded_at) {
      items.push({
        id: `quote-declined-${q.id}`,
        at: q.responded_at,
        label: "Quotation declined",
        detail: q.quote_number,
        eventType: "QUOTE_DECLINED",
        source: "quote",
      });
    }
  }

  for (const ev of quoteEvents ?? []) {
    items.push({
      id: `qevt-${ev.id}`,
      at: ev.created_at as string,
      label: quotationEventLabel(String(ev.event_type)),
      detail: null,
      eventType: String(ev.event_type),
      source: "quote",
    });
  }

  items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return items.slice(0, limit);
}

export function getDealNextActionState(deal: {
  stage: string;
  next_action_at: string | null;
  next_action_label: string | null;
}): {
  hasNextAction: boolean;
  isOverdue: boolean;
  label: string | null;
  at: string | null;
  emptyMessage: string;
} {
  if (deal.stage === "WON" || deal.stage === "LOST") {
    return {
      hasNextAction: false,
      isOverdue: false,
      label: null,
      at: null,
      emptyMessage: "This deal is closed.",
    };
  }
  if (!deal.next_action_at) {
    return {
      hasNextAction: false,
      isOverdue: false,
      label: null,
      at: null,
      emptyMessage:
        "This active Deal does not have another action scheduled.",
    };
  }
  const due = Date.parse(deal.next_action_at);
  const overdue = Number.isFinite(due) && due < Date.now();
  return {
    hasNextAction: true,
    isOverdue: overdue,
    label: deal.next_action_label,
    at: deal.next_action_at,
    emptyMessage: "",
  };
}
