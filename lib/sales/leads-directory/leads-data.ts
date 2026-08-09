/**
 * Salesperson-scoped Leads directory aggregates.
 * Authorization: assigned_to_id = authenticated salesperson.
 * Date semantics: lead created_at ∈ [from, to) when period ≠ all.
 * Conversion: won / (won + lost) — matches sales reports (excludes NOT_QUALIFIED).
 */

import { addDays, startOfDay, startOfMonth, startOfYear, subMonths, subYears } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTrend } from "@/lib/sales/sales-dashboard-display";
import {
  resolveSalesReportRange,
  sourceBucket,
  SALES_REPORT_SOURCES,
  type SalesReportPeriodId,
} from "@/lib/sales/sales-reports-data";
import { fetchLastCallTimes } from "@/lib/leads/all-leads";
import { leadScoreBand, leadScoreLabel, isClosedStage } from "@/lib/sales/format";
import type { LeadStatus } from "@/types";
import {
  buildLeadContext,
  companyFromFormData,
  locationFromFormData,
  stageAccent,
} from "./format";
import type {
  AttentionFilter,
  LeadDirectoryKpis,
  LeadDirectoryRow,
  LeadsDirectoryPayload,
  LeadsIntentFilter,
  LeadsPeriodId,
  LeadsSourceFilter,
  LeadsStageFilter,
  SourceSlice,
  StageSlice,
  TrendDisplay,
} from "./types";

export const LEADS_PERIODS: { id: LeadsPeriodId; label: string }[] = [
  { id: "all", label: "All dates" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "last_30", label: "Last 30 days" },
  { id: "last_90", label: "Last 90 days" },
  { id: "this_quarter", label: "This quarter" },
  { id: "this_year", label: "This year" },
];

export { SALES_REPORT_SOURCES as LEADS_SOURCES };

export const LEADS_STAGE_FILTERS: { id: LeadsStageFilter; label: string }[] = [
  { id: "all", label: "All stages" },
  { id: "NEW", label: "New" },
  { id: "CONTACTED", label: "Contacted" },
  { id: "NEGOTIATING", label: "Negotiating" },
  { id: "PROPOSAL_SENT", label: "Proposal sent" },
  { id: "WON", label: "Won" },
  { id: "LOST", label: "Lost" },
  { id: "NOT_QUALIFIED", label: "Not qualified" },
];

export const LEADS_INTENT_FILTERS: { id: LeadsIntentFilter; label: string }[] = [
  { id: "all", label: "All intent" },
  { id: "hot", label: "Hot" },
  { id: "warm", label: "Warm" },
  { id: "cold", label: "Cold" },
];

export const CONVERSION_FORMULA = "Won ÷ closed (Won + Lost)";

const SOURCE_COLORS: Record<Exclude<LeadsSourceFilter, "all">, string> = {
  whatsapp: "#25D366",
  facebook: "#2684FF",
  website: "#8B5CF6",
  referral: "#F59E0B",
  manual: "#14B8A6",
  other: "#98A2B3",
};

const ACTIVE_STAGES: LeadStatus[] = ["NEW", "CONTACTED", "NEGOTIATING", "PROPOSAL_SENT"];

export function isLeadsPeriod(v: string): v is LeadsPeriodId {
  return LEADS_PERIODS.some((p) => p.id === v);
}

export function isLeadsSource(v: string): v is LeadsSourceFilter {
  return SALES_REPORT_SOURCES.some((s) => s.id === v);
}

export function isLeadsStage(v: string): v is LeadsStageFilter {
  return LEADS_STAGE_FILTERS.some((s) => s.id === v);
}

export function isLeadsIntent(v: string): v is LeadsIntentFilter {
  return LEADS_INTENT_FILTERS.some((s) => s.id === v);
}

export function isAttentionFilter(v: string): v is AttentionFilter {
  return (
    v === "none" ||
    v === "never_contacted" ||
    v === "stale" ||
    v === "follow_up_overdue" ||
    v === "hot" ||
    v === "uncontacted"
  );
}

