import { SCORE_HOT_MIN, SCORE_WARM_MIN } from "./scoring";
import type { InboxConversation, InboxFilter } from "./types";

export const INBOX_FILTER_LABELS: Record<InboxFilter, string> = {
  all: "All",
  open: "Open",
  new: "New",
  resolved: "Resolved",
  unread: "Unread",
  mine: "Mine",
  unassigned: "Unassigned",
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
  no_deal: "No Deal",
  deal_qualified: "Deal · Qualified",
  deal_scoping: "Deal · Scoping",
  deal_proposal_sent: "Deal · Proposal sent",
  deal_negotiating: "Deal · Negotiating",
  follow_up_due: "Follow-up due",
  awaiting_reply: "Needs reply",
  waiting_customer: "Waiting for customer",
  quotes_sent: "Quotes sent",
};

export const INBOX_FILTER_ORDER: InboxFilter[] = [
  "all",
  "mine",
  "unassigned",
  "hot",
  "awaiting_reply",
  "follow_up_due",
  "waiting_customer",
  "quotes_sent",
];

export const COMPANY_INBOX_FILTER_ORDER: InboxFilter[] = [
  "all",
  "open",
  "awaiting_reply",
  "resolved",
];

export function isFollowUpDue(c: InboxConversation, now = new Date()): boolean {
  if (!c.followUpDate) return false;
  const due = new Date(`${c.followUpDate}T23:59:59`);
  return due <= now;
}

export function isAwaitingReply(c: InboxConversation): boolean {
  return c.conversationStatus === "OPEN" && c.lastMessageDirection === "inbound";
}

export function isWaitingForCustomer(c: InboxConversation): boolean {
  return c.conversationStatus === "OPEN" && c.lastMessageDirection === "outbound";
}

export function hasQuoteSent(c: InboxConversation): boolean {
  return Boolean(c.latestQuoteStatus && c.latestQuoteStatus !== "draft");
}

export function matchesInboxFilter(
  c: InboxConversation,
  filter: InboxFilter,
  userId: string
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "open":
      return c.conversationStatus === "OPEN";
    case "new": {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return new Date(c.firstContactAt || c.createdAt).getTime() >= sevenDaysAgo;
    }
    case "resolved":
      return c.conversationStatus === "RESOLVED";
    case "unread":
      return c.unread > 0;
    case "mine":
      return c.assignedToId === userId;
    case "unassigned":
      return c.conversationStatus === "OPEN" && !c.assignedToId;
    case "hot":
      return c.score >= SCORE_HOT_MIN;
    case "warm":
      return c.score >= SCORE_WARM_MIN && c.score < SCORE_HOT_MIN;
    case "cold":
      return c.score < SCORE_WARM_MIN;
    case "no_deal":
      return !c.activeDealId;
    case "deal_qualified":
      return c.dealStage === "QUALIFIED";
    case "deal_scoping":
      return c.dealStage === "SCOPING";
    case "deal_proposal_sent":
      return c.dealStage === "PROPOSAL_SENT";
    case "deal_negotiating":
      return c.dealStage === "NEGOTIATING";
    case "follow_up_due":
      return isFollowUpDue(c);
    case "awaiting_reply":
      return isAwaitingReply(c);
    case "waiting_customer":
      return isWaitingForCustomer(c);
    case "quotes_sent":
      return hasQuoteSent(c);
    default:
      return true;
  }
}

export function countInboxFilters(
  rows: InboxConversation[],
  userId: string
): Record<InboxFilter, number> {
  const counts = {} as Record<InboxFilter, number>;
  const allFilters = Array.from(
    new Set<InboxFilter>([
      ...INBOX_FILTER_ORDER,
      ...COMPANY_INBOX_FILTER_ORDER,
      "new",
      "unread",
      "warm",
      "cold",
      "no_deal",
      "deal_qualified",
      "deal_scoping",
      "deal_proposal_sent",
      "deal_negotiating",
    ])
  );
  for (const key of allFilters) {
    counts[key] = rows.filter((c) => matchesInboxFilter(c, key, userId)).length;
  }
  return counts;
}

export function sortInboxConversations(
  rows: InboxConversation[],
  filter: InboxFilter
): InboxConversation[] {
  const sorted = [...rows];
  if (filter === "awaiting_reply") {
    sorted.sort((a, b) => (b.awaitingReplyMinutes ?? 0) - (a.awaitingReplyMinutes ?? 0));
    return sorted;
  }
  if (filter === "follow_up_due") {
    sorted.sort((a, b) => {
      const ad = a.followUpDate ? new Date(a.followUpDate).getTime() : Infinity;
      const bd = b.followUpDate ? new Date(b.followUpDate).getTime() : Infinity;
      return ad - bd;
    });
    return sorted;
  }
  if (filter === "hot") {
    sorted.sort((a, b) => b.score - a.score || (b.dealValue ?? 0) - (a.dealValue ?? 0));
    return sorted;
  }
  sorted.sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  );
  return sorted;
}

export function formatAwaitingReply(minutes: number | null): string | null {
  if (minutes == null || minutes < 1) return null;
  if (minutes < 60) return `${minutes}m waiting`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h waiting`;
  const days = Math.floor(hours / 24);
  return `${days}d waiting`;
}

export function formatDealValue(value: number | null, currency = "USD"): string | null {
  if (value == null || value <= 0) return null;
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
