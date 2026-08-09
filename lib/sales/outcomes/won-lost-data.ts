/**
 * Salesperson-scoped Won & Lost aggregates.
 * Authorization: assigned_to_id = authenticated salesperson only.
 * Close date: leads.updated_at (no dedicated closed_at column).
 */

import {
  addDays,
  differenceInCalendarDays,
  startOfDay,
  startOfYear,
  subYears,
} from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTrend } from "@/lib/sales/sales-dashboard-display";
import {
  resolveSalesReportRange,
  sourceBucket,
  SALES_REPORT_PERIODS,
  SALES_REPORT_SOURCES,
  type SalesReportPeriodId,
} from "@/lib/sales/sales-reports-data";
import {
  calculateLostValue,
  calculateRevenueWon,
  calculateWinRate,
  formatOutcomeReason,
  groupOutcomeReasons,
  groupOutcomesByPeriod,
} from "./metrics";
import type {
  ClosedDealRow,
  ClosedDealKpis,
  OutcomeTab,
  TrendDisplay,
  WonLostGranularity,
  WonLostPayload,
  WonLostPeriodId,
  WonLostSourceFilter,
} from "./types";

export const WON_LOST_PERIODS: { id: WonLostPeriodId; label: string }[] = [
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "last_30", label: "Last 30 days" },
  { id: "last_90", label: "Last 90 days" },
  { id: "this_quarter", label: "This quarter" },
  { id: "this_year", label: "This year" },
];

export { SALES_REPORT_SOURCES as WON_LOST_SOURCES };

export function resolveWonLostRange(
  period: WonLostPeriodId,
  customFrom?: string | null,
  customTo?: string | null
): { from: Date; to: Date; previousFrom: Date; previousTo: Date; label: string } {
  if (period === "this_year") {
    const now = new Date();
    const from = startOfYear(now);
    const to = addDays(startOfDay(now), 1);
    return {
      from,
      to,
      previousFrom: startOfYear(subYears(now, 1)),
      previousTo: from,
      label: "This year",
    };
  }
  return resolveSalesReportRange(period as SalesReportPeriodId, customFrom, customTo);
}

function vsLabel(periodLabel: string): string {
  const cleaned = periodLabel.replace(/^Last /i, "").replace(/^This /i, "");
  return `vs last ${cleaned.toLowerCase()}`;
}

function pctTrend(
  current: number,
  previous: number,
  periodLabel: string,
  opts?: { invertSemantic?: boolean }
): TrendDisplay | null {
  const t = formatTrend(current, previous);
  if (t.direction === "none") return null;
  if (t.direction === "new") {
    return { direction: "new", label: `New ${vsLabel(periodLabel)}` };
  }
  if (t.direction === "flat") {
    return { direction: "flat", label: `No change ${vsLabel(periodLabel)}` };
  }

  // For lost deals / lost value: fewer is positive — flip colour semantics and clarify label
  if (opts?.invertSemantic) {
    if (t.direction === "down") {
      return {
        direction: "up",
        label: `${t.label} fewer ${vsLabel(periodLabel)}`,
      };
    }
    if (t.direction === "up") {
      return {
        direction: "down",
        label: `${t.label} more ${vsLabel(periodLabel)}`,
      };
    }
  }

  return {
    direction: t.direction,
    label: `${t.label} ${vsLabel(periodLabel)}`,
  };
}

function ptsTrend(
  current: number | null,
  previous: number | null,
  periodLabel: string
): TrendDisplay | null {
  if (current == null || previous == null) return null;
  const delta = current - previous;
  if (delta === 0) return { direction: "flat", label: `No change ${vsLabel(periodLabel)}` };
  const sign = delta > 0 ? "+" : "";
  return {
    direction: delta > 0 ? "up" : "down",
    label: `${sign}${delta} pts ${vsLabel(periodLabel)}`,
  };
}

function moneyTrend(
  current: number | null,
  previous: number | null,
  periodLabel: string,
  opts?: { invertSemantic?: boolean }
): TrendDisplay | null {
  if (current == null && previous == null) return null;
  const c = current ?? 0;
  const p = previous ?? 0;
  if (c === 0 && p === 0) return null;
  const t = formatTrend(c, p);
  if (t.direction === "none") return null;
  if (t.direction === "new") {
    return { direction: "new", label: `New ${vsLabel(periodLabel)}` };
  }
  if (t.direction === "flat") {
    return { direction: "flat", label: `No change ${vsLabel(periodLabel)}` };
  }
  if (opts?.invertSemantic) {
    if (t.direction === "down") {
      return { direction: "up", label: `${t.label} ${vsLabel(periodLabel)}` };
    }
    if (t.direction === "up") {
      return { direction: "down", label: `${t.label} ${vsLabel(periodLabel)}` };
    }
  }
  return {
    direction: t.direction,
    label: `${t.label} ${vsLabel(periodLabel)}`,
  };
}

