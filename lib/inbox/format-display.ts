import { differenceInCalendarDays, format, isToday, isYesterday, parseISO } from "date-fns";
import type { InboxConversation } from "./types";
import { formatAwaitingReply, formatDealValue, isFollowUpDue } from "./queue-filters";
import { SCORE_HOT_MIN, SCORE_WARM_MIN, STAGE_LABELS } from "./scoring";
import { formatDealStage } from "@/lib/sales/deals/display";

const MEANINGLESS_VALUES = new Set([
  "other",
  "n/a",
  "na",
  "none",
  "unknown",
  "-",
  "—",
  "--",
  "null",
  "undefined",
]);

function normalizeMetaToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isMeaninglessMeta(value: string): boolean {
  const n = normalizeMetaToken(value);
  if (!n || MEANINGLESS_VALUES.has(n)) return true;
  if (n.startsWith("other (")) return true;
  if (n === "other (not trade/service)") return true;
  return false;
}

/** Join meta segments, omitting null/empty/duplicate/meaningless values. */
export function formatLeadMeta(parts: Array<string | null | undefined>): string {
  const cleaned: string[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    if (typeof part !== "string") continue;
    const trimmed = part.trim();
    if (!trimmed || isMeaninglessMeta(trimmed)) continue;
    const key = normalizeMetaToken(trimmed);
    if (seen.has(key)) continue;
    // Skip if this token is already contained in a kept token (or vice versa)
    const redundant = cleaned.some((kept) => {
      const k = normalizeMetaToken(kept);
      return k.includes(key) || key.includes(k);
    });
    if (redundant) continue;
    seen.add(key);
    cleaned.push(trimmed);
  }

  return cleaned.join(" · ");
}

export function formatPipelineStage(status: string): string {
  return STAGE_LABELS[status] ?? status.replace(/_/g, " ");
}

export function formatQuoteStatus(status: string | null | undefined): string | null {
  if (!status) return null;
  const map: Record<string, string> = {
    draft: "Draft",
    sent: "Sent",
    viewed: "Viewed",
    accepted: "Accepted",
    declined: "Declined",
    expired: "Expired",
  };
  return map[status.toLowerCase()] ?? status.replace(/_/g, " ");
}

