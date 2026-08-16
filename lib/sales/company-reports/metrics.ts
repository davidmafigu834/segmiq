/**
 * Canonical Company Reports calculations.
 * Reuses the same Lead / Deal / Won / response definitions as Company Dashboard.
 */

import { DEAL_ACTIVE_STAGES, DEAL_STAGE_LABEL, type DealActiveStage } from "@/lib/sales/deals/display";
import { getDealCommercialValue } from "@/lib/sales/deals/commercial-value";
import type { DealRow } from "@/types";
import type { ReportBucket } from "./range";
import { inRange } from "./range";

export const QUALIFIED_LEAD_STATUSES = new Set([
  "QUALIFIED",
  "CONVERTED_TO_DEAL",
  "PROPOSAL_SENT",
  "NEGOTIATING",
  "WON",
]);

const CONTACTED_OR_BEYOND = new Set([
  "CONTACTED",
  "QUALIFIED",
  "CONVERTED_TO_DEAL",
  "PROPOSAL_SENT",
  "NEGOTIATING",
  "WON",
  "LOST",
  "NOT_QUALIFIED",
]);

export type ReportTrendDirection = "up" | "down" | "flat" | "new" | "none";

export type ReportTrend = {
  direction: ReportTrendDirection;
  pct: number | null;
  label: string;
};

export function reportTrend(current: number, previous: number): ReportTrend {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return { direction: "none", pct: null, label: "No prior comparison" };
  }
  if (previous === 0 && current === 0) {
    return { direction: "none", pct: null, label: "No prior comparison" };
  }
  if (previous === 0 && current > 0) {
    return { direction: "new", pct: null, label: "New" };
  }
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
  if (!Number.isFinite(pct)) {
    return { direction: "none", pct: null, label: "No prior comparison" };
  }
  if (pct === 0) return { direction: "flat", pct: 0, label: "No change" };
  const sign = pct > 0 ? "+" : "";
  return {
    direction: pct > 0 ? "up" : "down",
    pct,
    label: `${sign}${pct}%`,
  };
}

/** Map raw up/down onto semantic colour: invertGood means a decrease is positive. */
export function semanticTrend(trend: ReportTrend, invertGood = false): ReportTrend {
  if (!invertGood) return trend;
  if (trend.direction === "up") return { ...trend, direction: "down" };
  if (trend.direction === "down") return { ...trend, direction: "up" };
  return trend;
}

export function formatTrendVs(trend: ReportTrend, vsLabel: string): ReportTrend {
  if (trend.direction === "none" || trend.direction === "new") return trend;
  return { ...trend, label: `${trend.label} vs ${vsLabel}` };
}