function pickNote(row: {
  convert_later_note?: string | null;
  form_data?: Record<string, unknown> | null;
}): string | null {
  const convert = (row.convert_later_note ?? "").trim();
  if (convert) return convert;
  const fd = row.form_data;
  if (fd && typeof fd === "object") {
    for (const key of ["close_note", "outcome_note", "notes", "note"]) {
      const v = fd[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return null;
}

function mapDeal(row: {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  project_type: string | null;
  status: string;
  deal_value: number | null;
  updated_at: string;
  source: string | null;
  lost_reason: string | null;
  convert_later_note?: string | null;
  form_data?: Record<string, unknown> | null;
  contact_id: string | null;
  client_id: string;
  created_at: string;
}): ClosedDealRow | null {
  if (row.status !== "WON" && row.status !== "LOST") return null;
  const src = sourceBucket(row.source);
  const reason =
    row.status === "LOST"
      ? formatOutcomeReason(row.lost_reason) === "—"
        ? null
        : (row.lost_reason ?? "").trim() || null
      : null;

  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    projectType: row.project_type,
    status: row.status,
    dealValue: row.deal_value != null && Number.isFinite(Number(row.deal_value)) ? Number(row.deal_value) : null,
    closeDate: row.updated_at,
    source: row.source,
    sourceKey: src.key,
    sourceLabel: src.label,
    reason,
    note: pickNote(row),
    contactId: row.contact_id,
    clientId: row.client_id,
    createdAt: row.created_at,
  };
}

function buildKpis(
  current: ClosedDealRow[],
  previous: ClosedDealRow[],
  periodLabel: string
): ClosedDealKpis {
  const won = current.filter((d) => d.status === "WON").length;
  const lost = current.filter((d) => d.status === "LOST").length;
  const wonPrev = previous.filter((d) => d.status === "WON").length;
  const lostPrev = previous.filter((d) => d.status === "LOST").length;

  const winRate = calculateWinRate(won, lost);
  const winRatePrev = calculateWinRate(wonPrev, lostPrev);

  const revenue = calculateRevenueWon(current);
  const revenuePrev = calculateRevenueWon(previous);
  const lostVal = calculateLostValue(current);
  const lostValPrev = calculateLostValue(previous);

  return {
    wonDeals: {
      value: won,
      trend: pctTrend(won, wonPrev, periodLabel),
    },
    lostDeals: {
      value: lost,
      trend: pctTrend(lost, lostPrev, periodLabel, { invertSemantic: true }),
    },
    winRate: {
      value: winRate,
      trend: ptsTrend(winRate, winRatePrev, periodLabel),
    },
    revenueWon: {
      value: revenue.total,
      recordedCount: revenue.recordedCount,
      trend: moneyTrend(revenue.total, revenuePrev.total, periodLabel),
    },
    lostValue: {
      value: lostVal.total,
      recordedCount: lostVal.recordedCount,
      lostCount: lostVal.lostCount,
      trend: moneyTrend(lostVal.total, lostValPrev.total, periodLabel, { invertSemantic: true }),
    },
  };
}

function pickGranularity(
  from: Date,
  to: Date,
  override?: WonLostGranularity | null
): WonLostGranularity {
  if (override === "weekly" || override === "monthly") return override;
  const days = Math.max(1, differenceInCalendarDays(to, from));
  return days > 90 ? "monthly" : "weekly";
}

export async function fetchSalespersonWonLost(opts: {
  userId: string;
  period?: WonLostPeriodId;
  source?: WonLostSourceFilter;
  outcome?: OutcomeTab;
  granularity?: WonLostGranularity | null;
  customFrom?: string | null;
  customTo?: string | null;
}): Promise<WonLostPayload> {
  const period = opts.period ?? "this_month";
  const source = opts.source ?? "all";
  const outcome = opts.outcome ?? "all";
  const range = resolveWonLostRange(period, opts.customFrom, opts.customTo);
  const granularity = pickGranularity(range.from, range.to, opts.granularity);
  const supabase = createAdminClient();

  const selectCols =
    "id, name, phone, email, project_type, status, deal_value, updated_at, source, lost_reason, convert_later_note, form_data, contact_id, client_id, created_at";

  const [
    { data: currentRows },
    { data: previousRows },
    { count: closedAllTime },
  ] = await Promise.all([
    supabase
      .from("leads")
      .select(selectCols)
      .eq("assigned_to_id", opts.userId)
      .in("status", ["WON", "LOST"])
      .gte("updated_at", range.from.toISOString())
      .lt("updated_at", range.to.toISOString())
      .order("updated_at", { ascending: false }),
    supabase
      .from("leads")
      .select(selectCols)
      .eq("assigned_to_id", opts.userId)
      .in("status", ["WON", "LOST"])
      .gte("updated_at", range.previousFrom.toISOString())
      .lt("updated_at", range.previousTo.toISOString()),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to_id", opts.userId)
      .in("status", ["WON", "LOST"]),
  ]);

  const mapFilterSource = (rows: unknown[] | null) =>
    (rows ?? [])
      .map((r) => mapDeal(r as Parameters<typeof mapDeal>[0]))
      .filter((d): d is ClosedDealRow => d != null)
      .filter((d) => source === "all" || d.sourceKey === source);

  const currentAll = mapFilterSource(currentRows as unknown[] | null);
  const previousAll = mapFilterSource(previousRows as unknown[] | null);

  // KPIs use full WON+LOST for period/source so win rate stays canonical.
  const kpis = buildKpis(currentAll, previousAll, range.label);

  const fullTrend = groupOutcomesByPeriod(
    currentAll.map((d) => ({ status: d.status, closeDate: d.closeDate })),
    { from: range.from, to: range.to },
    granularity
  );
  const trend =
    outcome === "all"
      ? fullTrend
      : fullTrend.map((p) => ({
          ...p,
          won: outcome === "lost" ? 0 : p.won,
          lost: outcome === "won" ? 0 : p.lost,
        }));

  // Reason chart uses lost deals matching source + period (hidden on Won tab in UI)
  const lostForReasons =
    outcome === "won" ? [] : currentAll.filter((d) => d.status === "LOST");
  const lostReasons = groupOutcomeReasons(
    lostForReasons.map((d) => ({ reason: d.reason })),
    { includeMissing: lostForReasons.some((d) => !d.reason), maxRows: 6 }
  );

  return {
    currency: "USD",
    meta: {
      period,
      periodLabel: range.label,
      source,
      outcome,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      vsLabel: vsLabel(range.label),
      granularity,
      closeDateField: "updated_at",
      hasWonReasons: false,
      wonReasonsNote:
        "Win reasons aren't being captured yet. Add a win reason when closing a deal to build this insight.",
    },
    kpis,
    deals: currentAll,
    trend,
    lostReasons: {
      rows: lostReasons.rows,
      withReason: lostReasons.withReason,
      totalLost: lostReasons.total,
    },
    wonReasons: {
      rows: [],
      withReason: 0,
      totalWon: currentAll.filter((d) => d.status === "WON").length,
      available: false,
    },
    totals: {
      closedAllTime: closedAllTime ?? 0,
    },
  };
}

export function buildWonLostCsv(
  deals: ClosedDealRow[],
  opts?: { currency?: string }
): string {
  const currency = opts?.currency ?? "USD";
  const header = [
    "Customer",
    "Phone",
    "Project",
    "Outcome",
    "Deal value",
    "Currency",
    "Close date",
    "Source",
    "Reason",
  ];
  const lines = [header.join(",")];
  for (const d of deals) {
    const cells = [
      d.name ?? "",
      d.phone ?? "",
      d.projectType ?? "",
      d.status === "WON" ? "Won" : "Lost",
      d.dealValue == null ? "" : String(d.dealValue),
      currency,
      d.closeDate ? new Date(d.closeDate).toISOString().slice(0, 10) : "",
      d.sourceLabel,
      d.reason ?? "",
    ].map((c) => `"${String(c).replace(/"/g, '""')}"`);
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}

export function isWonLostPeriod(v: string): v is WonLostPeriodId {
  return (
    WON_LOST_PERIODS.some((p) => p.id === v) ||
    SALES_REPORT_PERIODS.some((p) => p.id === v) ||
    v === "custom" ||
    v === "this_year"
  );
}

export function isWonLostSource(v: string): v is WonLostSourceFilter {
  return SALES_REPORT_SOURCES.some((s) => s.id === v) || v === "all";
}
