/** Sales goals — types shared by API + UI. */

export type SalesGoalType = "REVENUE_WON" | "DEALS_WON" | "LEADS_CONVERTED";
export type SalesGoalPeriodType = "MONTHLY";
export type SalesGoalStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";

export type SalesGoalRow = {
  id: string;
  client_id: string;
  salesperson_id: string;
  goal_type: SalesGoalType;
  target_value: number;
  currency: string;
  period_type: SalesGoalPeriodType;
  period_start: string; // yyyy-MM-dd
  period_end: string; // yyyy-MM-dd
  status: SalesGoalStatus;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
};

export type GoalLifecycle =
  | "upcoming"
  | "active"
  | "completed_success"
  | "completed_shortfall"
  | "no_goal";

export type GoalMilestoneStatus = "achieved" | "in_progress" | "pending";

export type GoalMilestone = {
  pct: 25 | 50 | 75 | 100;
  amount: number;
  status: GoalMilestoneStatus;
  crossedAt: string | null;
};

export type GoalProgressPoint = {
  dateKey: string;
  label: string;
  cumulative: number;
  dayRevenue: number;
  dealsWon: number;
};

export type GoalSourceContribution = {
  key: string;
  label: string;
  value: number;
  pct: number;
  dealsWon: number;
};

export type GoalWeeklyComparison = {
  week: number;
  label: string;
  thisMonth: number;
  lastMonth: number;
};

export type GoalRecentDeal = {
  id: string;
  leadId: string | null;
  wonAt: string;
  amount: number;
  sourceKey: string;
  sourceLabel: string;
  customerName: string;
  project: string | null;
};

export type GoalRecommendation = {
  id: string;
  text: string;
  href?: string;
};

export type SalesGoalPeriodOption = {
  value: string; // yyyy-MM
  label: string;
  hasGoal: boolean;
};

export type SalesGoalsPayload = {
  currency: string;
  periodKey: string; // yyyy-MM
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  lifecycle: GoalLifecycle;
  goal: {
    id: string;
    goalType: SalesGoalType;
    goalTypeLabel: string;
    periodType: SalesGoalPeriodType;
    periodTypeLabel: string;
    target: number;
    status: SalesGoalStatus;
    periodStart: string;
    periodEnd: string;
    editable: boolean;
  } | null;
  progress: {
    achieved: number;
    remaining: number;
    shortfall: number;
    aboveTarget: number;
    progressPct: number; // may exceed 100
    ringPct: number; // clamped 0–100
    dealsWon: number;
  };
  series: GoalProgressPoint[];
  sources: GoalSourceContribution[];
  comparison: {
    thisMonth: number;
    lastMonth: number;
    trend: { direction: "up" | "down" | "flat" | "new" | "none"; label: string };
    weeks: GoalWeeklyComparison[];
  };
  milestones: GoalMilestone[];
  recentDeals: GoalRecentDeal[];
  recommendations: GoalRecommendation[];
  periodOptions: SalesGoalPeriodOption[];
  currentPerformance: {
    revenueWon: number;
    dealsWon: number;
    pipelineValue: number;
  };
  workingDaysLeft: number | null;
  daysLeftLabel: string | null;
  schedule: {
    weekdayLabel: string;
    dateLabel: string;
    isWorkingDay: boolean;
    workingDaysLabel: string;
    workStartLabel: string;
    workEndLabel: string;
    summary: string;
  } | null;
  dailyFocus: {
    yesterdayMissed: boolean;
    yesterdayLabel: string | null;
    missedStreak: number;
    headline: string | null;
    supporting: string | null;
  } | null;
};
