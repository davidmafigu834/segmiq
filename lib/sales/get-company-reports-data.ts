/**
 * Company Reports aggregator.
 *
 * Overview metrics reuse Company Dashboard definitions:
 * - Revenue Won / Deals Won: deals.stage = WON, dated by won_at (not created_at)
 * - New Leads: leads.created_at in range
 * - Lead → Deal conversion: cohort of Leads created in range that now have a Deal
 * - Pipeline: active Deal stages via DEAL_ACTIVE_STAGES + getDealCommercialValue
 * - Avg first response: firstQualifyingResponseMinutes
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { ROUND_ROBIN_ELIGIBLE_OR } from "@/lib/auth/sales-capabilities";
import { firstQualifyingResponseMinutes } from "@/lib/sales/intelligence/meaningful-activity";
import { DEAL_ACTIVE_STAGES, latestQuoteTotal } from "@/lib/sales/deals";
import { formatDealCurrency } from "@/lib/sales/format";
import { formatResponseTime } from "@/lib/sales/sales-dashboard-display";
import { computeWhatsAppHubReport } from "@/lib/whatsapp-hub-report";
import { effectiveQuoteStatus } from "@/lib/sales/quotes/format";
import type { DealRow, QuotationRow, UserRole } from "@/types";
import {
  alignPreviousSeries,
  avgSalesCycleDays,
  avgWonDealValue,
  bucketSeries,
  cohortConversionFunnel,
  commercialKnownAmount,
  cumulativeRatioSparkline,
  formatDurationDays,
  formatTrendVs,
  isDealCreatedLead,
  knownWonValue,
  leadToDealConversion,
  leadsBySource,
  pipelineStageDistribution,
  reportTrend,
  semanticTrend,
  sumKnownWonValue,
} from "./company-reports/metrics";
import {
  buildReportBuckets,
  formatRangeLabel,
  inRange,
  previousEquivalentRange,
  suggestGranularity,
  type ReportGranularity,
} from "./company-reports/range";
import type {
  CompanyReportPayload,
  CompanyReportTab,
  PerformanceSummaryRow,
  ReportKpi,
  ReportSalespersonRow,
  ReportTimePoint,
} from "./company-reports/types";

const FUNNEL_METHODOLOGY =
  "Cohort funnel: Leads captured in the selected range, counted by how many of that same cohort have reached each milestone (current status / related Deal). This is not Deal win rate, and Funnel Won can differ from period Deals Won.";

type Actor = { userId: string; role: UserRole | string; clientId: string | null };

type LeadRow = {
  id: string;
  status: string;
  source: string | null;
  created_at: string;
  assigned_to_id: string | null;
  contact_id?: string | null;
};

type TeamUser = {
  id: string;
  name: string | null;
  avatar_url: string | null;
};

type WonRow = {
  id: string;
  owner_id: string | null;
  contact_id: string | null;
  originating_lead_id: string;
  won_value: number | null;
  won_at: string | null;
  created_at: string;
};

type LostRow = {
  id: string;
  owner_id: string | null;
  lost_at: string | null;
  created_at: string;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function money(n: number | null | undefined, currency: string): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return formatDealCurrency(n, { currency });
}

function vsLabel(previousLabel: string): string {
  return previousLabel;
}

async function chunkedIn<T>(
  ids: string[],
  size: number,
  fn: (chunk: string[]) => Promise<T[]>
): Promise<T[]> {
  if (ids.length === 0) return [];
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += size) {
    const chunk = ids.slice(i, i + size);
    out.push(...(await fn(chunk)));
  }
  return out;
}

function toPoints(
  buckets: ReturnType<typeof buildReportBuckets>,
  current: number[],
  previous: number[]
): ReportTimePoint[] {
  const prev = alignPreviousSeries(current, previous);
  return buckets.map((b, i) => ({
    key: b.key,
    label: b.label,
    current: current[i] ?? 0,
    previous: prev[i] ?? 0,
  }));
}

function kpi(
  id: string,
  label: string,
  value: string,
  raw: number | null,
  trend: ReturnType<typeof reportTrend>,
  sparkline: number[],
  extra?: Partial<ReportKpi>
): ReportKpi {
  return { id, label, value, raw, trend, sparkline, ...extra };
}

export async function getCompanyReportData(opts: {
  clientId: string;
  actor: Actor;
  tab: CompanyReportTab;
  from: Date;
  to: Date;
  ownerId?: string | null;
  granularity?: ReportGranularity | null;
  now?: Date;
}): Promise<CompanyReportPayload> {
  if (opts.actor.role !== "SUPER_ADMIN" && opts.actor.clientId !== opts.clientId) {
    throw new Error("Forbidden company report scope");
  }

  const tab = opts.tab;
  if (tab === "whatsapp") return fetchWhatsAppTab(opts);
  if (tab === "quotations") return fetchQuotationsTab(opts);
  if (tab === "customers") return fetchCustomersTab(opts);
  if (tab === "activities") return fetchActivitiesTab(opts);
  return fetchCoreReport(opts);
}

async function fetchCoreReport(opts: {
  clientId: string;
  tab: CompanyReportTab;
  from: Date;
  to: Date;
  ownerId?: string | null;
  granularity?: ReportGranularity | null;
  now?: Date;
}): Promise<CompanyReportPayload> {
  const supabase = createAdminClient();
  const clientId = opts.clientId;
  const from = opts.from;
  const to = opts.to;
  const prev = previousEquivalentRange(from, to);
  const granularity = opts.granularity ?? suggestGranularity(from, to);
  const buckets = buildReportBuckets(from, to, granularity);
  const prevBuckets = buildReportBuckets(prev.from, prev.to, granularity);
  const currency = "USD";
  const generatedAt = (opts.now ?? new Date()).toISOString();
  const rangeLabel = formatRangeLabel(from, to);
  const previousLabel = formatRangeLabel(prev.from, prev.to);
  const errors: Partial<Record<string, string>> = {};

  const rangeMeta = {
    from: from.toISOString(),
    to: to.toISOString(),
    label: rangeLabel,
    previousFrom: prev.from.toISOString(),
    previousTo: prev.to.toISOString(),
    previousLabel,
    granularity,
  };

  const [teamRes, leadsRes, activeRes, wonRes, lostRes] = await Promise.all([
    supabase
      .from("users")
      .select("id, name, avatar_url")
      .eq("client_id", clientId)
      .or(ROUND_ROBIN_ELIGIBLE_OR)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("leads")
      .select("id, status, source, created_at, assigned_to_id, contact_id")
      .eq("client_id", clientId)
      .or("is_archived.is.null,is_archived.eq.false")
      .gte("created_at", prev.from.toISOString())
      .lt("created_at", to.toISOString())
      .limit(8000),
    supabase
      .from("deals")
      .select(
        "id, stage, owner_id, originating_lead_id, value_status, value_basis, estimated_value, estimated_value_min, estimated_value_max, customer_budget, sales_estimate, won_value, next_action_at, created_at"
      )
      .eq("client_id", clientId)
      .in("stage", [...DEAL_ACTIVE_STAGES])
      .limit(4000),
    supabase
      .from("deals")
      .select("id, owner_id, contact_id, originating_lead_id, won_value, won_at, created_at")
      .eq("client_id", clientId)
      .eq("stage", "WON")
      .gte("won_at", prev.from.toISOString())
      .lt("won_at", to.toISOString())
      .limit(4000),
    supabase
      .from("deals")
      .select("id, owner_id, lost_at, created_at")
      .eq("client_id", clientId)
      .eq("stage", "LOST")
      .gte("lost_at", prev.from.toISOString())
      .lt("lost_at", to.toISOString())
      .limit(4000),
  ]);

  const team = (teamRes.data ?? []) as TeamUser[];
  const owners = team.map((u) => ({ id: u.id, name: u.name?.trim() || "Team member" }));
  const ownerName = opts.ownerId
    ? owners.find((o) => o.id === opts.ownerId)?.name ?? null
    : null;
  const filters = { ownerId: opts.ownerId ?? null, ownerName };

  let leads = (leadsRes.data ?? []) as LeadRow[];
  let activeDeals = (activeRes.data ?? []) as Array<DealRow & { next_action_at?: string | null }>;
  let wonRows = (wonRes.data ?? []) as WonRow[];
  let lostRows = (lostRes.data ?? []) as LostRow[];

  if (opts.ownerId) {
    leads = leads.filter((l) => l.assigned_to_id === opts.ownerId);
    activeDeals = activeDeals.filter((d) => d.owner_id === opts.ownerId);
    wonRows = wonRows.filter((d) => d.owner_id === opts.ownerId);
    lostRows = lostRows.filter((d) => d.owner_id === opts.ownerId);
  }

  const cohort = leads.filter((l) => inRange(l.created_at, from, to));
  const prevCohort = leads.filter((l) => inRange(l.created_at, prev.from, prev.to));
  const wonCurrent = wonRows.filter((d) => inRange(d.won_at, from, to));
  const wonPrev = wonRows.filter((d) => inRange(d.won_at, prev.from, prev.to));
  const lostCurrent = lostRows.filter((d) => inRange(d.lost_at, from, to));
  const lostPrev = lostRows.filter((d) => inRange(d.lost_at, prev.from, prev.to));

  const cohortIds = cohort.map((l) => l.id);
  let originating: Array<{ originating_lead_id: string; stage: string }> = [];
  try {
    originating = await chunkedIn(cohortIds, 200, async (chunk) => {
      const { data, error } = await supabase
        .from("deals")
        .select("originating_lead_id, stage")
        .eq("client_id", clientId)
        .in("originating_lead_id", chunk);
      if (error) throw error;
      return (data ?? []) as Array<{ originating_lead_id: string; stage: string }>;
    });
  } catch (e) {
    errors.funnel = e instanceof Error ? e.message : "Unable to load conversion funnel.";
  }

  const originatingDealLeadIds = new Set(originating.map((d) => d.originating_lead_id));
  const wonOriginatingLeadIds = new Set(
    originating.filter((d) => d.stage === "WON").map((d) => d.originating_lead_id)
  );

  const prevCohortIds = prevCohort.map((l) => l.id);
  let prevOriginating: Array<{ originating_lead_id: string; stage: string }> = [];
  try {
    prevOriginating = await chunkedIn(prevCohortIds, 200, async (chunk) => {
      const { data, error } = await supabase
        .from("deals")
        .select("originating_lead_id, stage")
        .eq("client_id", clientId)
        .in("originating_lead_id", chunk);
      if (error) throw error;
      return (data ?? []) as Array<{ originating_lead_id: string; stage: string }>;
    });
  } catch {
    /* prior conversion is optional */
  }
  const prevDealLeadIds = new Set(prevOriginating.map((d) => d.originating_lead_id));

  const quoteTotalByDealId = new Map<string, number | null>();
  try {
    const activeIds = activeDeals.map((d) => d.id);
    const quotes = await chunkedIn(activeIds, 200, async (chunk) => {
      const { data } = await supabase
        .from("quotations")
        .select("id, deal_id, lead_id, total, status, sent_at, created_at, updated_at")
        .in("deal_id", chunk);
      return (data ?? []) as QuotationRow[];
    });
    const byDeal = new Map<string, QuotationRow[]>();
    for (const q of quotes) {
      if (!q.deal_id) continue;
      const list = byDeal.get(q.deal_id) ?? [];
      list.push(q);
      byDeal.set(q.deal_id, list);
    }
    for (const [id, list] of byDeal) {
      quoteTotalByDealId.set(id, latestQuoteTotal(list));
    }
  } catch (e) {
    errors.pipeline = e instanceof Error ? e.message : "Unable to load Pipeline report.";
  }

  const pipeline = pipelineStageDistribution(
    activeDeals,
    quoteTotalByDealId,
    (i) => activeDeals[i]!.id
  );

  const revenueWon = sumKnownWonValue(wonCurrent);
  const revenueWonPrev = sumKnownWonValue(wonPrev);
  const dealsWon = wonCurrent.length;
  const dealsWonPrev = wonPrev.length;
  const knownWonCount = wonCurrent.filter((d) => knownWonValue(d.won_value) != null).length;
  const avgWon = avgWonDealValue(revenueWon, knownWonCount);
  const avgWonPrev = avgWonDealValue(
    revenueWonPrev,
    wonPrev.filter((d) => knownWonValue(d.won_value) != null).length
  );

  const dealsCreated = cohort.filter((l) => isDealCreatedLead(l, originatingDealLeadIds)).length;
  const dealsCreatedPrev = prevCohort.filter((l) => isDealCreatedLead(l, prevDealLeadIds)).length;
  const conversion = leadToDealConversion(dealsCreated, cohort.length);
  const conversionPrev = leadToDealConversion(dealsCreatedPrev, prevCohort.length);

  let avgResponse: number | null = null;
  let avgResponsePrev: number | null = null;
  try {
    const responseIds = [...cohort.map((l) => l.id), ...prevCohort.map((l) => l.id)];
    const signals = await loadResponseSignals(supabase, responseIds);
    avgResponse = firstQualifyingResponseMinutes(cohort, signals);
    avgResponsePrev = firstQualifyingResponseMinutes(prevCohort, signals);
  } catch (e) {
    errors.response = e instanceof Error ? e.message : "Unable to load response time.";
  }

  const salesCycle = avgSalesCycleDays([
    ...wonCurrent.map((d) => ({ created_at: d.created_at, closed_at: d.won_at })),
    ...lostCurrent.map((d) => ({ created_at: d.created_at, closed_at: d.lost_at })),
  ]);
  const salesCyclePrev = avgSalesCycleDays([
    ...wonPrev.map((d) => ({ created_at: d.created_at, closed_at: d.won_at })),
    ...lostPrev.map((d) => ({ created_at: d.created_at, closed_at: d.lost_at })),
  ]);

  const revenueCurrentBuckets = bucketSeries(wonCurrent, buckets, (d) => d.won_at, (d) => knownWonValue(d.won_value) ?? 0);
  const revenuePrevBuckets = bucketSeries(wonPrev, prevBuckets, (d) => d.won_at, (d) => knownWonValue(d.won_value) ?? 0);
  const wonCountBuckets = bucketSeries(wonCurrent, buckets, (d) => d.won_at, () => 1);
  const leadBuckets = bucketSeries(cohort, buckets, (d) => d.created_at, () => 1);
  const leadPrevBuckets = bucketSeries(prevCohort, prevBuckets, (d) => d.created_at, () => 1);
  const dealCreatedBuckets = bucketSeries(
    cohort.filter((l) => isDealCreatedLead(l, originatingDealLeadIds)),
    buckets,
    (d) => d.created_at,
    () => 1
  );

  const revenueSeries = toPoints(buckets, revenueCurrentBuckets, revenuePrevBuckets);
  const leadSeries = toPoints(buckets, leadBuckets, leadPrevBuckets);

  const conversionSpark = cumulativeRatioSparkline(dealCreatedBuckets, leadBuckets);
  const avgValueSpark = revenueCurrentBuckets.map((v, i) => {
    const c = wonCountBuckets[i] ?? 0;
    return c > 0 ? Math.round(v / c) : 0;
  });

  const vs = vsLabel(previousLabel);
  const kpis: ReportKpi[] = [
    kpi(
      "revenue_won",
      "Revenue Won",
      money(revenueWon, currency),
      revenueWon,
      formatTrendVs(reportTrend(revenueWon, revenueWonPrev), vs),
      revenueCurrentBuckets,
      { tip: "Sum of known won_value for Deals whose won_at falls in the selected range. Not Pipeline or Quote totals." }
    ),
    kpi(
      "deals_won",
      "Deals Won",
      String(dealsWon),
      dealsWon,
      formatTrendVs(reportTrend(dealsWon, dealsWonPrev), vs),
      wonCountBuckets,
      { tip: "Count of Deals whose outcome became Won in the selected range (won_at)." }
    ),
    kpi(
      "new_leads",
      "New Leads",
      String(cohort.length),
      cohort.length,
      formatTrendVs(reportTrend(cohort.length, prevCohort.length), vs),
      leadBuckets,
      { tip: "Leads captured in the selected range (created_at), company-scoped." }
    ),
    kpi(
      "lead_deal_conversion",
      "Lead → Deal Conversion",
      conversion == null ? "—" : `${conversion}%`,
      conversion,
      formatTrendVs(reportTrend(conversion ?? 0, conversionPrev ?? 0), vs),
      conversionSpark,
      {
        tip: FUNNEL_METHODOLOGY,
      }
    ),
    kpi(
      "avg_won_value",
      "Avg. Won Deal Value",
      avgWon == null ? "—" : money(avgWon, currency),
      avgWon,
      formatTrendVs(reportTrend(avgWon ?? 0, avgWonPrev ?? 0), vs),
      avgValueSpark,
      { tip: "Revenue Won ÷ Won Deals with a known won_value in this period." }
    ),
    kpi(
      "avg_first_response",
      "Avg. First Response",
      formatResponseTime(avgResponse),
      avgResponse,
      formatTrendVs(
        semanticTrend(reportTrend(avgResponse ?? 0, avgResponsePrev ?? 0), true),
        vs
      ),
      [],
      {
        invertGood: true,
        tip: "Average minutes from Lead created_at to first qualifying salesperson response. Viewing or assigning a Lead does not count.",
      }
    ),
  ];

  const noNextAction = activeDeals.filter((d) => !d.next_action_at).length;
  const performanceSummary: PerformanceSummaryRow[] = [
    {
      id: "active",
      label: "Active Deals",
      value: String(pipeline.total),
      trend: { direction: "none", pct: null, label: "Current pipeline" },
    },
    {
      id: "won",
      label: "Won Deals",
      value: String(dealsWon),
      trend: formatTrendVs(reportTrend(dealsWon, dealsWonPrev), vs),
    },
    {
      id: "lost",
      label: "Lost Deals",
      value: String(lostCurrent.length),
      trend: formatTrendVs(
        semanticTrend(reportTrend(lostCurrent.length, lostPrev.length), true),
        vs
      ),
      invertGood: true,
    },
    {
      id: "pipeline_value",
      label: "Open Pipeline Value",
      value:
        pipeline.total > 0 && pipeline.knownValue === 0 && pipeline.pendingCount > 0
          ? "—"
          : money(pipeline.knownValue, currency),
      trend: {
        direction: "none",
        pct: null,
        label:
          pipeline.pendingCount > 0
            ? `${pipeline.pendingCount} Deal${pipeline.pendingCount === 1 ? "" : "s"} awaiting estimate`
            : "Active Deals · known values",
      },
    },
    {
      id: "sales_cycle",
      label: "Avg. Sales Cycle",
      value: formatDurationDays(salesCycle),
      trend: formatTrendVs(
        semanticTrend(reportTrend(salesCycle ?? 0, salesCyclePrev ?? 0), true),
        vs
      ),
      invertGood: true,
    },
  ];

  const funnel = {
    stages: cohortConversionFunnel({
      cohortLeads: cohort,
      originatingDealLeadIds,
      wonOriginatingLeadIds,
    }),
    methodology: FUNNEL_METHODOLOGY,
  };

  const teamById = new Map(team.map((u) => [u.id, u]));
  const topSalespeople = rankSalespeople({
    wonCurrent,
    wonPrev,
    buckets,
    teamById,
    previousLabel: vs,
  });

  const sources = leadsBySource(cohort, 5);

  const shared = {
    generatedAt,
    currency,
    range: rangeMeta,
    filters,
    owners,
    errors,
  };

  if (opts.tab === "sales") {
    const closed = dealsWon + lostCurrent.length;
    const winRate = closed > 0 ? Math.round((dealsWon / closed) * 1000) / 10 : null;
    return {
      tab: "sales",
      ...shared,
      kpis: [kpis[0]!, kpis[1]!, kpis[4]!, kpi(
        "win_rate",
        "Deal Win Rate",
        winRate == null ? "—" : `${winRate}%`,
        winRate,
        { direction: "none", pct: null, label: "Won / (Won + Lost) this period" },
        []
      ), kpi(
        "sales_cycle",
        "Avg. Sales Cycle",
        formatDurationDays(salesCycle),
        salesCycle,
        performanceSummary.find((r) => r.id === "sales_cycle")!.trend,
        [],
        { invertGood: true }
      )],
      revenueSeries,
      bySalesperson: rankSalespeople({
        wonCurrent,
        wonPrev,
        buckets,
        teamById,
        previousLabel: vs,
        limit: 25,
      }),
      winRate,
      wonCount: dealsWon,
      lostCount: lostCurrent.length,
    };
  }

  if (opts.tab === "pipeline") {
    return {
      tab: "pipeline",
      ...shared,
      kpis: [
        kpi("active", "Active Deals", String(pipeline.total), pipeline.total, { direction: "none", pct: null, label: "Point in time" }, []),
        kpi(
          "pipeline_value",
          "Open Pipeline Value",
          pipeline.total > 0 && pipeline.knownValue === 0 && pipeline.pendingCount > 0
            ? "—"
            : money(pipeline.knownValue, currency),
          pipeline.knownValue,
          {
            direction: "none",
            pct: null,
            label:
              pipeline.pendingCount > 0
                ? `${pipeline.pendingCount} awaiting estimate`
                : "Known commercial values",
          },
          []
        ),
        kpi("won", "Won Deals", String(dealsWon), dealsWon, formatTrendVs(reportTrend(dealsWon, dealsWonPrev), vs), wonCountBuckets),
        kpi("lost", "Lost Deals", String(lostCurrent.length), lostCurrent.length, formatTrendVs(semanticTrend(reportTrend(lostCurrent.length, lostPrev.length), true), vs), [], { invertGood: true }),
      ],
      pipeline: { ...pipeline, slices: pipeline.slices, activeCount: pipeline.total, knownValue: pipeline.knownValue, pendingCount: pipeline.pendingCount, mode: "count" },
      noNextAction,
    };
  }

  if (opts.tab === "leads") {
    return {
      tab: "leads",
      ...shared,
      kpis: [kpis[2]!, kpis[3]!, kpis[5]!, kpi(
        "contacted",
        "Contacted",
        String(cohort.filter((l) => l.status !== "NEW").length),
        cohort.filter((l) => l.status !== "NEW").length,
        { direction: "none", pct: null, label: "Of this Lead cohort" },
        []
      )],
      leadSeries,
      funnel,
      leadSources: sources,
    };
  }

  if (opts.tab === "team") {
    const pipelineByOwner = new Map<string, number>();
    for (const deal of activeDeals) {
      if (!deal.owner_id) continue;
      const { known, pending } = commercialKnownAmount(deal, quoteTotalByDealId.get(deal.id) ?? null);
      if (pending) continue;
      pipelineByOwner.set(deal.owner_id, (pipelineByOwner.get(deal.owner_id) ?? 0) + known);
    }
    const leadsByOwner = new Map<string, number>();
    for (const lead of cohort) {
      if (!lead.assigned_to_id) continue;
      leadsByOwner.set(lead.assigned_to_id, (leadsByOwner.get(lead.assigned_to_id) ?? 0) + 1);
    }
    const revenueByOwner = new Map<string, { value: number; count: number }>();
    for (const deal of wonCurrent) {
      if (!deal.owner_id) continue;
      const row = revenueByOwner.get(deal.owner_id) ?? { value: 0, count: 0 };
      row.count += 1;
      row.value += knownWonValue(deal.won_value) ?? 0;
      revenueByOwner.set(deal.owner_id, row);
    }
    return {
      tab: "team",
      ...shared,
      rows: team
        .filter((u) => !opts.ownerId || u.id === opts.ownerId)
        .map((u) => ({
          userId: u.id,
          name: u.name?.trim() || "Team member",
          initials: initials(u.name?.trim() || "?"),
          avatarUrl: u.avatar_url,
          revenueWon: revenueByOwner.get(u.id)?.value ?? 0,
          dealsWon: revenueByOwner.get(u.id)?.count ?? 0,
          pipelineValue: pipelineByOwner.get(u.id) ?? 0,
          newLeads: leadsByOwner.get(u.id) ?? 0,
          avgResponseMinutes: null,
        }))
        .sort((a, b) => b.revenueWon - a.revenueWon || b.dealsWon - a.dealsWon),
    };
  }

  return {
    tab: "overview",
    timezoneNote: "Date boundaries use the reporting process local calendar. SegmiQ does not yet store a per-company timezone.",
    ...shared,
    kpis,
    revenueSeries,
    pipeline: {
      slices: pipeline.slices,
      activeCount: pipeline.total,
      knownValue: pipeline.knownValue,
      pendingCount: pipeline.pendingCount,
      mode: "count",
    },
    performanceSummary,
    leadSeries,
    funnel,
    topSalespeople,
    leadSources: sources,
  };
}