export function formatCurrencyAmount(
  value: number | null | undefined,
  currency = "USD"
): string | null {
  if (value == null || Number.isNaN(value) || value <= 0) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$${Math.round(value).toLocaleString()}`;
  }
}

export function formatFollowUpDate(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null;
  try {
    return format(new Date(`${isoDate}T12:00:00`), "MMM d, yyyy");
  } catch {
    return null;
  }
}

/** List-row timestamp: clock for today, Yesterday / date otherwise. */
export function formatRelativeMessageTime(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = parseISO(iso);
    if (isToday(d)) return format(d, "h:mm a");
    if (isYesterday(d)) return "Yesterday";
    return format(d, "MMM d");
  } catch {
    return "";
  }
}

export function formatScoreLabel(score: number | null | undefined): "Hot" | "Warm" | "Cold" | null {
  if (score == null || Number.isNaN(score)) return null;
  if (score >= SCORE_HOT_MIN) return "Hot";
  if (score >= SCORE_WARM_MIN) return "Warm";
  return "Cold";
}

export function getScoreTone(label: "Hot" | "Warm" | "Cold" | null): {
  text: string;
  bg: string;
  border: string;
  dot: string;
  bar: string;
} {
  if (label === "Hot") {
    return { text: "#DC2626", bg: "#FEE2E2", border: "#FECACA", dot: "#EF4444", bar: "#D4FF4F" };
  }
  if (label === "Warm") {
    return { text: "#C2410C", bg: "#FFF4E5", border: "#FED7AA", dot: "#F97316", bar: "#F59E0B" };
  }
  if (label === "Cold") {
    return { text: "#64748B", bg: "#F1F5F9", border: "#E2E8F0", dot: "#94A3B8", bar: "#94A3B8" };
  }
  return { text: "#98A2B3", bg: "#F2F4F7", border: "#E4E7EC", dot: "#98A2B3", bar: "#D0D5DD" };
}

export type WaitingTone = "muted" | "amber" | "orange" | "red";

export function getWaitingTone(minutes: number | null | undefined): WaitingTone | null {
  if (minutes == null || minutes < 1) return null;
  if (minutes < 15) return "muted";
  if (minutes < 60) return "amber";
  if (minutes < 60 * 24) return "orange";
  return "red";
}

export function waitingToneClass(tone: WaitingTone | null): string {
  if (tone === "muted") return "text-sales-text-muted";
  if (tone === "amber") return "text-sales-warning-fg";
  if (tone === "orange") return "text-sales-warning";
  if (tone === "red") return "text-sales-danger";
  return "text-sales-text-muted";
}

export function conversationMetaLine(
  conversation: InboxConversation,
  currentRepName: string
): string {
  const dealLabel = formatDealValue(conversation.dealValue, conversation.dealCurrency ?? "USD");
  const assigneeName = conversation.assignee?.name ?? null;
  const assigneePart =
    !assigneeName
      ? "Unassigned"
      : assigneeName === currentRepName || assigneeName.trim().toLowerCase() === currentRepName.trim().toLowerCase()
        ? "You"
        : assigneeName;

  if (conversation.activeDealId) {
    return formatLeadMeta([
      conversation.projectType,
      conversation.dealStage ? formatDealStage(conversation.dealStage) : null,
      dealLabel,
      assigneePart,
    ]);
  }

  return formatLeadMeta([
    conversation.projectType,
    conversation.leadBudget,
    conversation.company,
    conversation.sourceLabel !== "WhatsApp" ? conversation.sourceLabel : null,
    assigneePart,
  ]);
}

export function hasMeaningfulScore(
  score: number | null | undefined,
  breakdown?: InboxConversation["breakdown"] | null
): boolean {
  if (score == null || Number.isNaN(score)) return false;
  if (score > 0) return true;
  if (!breakdown) return false;
  return (
    breakdown.urgency > 0 ||
    breakdown.budget > 0 ||
    breakdown.location > 0 ||
    breakdown.productInterest > 0 ||
    breakdown.engagement > 0
  );
}

export function scoreInsightLine(
  score: number,
  breakdown: InboxConversation["breakdown"]
): string | null {
  const label = formatScoreLabel(score);
  if (!label) return null;
  const strongBudget = breakdown.budget >= 15;
  const strongUrgency = breakdown.urgency >= 15;
  const weak =
    breakdown.budget <= 5 &&
    breakdown.urgency <= 5 &&
    breakdown.location <= 0 &&
    breakdown.productInterest <= 5;

  if (label === "Hot" && (strongBudget || strongUrgency)) {
    return "High intent · strong budget and urgency signals";
  }
  if (label === "Hot") return "High intent · strong engagement";
  if (label === "Warm" && strongBudget) return "Warm intent · budget signals present";
  if (label === "Cold" && weak) return "Low intent · limited qualification data";
  if (label === "Cold") return "Low intent · keep nurturing";
  return null;
}

export type SalesSignal = {
  id: string;
  title: string;
  detail: string;
  tone: "danger" | "warning" | "info" | "success" | "neutral";
  action?: "claim" | "reply" | "follow_up" | "quote" | "none";
};

/** Deterministic next-action cue from existing conversation fields only. */
export function getSalesSignal(
  conversation: InboxConversation,
  options?: { currentUserId?: string }
): SalesSignal | null {
  const waiting = formatAwaitingReply(conversation.awaitingReplyMinutes);
  const followUpOverdue = isFollowUpDue(conversation);
  const followUpLabel = formatFollowUpDate(conversation.followUpDate);
  const quoteStatus = (conversation.latestQuoteStatus || "").toLowerCase();
  const unassigned = !conversation.assignedToId;

  if (unassigned) {
    return {
      id: "unassigned",
      title: "Unassigned lead",
      detail: "Claim to start selling",
      tone: "info",
      action: "claim",
    };
  }

  if (conversation.lastMessageDirection === "inbound" && waiting) {
    return {
      id: "needs_reply",
      title: `Needs reply · customer waiting ${waiting.replace(/ waiting$/, "")}`,
      detail: "Customer is waiting for a reply",
      tone: getWaitingTone(conversation.awaitingReplyMinutes) === "red" ? "danger" : "warning",
      action: "reply",
    };
  }

  if (followUpOverdue && conversation.followUpDate) {
    const days = differenceInCalendarDays(new Date(), new Date(`${conversation.followUpDate}T12:00:00`));
    return {
      id: "follow_up_overdue",
      title: days <= 0 ? "Follow-up due today" : `Follow-up overdue by ${days} day${days === 1 ? "" : "s"}`,
      detail: followUpLabel ? `Was due ${followUpLabel}` : "Reschedule or complete the follow-up",
      tone: "danger",
      action: "follow_up",
    };
  }

  if (conversation.followUpDate && followUpLabel && !followUpOverdue) {
    const days = differenceInCalendarDays(new Date(`${conversation.followUpDate}T12:00:00`), new Date());
    if (days === 0) {
      return {
        id: "follow_up_today",
        title: "Follow-up due today",
        detail: followUpLabel,
        tone: "warning",
        action: "follow_up",
      };
    }
  }

  if (quoteStatus && quoteStatus !== "draft") {
    return {
      id: "quote_sent",
      title: `Quote ${formatQuoteStatus(quoteStatus) ?? "sent"}`,
      detail: conversation.latestQuoteNumber
        ? `#${conversation.latestQuoteNumber} · awaiting customer response`
        : "Awaiting customer response",
      tone: "info",
      action: "quote",
    };
  }

  if (conversation.score >= SCORE_HOT_MIN) {
    return {
      id: "hot",
      title: `Hot lead · score ${conversation.score}`,
      detail: "Prioritise this conversation",
      tone: "success",
      action: "reply",
    };
  }

  if (options?.currentUserId && conversation.assignedToId === options.currentUserId) {
    return null;
  }

  return null;
}

