import type { SalesActionRecommendation } from "@/lib/sales/intelligence/types";
import { isFollowUpDue } from "./queue-filters";
import type { InboxConversation } from "./types";
import type { QualificationAssistField } from "./qualification-assist";

export type NextBestActionKind =
  | "daily_plan"
  | "customer_waiting"
  | "follow_up_due"
  | "quote_follow_up"
  | "deal_next_action"
  | "qualification"
  | "none";

export type NextBestAction = {
  kind: NextBestActionKind;
  eyebrow: string;
  title: string;
  reason: string | null;
  dailyPlanIndex: number | null;
  dailyPlanTotal: number | null;
  dailyPlanKey: string | null;
  showCall: boolean;
  showSchedule: boolean;
  showViewQuote: boolean;
  showCompletePlan: boolean;
};

function relativeDaysAgo(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  const days = Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function resolveNextBestAction(input: {
  conversation: InboxConversation;
  dailyPlan?: SalesActionRecommendation[];
  qualification?: QualificationAssistField[];
}): NextBestAction {
  const { conversation, dailyPlan = [], qualification = [] } = input;
  const planQueue = dailyPlan.filter(
    (item) => item.customer?.leadId === conversation.id || item.sourceEntityId === conversation.id
  );
  const planItem = planQueue[0] ?? null;
  const planIndex = planItem
    ? dailyPlan.findIndex((item) => item.id === planItem.id)
    : -1;

  if (planItem) {
    return {
      kind: "daily_plan",
      eyebrow: `Today's plan · Action ${planIndex + 1} of ${dailyPlan.length}`,
      title: planItem.title,
      reason: planItem.reason || planItem.subtitle,
      dailyPlanIndex: planIndex + 1,
      dailyPlanTotal: dailyPlan.length,
      dailyPlanKey: planItem.idempotencyKey,
      showCall: planItem.availableActions.includes("call"),
      showSchedule: planItem.availableActions.includes("schedule_follow_up"),
      showViewQuote: Boolean(conversation.latestQuoteStatus && conversation.latestQuoteStatus !== "draft"),
      showCompletePlan: true,
    };
  }

  if (conversation.conversationType !== "SUPPORT" && conversation.lastMessageDirection === "inbound") {
    const waiting = conversation.awaitingReplyMinutes
      ? conversation.awaitingReplyMinutes < 60
        ? `${conversation.awaitingReplyMinutes}m waiting`
        : `${Math.floor(conversation.awaitingReplyMinutes / 60)}h waiting`
      : "Customer is waiting";
    return {
      kind: "customer_waiting",
      eyebrow: "Next best action",
      title: "Reply to customer",
      reason: waiting,
      dailyPlanIndex: null,
      dailyPlanTotal: null,
      dailyPlanKey: null,
      showCall: true,
      showSchedule: true,
      showViewQuote: Boolean(conversation.latestQuoteStatus && conversation.latestQuoteStatus !== "draft"),
      showCompletePlan: false,
    };
  }

  if (isFollowUpDue(conversation)) {
    return {
      kind: "follow_up_due",
      eyebrow: "Next best action",
      title: conversation.dealNextActionLabel || "Complete scheduled follow-up",
      reason: conversation.followUpDate ? `Follow-up due ${conversation.followUpDate}` : "Follow-up is due",
      dailyPlanIndex: null,
      dailyPlanTotal: null,
      dailyPlanKey: null,
      showCall: true,
      showSchedule: true,
      showViewQuote: Boolean(conversation.latestQuoteStatus && conversation.latestQuoteStatus !== "draft"),
      showCompletePlan: false,
    };
  }

  if (
    conversation.latestQuoteStatus &&
    conversation.latestQuoteStatus !== "draft" &&
    conversation.conversationType !== "SUPPORT"
  ) {
    const when = relativeDaysAgo(conversation.dealNextActionAt || conversation.lastMessageAt);
    return {
      kind: "quote_follow_up",
      eyebrow: "Next best action",
      title: "Follow up on quotation",
      reason: conversation.dealStage === "PROPOSAL_SENT" && when ? `Proposal sent ${when}` : "Quotation already sent",
      dailyPlanIndex: null,
      dailyPlanTotal: null,
      dailyPlanKey: null,
      showCall: true,
      showSchedule: true,
      showViewQuote: true,
      showCompletePlan: false,
    };
  }

  if (conversation.activeDealId && conversation.dealNextActionAt) {
    return {
      kind: "deal_next_action",
      eyebrow: "Next best action",
      title: conversation.dealNextActionLabel || "Complete next Deal action",
      reason: null,
      dailyPlanIndex: null,
      dailyPlanTotal: null,
      dailyPlanKey: null,
      showCall: true,
      showSchedule: true,
      showViewQuote: Boolean(conversation.latestQuoteStatus && conversation.latestQuoteStatus !== "draft"),
      showCompletePlan: false,
    };
  }

  const missing = qualification.find((field) => !field.filled);
  if (missing && conversation.conversationType !== "SUPPORT" && !conversation.activeDealId) {
    return {
      kind: "qualification",
      eyebrow: "Next best action",
      title: `Complete qualification · ${missing.label}`,
      reason: "Missing information needed before creating a Deal",
      dailyPlanIndex: null,
      dailyPlanTotal: null,
      dailyPlanKey: null,
      showCall: true,
      showSchedule: true,
      showViewQuote: false,
      showCompletePlan: false,
    };
  }

  return {
    kind: "none",
    eyebrow: "Next best action",
    title: "No next action scheduled",
    reason: null,
    dailyPlanIndex: null,
    dailyPlanTotal: null,
    dailyPlanKey: null,
    showCall: true,
    showSchedule: true,
    showViewQuote: Boolean(conversation.latestQuoteStatus && conversation.latestQuoteStatus !== "draft"),
    showCompletePlan: false,
  };
}
