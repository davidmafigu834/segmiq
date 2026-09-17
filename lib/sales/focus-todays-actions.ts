/**
 * Maps daily-plan SalesActionRecommendation → dashboard "What should I focus on today?" rows.
 * Ranking stays in the plan engine; this only shapes display + primary CTA choice.
 */

import type {
  AvailableContactAction,
  FocusMode,
  SalesActionRecommendation,
  SalesActionReasonCode,
  SalesActionType,
} from "@/lib/sales/intelligence/types";
import { formatDealValue } from "@/lib/sales/sales-dashboard-display";
import type {
  SalesDealAttentionItem,
  SalesEnquiryPriorityItem,
} from "@/components/dashboard/sales/types";

export type FocusPriorityTier = "URGENT" | "HIGH" | "NORMAL";

export type FocusPrimaryCtaKind =
  | "whatsapp"
  | "call"
  | "open"
  | "create_quote"
  | "add_prospect"
  | "schedule";

export type FocusPrimaryCta = {
  kind: FocusPrimaryCtaKind;
  label: string;
  href: string | null;
};

export type FocusActionRow = {
  id: string;
  rank: number;
  priority: FocusPriorityTier;
  customerName: string;
  opportunityLabel: string | null;
  reason: string;
  signal: string | null;
  valueLabel: string | null;
  commercialState: string | null;
  href: string;
  phone: string | null;
  leadId: string | null;
  dealId: string | null;
  primary: FocusPrimaryCta;
  availableActions: AvailableContactAction[];
  recommendation: SalesActionRecommendation | null;
};

const URGENT_REASONS = new Set<SalesActionReasonCode>([
  "CUSTOMER_WAITING",
  "FOLLOWUP_OVERDUE",
  "QUOTE_EXPIRING",
  "QUOTE_CUSTOMER_CHANGES",
]);

const HIGH_REASONS = new Set<SalesActionReasonCode>([
  "FOLLOWUP_DUE_TODAY",
  "HIGH_INTENT_NEW_LEAD",
  "QUOTE_WAITING",
  "QUOTE_VIEWED",
  "QUOTE_APPROVAL_NEEDED",
  "DEAL_STALE",
  "LATE_STAGE_NEEDS_ACTION",
  "NO_NEXT_ACTION",
  "SCHEDULED_TODAY",
  "MANAGER_ASSIGNED",
]);

export function focusModeEmphasisLabel(mode: FocusMode): string {
  if (mode === "BUILD") return "Today's emphasis: Build pipeline";
  if (mode === "CLOSE") return "Today's emphasis: Close opportunities";
  return "Today's emphasis: Move deals";
}

export function entityHref(rec: SalesActionRecommendation): string {
  const dealId =
    (typeof rec.metadata?.dealId === "string" && rec.metadata.dealId) ||
    (rec.sourceEntityType === "deal" ? rec.sourceEntityId : null);
  if (dealId) return `/sales/deals/${dealId}`;
  const id = rec.customer?.leadId ?? rec.sourceEntityId;
  if (!id) return "/sales/leads";
  const source = String(rec.customer?.source ?? "");
  if (source.toUpperCase().includes("WHATSAPP")) return `/sales/inbox?lead=${id}`;
  return `/sales/leads?lead=${id}`;
}

export function resolvePriority(rec: SalesActionRecommendation): FocusPriorityTier {
  if (URGENT_REASONS.has(rec.reasonCode) || rec.attentionScore >= 75) return "URGENT";
  if (rec.metadata?.isAtRisk === true) return "URGENT";
  if (HIGH_REASONS.has(rec.reasonCode) || rec.attentionScore >= 50) return "HIGH";
  if (rec.customer?.scoreBand === "Hot") return "HIGH";
  return "NORMAL";
}

