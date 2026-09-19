/**
 * For You ranking: sales importance, not newest-first.
 */

import { SCORE_HOT_MIN } from "@/lib/inbox/scoring";
import type { SocialInboxViewId, SocialQueueItem } from "./types";
import { primaryQueueLabel } from "./scoring";

function minutesSince(iso: string | null): number {
  if (!iso) return 99999;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 99999;
  return Math.max(0, (Date.now() - t) / 60000);
}

export function rankScoreForYou(item: SocialQueueItem, viewerId: string): number {
  let score = item.intentScore;
  if (item.unread) score += 14;
  if (item.assignedToId === viewerId) score += 10;
  if (!item.assignedToId) score += 6;
  if (item.crmState === "open_deal") score += 12;
  if (item.crmState === "existing_customer") score += 6;
  if (item.followUpLabel?.toLowerCase().includes("overdue")) score += 16;
  else if (item.followUpLabel) score += 10;
  const waiting = minutesSince(item.lastMessageAt);
  if (item.unread && waiting > 180) score += 8;
  if (waiting < 30) score += 4;
  if (item.conversationKind === "comment" && item.intentScore >= SCORE_HOT_MIN) score += 4;
  return score;
}

export function decorateQueueItem(item: SocialQueueItem, viewerId: string): SocialQueueItem {
  const rankScore = rankScoreForYou(item, viewerId);
  return {
    ...item,
    rankScore,
    primaryLabel: primaryQueueLabel(item),
  };
}

export function sortQueue(items: SocialQueueItem[], view: SocialInboxViewId, viewerId: string): SocialQueueItem[] {
  const decorated = items.map((item) => decorateQueueItem(item, viewerId));
  decorated.sort((a, b) => {
    if (view === "for_you" || view === "hot" || view === "needs_reply") {
      if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
    }
    const tb = Date.parse(b.lastMessageAt ?? "") || 0;
    const ta = Date.parse(a.lastMessageAt ?? "") || 0;
    return tb - ta;
  });
  return decorated;
}

export function matchesView(item: SocialQueueItem, view: SocialInboxViewId): boolean {
  switch (view) {
    case "for_you":
      if (item.crmState === "converted" && !item.unread) return false;
      if (item.intentBand === "cold" && item.crmState === "none" && !item.followUpLabel && !item.unread) {
        return false;
      }
      return true;
    case "hot":
      return item.intentBand === "hot";
    case "needs_reply":
      return item.unread;
    case "follow_up":
      return Boolean(item.followUpLabel);
    case "dms":
      return item.conversationKind === "dm";
    case "comments":
      return item.conversationKind === "comment";
    case "converted":
      return item.crmState === "converted";
    case "unassigned":
      return !item.assignedToId;
    default:
      return true;
  }
}

export function computeIndicators(items: SocialQueueItem[]): {
  highIntent: number;
  awaitingReply: number;
  followUpsDue: number;
  openDealsNeedingAttention: number;
} {
  return {
    highIntent: items.filter((i) => i.intentBand === "hot").length,
    awaitingReply: items.filter((i) => i.unread).length,
    followUpsDue: items.filter((i) => Boolean(i.followUpLabel)).length,
    openDealsNeedingAttention: items.filter((i) => i.crmState === "open_deal" && (i.unread || i.followUpLabel)).length,
  };
}