export function followUpContextLine(followUpDate: string | null | undefined): string | null {
  if (!followUpDate) return null;
  try {
    const due = new Date(`${followUpDate}T12:00:00`);
    const days = differenceInCalendarDays(due, new Date());
    if (days < 0) return `Follow-up overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`;
    if (days === 0) return "Due today";
    return `Scheduled in ${days} day${days === 1 ? "" : "s"}`;
  } catch {
    return null;
  }
}

export type ConversationSort =
  | "priority"
  | "newest"
  | "longest_waiting"
  | "highest_score"
  | "follow_up_due";

export const CONVERSATION_SORT_LABELS: Record<ConversationSort, string> = {
  priority: "Priority",
  newest: "Newest message",
  longest_waiting: "Longest waiting",
  highest_score: "Highest score",
  follow_up_due: "Follow-up due",
};

export function sortConversationsClient(
  rows: InboxConversation[],
  sort: ConversationSort
): InboxConversation[] {
  const sorted = [...rows];
  switch (sort) {
    case "longest_waiting":
      return sorted.sort((a, b) => (b.awaitingReplyMinutes ?? 0) - (a.awaitingReplyMinutes ?? 0));
    case "highest_score":
      return sorted.sort((a, b) => b.score - a.score || (b.dealValue ?? 0) - (a.dealValue ?? 0));
    case "follow_up_due":
      return sorted.sort((a, b) => {
        const ad = a.followUpDate ? new Date(a.followUpDate).getTime() : Infinity;
        const bd = b.followUpDate ? new Date(b.followUpDate).getTime() : Infinity;
        return ad - bd;
      });
    case "priority":
      return sorted.sort((a, b) => {
        const score = (c: InboxConversation) => {
          let s = 0;
          if (c.lastMessageDirection === "inbound") s += 40;
          if ((c.awaitingReplyMinutes ?? 0) > 60) s += 20;
          if (c.score >= SCORE_HOT_MIN) s += 25;
          if (isFollowUpDue(c)) s += 30;
          if (c.unread > 0) s += 10;
          return s;
        };
        return score(b) - score(a) || new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      });
    case "newest":
    default:
      return sorted.sort(
        (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );
  }
}