function commercialStateFrom(rec: SalesActionRecommendation): string | null {
  const subtitle = rec.subtitle?.trim();
  if (subtitle && !/^(waiting for reply|contacted|new|qualified)$/i.test(subtitle)) {
    if (
      /proposal|quotation|negotiat|qualified|new enquiry|customer waiting|needs quote|follow-up/i.test(
        subtitle
      )
    ) {
      return subtitle;
    }
  }

  switch (rec.actionType) {
    case "CONTACT_NEW_LEAD":
      return "New enquiry";
    case "RESPOND_TO_CUSTOMER":
      return "Customer waiting";
    case "FOLLOW_UP_QUOTE":
      return "Quotation sent";
    case "FOLLOW_UP_NEGOTIATION":
      return "In negotiation";
    case "CREATE_QUOTE":
      return "Needs quotation";
    case "REENGAGE_STALE_DEAL":
      return "Needs re-engagement";
    case "COMPLETE_FOLLOW_UP":
      return "Follow-up due";
    case "COMPLETE_SCHEDULED_CALL":
      return "Call scheduled";
    case "COMPLETE_APPOINTMENT":
      return "Appointment";
    case "SCHEDULE_NEXT_ACTION":
      return "Needs next action";
    case "PROSPECT_NEW_CUSTOMERS":
    case "ADD_VALID_PROSPECT":
      return "Prospecting";
    default:
      break;
  }

  const status = String(rec.customer?.status ?? "");
  if (status === "NEW") return "New enquiry";
  if (status === "CONTACTED") return "Contacted";
  if (status === "QUALIFIED") return "Qualified";
  if (status === "PROPOSAL_SENT") return "Proposal sent";
  if (status === "NEGOTIATING") return "In negotiation";
  return null;
}

function opportunityLabel(rec: SalesActionRecommendation): string | null {
  const project = rec.customer?.projectType?.trim();
  if (project) return project;
  const subtitle = rec.subtitle?.trim();
  if (
    subtitle &&
    !/^(waiting for reply|contacted|new|qualified|new enquiry)$/i.test(subtitle) &&
    subtitle.length <= 72
  ) {
    return subtitle;
  }
  return null;
}

function pickPrimaryCta(rec: SalesActionRecommendation, href: string): FocusPrimaryCta {
  const actions = new Set(rec.availableActions);
  const phone = rec.customer?.phone;
  const type: SalesActionType = rec.actionType;

  if (actions.has("add_prospect") || type === "PROSPECT_NEW_CUSTOMERS" || type === "ADD_VALID_PROSPECT") {
    return { kind: "add_prospect", label: "Add prospect", href: null };
  }

  if (type === "CREATE_QUOTE" || actions.has("create_quote")) {
    const dealId = dealIdFrom(rec);
    return {
      kind: "create_quote",
      label: "Create quotation",
      href: dealId ? `/sales/quotes?dealId=${encodeURIComponent(dealId)}` : "/sales/quotes",
    };
  }

  if (
    (type === "RESPOND_TO_CUSTOMER" || type === "CONTACT_NEW_LEAD" || type === "FOLLOW_UP_QUOTE") &&
    actions.has("whatsapp") &&
    phone
  ) {
    return {
      kind: "whatsapp",
      label: type === "FOLLOW_UP_QUOTE" ? "Send follow-up" : "Send WhatsApp",
      href: null,
    };
  }

  if (
    (type === "COMPLETE_SCHEDULED_CALL" ||
      type === "REENGAGE_STALE_DEAL" ||
      type === "FOLLOW_UP_NEGOTIATION" ||
      type === "CONTACT_NEW_LEAD" ||
      type === "COMPLETE_FOLLOW_UP") &&
    actions.has("call") &&
    phone
  ) {
    return { kind: "call", label: "Call customer", href: null };
  }

  if (actions.has("whatsapp") && phone) {
    return { kind: "whatsapp", label: "Send WhatsApp", href: null };
  }

  if (actions.has("call") && phone) {
    return { kind: "call", label: "Call customer", href: null };
  }

  if (actions.has("schedule_follow_up") || type === "SCHEDULE_NEXT_ACTION") {
    return { kind: "schedule", label: "Schedule next step", href };
  }

  const label =
    rec.recommendedActionLabel?.trim() ||
    (rec.sourceEntityType === "deal" ? "Open deal" : "Open lead");

  return { kind: "open", label: shortenCtaLabel(label), href };
}

function shortenCtaLabel(label: string): string {
  if (label.length <= 22) return label;
  if (/follow up quotation/i.test(label)) return "Send follow-up";
  if (/follow up negotiation/i.test(label)) return "Follow up";
  if (/re-engage/i.test(label)) return "Re-engage";
  if (/contact new/i.test(label)) return "Contact now";
  if (/reply/i.test(label)) return "Reply";
  return `${label.slice(0, 20).trimEnd()}…`;
}

function dealIdFrom(rec: SalesActionRecommendation): string | null {
  if (typeof rec.metadata?.dealId === "string" && rec.metadata.dealId) return rec.metadata.dealId;
  if (rec.sourceEntityType === "deal" && rec.sourceEntityId) return rec.sourceEntityId;
  return null;
}

