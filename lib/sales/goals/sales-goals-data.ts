import { format, startOfWeek } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTrend } from "@/lib/sales/sales-dashboard-display";
import { sourceBucket } from "@/lib/sales/sales-reports-data";
import { buildMilestones } from "./milestones";
import {
  goalPeriodBounds,
  goalTypeLabel,
  isPeriodCurrent,
  isPeriodEnded,
  isPeriodInFuture,
  parseGoalPeriodKey,
  periodTypeLabel,
  previousPeriodKey,
} from "./period";
import { buildCumulativeSeries, calcProgress, resolveLifecycle } from "./progress";
import { buildGoalRecommendations } from "./recommendations";
import type {
  GoalRecentDeal,
  GoalSourceContribution,
  GoalWeeklyComparison,
  SalesGoalRow,
  SalesGoalsPayload,
} from "./types";

type WinRow = {
  id: string;
  deal_value: number | null;
  created_at: string;
  lead_id: string | null;
  source: string | null;
  leads:
    | { name: string | null; source?: string | null; project_type?: string | null }
    | { name: string | null; source?: string | null; project_type?: string | null }[]
    | null;
};

function leadFields(w: WinRow) {
  const lead = Array.isArray(w.leads) ? w.leads[0] : w.leads;
  return {
    name: lead?.name ?? "Unknown",
    source: lead?.source ?? w.source,
    project: lead?.project_type ?? null,
  };
}

async function fetchWins(
  salespersonId: string,
  from: Date,
  toExclusive: Date,
  clientId: string
): Promise<WinRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("win_analysis")
    .select("id, deal_value, created_at, lead_id, source, leads(name, source, project_type)")
    .eq("salesperson_id", salespersonId)
    .eq("client_id", clientId)
    .gte("created_at", from.toISOString())
    .lt("created_at", toExclusive.toISOString())
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as WinRow[];
}

function sumWins(wins: WinRow[]): number {
  return wins.reduce((s, w) => s + (Number(w.deal_value) || 0), 0);
}

