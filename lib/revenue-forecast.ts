/**
 * Revenue forecast — stage-probability weighted sum over open leads.
 *
 * Methodology: `stage` only for now. AI intent → close-probability curve is
 * intentionally deferred until band-level historical win rates exist.
 */

import {
  endOfMonth,
  endOfQuarter,
  format,
  startOfDay,
  startOfMonth,
  startOfQuarter,
} from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { pipelineValue } from "@/lib/client-team-report";
import type { LeadStatus } from "@/types";

export type ForecastPeriodType = "month" | "quarter";
export type ForecastBucket = "month" | "quarter" | "later" | "undated";
export type ForecastTier = "committed" | "best_case" | "pipeline";
export type ForecastMethodology = "stage";

/** Stage → close probability. Product constants — not lane ranking scores. */
export const STAGE_CLOSE_PROBABILITY: Readonly<Partial<Record<LeadStatus, number>>> = {
  NEW: 0.05,
  CONTACTED: 0.15,
  PROPOSAL_SENT: 0.25,
  NEGOTIATING: 0.5,
  // Verbal commit (0.75) has no status yet — leave room when added.
};

/** Probability bands for committed / best-case / pipeline split. */
export const TIER_THRESHOLDS = {
  committed: 0.75,
  bestCase: 0.4,
} as const;

export const OPEN_FORECAST_STATUSES: readonly LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "NEGOTIATING",
  "PROPOSAL_SENT",
];

export type ForecastableLead = {
  id: string;
  status: string;
  deal_value: unknown;
  budget: string | null;
  expected_close_date: string | null;
};

export type ForecastDealContribution = {
  leadId: string;
  dealValue: number;
  closeProbability: number;
  weightedValue: number;
  tier: ForecastTier;
  bucket: ForecastBucket;
};

export type ForecastBucketSummary = {
  forecastedValue: number;
  committed: number;
  bestCase: number;
  pipeline: number;
  dealCount: number;
  contributions: ForecastDealContribution[];
};

export type LiveForecast = {
  methodology: ForecastMethodology;
  asOf: string;
  month: ForecastBucketSummary;
  quarter: ForecastBucketSummary;
  later: ForecastBucketSummary;
  undated: {
    count: number;
    pipelineValue: number;
    dealCount: number;
  };
  /** Month + quarter overlap: month is a subset of quarter; totals are separate views. */
};

export type ForecastAccuracyPoint = {
  periodType: ForecastPeriodType;
  periodStart: string;
  periodEnd: string;
  forecastedValue: number;
  actualValue: number;
  /** Absolute percentage error: |forecast − actual| / max(actual, 1) */
  absPctError: number;
};

export type ForecastAccuracySummary = {
  sampleSize: number;
  /** 100 − mean absolute percentage error, clamped 0–100. Null until enough closed periods. */
  accuracyPct: number | null;
  points: ForecastAccuracyPoint[];
};

const MIN_ACCURACY_SAMPLES = 2;

function dateKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function parseDateOnly(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function stageCloseProbability(status: string): number {
  return STAGE_CLOSE_PROBABILITY[status as LeadStatus] ?? 0;
}

export function probabilityTier(p: number): ForecastTier {
  if (p >= TIER_THRESHOLDS.committed) return "committed";
  if (p >= TIER_THRESHOLDS.bestCase) return "best_case";
  return "pipeline";
}

export function bucketExpectedClose(
  expectedCloseDate: string | null | undefined,
  now: Date = new Date()
): ForecastBucket {
  const d = parseDateOnly(expectedCloseDate ?? null);
  if (!d) return "undated";

  const monthEnd = endOfMonth(now);
  const quarterEnd = endOfQuarter(now);

  if (d <= monthEnd) return "month";
  if (d <= quarterEnd) return "quarter";
  return "later";
}

function emptyBucket(): ForecastBucketSummary {
  return {
    forecastedValue: 0,
    committed: 0,
    bestCase: 0,
    pipeline: 0,
    dealCount: 0,
    contributions: [],
  };
}

function addToBucket(bucket: ForecastBucketSummary, c: ForecastDealContribution): void {
  bucket.forecastedValue += c.weightedValue;
  bucket.dealCount += 1;
  bucket.contributions.push(c);
  if (c.tier === "committed") bucket.committed += c.weightedValue;
  else if (c.tier === "best_case") bucket.bestCase += c.weightedValue;
  else bucket.pipeline += c.weightedValue;
}

/** Pure: compute live forecast from open leads. */
export function computeLiveForecast(
  leads: ForecastableLead[],
  now: Date = new Date()
): LiveForecast {
  const month = emptyBucket();
  const quarter = emptyBucket();
  const later = emptyBucket();
  let undatedCount = 0;
  let undatedPipelineValue = 0;

  for (const lead of leads) {
    if (!OPEN_FORECAST_STATUSES.includes(lead.status as LeadStatus)) continue;

    const dealValue = pipelineValue(lead);
    if (dealValue <= 0) continue;

    const p = stageCloseProbability(lead.status);
    if (p <= 0) continue;

    const bucket = bucketExpectedClose(lead.expected_close_date, now);
    const weightedValue = dealValue * p;
    const contribution: ForecastDealContribution = {
      leadId: lead.id,
      dealValue,
      closeProbability: p,
      weightedValue,
      tier: probabilityTier(p),
      bucket,
    };

    if (bucket === "undated") {
      undatedCount += 1;
      undatedPipelineValue += dealValue;
      continue;
    }

    // Month deals also sit inside the current quarter view.
    if (bucket === "month") {
      addToBucket(month, contribution);
      addToBucket(quarter, { ...contribution, bucket: "quarter" });
    } else if (bucket === "quarter") {
      addToBucket(quarter, contribution);
    } else {
      addToBucket(later, contribution);
    }
  }

  return {
    methodology: "stage",
    asOf: now.toISOString(),
    month,
    quarter,
    later,
    undated: {
      count: undatedCount,
      pipelineValue: undatedPipelineValue,
      dealCount: undatedCount,
    },
  };
}

export function periodBounds(
  periodType: ForecastPeriodType,
  now: Date = new Date()
): { periodStart: Date; periodEnd: Date } {
  if (periodType === "month") {
    return { periodStart: startOfMonth(now), periodEnd: endOfMonth(now) };
  }
  return { periodStart: startOfQuarter(now), periodEnd: endOfQuarter(now) };
}

async function fetchOpenForecastLeads(clientId: string): Promise<ForecastableLead[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("leads")
    .select("id, status, deal_value, budget, expected_close_date")
    .eq("client_id", clientId)
    .in("status", [...OPEN_FORECAST_STATUSES])
    .or("is_archived.is.null,is_archived.eq.false");

  if (error) {
    // Pre-migration DBs may lack expected_close_date — retry without it.
    if (/expected_close_date/i.test(error.message)) {
      const fallback = await supabase
        .from("leads")
        .select("id, status, deal_value, budget")
        .eq("client_id", clientId)
        .in("status", [...OPEN_FORECAST_STATUSES])
        .or("is_archived.is.null,is_archived.eq.false");
      if (fallback.error) throw new Error(fallback.error.message);
      return (fallback.data ?? []).map((row) => ({
        ...(row as Omit<ForecastableLead, "expected_close_date">),
        expected_close_date: null,
      }));
    }
    throw new Error(error.message);
  }

  return (data ?? []) as ForecastableLead[];
}

/** Live forecast for a client (dashboard / API). */
export async function getClientLiveForecast(
  clientId: string,
  now: Date = new Date()
): Promise<LiveForecast> {
  const leads = await fetchOpenForecastLeads(clientId);
  return computeLiveForecast(leads, now);
}

async function sumWonValueInPeriod(
  clientId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<number> {
  const supabase = createAdminClient();
  const from = startOfDay(periodStart).toISOString();
  // periodEnd is inclusive calendar day — use next day exclusive upper bound
  const toExclusive = new Date(periodEnd);
  toExclusive.setDate(toExclusive.getDate() + 1);
  toExclusive.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("win_analysis")
    .select("deal_value, created_at")
    .eq("client_id", clientId)
    .gte("created_at", from)
    .lt("created_at", toExclusive.toISOString());

  if (error) {
    // Fallback: WON leads by updated_at if win_analysis unavailable
    const won = await supabase
      .from("leads")
      .select("deal_value, updated_at")
      .eq("client_id", clientId)
      .eq("status", "WON")
      .gte("updated_at", from)
      .lt("updated_at", toExclusive.toISOString());
    if (won.error) throw new Error(won.error.message);
    return (won.data ?? []).reduce((s, r) => s + (Number(r.deal_value) || 0), 0);
  }

  return (data ?? []).reduce((s, r) => s + (Number(r.deal_value) || 0), 0);
}

/**
 * Snapshot current month + quarter forecasts and backfill actuals for closed periods.
 * Call from weekly cron (calendar Monday convention via snapshot_date = today).
 */
export async function snapshotClientForecast(
  clientId: string,
  now: Date = new Date()
): Promise<void> {
  const supabase = createAdminClient();
  const live = await getClientLiveForecast(clientId, now);
  const snapshotDate = dateKey(now);

  const rows = (
    [
      ["month", live.month],
      ["quarter", live.quarter],
    ] as const
  ).map(([periodType, summary]) => {
    const { periodStart, periodEnd } = periodBounds(periodType, now);
    return {
      client_id: clientId,
      period_type: periodType,
      period_start: dateKey(periodStart),
      period_end: dateKey(periodEnd),
      snapshot_date: snapshotDate,
      forecasted_value: Math.round(summary.forecastedValue * 100) / 100,
      forecast_committed: Math.round(summary.committed * 100) / 100,
      forecast_best_case: Math.round(summary.bestCase * 100) / 100,
      forecast_pipeline: Math.round(summary.pipeline * 100) / 100,
      undated_count: live.undated.count,
      undated_pipeline_value: Math.round(live.undated.pipelineValue * 100) / 100,
      open_deal_count: summary.dealCount,
      methodology: live.methodology,
    };
  });

  const { error } = await supabase.from("forecast_snapshots").upsert(rows, {
    onConflict: "client_id,period_type,period_start,snapshot_date",
  });

  if (error) {
    // Table may not exist yet pre-migration — soft-fail for cron resilience.
    if (/forecast_snapshots|does not exist|Could not find/i.test(error.message)) {
      console.warn(`[forecast] snapshot skipped for ${clientId}: ${error.message}`);
      return;
    }
    throw new Error(error.message);
  }

  await backfillClosedPeriodActuals(clientId, now);
}

/** Set actual_value on snapshots whose period has ended. */
export async function backfillClosedPeriodActuals(
  clientId: string,
  now: Date = new Date()
): Promise<void> {
  const supabase = createAdminClient();
  const today = dateKey(now);

  const { data: pending, error } = await supabase
    .from("forecast_snapshots")
    .select("id, period_start, period_end, period_type")
    .eq("client_id", clientId)
    .is("actual_value", null)
    .lt("period_end", today);

  if (error) {
    if (/forecast_snapshots|does not exist|Could not find/i.test(error.message)) return;
    throw new Error(error.message);
  }

  // Deduplicate by period so we only sum wins once per period.
  const periods = new Map<string, { periodStart: string; periodEnd: string; ids: string[] }>();
  for (const row of pending ?? []) {
    const key = `${row.period_type}:${row.period_start}`;
    const existing = periods.get(key);
    if (existing) existing.ids.push(row.id as string);
    else {
      periods.set(key, {
        periodStart: row.period_start as string,
        periodEnd: row.period_end as string,
        ids: [row.id as string],
      });
    }
  }

  for (const period of Array.from(periods.values())) {
    const start = parseDateOnly(period.periodStart);
    const end = parseDateOnly(period.periodEnd);
    if (!start || !end) continue;
    const actual = await sumWonValueInPeriod(clientId, start, end);
    await supabase
      .from("forecast_snapshots")
      .update({ actual_value: Math.round(actual * 100) / 100 })
      .in("id", period.ids);
  }
}

/**
 * Accuracy from closed periods. Uses the earliest snapshot in each period
 * (forecast as of period start / first weekly capture) vs actual closed-won.
 */
export async function getForecastAccuracy(
  clientId: string,
  opts?: { limit?: number }
): Promise<ForecastAccuracySummary> {
  const supabase = createAdminClient();
  const limit = opts?.limit ?? 12;

  const { data, error } = await supabase
    .from("forecast_snapshots")
    .select(
      "period_type, period_start, period_end, snapshot_date, forecasted_value, actual_value"
    )
    .eq("client_id", clientId)
    .not("actual_value", "is", null)
    .order("period_start", { ascending: false })
    .order("snapshot_date", { ascending: true });

  if (error) {
    if (/forecast_snapshots|does not exist|Could not find/i.test(error.message)) {
      return { sampleSize: 0, accuracyPct: null, points: [] };
    }
    throw new Error(error.message);
  }

  // Earliest snapshot per (period_type, period_start)
  const earliest = new Map<
    string,
    {
      periodType: ForecastPeriodType;
      periodStart: string;
      periodEnd: string;
      forecastedValue: number;
      actualValue: number;
    }
  >();

  for (const row of data ?? []) {
    const key = `${row.period_type}:${row.period_start}`;
    if (earliest.has(key)) continue;
    earliest.set(key, {
      periodType: row.period_type as ForecastPeriodType,
      periodStart: row.period_start as string,
      periodEnd: row.period_end as string,
      forecastedValue: Number(row.forecasted_value) || 0,
      actualValue: Number(row.actual_value) || 0,
    });
  }

  const points: ForecastAccuracyPoint[] = Array.from(earliest.values())
    .slice(0, limit)
    .map((p) => {
      const denom = Math.max(p.actualValue, 1);
      const absPctError = (Math.abs(p.forecastedValue - p.actualValue) / denom) * 100;
      return { ...p, absPctError };
    });

  const sampleSize = points.length;
  if (sampleSize < MIN_ACCURACY_SAMPLES) {
    return { sampleSize, accuracyPct: null, points };
  }

  const meanApe = points.reduce((s, p) => s + p.absPctError, 0) / sampleSize;
  const accuracyPct = Math.max(0, Math.min(100, Math.round(100 - meanApe)));

  return { sampleSize, accuracyPct, points };
}

/** Weekly cron: snapshot + backfill for every active client. */
export async function runForecastSnapshotsAllClients(
  now: Date = new Date()
): Promise<{ processed: number; errors: string[] }> {
  const supabase = createAdminClient();
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id")
    .eq("is_active", true)
    .eq("is_archived", false);

  if (error) throw new Error(error.message);

  const errors: string[] = [];
  let processed = 0;
  for (const client of clients ?? []) {
    try {
      await snapshotClientForecast(client.id as string, now);
      processed += 1;
    } catch (err) {
      errors.push(`Forecast snapshot failed for ${client.id}: ${String(err)}`);
    }
  }
  return { processed, errors };
}

/** Compact shape for Client Manager dashboard card. */
export type DashboardForecastCard = {
  methodology: ForecastMethodology;
  month: {
    forecastedValue: number;
    committed: number;
    bestCase: number;
    pipeline: number;
    dealCount: number;
  };
  quarter: {
    forecastedValue: number;
    committed: number;
    bestCase: number;
    pipeline: number;
    dealCount: number;
  };
  undated: {
    count: number;
    pipelineValue: number;
  };
  accuracyPct: number | null;
  accuracySampleSize: number;
};

export async function getDashboardForecastCard(
  clientId: string,
  now: Date = new Date()
): Promise<DashboardForecastCard> {
  const [live, accuracy] = await Promise.all([
    getClientLiveForecast(clientId, now),
    getForecastAccuracy(clientId),
  ]);

  return {
    methodology: live.methodology,
    month: {
      forecastedValue: live.month.forecastedValue,
      committed: live.month.committed,
      bestCase: live.month.bestCase,
      pipeline: live.month.pipeline,
      dealCount: live.month.dealCount,
    },
    quarter: {
      forecastedValue: live.quarter.forecastedValue,
      committed: live.quarter.committed,
      bestCase: live.quarter.bestCase,
      pipeline: live.quarter.pipeline,
      dealCount: live.quarter.dealCount,
    },
    undated: {
      count: live.undated.count,
      pipelineValue: live.undated.pipelineValue,
    },
    accuracyPct: accuracy.accuracyPct,
    accuracySampleSize: accuracy.sampleSize,
  };
}