function rankSalespeople(opts: {
  wonCurrent: WonRow[];
  wonPrev: WonRow[];
  buckets: ReturnType<typeof buildReportBuckets>;
  teamById: Map<string, TeamUser>;
  previousLabel: string;
  limit?: number;
}): ReportSalespersonRow[] {
  const byOwner = new Map<string, WonRow[]>();
  for (const row of opts.wonCurrent) {
    if (!row.owner_id) continue;
    const list = byOwner.get(row.owner_id) ?? [];
    list.push(row);
    byOwner.set(row.owner_id, list);
  }
  const prevByOwner = new Map<string, number>();
  for (const row of opts.wonPrev) {
    if (!row.owner_id) continue;
    prevByOwner.set(row.owner_id, (prevByOwner.get(row.owner_id) ?? 0) + (knownWonValue(row.won_value) ?? 0));
  }
  const ranked = Array.from(byOwner.entries())
    .map(([userId, rows]) => {
      const user = opts.teamById.get(userId);
      const name = user?.name?.trim() || "Team member";
      const revenueWon = sumKnownWonValue(rows);
      const sparkline = bucketSeries(rows, opts.buckets, (d) => d.won_at, (d) => knownWonValue(d.won_value) ?? 0);
      return {
        userId,
        name,
        initials: initials(name),
        avatarUrl: user?.avatar_url ?? null,
        revenueWon,
        dealsWon: rows.length,
        sparkline,
        trend: formatTrendVs(reportTrend(revenueWon, prevByOwner.get(userId) ?? 0), opts.previousLabel),
      };
    })
    .filter((r) => r.revenueWon > 0 || r.dealsWon > 0)
    .sort((a, b) => b.revenueWon - a.revenueWon || b.dealsWon - a.dealsWon);
  return ranked.slice(0, opts.limit ?? 5);
}