function rowFromRecommendation(rec: SalesActionRecommendation, rank: number): FocusActionRow {
  const href = entityHref(rec);
  const value =
    rec.customer?.dealValue != null && Number.isFinite(rec.customer.dealValue)
      ? formatDealValue(rec.customer.dealValue)
      : null;

  return {
    id: rec.idempotencyKey || rec.id,
    rank,
    priority: resolvePriority(rec),
    customerName: rec.customer?.name?.trim() || rec.title,
    opportunityLabel: opportunityLabel(rec),
    reason: rec.reason?.trim() || rec.title,
    signal: rec.urgencyLabel?.trim() || null,
    valueLabel: value && value !== "Value not set" ? value : null,
    commercialState: commercialStateFrom(rec),
    href,
    phone: rec.customer?.phone ?? null,
    leadId: rec.customer?.leadId ?? null,
    dealId: dealIdFrom(rec),
    primary: pickPrimaryCta(rec, href),
    availableActions: rec.availableActions,
    recommendation: rec,
  };
}

function enquiryFallbackPriority(item: SalesEnquiryPriorityItem): FocusPriorityTier {
  if (/waiting|overdue/i.test(item.reason) || /overdue/i.test(item.receivedLabel)) return "URGENT";
  if (item.intent === "Hot") return "HIGH";
  return "HIGH";
}

function dealFallbackPriority(item: SalesDealAttentionItem): FocusPriorityTier {
  if (item.atRisk || item.reasonCode === "FOLLOWUP_OVERDUE" || item.reasonCode === "DEAL_STALE") {
    return "URGENT";
  }
  if (URGENT_REASONS.has(item.reasonCode)) return "URGENT";
  if (HIGH_REASONS.has(item.reasonCode) || item.urgency >= 50) return "HIGH";
  return "NORMAL";
}

function primaryFromEnquiry(item: SalesEnquiryPriorityItem): FocusPrimaryCta {
  const actions = new Set(item.availableActions);
  if (actions.has("whatsapp") && item.phone) {
    return { kind: "whatsapp", label: "Send WhatsApp", href: null };
  }
  if (actions.has("call") && item.phone) {
    return { kind: "call", label: "Call customer", href: null };
  }
  return { kind: "open", label: "Open lead", href: item.href };
}

function primaryFromDeal(item: SalesDealAttentionItem): FocusPrimaryCta {
  return { kind: "open", label: "Open deal", href: item.href };
}

/**
 * Prefer ranked plan queue. If empty (plan error / cold start), merge dashboard
 * priority enquiries + deals so the focus section still shows real work.
 */
export function buildFocusActionRows(
  queue: SalesActionRecommendation[],
  opts?: {
    limit?: number;
    fallbackEnquiries?: SalesEnquiryPriorityItem[];
    fallbackDeals?: SalesDealAttentionItem[];
  }
): FocusActionRow[] {
  const limit = opts?.limit ?? 6;
  const rows: FocusActionRow[] = [];

  for (const rec of queue) {
    rows.push(rowFromRecommendation(rec, rows.length + 1));
    if (rows.length >= limit) return rows;
  }

  if (rows.length > 0) return rows;

  for (const item of opts?.fallbackEnquiries ?? []) {
    rows.push({
      id: item.id,
      rank: rows.length + 1,
      priority: enquiryFallbackPriority(item),
      customerName: item.name,
      opportunityLabel: item.projectType,
      reason: item.reason,
      signal: item.receivedLabel || null,
      valueLabel: null,
      commercialState: item.intent ? `${item.intent} enquiry` : "New enquiry",
      href: item.href,
      phone: item.phone,
      leadId: item.leadId,
      dealId: null,
      primary: primaryFromEnquiry(item),
      availableActions: item.availableActions,
      recommendation: null,
    });
    if (rows.length >= limit) return rows;
  }

  for (const item of opts?.fallbackDeals ?? []) {
    rows.push({
      id: item.id,
      rank: rows.length + 1,
      priority: dealFallbackPriority(item),
      customerName: item.customerName,
      opportunityLabel: item.name,
      reason: item.attentionReason,
      signal: item.nextActionWhen || (item.noNextAction ? "No next action" : item.nextActionLabel),
      valueLabel:
        item.valueLabel && !/not estimated/i.test(item.valueLabel) ? item.valueLabel : null,
      commercialState: item.stageLabel,
      href: item.href,
      phone: null,
      leadId: null,
      dealId: item.dealId,
      primary: primaryFromDeal(item),
      availableActions: ["open_lead"],
      recommendation: null,
    });
    if (rows.length >= limit) return rows;
  }

  return rows;
}
