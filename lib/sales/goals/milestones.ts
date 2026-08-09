import type { GoalMilestone, GoalMilestoneStatus, GoalProgressPoint } from "./types";

const MILESTONE_PCTS = [25, 50, 75, 100] as const;

export function buildMilestones(
  target: number,
  achieved: number,
  series: GoalProgressPoint[]
): GoalMilestone[] {
  if (!(target > 0)) return [];

  let firstIncomplete = true;
  return MILESTONE_PCTS.map((pct) => {
    const amount = Math.round((target * pct) / 100);
    const crossedAt = firstDateCrossing(series, amount);
    let status: GoalMilestoneStatus;
    if (achieved >= amount) {
      status = "achieved";
    } else if (firstIncomplete) {
      status = "in_progress";
      firstIncomplete = false;
    } else {
      status = "pending";
      firstIncomplete = false;
    }
    return { pct, amount, status, crossedAt };
  });
}

function firstDateCrossing(series: GoalProgressPoint[], amount: number): string | null {
  for (const pt of series) {
    if (pt.cumulative >= amount) return pt.dateKey;
  }
  return null;
}