async function loadResponseSignals(
  supabase: ReturnType<typeof createAdminClient>,
  ids: string[]
) {
  if (ids.length === 0) {
    return {
      callAtsByLead: new Map<string, string[]>(),
      outboundWaByLead: new Map<string, string[]>(),
      eventsByLead: new Map<string, Array<{ event_type: string; created_at: string }>>(),
    };
  }
  const callAtsByLead = new Map<string, string[]>();
  const outboundWaByLead = new Map<string, string[]>();
  const eventsByLead = new Map<string, Array<{ event_type: string; created_at: string }>>();
  await chunkedIn(ids, 400, async (chunk) => {
    const [calls, wa, events] = await Promise.all([
      supabase.from("call_logs").select("lead_id, created_at").in("lead_id", chunk).limit(4000),
      supabase
        .from("whatsapp_messages")
        .select("lead_id, direction, created_at")
        .in("lead_id", chunk)
        .eq("direction", "outbound")
        .limit(4000),
      supabase
        .from("lead_events")
        .select("lead_id, event_type, created_at")
        .in("lead_id", chunk)
        .in("event_type", ["CALL_LOGGED", "MESSAGE_SENT"])
        .limit(4000),
    ]);
    for (const row of (calls.data ?? []) as Array<{ lead_id: string; created_at: string }>) {
      const list = callAtsByLead.get(row.lead_id) ?? [];
      list.push(row.created_at);
      callAtsByLead.set(row.lead_id, list);
    }
    for (const row of (wa.data ?? []) as Array<{ lead_id: string; created_at: string }>) {
      const list = outboundWaByLead.get(row.lead_id) ?? [];
      list.push(row.created_at);
      outboundWaByLead.set(row.lead_id, list);
    }
    for (const row of (events.data ?? []) as Array<{ lead_id: string; event_type: string; created_at: string }>) {
      const list = eventsByLead.get(row.lead_id) ?? [];
      list.push(row);
      eventsByLead.set(row.lead_id, list);
    }
    return [];
  });
  return { callAtsByLead, outboundWaByLead, eventsByLead };
}

