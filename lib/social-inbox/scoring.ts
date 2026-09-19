/**
 * Social opportunity scoring — compatible with inbox Hot ≥70 / Warm ≥45.
 * Score is explainable via reasons, never a black box.
 */

import { SCORE_HOT_MIN, SCORE_WARM_MIN, scoreLabel } from "@/lib/inbox/scoring";
import type { IntentClassification, SocialIntentBand, SocialQueueItem } from "./types";

export { SCORE_HOT_MIN, SCORE_WARM_MIN, scoreLabel };

export function bandFromScore(score: number): SocialIntentBand {
  if (score >= SCORE_HOT_MIN) return "hot";
  if (score >= SCORE_WARM_MIN) return "warm";
  return "cold";
}

export function opportunityScoreFromClassification(
  classification: IntentClassification,
  extras?: {
    unansweredMinutes?: number;
    existingHighValueCustomer?: boolean;
    openDeal?: boolean;
    assignedToViewer?: boolean;
    overdueFollowUp?: boolean;
  }
): number {
  let score = classification.score;
  const waiting = extras?.unansweredMinutes ?? 0;
  if (waiting > 12 * 60) score += 8;
  else if (waiting > 60) score += 4;
  if (extras?.existingHighValueCustomer) score += 6;
  if (extras?.openDeal) score += 8;
  if (extras?.overdueFollowUp) score += 10;
  if (extras?.assignedToViewer) score += 2;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function primaryQueueLabel(item: Pick<
  SocialQueueItem,
  "intentBand" | "unread" | "followUpLabel" | "crmState" | "conversationKind"
>): string | null {
  if (item.followUpLabel?.toLowerCase().includes("overdue")) return "Follow up overdue";
  if (item.followUpLabel) return "Follow up today";
  if (item.intentBand === "hot") return "Hot";
  if (item.unread) return "Needs reply";
  if (item.crmState === "open_deal") return "Open deal";
  if (item.crmState === "existing_customer") return "Existing customer";
  if (item.crmState === "converted") return "Converted";
  if (item.conversationKind === "comment" && item.intentBand === "warm") return "New social opportunity";
  return null;
}

export function explainScore(reasons: string[]): string {
  if (!reasons.length) return "Ranked from recent conversation activity.";
  if (reasons.length === 1) return `High intent because: ${reasons[0]}.`;
  return `High intent because: ${reasons.slice(0, 3).join(", ")}.`;
}
