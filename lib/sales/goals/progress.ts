import type { GoalLifecycle, GoalProgressPoint } from "./types";

export function calcProgress(achieved: number, target: number) {
  const safeTarget = Number.isFinite(target) && target > 0 ? target : 0;
  const safeAchieved = Number.isFinite(achieved) && achieved > 0 ? achieved : 0;
  if (safeTarget <= 0) {
    return {
      achieved: safeAchieved,
      remaining: 0,
      shortfall: 0,
      aboveTarget: 0,
      progressPct: 0,
      ringPct: 0,
    };
  }
  const progressPct = Math.round((safeAchieved / safeTarget) * 100);
  const remaining = Math.max(0, safeTarget - safeAchieved);
  const aboveTarget = Math.max(0, safeAchieved - safeTarget);
  const shortfall = Math.max(0, safeTarget - safeAchieved);
  return {
    achieved: safeAchieved,
    remaining,
    shortfall,
    aboveTarget,
    progressPct,
    ringPct: Math.min(100, progressPct),
  };
}

export function resolveLifecycle(opts: {
  hasGoal: boolean;
  periodKey: string;
  progressPct: number;
  isFuture: boolean;
  isEnded: boolean;
}): GoalLifecycle {
  if (!opts.hasGoal) return "no_goal";
  if (opts.isFuture) return "upcoming";
  if (opts.isEnded) {
    return opts.progressPct >= 100 ? "completed_success" : "completed_shortfall";
  }
  return opts.progressPct >= 100 ? "completed_success" : "active";
}

/** Build cumulative daily series across a month from win events. */
export function buildCumulativeSeries(
  wins: Array<{ created_at: string; deal_value: number | null }>,
  from: Date,
  toExclusive: Date
): GoalProgressPoint[] {
  const dayMap = new Map<string, { revenue: number; deals: number }>();
  for (const w of wins) {
    const d = new Date(w.created_at);
    if (d < from || d >= toExclusive) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const cur = dayMap.get(key) ?? { revenue: 0, deals: 0 };
    cur.revenue += Number(w.deal_value) || 0;
    cur.deals += 1;
    dayMap.set(key, cur);
  }

  const points: GoalProgressPoint[] = [];
  let cumulative = 0;
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(toExclusive.getFullYear(), toExclusive.getMonth(), toExclusive.getDate());
  while (cursor < end) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    const day = dayMap.get(key) ?? { revenue: 0, deals: 0 };
    cumulative += day.revenue;
    points.push({
      dateKey: key,
      label: cursor.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      cumulative,
      dayRevenue: day.revenue,
      dealsWon: day.deals,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return points;
}