async function fetchWhatsAppTab(opts: {
  clientId: string;
  from: Date;
  to: Date;
  ownerId?: string | null;
  granularity?: ReportGranularity | null;
  now?: Date;
}): Promise<CompanyReportPayload> {
  const generatedAt = (opts.now ?? new Date()).toISOString();
  const prev = previousEquivalentRange(opts.from, opts.to);
  const granularity = opts.granularity ?? suggestGranularity(opts.from, opts.to);
  const range = {
    from: opts.from.toISOString(),
    to: opts.to.toISOString(),
    label: formatRangeLabel(opts.from, opts.to),
    previousFrom: prev.from.toISOString(),
    previousTo: prev.to.toISOString(),
    previousLabel: formatRangeLabel(prev.from, prev.to),
    granularity,
  };
  const errors: Partial<Record<string, string>> = {};
  let report;
  try {
    report = await computeWhatsAppHubReport({
      clientId: opts.clientId,
      salespersonId: opts.ownerId,
      now: opts.now,
      from: opts.from,
      to: opts.to,
    });
  } catch (e) {
    errors.whatsapp = e instanceof Error ? e.message : "Unable to load WhatsApp report.";
  }
  const s = report?.summary;
  return {
    tab: "whatsapp",
    generatedAt,
    currency: "USD",
    range,
    filters: { ownerId: opts.ownerId ?? null, ownerName: null },
    owners: [],
    kpis: [
      kpi("conversations", "Active conversations", String(s?.activeChats ?? 0), s?.activeChats ?? 0, { direction: "none", pct: null, label: "Open WhatsApp-sourced chats" }, []),
      kpi("new", "New WhatsApp Leads", String(s?.newChats ?? 0), s?.newChats ?? 0, formatTrendVs(reportTrend(s?.newChats ?? 0, s?.newChatsPrior ?? 0), range.previousLabel), []),
      kpi("awaiting", "Needs reply", String(s?.awaitingReply ?? 0), s?.awaitingReply ?? 0, { direction: "none", pct: null, label: "Latest message is inbound" }, []),
      kpi("response", "Avg. first reply", formatResponseTime(s?.avgFirstResponseMinutes ?? null), s?.avgFirstResponseMinutes ?? null, { direction: "none", pct: null, label: "Inbound → first outbound" }, [], { invertGood: true }),
    ],
    conversations: s?.activeChats ?? 0,
    inbound: s?.inboundMessages ?? 0,
    outbound: s?.outboundMessages ?? 0,
    awaitingReply: s?.awaitingReply ?? 0,
    byRep: (report?.byRep ?? []).map((r) => ({
      userId: r.userId,
      name: r.name,
      outboundMessages: r.outboundMessages,
      assignedChats: r.assignedChats,
    })),
    errors,
  };
}