export function resolveLeadsRange(
  period: LeadsPeriodId,
  customFrom?: string | null,
  customTo?: string | null
): {
  from: Date | null;
  to: Date | null;
  previousFrom: Date | null;
  previousTo: Date | null;
  label: string;
} {
  if (period === "all") {
    return { from: null, to: null, previousFrom: null, previousTo: null, label: "All dates" };
  }
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
  if (periodLabel === "All dates") return "vs prior period";
  const cleaned = periodLabel.replace(/^Last /i, "").replace(/^This /i, "");
  return `vs last ${cleaned.toLowerCase()}`;
}

function pctTrend(current: number, previous: number, periodLabel: string): TrendDisplay | null {
  const t = formatTrend(current, previous);
  if (t.direction === "none") return null;
  if (t.direction === "new") return { direction: "new", label: `New ${vsLabel(periodLabel)}` };
  if (t.direction === "flat") return { direction: "flat", label: `No change ${vsLabel(periodLabel)}` };
  return { direction: t.direction, label: `${t.label} ${vsLabel(periodLabel)}` };
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

type DbLead = {
  id: string;
  client_id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  project_type: string | null;
  source: string | null;
  status: string;
  score: number | null;
  follow_up_date: string | null;
  created_at: string;
  updated_at: string;
  is_stale: boolean | null;
  budget: string | null;
  form_data: Record<string, unknown> | null;
  is_archived?: boolean | null;
};

function mapRow(lead: DbLead, lastContactAt: string | null, now: Date): LeadDirectoryRow {
  const score = lead.score != null && Number.isFinite(Number(lead.score)) ? Number(lead.score) : null;
  const company = companyFromFormData(lead.form_data);
  const location = locationFromFormData(lead.form_data);
  const ctx = buildLeadContext({
    name: lead.name,
    company,
    projectType: lead.project_type,
    location,
  });
  const src = sourceBucket(lead.source);
  const neverContacted = !lastContactAt;
  const followUpOverdue = Boolean(
    lead.follow_up_date && new Date(lead.follow_up_date) < startOfDay(now)
  );

  return {
    id: lead.id,
    clientId: lead.client_id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    projectType: lead.project_type?.trim() || null,
    company: ctx.company,
    location,
    contextLine: ctx.contextLine,
    source: lead.source,
    sourceKey: src.key,
    sourceLabel: src.label,
    status: lead.status as LeadStatus,
    score,
    scoreBand: leadScoreBand(score),
    scoreLabel: leadScoreLabel(score),
    lastContactAt,
    followUpDate: lead.follow_up_date,
    createdAt: lead.created_at,
    updatedAt: lead.updated_at,
    isStale: Boolean(lead.is_stale),
    neverContacted,
    followUpOverdue,
    budget: lead.budget,
    formData: lead.form_data,
  };
}

function inRange(iso: string, from: Date | null, to: Date | null): boolean {
  if (!from || !to) return true;
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t < to.getTime();
}

function matchesIntent(row: LeadDirectoryRow, intent: LeadsIntentFilter): boolean {
  if (intent === "all") return true;
  return row.scoreBand === intent;
}

function matchesAttention(row: LeadDirectoryRow, attention: AttentionFilter): boolean {
  if (attention === "none") return true;
  if (attention === "hot") return row.scoreBand === "hot";
  if (attention === "never_contacted" || attention === "uncontacted") return row.neverContacted;
  if (attention === "stale") return row.isStale;
  if (attention === "follow_up_overdue") return row.followUpOverdue;
  return true;
}

function matchesSearch(row: LeadDirectoryRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    row.name,
    row.phone,
    row.email,
    row.company,
    row.projectType,
    row.location,
    row.contextLine,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

function winRate(won: number, lost: number): number | null {
  const closed = won + lost;
  if (closed === 0) return null;
  return Math.round((won / closed) * 100);
}

function buildSourceSlices(rows: LeadDirectoryRow[]): { slices: SourceSlice[]; total: number } {
  const counts: Record<Exclude<LeadsSourceFilter, "all">, number> = {
    whatsapp: 0,
    facebook: 0,
    website: 0,
    referral: 0,
    manual: 0,
    other: 0,
  };
  for (const r of rows) counts[r.sourceKey]++;
  const total = rows.length;
  const order: Array<Exclude<LeadsSourceFilter, "all">> = [
    "whatsapp",
    "facebook",
    "website",
    "referral",
    "manual",
    "other",
  ];
  const labels: Record<Exclude<LeadsSourceFilter, "all">, string> = {
    whatsapp: "WhatsApp",
    facebook: "Facebook Ads",
    website: "Website",
    referral: "Referrals",
    manual: "Manual",
    other: "Other",
  };
  const slices = order
    .filter((k) => counts[k] > 0)
    .map((k) => ({
      key: k,
      label: labels[k],
      count: counts[k],
      pct: total > 0 ? Math.round((counts[k] / total) * 100) : 0,
      color: SOURCE_COLORS[k],
    }));
  return { slices, total };
}

function buildStageSlices(rows: LeadDirectoryRow[]): { slices: StageSlice[]; total: number } {
  const active = rows.filter((r) => ACTIVE_STAGES.includes(r.status));
  const counts: Partial<Record<LeadStatus, number>> = {};
  for (const r of active) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const total = active.length;
  const slices: StageSlice[] = ACTIVE_STAGES.filter((s) => (counts[s] ?? 0) > 0).map((s) => ({
    status: s,
    label: LEADS_STAGE_FILTERS.find((f) => f.id === s)?.label ?? s,
    count: counts[s] ?? 0,
    pct: total > 0 ? Math.round(((counts[s] ?? 0) / total) * 100) : 0,
    color: stageAccent(s),
  }));
  return { slices, total };
}

export function leadMatchesDirectorySearch(row: LeadDirectoryRow, query: string): boolean {
  return matchesSearch(row, query);
}

export async function fetchSalespersonLeadsDirectory(opts: {
  userId: string;
  period?: LeadsPeriodId;
  source?: LeadsSourceFilter;
  stage?: LeadsStageFilter;
  intent?: LeadsIntentFilter;
  attention?: AttentionFilter;
  search?: string;
  page?: number;
  pageSize?: number;
  customFrom?: string | null;
  customTo?: string | null;
}): Promise<LeadsDirectoryPayload> {
  const period = opts.period ?? "this_month";
  const source = opts.source ?? "all";
  const stage = opts.stage ?? "all";
  const intent = opts.intent ?? "all";
  const attention = opts.attention ?? "none";
  const search = opts.search ?? "";
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = [20, 50, 100].includes(opts.pageSize ?? 20) ? (opts.pageSize as number) : 20;

  const range = resolveLeadsRange(period, opts.customFrom, opts.customTo);
  // "New this month" KPI always uses calendar month when period is all
  const monthRange =
    period === "all"
      ? (() => {
          const now = new Date();
          const from = startOfMonth(now);
          const to = addDays(startOfDay(now), 1);
          return {
            from,
            to,
            previousFrom: startOfMonth(subMonths(now, 1)),
            previousTo: from,
            label: "This month",
          };
        })()
      : range;

  const now = new Date();
  const supabase = createAdminClient();

  const selectCols =
    "id, client_id, name, phone, email, project_type, source, status, score, follow_up_date, created_at, updated_at, is_stale, budget, form_data, is_archived";

  let leadsRes = await supabase
    .from("leads")
    .select(selectCols)
    .eq("assigned_to_id", opts.userId)
    .order("created_at", { ascending: false });

  if (leadsRes.error && String(leadsRes.error.message || "").includes("is_archived")) {
    leadsRes = await supabase
      .from("leads")
      .select(
        "id, client_id, name, phone, email, project_type, source, status, score, follow_up_date, created_at, updated_at, is_stale, budget, form_data"
      )
      .eq("assigned_to_id", opts.userId)
      .order("created_at", { ascending: false });
  }

  const raw = ((leadsRes.data ?? []) as DbLead[]).filter((l) => !l.is_archived);
  const lastMap = await fetchLastCallTimes(raw.map((l) => l.id));
  const mapped = raw.map((l) => mapRow(l, lastMap[l.id] ?? null, now));

  const allTimeCount = mapped.length;

  const filterSource = (rows: LeadDirectoryRow[]) =>
    rows.filter((r) => source === "all" || r.sourceKey === source);

  const sourcedAll = filterSource(mapped);
  const periodRows = sourcedAll.filter((r) => inRange(r.createdAt, range.from, range.to));
  const previousCreated = sourcedAll.filter((r) =>
    inRange(r.createdAt, range.previousFrom, range.previousTo)
  );

  // Closed deals for conversion: by updated_at in period (reports convention)
  const closedIn = (from: Date | null, to: Date | null) => {
    const rows = sourcedAll.filter((r) => r.status === "WON" || r.status === "LOST");
    const inP = rows.filter((r) => inRange(r.updatedAt, from, to));
    return {
      won: inP.filter((r) => r.status === "WON").length,
      lost: inP.filter((r) => r.status === "LOST").length,
    };
  };

  const closedRangeFrom = range.from ?? monthRange.from;
  const closedRangeTo = range.to ?? monthRange.to;
  const closedCurrent = closedIn(closedRangeFrom, closedRangeTo);
  const closedPrevious = closedIn(
    range.previousFrom ?? monthRange.previousFrom,
    range.previousTo ?? monthRange.previousTo
  );

  // New-in-period: calendar month when period is "all", else selected range
  const newRows =
    period === "all"
      ? sourcedAll.filter((r) => inRange(r.createdAt, monthRange.from, monthRange.to))
      : periodRows;
  const newPrevRows =
    period === "all"
      ? sourcedAll.filter((r) =>
          inRange(r.createdAt, monthRange.previousFrom, monthRange.previousTo)
        )
      : previousCreated;

  const kpis: LeadDirectoryKpis = {
    total: {
      value: sourcedAll.length,
      trend: pctTrend(newRows.length, newPrevRows.length, period === "all" ? "month" : range.label),
    },
    newInPeriod: {
      value: newRows.length,
      label:
        period === "all" || period === "this_month"
          ? "New this month"
          : `New (${range.label.toLowerCase()})`,
    },
    hot: {
      value: sourcedAll.filter((r) => r.scoreBand === "hot" && !isClosedStage(r.status)).length,
    },
    won: {
      value: closedCurrent.won,
      trend: pctTrend(closedCurrent.won, closedPrevious.won, range.label),
    },
    conversionRate: {
      value: winRate(closedCurrent.won, closedCurrent.lost),
      trend: ptsTrend(
        winRate(closedCurrent.won, closedCurrent.lost),
        winRate(closedPrevious.won, closedPrevious.lost),
        range.label
      ),
      formula: CONVERSION_FORMULA,
    },
  };

  const tableBase = period === "all" ? sourcedAll : periodRows;

  let filtered = tableBase.filter((r) => {
    if (stage !== "all" && r.status !== stage) return false;
    if (!matchesIntent(r, intent)) return false;
    if (!matchesAttention(r, attention)) return false;
    if (!matchesSearch(r, search)) return false;
    return true;
  });

  // Default sort: newest first; hot-first when attention/intent is hot
  filtered = [...filtered].sort((a, b) => {
    if (intent === "hot" || attention === "hot") {
      const scoreDiff = (b.score ?? -1) - (a.score ?? -1);
      if (scoreDiff !== 0) return scoreDiff;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const totalFiltered = filtered.length;
  const pageSafe = Math.min(page, Math.max(1, Math.ceil(totalFiltered / pageSize) || 1));
  const leads = filtered.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  const bySource = buildSourceSlices(tableBase);
  const byStage = buildStageSlices(tableBase);

  const hotLeads = mapped
    .filter((r) => r.scoreBand === "hot" && !isClosedStage(r.status))
    .filter((r) => source === "all" || r.sourceKey === source)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 5);

  return {
    meta: {
      period,
      periodLabel: range.label,
      source,
      stage,
      intent,
      attention,
      from: range.from?.toISOString() ?? null,
      to: range.to?.toISOString() ?? null,
      dateField: "created_at",
      conversionFormula: CONVERSION_FORMULA,
      allTimeCount,
      page: pageSafe,
      pageSize,
      totalFiltered,
    },
    kpis,
    leads,
    bySource,
    byStage,
    hotLeads,
  };
}