export function knownWonValue(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function sumKnownWonValue(
  rows: Array<{ won_value?: number | string | null }>
): number {
  let sum = 0;
  for (const row of rows) {
    const n = knownWonValue(row.won_value);
    if (n != null) sum += n;
  }
  return sum;
}

/** Revenue Won / Deals with a known won value. Null when none. */
export function avgWonDealValue(revenueWon: number, dealsWithKnownValue: number): number | null {
  if (dealsWithKnownValue <= 0) return null;
  return revenueWon / dealsWithKnownValue;
}

export function leadToDealConversion(dealsCreated: number, cohortLeads: number): number | null {
  if (cohortLeads <= 0) return null;
  return Math.round((dealsCreated / cohortLeads) * 1000) / 10;
}

export function isContactedLead(status: string): boolean {
  return status !== "NEW" && CONTACTED_OR_BEYOND.has(status);
}

export function isQualifiedLead(status: string): boolean {
  return QUALIFIED_LEAD_STATUSES.has(status);
}

export function isDealCreatedLead(
  lead: { status: string; id: string },
  dealLeadIds: Set<string>
): boolean {
  return lead.status === "CONVERTED_TO_DEAL" || dealLeadIds.has(lead.id);
}

export type FunnelStageId =
  | "new_leads"
  | "contacted"
  | "qualified"
  | "deals_created"
  | "deals_won";

export type FunnelStage = {
  id: FunnelStageId;
  label: string;
  count: number;
  conversionPct: number;
};

/**
 * Cohort funnel: start with Leads created in the selected range, then count
 * how many of THAT cohort currently sit at or beyond each milestone.
 */
export function cohortConversionFunnel(opts: {
  cohortLeads: Array<{ id: string; status: string }>;
  originatingDealLeadIds: Set<string>;
  wonOriginatingLeadIds: Set<string>;
}): FunnelStage[] {
  const total = opts.cohortLeads.length;
  const contacted = opts.cohortLeads.filter((l) => l.status !== "NEW").length;
  const qualified = opts.cohortLeads.filter((l) => isQualifiedLead(l.status)).length;
  const dealsCreated = opts.cohortLeads.filter((l) =>
    isDealCreatedLead(l, opts.originatingDealLeadIds)
  ).length;
  const won = opts.cohortLeads.filter((l) => opts.wonOriginatingLeadIds.has(l.id)).length;
  const pct = (count: number) => (total <= 0 ? 0 : Math.round((count / total) * 1000) / 10);
  return [
    { id: "new_leads", label: "New Leads", count: total, conversionPct: total > 0 ? 100 : 0 },
    { id: "contacted", label: "Contacted Leads", count: contacted, conversionPct: pct(contacted) },
    { id: "qualified", label: "Qualified Leads", count: qualified, conversionPct: pct(qualified) },
    { id: "deals_created", label: "Deals Created", count: dealsCreated, conversionPct: pct(dealsCreated) },
    { id: "deals_won", label: "Deals Won", count: won, conversionPct: pct(won) },
  ];
}

export type PipelineStageSlice = {
  stage: DealActiveStage;
  label: string;
  count: number;
  value: number;
  pendingCount: number;
  pct: number;
};

export function commercialKnownAmount(
  deal: Pick<
    DealRow,
    | "stage"
    | "value_status"
    | "value_basis"
    | "estimated_value"
    | "estimated_value_min"
    | "estimated_value_max"
    | "customer_budget"
    | "sales_estimate"
    | "won_value"
  >,
  latestQuoteTotal: number | null
): { known: number; pending: boolean } {
  const v = getDealCommercialValue(deal, { latestQuoteTotal });
  if (v.kind === "pending") return { known: 0, pending: true };
  if (v.kind === "amount") return { known: v.amount, pending: false };
  return { known: (v.min + v.max) / 2, pending: false };
}

export function pipelineStageDistribution(
  activeDeals: Array<{
    stage: string;
    value_status?: DealRow["value_status"];
    value_basis?: DealRow["value_basis"];
    estimated_value?: number | null;
    estimated_value_min?: number | null;
    estimated_value_max?: number | null;
    customer_budget?: number | null;
    sales_estimate?: number | null;
    won_value?: number | null;
  }>,
  quoteTotalByDealId: Map<string, number | null>,
  dealId: (index: number) => string
): { slices: PipelineStageSlice[]; total: number; knownValue: number; pendingCount: number } {
  const counts = new Map<DealActiveStage, { count: number; value: number; pending: number }>();
  for (const stage of DEAL_ACTIVE_STAGES) {
    counts.set(stage, { count: 0, value: 0, pending: 0 });
  }
  let knownValue = 0;
  let pendingCount = 0;
  activeDeals.forEach((deal, index) => {
    if (!(DEAL_ACTIVE_STAGES as readonly string[]).includes(deal.stage)) return;
    const stage = deal.stage as DealActiveStage;
    const bucket = counts.get(stage)!;
    bucket.count += 1;
    const { known, pending } = commercialKnownAmount(deal as DealRow, quoteTotalByDealId.get(dealId(index)) ?? null);
    if (pending) {
      bucket.pending += 1;
      pendingCount += 1;
    } else {
      bucket.value += known;
      knownValue += known;
    }
  });
  const total = activeDeals.filter((d) =>
    (DEAL_ACTIVE_STAGES as readonly string[]).includes(d.stage)
  ).length;
  const slices: PipelineStageSlice[] = DEAL_ACTIVE_STAGES.map((stage) => {
    const bucket = counts.get(stage)!;
    return {
      stage,
      label: DEAL_STAGE_LABEL[stage],
      count: bucket.count,
      value: bucket.value,
      pendingCount: bucket.pending,
      pct: total > 0 ? Math.round((bucket.count / total) * 1000) / 10 : 0,
    };
  }).filter((s) => s.count > 0 || activeDeals.length === 0);
  return {
    slices: slices.filter((s) => s.count > 0),
    total,
    knownValue,
    pendingCount,
  };
}

/**
 * Average days from Deal created_at → won_at/lost_at for Deals closed in period.
 * Lead created date is not included.
 */
export function avgSalesCycleDays(
  closed: Array<{ created_at: string; closed_at: string | null }>
): number | null {
  const samples: number[] = [];
  for (const row of closed) {
    if (!row.closed_at) continue;
    const start = Date.parse(row.created_at);
    const end = Date.parse(row.closed_at);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue;
    samples.push((end - start) / 86_400_000);
  }
  if (samples.length === 0) return null;
  return Math.round((samples.reduce((a, b) => a + b, 0) / samples.length) * 10) / 10;
}

export function normalizeLeadSource(raw: string | null | undefined): {
  key: string;
  label: string;
} {
  const s = String(raw ?? "").toUpperCase();
  if (s.includes("WHATSAPP")) return { key: "whatsapp", label: "WhatsApp" };
  if (s.includes("FACEBOOK") || s === "FB" || s.includes("META") || s === "FACEBOOK_AD")
    return { key: "facebook", label: "Facebook" };
  if (s.includes("REFERRAL")) return { key: "referral", label: "Referral" };
  if (s.includes("LANDING") || s.includes("WEBSITE") || s.includes("PROFILE") || s === "WEB")
    return { key: "website", label: "Website" };
  if (s.includes("WALK")) return { key: "walkin", label: "Walk-in" };
  if (s.includes("OUTBOUND")) return { key: "outbound", label: "Outbound" };
  if (s.includes("EVENT")) return { key: "event", label: "Event" };
  if (s.includes("MANUAL")) return { key: "manual", label: "Manual" };
  if (!s) return { key: "unknown", label: "Unknown" };
  return {
    key: s.toLowerCase(),
    label: s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
  };
}

export type SourceSlice = {
  key: string;
  label: string;
  count: number;
  pct: number;
};

export function leadsBySource(leads: Array<{ source?: string | null }>, limit = 5): {
  rows: SourceSlice[];
  total: number;
} {
  const total = leads.length;
  const map = new Map<string, { label: string; count: number }>();
  for (const lead of leads) {
    const src = normalizeLeadSource(lead.source);
    const row = map.get(src.key) ?? { label: src.label, count: 0 };
    row.count += 1;
    map.set(src.key, row);
  }
  const ranked = Array.from(map.entries())
    .map(([key, v]) => ({
      key,
      label: v.label,
      count: v.count,
      pct: total > 0 ? Math.round((v.count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);
  return { rows: ranked.slice(0, limit), total };
}

export function bucketSeries<T>(
  items: T[],
  buckets: ReportBucket[],
  timestamp: (item: T) => string | null | undefined,
  value: (item: T) => number
): number[] {
  const values = buckets.map(() => 0);
  for (const item of items) {
    const iso = timestamp(item);
    if (!iso) continue;
    const idx = buckets.findIndex((b) => inRange(iso, b.from, b.to));
    if (idx < 0) continue;
    values[idx] = (values[idx] ?? 0) + value(item);
  }
  return values;
}

export function alignPreviousSeries(current: number[], previous: number[]): number[] {
  if (current.length === 0) return [];
  if (previous.length === current.length) return previous;
  if (previous.length === 0) return current.map(() => 0);
  const out: number[] = [];
  for (let i = 0; i < current.length; i++) {
    const mapped = Math.round((i * previous.length) / current.length);
    out.push(previous[Math.min(mapped, previous.length - 1)] ?? 0);
  }
  return out;
}

export function cumulativeRatioSparkline(numerators: number[], denominators: number[]): number[] {
  let n = 0;
  let d = 0;
  return denominators.map((den, i) => {
    n += numerators[i] ?? 0;
    d += den;
    if (d <= 0) return 0;
    return Math.round((n / d) * 1000) / 10;
  });
}

export function formatAxisMoney(value: number, currency = "USD"): string {
  const prefix = !currency || currency === "USD" ? "$" : `${currency} `;
  if (!Number.isFinite(value) || value === 0) return `${prefix}0`;
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${prefix}${Math.round(value / 1_000_000)}M`;
  if (abs >= 1000) return `${prefix}${Math.round(value / 1000)}K`;
  return `${prefix}${Math.round(value)}`;
}

export function formatDurationDays(days: number | null): string {
  if (days == null || !Number.isFinite(days)) return "—";
  const rounded = Math.round(days);
  return `${rounded} day${rounded === 1 ? "" : "s"}`;
}