async function fetchQuotationsTab(opts: {
  clientId: string;
  from: Date;
  to: Date;
  ownerId?: string | null;
  granularity?: ReportGranularity | null;
  now?: Date;
}): Promise<CompanyReportPayload> {
  const supabase = createAdminClient();
  const generatedAt = (opts.now ?? new Date()).toISOString();
  const prev = previousEquivalentRange(opts.from, opts.to);
  const granularity = opts.granularity ?? suggestGranularity(opts.from, opts.to);
  const range = {
    from: opts.from.toISOString(),
    to: opts.to.toISOString(),
    label: formatRangeLabel(opts.from, opts.to),
    previousFrom: prev.from.toISOString(),
    previousTo: prev.to.toISOString(),
    previousLabel: formatRangeLabel(prev.from, prev.to),
    granularity,
  };
  const errors: Partial<Record<string, string>> = {};
  let { data, error } = await supabase
    .from("quotations")
    .select("id, status, total, currency, sent_at, viewed_at, valid_until, created_at, prepared_by_id, prepared_by_name, discount_percent, approval_status, accepted_at, responded_at")
    .eq("client_id", opts.clientId)
    .gte("created_at", prev.from.toISOString())
    .lt("created_at", opts.to.toISOString())
    .limit(4000);
  if (error) {
    const fallback = await supabase
      .from("quotations")
      .select("id, status, total, currency, sent_at, viewed_at, valid_until, created_at, prepared_by_id, discount_percent, approval_status")
      .eq("client_id", opts.clientId)
      .gte("created_at", prev.from.toISOString())
      .lt("created_at", opts.to.toISOString())
      .limit(4000);
    data = (fallback.data ?? []) as typeof data;
    error = fallback.error;
  }
  if (error) errors.quotations = error.message;
  let rows = (data ?? []) as Array<{
    status: import("@/types").QuotationStatus;
    total: number | null;
    sent_at: string | null;
    viewed_at: string | null;
    valid_until: string | null;
    created_at: string;
    prepared_by_id: string | null;
    prepared_by_name?: string | null;
    discount_percent?: number | null;
    approval_status?: string | null;
    accepted_at?: string | null;
    responded_at?: string | null;
  }>;
  if (opts.ownerId) rows = rows.filter((r) => r.prepared_by_id === opts.ownerId);
  const current = rows.filter((r) => inRange(r.created_at, opts.from, opts.to));
  const previous = rows.filter((r) => inRange(r.created_at, prev.from, prev.to));
  const statusOf = (row: (typeof current)[number]) => effectiveQuoteStatus(row.status, row.valid_until);
  const sent = current.filter((r) => r.sent_at || ["sent", "viewed", "accepted", "rejected"].includes(statusOf(r))).length;
  const accepted = current.filter((r) => statusOf(r) === "accepted").length;
  const viewed = current.filter((r) => r.viewed_at || statusOf(r) === "viewed").length;
  const quotedValue = current.reduce((s, r) => s + (Number(r.total) || 0), 0);
  const acceptedValue = current.filter((r) => statusOf(r) === "accepted").reduce((s, r) => s + (Number(r.total) || 0), 0);
  const declined = current.filter((r) => statusOf(r) === "rejected").length;
  const expired = current.filter((r) => statusOf(r) === "expired").length;
  const approvalRequests = current.filter((r) =>
    ["pending", "approved", "changes_requested", "rejected"].includes(String(r.approval_status ?? ""))
  ).length;
  const approved = current.filter((r) => r.approval_status === "approved").length;
  const approvalRate = approvalRequests > 0 ? Math.round((approved / approvalRequests) * 1000) / 10 : null;
  const discounts = current.map((r) => Number(r.discount_percent) || 0);
  const avgDiscount = discounts.length ? Math.round((discounts.reduce((s, n) => s + n, 0) / discounts.length) * 10) / 10 : null;
  const viewRate = sent > 0 ? Math.round((viewed / sent) * 1000) / 10 : null;
  const acceptance = sent > 0 ? Math.round((accepted / sent) * 1000) / 10 : null;
  const responseDays = current
    .map((r) => {
      if (!r.sent_at) return null;
      const end = r.accepted_at || r.responded_at;
      if (!end) return null;
      const ms = Date.parse(end) - Date.parse(r.sent_at);
      if (!Number.isFinite(ms) || ms < 0) return null;
      return ms / 86400000;
    })
    .filter((n): n is number => n != null);
  const avgResponseDays =
    responseDays.length > 0
      ? Math.round((responseDays.reduce((s, n) => s + n, 0) / responseDays.length) * 10) / 10
      : null;
  const byPerson = new Map<
    string,
    { name: string; created: number; quotedValue: number; accepted: number; acceptedValue: number }
  >();
  for (const row of current) {
    const id = row.prepared_by_id || "unassigned";
    const cur = byPerson.get(id) ?? {
      name: row.prepared_by_name?.trim() || (id === "unassigned" ? "Unassigned" : "Salesperson"),
      created: 0,
      quotedValue: 0,
      accepted: 0,
      acceptedValue: 0,
    };
    cur.created += 1;
    cur.quotedValue += Number(row.total) || 0;
    if (statusOf(row) === "accepted") {
      cur.accepted += 1;
      cur.acceptedValue += Number(row.total) || 0;
    }
    byPerson.set(id, cur);
  }
  const byStatusMap = new Map<string, number>();
  for (const row of current) {
    const st = statusOf(row);
    byStatusMap.set(st, (byStatusMap.get(st) ?? 0) + 1);
  }
  const labels: Record<string, string> = {
    draft: "Draft",
    sent: "Sent",
    viewed: "Viewed",
    accepted: "Accepted",
    rejected: "Declined",
    expired: "Expired",
  };
  return {
    tab: "quotations",
    generatedAt,
    currency: "USD",
    range,
    filters: { ownerId: opts.ownerId ?? null, ownerName: null },
    owners: [],
    kpis: [
      kpi("created", "Quotes created", String(current.length), current.length, formatTrendVs(reportTrend(current.length, previous.length), range.previousLabel), []),
      kpi("sent", "Sent", String(sent), sent, { direction: "none", pct: null, label: "Including viewed / accepted / declined" }, []),
      kpi("viewed", "Viewed", String(viewed), viewed, { direction: "none", pct: null, label: "Public link opened" }, []),
      kpi("accepted", "Accepted", String(accepted), accepted, { direction: "none", pct: null, label: "Quote outcome — not Deal Won" }, []),
      kpi("value", "Quoted value", money(quotedValue, "USD"), quotedValue, { direction: "none", pct: null, label: "Not Revenue Won" }, []),
      kpi("accepted_value", "Accepted quotation value", money(acceptedValue, "USD"), accepted, { direction: "none", pct: null, label: "Not Won Deal Value" }, []),
      kpi("accept_rate", "Acceptance rate", acceptance == null ? "—" : `${acceptance}%`, acceptance, { direction: "none", pct: null, label: "Accepted / sent this period" }, []),
      kpi("view_rate", "View rate", viewRate == null ? "—" : `${viewRate}%`, viewRate, { direction: "none", pct: null, label: "Viewed / sent" }, []),
      kpi("declined", "Declined", String(declined), declined, { direction: "none", pct: null, label: "Quotation declined — not Deal Lost" }, []),
      kpi("expired", "Expired", String(expired), expired, { direction: "none", pct: null, label: "Validity passed" }, []),
      kpi("avg_discount", "Average discount", avgDiscount == null ? "—" : `${avgDiscount}%`, avgDiscount, { direction: "none", pct: null, label: "Document discount on created quotes" }, []),
      kpi("approvals", "Approval requests", String(approvalRequests), approvalRequests, { direction: "none", pct: null, label: approvalRate == null ? "No approval volume" : `${approvalRate}% approved` }, []),
      kpi("avg_response", "Avg days to customer response", avgResponseDays == null ? "—" : String(avgResponseDays), avgResponseDays, { direction: "none", pct: null, label: "Accepted or declined after send" }, []),
    ],
    byStatus: Array.from(byStatusMap.entries()).map(([status, count]) => ({
      status,
      label: labels[status] ?? status,
      count,
    })),
    bySalesperson: Array.from(byPerson.entries())
      .map(([userId, row]) => ({
        userId,
        name: row.name,
        created: row.created,
        quotedValue: row.quotedValue,
        accepted: row.accepted,
        acceptedValue: row.acceptedValue,
        acceptRate: row.created > 0 ? Math.round((row.accepted / row.created) * 1000) / 10 : null,
      }))
      .sort((a, b) => b.quotedValue - a.quotedValue),
    errors,
  };
}

