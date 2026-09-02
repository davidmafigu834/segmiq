/**
 * NextBestActionService — deterministic Deal next-action evaluation.
 *
 * Deal Stage ≠ Next Best Action.
 * Prefer canonical deals.next_action_* / follow-ups / appointments / quotes.
 */

import { getDealAttentionState } from "@/lib/sales/deals/attention";
import { getDealNextActionState } from "@/lib/sales/deals/timeline";
import { reasonText } from "@/lib/sales/intelligence/reasons";
import type { DealRow } from "@/types";
import { priorityClassForAttention, suggestedActionFromAttention } from "./priority";
import type { DealNextBestAction, NextBestActionType } from "./types";

export type NextBestActionInput = {
  deal: Pick<
    DealRow,
    | "id"
    | "stage"
    | "next_action_at"
    | "next_action_label"
    | "expected_decision_at"
    | "last_meaningful_activity_at"
    | "updated_at"
    | "value_status"
    | "originating_lead_id"
  >;
  /** Explicit intentional wait — suppresses inactivity until date. */
  waitUntil?: string | null;
  waitReason?: string | null;
  openQuote?: {
    id: string;
    status: string;
    sentAt?: string | null;
    validUntil?: string | null;
    approvalStatus?: string | null;
    customerResponded?: boolean;
  } | null;
  awaitingReplyMinutes?: number | null;
  hasFutureAppointment?: boolean;
  now?: Date;
};

/**
 * Evaluate the best next action for a Deal from canonical state.
 * Returns NO_ACTION_REQUIRED / WAIT_UNTIL when intentional waiting applies.
 */
