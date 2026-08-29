/**
 * Deterministic agent priority queue. No ML. Why-labels are required.
 */

import type { RePipelineStage } from "@/lib/real-estate/pipeline";

export type PriorityReasonId =
  | "new_uncontacted"
  | "overdue_follow_up"
  | "viewing_today"
  | "viewing_awaiting_follow_up"
  | "qualified_no_match"
  | "stale_inquiry";

export type PriorityCandidateInput = {
  id: string;
  name: string;
  dealSide: string | null;
  stage: RePipelineStage;
  assignedToId: string | null;
  createdAt: string;
  followUpAt: string | null;
  lastActivityAt: string | null;
  hasUpcomingViewingToday?: boolean;
  viewingCompletedYesterday?: boolean;
  hasPropertyMatch?: boolean;
};

export type PriorityItem = {
  id: string;
  name: string;
  dealSide: string | null;
  stage: RePipelineStage;
  reasonId: PriorityReasonId;
  why: string;
  nextLabel: string;
  actionId: "open" | "find_matches" | "follow_up" | "contact";
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysBetween(fromIso: string, now: Date): number {
  const from = startOfDay(new Date(fromIso));
  const to = startOfDay(now);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export function derivePriorityItem(
  input: PriorityCandidateInput,
  now: Date = new Date()
): PriorityItem | null {
  if (input.hasUpcomingViewingToday) {
    return {
      id: input.id,
      name: input.name,
      dealSide: input.dealSide,
      stage: input.stage,
      reasonId: "viewing_today",
      why: "Viewing happening today",
      nextLabel: "Open viewing",
      actionId: "open",
    };
  }

  if (input.viewingCompletedYesterday) {
    return {
      id: input.id,
      name: input.name,
      dealSide: input.dealSide,
      stage: input.stage,
      reasonId: "viewing_awaiting_follow_up",
      why: "Viewing completed yesterday",
      nextLabel: "Record follow-up",
      actionId: "follow_up",
    };
  }

  if (input.followUpAt) {
    const due = new Date(input.followUpAt);
    if (!Number.isNaN(due.getTime()) && due.getTime() <= now.getTime()) {
      const overdueDays = daysBetween(input.followUpAt, now);
      return {
        id: input.id,
        name: input.name,
        dealSide: input.dealSide,
        stage: input.stage,
        reasonId: "overdue_follow_up",
        why: overdueDays <= 0 ? "Follow-up due today" : `Overdue by ${overdueDays} day${overdueDays === 1 ? "" : "s"}`,
        nextLabel: "Complete follow-up",
        actionId: "follow_up",
      };
    }
  }

  if (input.stage === "new_inquiry") {
    return {
      id: input.id,
      name: input.name,
      dealSide: input.dealSide,
      stage: input.stage,
      reasonId: "new_uncontacted",
      why: "New inquiry not yet contacted",
      nextLabel: "Contact client",
      actionId: "contact",
    };
  }

  if (input.stage === "qualified" && !input.hasPropertyMatch) {
    return {
      id: input.id,
      name: input.name,
      dealSide: input.dealSide,
      stage: input.stage,
      reasonId: "qualified_no_match",
      why: "Qualified but no property matched",
      nextLabel: "Find property",
      actionId: "find_matches",
    };
  }

  const staleFrom = input.lastActivityAt || input.createdAt;
  if (
    !["won", "lost", "not_qualified"].includes(input.stage) &&
    daysBetween(staleFrom, now) >= 5
  ) {
    return {
      id: input.id,
      name: input.name,
      dealSide: input.dealSide,
      stage: input.stage,
      reasonId: "stale_inquiry",
      why: "Stale active inquiry",
      nextLabel: "Follow up",
      actionId: "open",
    };
  }

  return null;
}

const REASON_RANK: Record<PriorityReasonId, number> = {
  viewing_today: 0,
  viewing_awaiting_follow_up: 1,
  overdue_follow_up: 2,
  new_uncontacted: 3,
  qualified_no_match: 4,
  stale_inquiry: 5,
};

export function rankPriorityItems(items: PriorityItem[]): PriorityItem[] {
  return [...items].sort((a, b) => REASON_RANK[a.reasonId] - REASON_RANK[b.reasonId]);
}