async function fetchCustomersTab(opts: {
  clientId: string;
  from: Date;
  to: Date;
  ownerId?: string | null;
  granularity?: ReportGranularity | null;
  now?: Date;
}): Promise<CompanyReportPayload> {
  const supabase = createAdminClient();
  const generatedAt = (opts.now ?? new Date()).toISOString();
  const prev = previousEquivalentRange(opts.from, opts.to);
  const granularity = opts.granularity ?? suggestGranularity(opts.from, opts.to);
  const range = {
    from: opts.from.toISOString(),
    to: opts.to.toISOString(),
    label: formatRangeLabel(opts.from, opts.to),
    previousFrom: prev.from.toISOString(),
    previousTo: prev.to.toISOString(),
    previousLabel: formatRangeLabel(prev.from, prev.to),
    granularity,
  };
  const errors: Partial<Record<string, string>> = {};
  const [{ data: contacts, error: cErr }, { data: won, error: wErr }] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, name, created_at")
      .eq("client_id", opts.clientId)
      .gte("created_at", prev.from.toISOString())
      .lt("created_at", opts.to.toISOString())
      .limit(4000),
    supabase
      .from("deals")
      .select("id, contact_id, owner_id, won_value, won_at, name")
      .eq("client_id", opts.clientId)
      .eq("stage", "WON")
      .gte("won_at", opts.from.toISOString())
      .lt("won_at", opts.to.toISOString())
      .limit(4000),
  ]);
  if (cErr) errors.customers = cErr.message;
  if (wErr) errors.won = wErr.message;
  const contactRows = (contacts ?? []) as Array<{ id: string; name: string | null; created_at: string }>;
  const newCurrent = contactRows.filter((c) => inRange(c.created_at, opts.from, opts.to));
  const newPrev = contactRows.filter((c) => inRange(c.created_at, prev.from, prev.to));
  let wonRows = (won ?? []) as Array<{ contact_id: string | null; owner_id: string | null; won_value: number | null; name: string | null }>;
  if (opts.ownerId) wonRows = wonRows.filter((d) => d.owner_id === opts.ownerId);
  const byCustomer = new Map<string, { name: string; revenueWon: number; dealsWon: number }>();
  for (const row of wonRows) {
    const id = row.contact_id || "unknown";
    const cur = byCustomer.get(id) ?? { name: row.name?.trim() || "Customer", revenueWon: 0, dealsWon: 0 };
    cur.dealsWon += 1;
    cur.revenueWon += knownWonValue(row.won_value) ?? 0;
    byCustomer.set(id, cur);
  }
  const topCustomers = Array.from(byCustomer.entries())
    .map(([contactId, v]) => ({ contactId, ...v }))
    .sort((a, b) => b.revenueWon - a.revenueWon)
    .slice(0, 8);
  const revenue = sumKnownWonValue(wonRows);
  return {
    tab: "customers",
    generatedAt,
    currency: "USD",
    range,
    filters: { ownerId: opts.ownerId ?? null, ownerName: null },
    owners: [],
    kpis: [
      kpi("new", "New customers", String(newCurrent.length), newCurrent.length, formatTrendVs(reportTrend(newCurrent.length, newPrev.length), range.previousLabel), []),
      kpi("won_value", "Won value", money(revenue, "USD"), revenue, { direction: "none", pct: null, label: "Won Deals in this period" }, []),
      kpi("won", "Won Deals", String(wonRows.length), wonRows.length, { direction: "none", pct: null, label: "By customer relationship" }, []),
    ],
    topCustomers,
    errors,
  };
}