function sourceContributions(wins: WinRow[]): GoalSourceContribution[] {
  const achieved = sumWins(wins);
  const map = new Map<string, { label: string; value: number; deals: number }>();
  for (const w of wins) {
    const { source } = leadFields(w);
    const b = sourceBucket(source);
    const cur = map.get(b.key) ?? { label: b.label, value: 0, deals: 0 };
    cur.value += Number(w.deal_value) || 0;
    cur.deals += 1;
    map.set(b.key, cur);
  }
  return [...map.entries()]
    .map(([key, v]) => ({
      key,
      label: v.label,
      value: v.value,
      dealsWon: v.deals,
      pct: achieved > 0 ? Math.round((v.value / achieved) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

function weeklyComparison(
  thisWins: WinRow[],
  lastWins: WinRow[],
  thisFrom: Date,
  lastFrom: Date
): GoalWeeklyComparison[] {
  const buckets = [1, 2, 3, 4, 5].map((week) => ({
    week,
    label: `Week ${week}`,
    thisMonth: 0,
    lastMonth: 0,
  }));

  const weekIndex = (iso: string, monthStart: Date) => {
    const d = new Date(iso);
    const start = startOfWeek(monthStart, { weekStartsOn: 1 });
    const diff = Math.floor((d.getTime() - start.getTime()) / (7 * 86400000));
    return Math.min(4, Math.max(0, diff));
  };

  for (const w of thisWins) {
    const i = weekIndex(w.created_at, thisFrom);
    buckets[i]!.thisMonth += Number(w.deal_value) || 0;
  }
  for (const w of lastWins) {
    const i = weekIndex(w.created_at, lastFrom);
    buckets[i]!.lastMonth += Number(w.deal_value) || 0;
  }

  // Drop trailing empty weeks if both zero beyond week 4
  while (
    buckets.length > 4 &&
    buckets[buckets.length - 1]!.thisMonth === 0 &&
    buckets[buckets.length - 1]!.lastMonth === 0
  ) {
    buckets.pop();
  }
  return buckets;
}

function recentDeals(wins: WinRow[]): GoalRecentDeal[] {
  return [...wins]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6)
    .map((w) => {
      const f = leadFields(w);
      const b = sourceBucket(f.source);
      return {
        id: w.id,
        leadId: w.lead_id,
        wonAt: w.created_at,
        amount: Number(w.deal_value) || 0,
        sourceKey: b.key,
        sourceLabel: b.label,
        customerName: f.name,
        project: f.project,
      };
    });
}

export async function listSalespersonGoalPeriods(
  clientId: string,
  salespersonId: string
): Promise<Array<{ period_start: string }>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_goals")
    .select("period_start")
    .eq("client_id", clientId)
    .eq("salesperson_id", salespersonId)
    .eq("goal_type", "REVENUE_WON")
    .neq("status", "CANCELLED")
    .order("period_start", { ascending: false })
    .limit(24);
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{ period_start: string }>;
}

export async function getActiveGoalForPeriod(
  clientId: string,
  salespersonId: string,
  periodStartIso: string
): Promise<SalesGoalRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_goals")
    .select("*")
    .eq("client_id", clientId)
    .eq("salesperson_id", salespersonId)
    .eq("goal_type", "REVENUE_WON")
    .eq("period_start", periodStartIso)
    .eq("status", "ACTIVE")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as SalesGoalRow | null;
}

export async function fetchSalesGoalsPayload(opts: {
  userId: string;
  clientId: string;
  period?: string | null;
}): Promise<SalesGoalsPayload> {
  const periodKey = parseGoalPeriodKey(opts.period);
  const bounds = goalPeriodBounds(periodKey);
  const prevKey = previousPeriodKey(periodKey);
  const prevBounds = goalPeriodBounds(prevKey);
  const now = new Date();

  const [goal, wins, prevWins, savedPeriods, pipelineRes, overdueRes, quotesRes, hotRes, staleRes] =
    await Promise.all([
      getActiveGoalForPeriod(opts.clientId, opts.userId, bounds.periodStartIso),
      fetchWins(opts.userId, bounds.from, bounds.toExclusive, opts.clientId),
      fetchWins(opts.userId, prevBounds.from, prevBounds.toExclusive, opts.clientId),
      listSalespersonGoalPeriods(opts.clientId, opts.userId),
      createAdminClient()
        .from("leads")
        .select("id, deal_value, budget, status, follow_up_date, score, is_stale, updated_at")
        .eq("assigned_to_id", opts.userId)
        .eq("client_id", opts.clientId)
        .or("is_archived.is.null,is_archived.eq.false")
        .not("status", "in", '("WON","LOST","NOT_QUALIFIED")'),
      createAdminClient()
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to_id", opts.userId)
        .eq("client_id", opts.clientId)
        .not("status", "in", '("WON","LOST","NOT_QUALIFIED")')
        .lt("follow_up_date", format(now, "yyyy-MM-dd")),
      createAdminClient()
        .from("quotations")
        .select("id, lead_id, status")
        .in("status", ["sent", "viewed", "draft"])
        .limit(500),
      createAdminClient()
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to_id", opts.userId)
        .eq("client_id", opts.clientId)
        .not("status", "in", '("WON","LOST","NOT_QUALIFIED")')
        .gte("score", 70),
      createAdminClient()
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to_id", opts.userId)
        .eq("client_id", opts.clientId)
        .eq("is_stale", true)
        .not("status", "in", '("WON","LOST","NOT_QUALIFIED")'),
    ]);

  const currency = goal?.currency ?? "USD";
  const achieved = sumWins(wins);
  const lastMonth = sumWins(prevWins);
  const target = goal ? Number(goal.target_value) : 0;
  const progress = calcProgress(achieved, target || 0);
  const future = isPeriodInFuture(periodKey, now);
  const ended = isPeriodEnded(periodKey, now);
  const lifecycle = resolveLifecycle({
    hasGoal: !!goal,
    periodKey,
    progressPct: progress.progressPct,
    isFuture: future,
    isEnded: ended,
  });

  const series = buildCumulativeSeries(wins, bounds.from, bounds.toExclusive);
  const sources = sourceContributions(wins);
  const trend = formatTrend(achieved, lastMonth);

  const activeLeads = (pipelineRes.data ?? []) as Array<{
    id: string;
    deal_value: number | null;
    budget: string | null;
  }>;
  const pipelineValue = activeLeads.reduce((s, l) => {
    const v = Number(l.deal_value);
    if (Number.isFinite(v) && v > 0) return s + v;
    return s;
  }, 0);

  const activeLeadIds = new Set(activeLeads.map((l) => l.id));
  const pendingQuotes = ((quotesRes.data ?? []) as Array<{ lead_id: string }>).filter((q) =>
    activeLeadIds.has(q.lead_id)
  ).length;

  const periodOptionSet = new Map<string, boolean>();
  periodOptionSet.set(format(now, "yyyy-MM"), false);
  const lastMonthKey = format(
    new Date(now.getFullYear(), now.getMonth() - 1, 1),
    "yyyy-MM"
  );
  periodOptionSet.set(lastMonthKey, false);
  for (const row of savedPeriods) {
    const key = String(row.period_start).slice(0, 7);
    periodOptionSet.set(key, true);
  }
  if (goal) periodOptionSet.set(periodKey, true);

  const periodOptions = [...periodOptionSet.entries()]
    .map(([value, hasGoal]) => {
      const b = goalPeriodBounds(value);
      let label = b.label;
      if (isPeriodCurrent(value, now)) label = "This month";
      else if (value === lastMonthKey) label = "Last month";
      return { value, label, hasGoal: hasGoal || value === periodKey && !!goal };
    })
    .sort((a, b) => b.value.localeCompare(a.value));

  const editable =
    !!goal &&
    goal.salesperson_id === opts.userId &&
    (isPeriodCurrent(periodKey, now) || future) &&
    goal.status === "ACTIVE";

  return {
    currency,
    periodKey,
    periodLabel: bounds.label,
    periodStart: bounds.periodStartIso,
    periodEnd: bounds.periodEndIso,
    lifecycle,
    goal: goal
      ? {
          id: goal.id,
          goalType: goal.goal_type,
          goalTypeLabel: goalTypeLabel(goal.goal_type),
          periodType: goal.period_type,
          periodTypeLabel: periodTypeLabel(goal.period_type),
          target: Number(goal.target_value),
          status: ended && goal.status === "ACTIVE" ? "COMPLETED" : goal.status,
          periodStart: goal.period_start,
          periodEnd: goal.period_end,
          editable,
        }
      : null,
    progress: {
      ...progress,
      dealsWon: wins.length,
    },
    series,
    sources,
    comparison: {
      thisMonth: achieved,
      lastMonth,
      trend: {
        direction: trend.direction,
        label: trend.label,
      },
      weeks: weeklyComparison(wins, prevWins, bounds.from, prevBounds.from),
    },
    milestones: goal ? buildMilestones(target, achieved, series) : [],
    recentDeals: recentDeals(wins),
    recommendations: buildGoalRecommendations({
      overdueFollowUps: overdueRes.count ?? 0,
      pendingQuotes,
      highIntentUncontacted: hotRes.count ?? 0,
      staleHighValue: staleRes.count ?? 0,
      remaining: progress.remaining,
      lifecycle,
      progressPct: progress.progressPct,
    }),
    periodOptions,
    currentPerformance: {
      revenueWon: achieved,
      dealsWon: wins.length,
      pipelineValue,
    },
  };
}

export async function createSalesGoal(opts: {
  clientId: string;
  salespersonId: string;
  createdById: string;
  targetValue: number;
  currency?: string;
  periodKey: string;
  goalType?: "REVENUE_WON";
}): Promise<SalesGoalRow> {
  if (!(opts.targetValue > 0) || !Number.isFinite(opts.targetValue)) {
    throw new Error("Enter a target greater than zero.");
  }
  const bounds = goalPeriodBounds(parseGoalPeriodKey(opts.periodKey));
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_goals")
    .insert({
      client_id: opts.clientId,
      salesperson_id: opts.salespersonId,
      created_by_id: opts.createdById,
      goal_type: opts.goalType ?? "REVENUE_WON",
      target_value: opts.targetValue,
      currency: opts.currency ?? "USD",
      period_type: "MONTHLY",
      period_start: bounds.periodStartIso,
      period_end: bounds.periodEndIso,
      status: "ACTIVE",
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") {
      throw new Error("You already have an active goal for this period.");
    }
    throw new Error(error.message);
  }
  return data as SalesGoalRow;
}

export async function updateSalesGoal(opts: {
  id: string;
  clientId: string;
  salespersonId: string;
  targetValue?: number;
  status?: "ACTIVE" | "CANCELLED";
}): Promise<SalesGoalRow> {
  const supabase = createAdminClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (opts.targetValue != null) {
    if (!(opts.targetValue > 0) || !Number.isFinite(opts.targetValue)) {
      throw new Error("Enter a target greater than zero.");
    }
    patch.target_value = opts.targetValue;
  }
  if (opts.status) patch.status = opts.status;

  const { data, error } = await supabase
    .from("sales_goals")
    .update(patch)
    .eq("id", opts.id)
    .eq("client_id", opts.clientId)
    .eq("salesperson_id", opts.salespersonId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Goal not found");
  return data as SalesGoalRow;
}

/** Export for Reports integration — same win_analysis definition. */
export async function getGoalProgressForReports(opts: {
  userId: string;
  clientId: string;
}): Promise<{
  hasTarget: boolean;
  target: number | null;
  achieved: number;
  remaining: number | null;
  progressPct: number;
  currency: string;
  goalId: string | null;
  periodLabel: string;
}> {
  const periodKey = parseGoalPeriodKey(null);
  const bounds = goalPeriodBounds(periodKey);
  const [goal, wins] = await Promise.all([
    getActiveGoalForPeriod(opts.clientId, opts.userId, bounds.periodStartIso),
    fetchWins(opts.userId, bounds.from, bounds.toExclusive, opts.clientId),
  ]);
  const achieved = sumWins(wins);
  if (!goal) {
    return {
      hasTarget: false,
      target: null,
      achieved,
      remaining: null,
      progressPct: 0,
      currency: "USD",
      goalId: null,
      periodLabel: bounds.label,
    };
  }
  const progress = calcProgress(achieved, Number(goal.target_value));
  return {
    hasTarget: true,
    target: Number(goal.target_value),
    achieved,
    remaining: progress.remaining,
    progressPct: progress.ringPct,
    currency: goal.currency,
    goalId: goal.id,
    periodLabel: bounds.label,
  };
}
