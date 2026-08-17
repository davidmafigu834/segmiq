import type { GoalRecommendation } from "./types";

export type RecommendationInput = {
  overdueFollowUps: number;
  pendingQuotes: number;
  highIntentUncontacted: number;
  staleHighValue: number;
  remaining: number;
  lifecycle: string;
  progressPct: number;
  daysLeftLabel?: string | null;
  dailyFocusHeadline?: string | null;
};

/** Deterministic tips from real sales state — never invent filler. */
export function buildGoalRecommendations(input: RecommendationInput): GoalRecommendation[] {
  const tips: GoalRecommendation[] = [];

  if (input.lifecycle === "upcoming") {
    return [
      {
        id: "upcoming",
        text: "Your goal starts next period. Keep pipeline warm so you hit the ground running.",
        href: "/sales/pipeline",
      },
    ];
  }

  if (input.lifecycle === "completed_success") {
    return [
      {
        id: "achieved",
        text: "Goal achieved. Review top sources and set next month's target while momentum is high.",
        href: "/sales/goals",
      },
    ];
  }

  if (input.dailyFocusHeadline) {
    tips.push({
      id: "daily_focus",
      text: input.dailyFocusHeadline,
      href: "/sales/tasks",
    });
  }

  if (input.overdueFollowUps > 0) {
    tips.push({
      id: "overdue",
      text: `Clear ${input.overdueFollowUps} overdue follow-up${input.overdueFollowUps === 1 ? "" : "s"}.`,
      href: "/sales/tasks",
    });
  }

  if (input.pendingQuotes > 0) {
    tips.push({
      id: "quotes",
      text: `Follow up with ${input.pendingQuotes} pending quote${input.pendingQuotes === 1 ? "" : "s"}.`,
      href: "/sales/quotes",
    });
  }

  if (input.highIntentUncontacted > 0) {
    tips.push({
      id: "hot",
      text: `Contact ${input.highIntentUncontacted} high-intent lead${input.highIntentUncontacted === 1 ? "" : "s"} waiting for outreach.`,
      href: "/sales/call-now",
    });
  }

  if (input.staleHighValue > 0) {
    tips.push({
      id: "stale",
      text: `Re-engage ${input.staleHighValue} stale high-value deal${input.staleHighValue === 1 ? "" : "s"}.`,
      href: "/sales/pipeline",
    });
  }

  if (tips.length === 0) {
    if (input.daysLeftLabel && input.remaining > 0) {
      tips.push({
        id: "days_left",
        text: `${input.daysLeftLabel} in this goal period. Keep moving open deals to Won.`,
        href: "/sales/pipeline",
      });
    } else if (input.remaining > 0 && input.progressPct > 0) {
      tips.push({
        id: "on_track",
        text: "You're on track. No urgent sales actions need attention right now.",
      });
    } else if (input.remaining > 0) {
      tips.push({
        id: "start",
        text: "Focus on moving open deals to Won — revenue updates your goal automatically.",
        href: "/sales/pipeline",
      });
    } else {
      tips.push({
        id: "done",
        text: "You're on track. No urgent sales actions need attention right now.",
      });
    }
  }

  return tips.slice(0, 4);
}