async function fetchActivitiesTab(opts: {
  clientId: string;
  from: Date;
  to: Date;
  ownerId?: string | null;
  granularity?: ReportGranularity | null;
  now?: Date;
}): Promise<CompanyReportPayload> {
  const supabase = createAdminClient();
  const generatedAt = (opts.now ?? new Date()).toISOString();
  const prev = previousEquivalentRange(opts.from, opts.to);
  const granularity = opts.granularity ?? suggestGranularity(opts.from, opts.to);
  const range = {
    from: opts.from.toISOString(),
    to: opts.to.toISOString(),
    label: formatRangeLabel(opts.from, opts.to),
    previousFrom: prev.from.toISOString(),
    previousTo: prev.to.toISOString(),
    previousLabel: formatRangeLabel(prev.from, prev.to),
    granularity,
  };
  const errors: Partial<Record<string, string>> = {};
  let eventsQuery = supabase
    .from("lead_events")
    .select("event_type, actor_id, created_at")
    .eq("client_id", opts.clientId)
    .gte("created_at", opts.from.toISOString())
    .lt("created_at", opts.to.toISOString())
    .in("event_type", [
      "CALL_LOGGED",
      "FOLLOW_UP_COMPLETED",
      "MESSAGE_SENT",
      "DEAL_CREATED",
      "QUOTE_SENT",
    ])
    .limit(4000);
  if (opts.ownerId) eventsQuery = eventsQuery.eq("actor_id", opts.ownerId);
  const { data, error } = await eventsQuery;
  if (error) errors.activities = error.message;
  const rows = (data ?? []) as Array<{ event_type: string }>;
  const count = (t: string) => rows.filter((r) => r.event_type === t).length;
  const byType = [
    { type: "CALL_LOGGED", label: "Calls logged", count: count("CALL_LOGGED") },
    { type: "FOLLOW_UP_COMPLETED", label: "Follow-ups completed", count: count("FOLLOW_UP_COMPLETED") },
    { type: "MESSAGE_SENT", label: "Messages sent", count: count("MESSAGE_SENT") },
    { type: "QUOTE_SENT", label: "Quotes sent", count: count("QUOTE_SENT") },
    { type: "DEAL_CREATED", label: "Deals created", count: count("DEAL_CREATED") },
  ];
  return {
    tab: "activities",
    generatedAt,
    currency: "USD",
    range,
    filters: { ownerId: opts.ownerId ?? null, ownerName: null },
    owners: [],
    kpis: byType.map((row) =>
      kpi(row.type.toLowerCase(), row.label, String(row.count), row.count, { direction: "none", pct: null, label: "Period activity — not a ranking" }, [])
    ),
    byType,
    errors,
  };
}