export function evaluateDealNextBestAction(input: NextBestActionInput): DealNextBestAction {
  const now = input.now ?? new Date();
  const deal = input.deal;
  const leadId = deal.originating_lead_id;

  if (deal.stage === "WON" || deal.stage === "LOST") {
    return {
      actionType: "NO_ACTION_REQUIRED",
      reasonCode: "CLOSED_DEAL",
      dueAt: null,
      waitUntil: null,
      title: "No action required",
      summary: "This Deal is closed.",
      sourceConversationId: null,
      sourceQuotationId: null,
      sourceTaskId: null,
      dealId: deal.id,
      leadId,
      priorityClass: "WATCH",
    };
  }

  const dealWaitUntil =
    input.waitUntil ??
    (typeof (deal as { wait_until?: string | null }).wait_until === "string"
      ? (deal as { wait_until?: string | null }).wait_until
      : null);
  const dealWaitReason =
    input.waitReason ??
    (typeof (deal as { wait_reason?: string | null }).wait_reason === "string"
      ? (deal as { wait_reason?: string | null }).wait_reason
      : null);

  if (dealWaitUntil) {
    const until = Date.parse(dealWaitUntil);
    if (Number.isFinite(until) && until > now.getTime()) {
      return {
        actionType: "WAIT_UNTIL",
        reasonCode: "WAIT_UNTIL_DATE",
        dueAt: dealWaitUntil,
        waitUntil: dealWaitUntil,
        title: "Wait until scheduled date",
        summary:
          dealWaitReason?.trim() ||
          `Intentionally waiting until ${new Date(dealWaitUntil).toLocaleDateString()}.`,
        sourceConversationId: leadId,
        sourceQuotationId: null,
        sourceTaskId: null,
        dealId: deal.id,
        leadId,
        priorityClass: "WATCH",
      };
    }
  }

  if (input.awaitingReplyMinutes != null && input.awaitingReplyMinutes >= 0) {
    return {
      actionType: "REPLY_TO_CUSTOMER",
      reasonCode: "CUSTOMER_UNANSWERED",
      dueAt: null,
      waitUntil: null,
      title: "Reply to customer",
      summary: reasonText("CUSTOMER_WAITING", {
        ageLabel:
          input.awaitingReplyMinutes < 60
            ? `${input.awaitingReplyMinutes} minutes`
            : `${Math.floor(input.awaitingReplyMinutes / 60)} hours`,
      }),
      sourceConversationId: leadId,
      sourceQuotationId: null,
      sourceTaskId: null,
      dealId: deal.id,
      leadId,
      priorityClass: "IMMEDIATE",
    };
  }

  const quote = input.openQuote;
  if (quote?.approvalStatus === "pending" || quote?.approvalStatus === "required") {
    return {
      actionType: "REQUEST_APPROVAL",
      reasonCode: "QUOTE_APPROVAL_NEEDED",
      dueAt: null,
      waitUntil: null,
      title: "Request commercial approval",
      summary: reasonText("QUOTE_APPROVAL_NEEDED"),
      sourceConversationId: leadId,
      sourceQuotationId: quote.id,
      sourceTaskId: null,
      dealId: deal.id,
      leadId,
      priorityClass: "TODAY",
    };
  }

  if (quote?.customerResponded) {
    return {
      actionType: "REVISE_QUOTATION",
      reasonCode: "QUOTE_CUSTOMER_CHANGES",
      dueAt: null,
      waitUntil: null,
      title: "Revise quotation",
      summary: reasonText("QUOTE_CUSTOMER_CHANGES"),
      sourceConversationId: leadId,
      sourceQuotationId: quote.id,
      sourceTaskId: null,
      dealId: deal.id,
      leadId,
      priorityClass: "TODAY",
    };
  }

  const next = getDealNextActionState(deal);
  if (next.hasNextAction && next.at) {
    const actionType: NextBestActionType =
      input.hasFutureAppointment || /appoint|visit|site|call/i.test(next.label ?? "")
        ? input.hasFutureAppointment
          ? "COMPLETE_APPOINTMENT"
          : "CALL_CUSTOMER"
        : "FOLLOW_UP";
    return {
      actionType,
      reasonCode: next.isOverdue ? "FOLLOWUP_OVERDUE" : "FOLLOWUP_DUE_TODAY",
      dueAt: next.at,
      waitUntil: null,
      title: next.label?.trim() || (next.isOverdue ? "Overdue follow-up" : "Follow up"),
      summary: next.isOverdue
        ? reasonText("FOLLOWUP_OVERDUE")
        : next.label?.trim() || reasonText("FOLLOWUP_DUE_TODAY"),
      sourceConversationId: leadId,
      sourceQuotationId: quote?.id ?? null,
      sourceTaskId: null,
      dealId: deal.id,
      leadId,
      priorityClass: next.isOverdue ? "IMMEDIATE" : "TODAY",
    };
  }

  if (input.hasFutureAppointment) {
    return {
      actionType: "COMPLETE_APPOINTMENT",
      reasonCode: "SCHEDULED_TODAY",
      dueAt: null,
      waitUntil: null,
      title: "Complete scheduled appointment",
      summary: reasonText("SCHEDULED_TODAY"),
      sourceConversationId: leadId,
      sourceQuotationId: null,
      sourceTaskId: null,
      dealId: deal.id,
      leadId,
      priorityClass: "TODAY",
    };
  }

  // No canonical future task / appointment / wait → no next action
  const attention = getDealAttentionState(deal, now);
  if (attention.code === "DEAL_STALE") {
    return {
      actionType: suggestedActionFromAttention("DEAL_INACTIVE"),
      reasonCode: "NO_MEANINGFUL_ACTIVITY",
      dueAt: null,
      waitUntil: null,
      title: "Re-engage inactive Deal",
      summary: attention.reason || reasonText("DEAL_STALE"),
      sourceConversationId: leadId,
      sourceQuotationId: quote?.id ?? null,
      sourceTaskId: null,
      dealId: deal.id,
      leadId,
      priorityClass: priorityClassForAttention("DEAL_INACTIVE"),
    };
  }

  return {
    actionType: "CREATE_TASK",
    reasonCode: "NO_NEXT_ACTION",
    dueAt: null,
    waitUntil: null,
    title: "Schedule next action",
    summary: reasonText("NO_NEXT_ACTION"),
    sourceConversationId: leadId,
    sourceQuotationId: quote?.id ?? null,
    sourceTaskId: null,
    dealId: deal.id,
    leadId,
    priorityClass: "NEEDS_PROGRESS",
  };
}
