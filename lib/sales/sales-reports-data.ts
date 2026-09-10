/**
 * Salesperson-scoped reports aggregates.
 * All queries filter to the authenticated salesperson — never team-wide.
 */

import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  eachWeekOfInterval,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { firstCallResponseMinutes } from "@/lib/metrics";
import { parseBudgetValue } from "@/lib/lead-lanes";
import { formatTrend } from "@/lib/sales/sales-dashboard-display";

export type SalesReportPeriodId =
  | "last_7"
  | "last_30"
  | "last_90"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "custom";

export type SalesReportSourceFilter =
  | "all"
  | "whatsapp"
  | "facebook"
  | "referral"
  | "website"
  | "manual"
  | "other";

export type SalesReportGranularity = "daily" | "weekly" | "monthly";

export type SalesReportTab =
  | "overview"
  | "pipeline"
  | "sources"
  | "activity"
  | "forecast";

export const SALES_REPORT_PERIODS: { id: SalesReportPeriodId; label: string }[] = [
  { id: "last_7", label: "Last 7 days" },
  { id: "last_30", label: "Last 30 days" },
  { id: "last_90", label: "Last 90 days" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "this_quarter", label: "This quarter" },
];

export const SALES_REPORT_SOURCES: { id: SalesReportSourceFilter; label: string }[] = [
  { id: "all", label: "All sources" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "facebook", label: "Facebook Ads" },
  { id: "referral", label: "Referrals" },
  { id: "website", label: "Website" },
  { id: "manual", label: "Manual" },
  { id: "other", label: "Other" },
];

type LeadRow = {
  id: string;
  name: string | null;
  phone: string | null;
  status: string;
  follow_up_date: string | null;
  created_at: string;
  updated_at?: string | null;
  source?: string | null;
  client_id: string;
  score?: number | null;
  is_stale?: boolean | null;
  budget?: string | null;
  project_type?: string | null;
  deal_value?: number | null;
  form_data?: Record<string, unknown> | null;
};

function leadValue(lead: LeadRow): number {
  const deal = Number(lead.deal_value);
  if (Number.isFinite(deal) && deal > 0) return deal;
  return parseBudgetValue(lead.budget) ?? 0;
}

export function sourceBucket(raw: string | null | undefined): {
  key: Exclude<SalesReportSourceFilter, "all">;
  label: string;
} {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("whatsapp") || s === "wa") return { key: "whatsapp", label: "WhatsApp" };
  if (s.includes("facebook") || s.includes("meta") || s === "fb" || s.includes("facebook_ad"))
    return { key: "facebook", label: "Facebook Ads" };
  if (s.includes("refer")) return { key: "referral", label: "Referrals" };
  if (s.includes("web") || s.includes("site") || s.includes("landing") || s.includes("form"))
    return { key: "website", label: "Website" };
  if (s.includes("manual") || s.includes("event")) return { key: "manual", label: "Manual" };
  return { key: "other", label: "Other" };
}

export function resolveSalesReportRange(
  period: SalesReportPeriodId,
  customFrom?: string | null,
  customTo?: string | null
): { from: Date; to: Date; previousFrom: Date; previousTo: Date; label: string } {
  const now = new Date();
  const toExclusive = addDays(startOfDay(now), 1);

  if (period === "custom" && customFrom && customTo) {
    const from = startOfDay(new Date(customFrom));
    const to = addDays(startOfDay(new Date(customTo)), 1);
    const days = Math.max(1, differenceInCalendarDays(to, from));
    return {
      from,
      to,
      previousFrom: subDays(from, days),
      previousTo: from,
      label: "Custom range",
    };
  }

  switch (period) {
    case "last_7": {
      const to = toExclusive;
      const from = subDays(to, 7);
      return {
        from,
        to,
        previousFrom: subDays(from, 7),
        previousTo: from,
        label: "Last 7 days",
      };
    }
    case "last_90": {
      const to = toExclusive;
      const from = subDays(to, 90);
      return {
        from,
        to,
        previousFrom: subDays(from, 90),
        previousTo: from,
        label: "Last 90 days",
      };
    }
    case "this_month": {
      const from = startOfMonth(now);
      const to = toExclusive;
      const prevFrom = startOfMonth(subMonths(now, 1));
      return {
        from,
        to,
        previousFrom: prevFrom,
        previousTo: from,
        label: "This month",
      };
    }
    case "last_month": {
      const thisM = startOfMonth(now);
      const from = subMonths(thisM, 1);
      return {
        from,
        to: thisM,
        previousFrom: subMonths(from, 1),
        previousTo: from,
        label: "Last month",
      };
    }
    case "this_quarter": {
      const month = now.getMonth();
      const qStartMonth = Math.floor(month / 3) * 3;
      const from = new Date(now.getFullYear(), qStartMonth, 1);
      const prevFrom = subMonths(from, 3);
      return {
        from,
        to: toExclusive,
        previousFrom: prevFrom,
        previousTo: from,
        label: "This quarter",
      };
    }
    case "last_30":
    default: {
      const to = toExclusive;
      const from = subDays(to, 30);
      return {
        from,
        to,
        previousFrom: subDays(from, 30),
        previousTo: from,
        label: "Last 30 days",
      };
    }
  }
}

export function resolveGranularity(
  from: Date,
  to: Date,
  preferred?: SalesReportGranularity | null
): SalesReportGranularity {
  const days = differenceInCalendarDays(to, from);
  if (preferred === "daily" && days <= 45) return "daily";
  if (preferred === "weekly" && days <= 180) return "weekly";
  if (preferred === "monthly") return "monthly";
  if (days <= 14) return "daily";
  if (days <= 90) return "weekly";
  return "monthly";
}

function inRange(iso: string, from: Date, to: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t < to.getTime();
}

function pctOfPrev(count: number, prev: number): number | null {
  if (prev === 0 && count === 0) return null;
  if (prev === 0) return null; // "New" handled via formatTrend
  return Math.round(((count - prev) / Math.abs(prev)) * 100);
}

function trendPayload(current: number, previous: number) {
  const t = formatTrend(current, previous);
  return {
    direction: t.direction as "up" | "down" | "flat" | "new" | "none",
    label: t.label,
    changePct: pctOfPrev(current, previous),
  };
}

async function fetchAssignedLeads(userId: string): Promise<LeadRow[]> {
  const supabase = createAdminClient();
  const select =
    "id, name, phone, status, follow_up_date, created_at, updated_at, source, client_id, score, is_stale, budget, project_type, deal_value, form_data";
  const q = supabase
    .from("leads")
    .select(select)
    .eq("assigned_to_id", userId)
    .or("is_archived.is.null,is_archived.eq.false")
    .order("created_at", { ascending: false });

  let { data, error } = await q;
  if (error && String(error.message).includes("is_archived")) {
    const retry = await supabase
      .from("leads")
      .select(select)
      .eq("assigned_to_id", userId)
      .order("created_at", { ascending: false });
    data = retry.data;
    error = retry.error;
  }
  if (error && String(error.message).includes("deal_value")) {
    const retry = await supabase
      .from("leads")
      .select(
        "id, name, phone, status, follow_up_date, created_at, updated_at, source, client_id, score, is_stale, budget, project_type, form_data"
      )
      .eq("assigned_to_id", userId)
      .order("created_at", { ascending: false });
    data = retry.data as typeof data;
    error = retry.error;
  }
  if (error) throw new Error(error.message);
  return (data ?? []) as LeadRow[];
}

function matchesSource(lead: LeadRow, source: SalesReportSourceFilter): boolean {
  if (source === "all") return true;
  return sourceBucket(lead.source).key === source;
}

function leadIdsForUser(leads: LeadRow[], leadId: string): boolean {
  return leads.some((l) => l.id === leadId);
}

function buildSeriesBuckets(
  from: Date,
  to: Date,
  granularity: SalesReportGranularity
): Array<{ key: string; label: string; start: Date; end: Date }> {
  if (granularity === "daily") {
    return eachDayOfInterval({ start: from, end: subDays(to, 1) }).map((d) => ({
      key: format(d, "yyyy-MM-dd"),
      label: format(d, "d MMM"),
      start: startOfDay(d),
      end: addDays(startOfDay(d), 1),
    }));
  }
  if (granularity === "weekly") {
    const weeks = eachWeekOfInterval(
      { start: from, end: subDays(to, 1) },
      { weekStartsOn: 1 }
    );
    return weeks.map((d) => {
      const start = startOfWeek(d, { weekStartsOn: 1 });
      const end = addDays(start, 7);
      return {
        key: format(start, "yyyy-MM-dd"),
        label: format(start, "d MMM"),
        start,
        end: end > to ? to : end,
      };
    });
  }
  // monthly
  const buckets: Array<{ key: string; label: string; start: Date; end: Date }> = [];
  let cursor = startOfMonth(from);
  while (cursor < to) {
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    buckets.push({
      key: format(cursor, "yyyy-MM"),
      label: format(cursor, "MMM yyyy"),
      start: cursor,
      end: monthEnd > to ? to : monthEnd,
    });
    cursor = monthEnd;
  }
  return buckets;
}

export type SalesReportsPayload = Awaited<ReturnType<typeof fetchSalespersonReports>>;

export async function fetchSalespersonReports(opts: {
  userId: string;
  period: SalesReportPeriodId;
  source?: SalesReportSourceFilter;
  granularity?: SalesReportGranularity | null;
  customFrom?: string | null;
  customTo?: string | null;
}) {
  const source = opts.source ?? "all";
  const range = resolveSalesReportRange(opts.period, opts.customFrom, opts.customTo);
  const granularity = resolveGranularity(range.from, range.to, opts.granularity);
  const supabase = createAdminClient();
  const now = new Date();

  const leads = await fetchAssignedLeads(opts.userId);
  const scoped = leads.filter((l) => matchesSource(l, source));
  const active = scoped.filter((l) => !["WON", "LOST", "NOT_QUALIFIED"].includes(l.status));

  const createdIn = (from: Date, to: Date) =>
    scoped.filter((l) => inRange(l.created_at, from, to));
  const createdCurrent = createdIn(range.from, range.to);
  const createdPrevious = createdIn(range.previousFrom, range.previousTo);

  const [
    { data: winsCurrent },
    { data: winsPrevious },
    { data: closedCurrent },
    { data: closedPrevious },
    { data: callLogsCurrent },
    { data: callLogsPrevious },
    { data: eventsCurrent },
    quotationsResult,
    { data: followUpsCompletedEvents },
  ] = await Promise.all([
    supabase
      .from("win_analysis")
      .select("id, deal_value, created_at, lead_id, leads(name, source, project_type)")
      .eq("salesperson_id", opts.userId)
      .gte("created_at", range.from.toISOString())
      .lt("created_at", range.to.toISOString()),
    supabase
      .from("win_analysis")
      .select("id, deal_value, created_at")
      .eq("salesperson_id", opts.userId)
      .gte("created_at", range.previousFrom.toISOString())
      .lt("created_at", range.previousTo.toISOString()),
    supabase
      .from("leads")
      .select("id, status, source, updated_at")
      .eq("assigned_to_id", opts.userId)
      .in("status", ["WON", "LOST"])
      .gte("updated_at", range.from.toISOString())
      .lt("updated_at", range.to.toISOString()),
    supabase
      .from("leads")
      .select("id, status, source")
      .eq("assigned_to_id", opts.userId)
      .in("status", ["WON", "LOST"])
      .gte("updated_at", range.previousFrom.toISOString())
      .lt("updated_at", range.previousTo.toISOString()),
    supabase
      .from("call_logs")
      .select("id, lead_id, created_at, outcome")
      .eq("user_id", opts.userId)
      .gte("created_at", range.from.toISOString())
      .lt("created_at", range.to.toISOString()),
    supabase
      .from("call_logs")
      .select("id")
      .eq("user_id", opts.userId)
      .gte("created_at", range.previousFrom.toISOString())
      .lt("created_at", range.previousTo.toISOString()),
    supabase
      .from("lead_events")
      .select("id, event_type, channel, created_at, lead_id")
      .eq("actor_id", opts.userId)
      .gte("created_at", range.from.toISOString())
      .lt("created_at", range.to.toISOString()),
    supabase
      .from("quotations")
      .select("id, created_at, lead_id")
      .gte("created_at", range.from.toISOString())
      .lt("created_at", range.to.toISOString())
      .limit(500),
    supabase
      .from("lead_events")
      .select("id, event_type, created_at, lead_id")
      .eq("actor_id", opts.userId)
      .eq("event_type", "CALL_LOGGED")
      .gte("created_at", range.from.toISOString())
      .lt("created_at", range.to.toISOString()),
  ]);

  const quotationsCurrent = ((quotationsResult.data ?? []) as Array<{ lead_id: string }>).filter(
    (q) => leadIdsForUser(scoped, q.lead_id)
  );

  const filterWinsBySource = <T extends { leads?: unknown }>(rows: T[] | null) => {
    if (source === "all") return rows ?? [];
    return (rows ?? []).filter((w) => {
      const lead = w.leads as { source?: string | null } | { source?: string | null }[] | null;
      const src = Array.isArray(lead) ? lead[0]?.source : lead?.source;
      return sourceBucket(src).key === source;
    });
  };

  const wins = filterWinsBySource(
    (winsCurrent ?? []) as unknown as Array<{
      id: string;
      deal_value: number | null;
      created_at: string;
      lead_id: string | null;
      leads: { name: string | null; source?: string | null; project_type?: string | null } | null;
    }>
  );
  const winsPrev = winsPrevious ?? [];

  const closedNow = ((closedCurrent ?? []) as Array<{ id: string; status: string; source?: string | null }>).filter(
    (l) => source === "all" || sourceBucket(l.source).key === source
  );
  const closedPrev = ((closedPrevious ?? []) as Array<{ id: string; status: string; source?: string | null }>).filter(
    (l) => source === "all" || sourceBucket(l.source).key === source
  );

  const wonCount = wins.length;
  const wonPrevCount = winsPrev.length;
  const wonValue = wins.reduce((s, w) => s + (Number(w.deal_value) || 0), 0);

  const wonClosed = closedNow.filter((l) => l.status === "WON").length;
  const wonClosedPrev = closedPrev.filter((l) => l.status === "WON").length;
  const conversionRate =
    closedNow.length === 0 ? null : Math.round((wonClosed / closedNow.length) * 100);
  const conversionPrev =
    closedPrev.length === 0 ? null : Math.round((wonClosedPrev / closedPrev.length) * 100);

  // Response time: first call for leads created in period
  const periodLeadIds = createdCurrent.map((l) => l.id);
  const responseLogs =
    periodLeadIds.length > 0
      ? await supabase
          .from("call_logs")
          .select("lead_id, created_at")
          .in("lead_id", periodLeadIds.slice(0, 200))
          .order("created_at", { ascending: true })
      : { data: [] as Array<{ lead_id: string; created_at: string }> };

  const avgResponseMinutes = firstCallResponseMinutes(
    createdCurrent.map((l) => ({ id: l.id, created_at: l.created_at })),
    (responseLogs.data ?? []) as Array<{ lead_id: string; created_at: string }>
  );

  const prevPeriodLeadIds = createdPrevious.map((l) => l.id);
  const prevResponseLogs =
    prevPeriodLeadIds.length > 0
      ? await supabase
          .from("call_logs")
          .select("lead_id, created_at")
          .in("lead_id", prevPeriodLeadIds.slice(0, 200))
          .order("created_at", { ascending: true })
      : { data: [] as Array<{ lead_id: string; created_at: string }> };
  const avgResponsePrev = firstCallResponseMinutes(
    createdPrevious.map((l) => ({ id: l.id, created_at: l.created_at })),
    (prevResponseLogs.data ?? []) as Array<{ lead_id: string; created_at: string }>
  );

  // Follow-ups completed: CALL_LOGGED in period on leads that have/had follow_up_date
  const callsCurrent = (callLogsCurrent ?? []) as Array<{
    id: string;
    lead_id: string;
    created_at: string;
  }>;
  const leadById = new Map(scoped.map((l) => [l.id, l]));
  const followUpsCompleted = new Set(
    ((followUpsCompletedEvents ?? []) as Array<{ lead_id: string }>).map((e) => e.lead_id)
  ).size;
  // Prefer counting CALL_LOGGED events as completed follow-up activity when lead had follow-up
  const followUpCompletedCount = callsCurrent.filter((c) => {
    const lead = leadById.get(c.lead_id);
    return Boolean(lead?.follow_up_date);
  }).length || followUpsCompleted;

  const followUpsCompletedPrev = ((callLogsPrevious ?? []) as Array<{ id: string }>).length; // rough prior activity baseline unused for completed
  void followUpsCompletedPrev;

  const overdueFollowUps = active.filter((l) => {
    if (!l.follow_up_date) return false;
    const d = new Date(l.follow_up_date);
    return d.getTime() < now.getTime() && d.toDateString() !== now.toDateString();
  }).length;

  const dueToday = active.filter((l) => {
    if (!l.follow_up_date) return false;
    const d = new Date(l.follow_up_date);
    return d.toDateString() === now.toDateString();
  }).length;

  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const followUpsCompletedThisWeek = callsCurrent.filter((c) => {
    const lead = leadById.get(c.lead_id);
    if (!lead?.follow_up_date) return false;
    return new Date(c.created_at) >= weekStart;
  }).length;

  const pipelineValue = active.reduce((s, l) => s + leadValue(l), 0);

  // Sources
  const sourceKeys = ["whatsapp", "facebook", "referral", "website", "manual", "other"] as const;
  const sourceCounts = new Map<string, number>();
  for (const lead of createdCurrent) {
    const b = sourceBucket(lead.source);
    sourceCounts.set(b.key, (sourceCounts.get(b.key) ?? 0) + 1);
  }
  const sourceTotal = createdCurrent.length;
  const leadSources = sourceKeys
    .map((key) => {
      const count = sourceCounts.get(key) ?? 0;
      const label = SALES_REPORT_SOURCES.find((s) => s.id === key)?.label ?? key;
      return {
        key,
        label,
        count,
        pct: sourceTotal === 0 ? 0 : Math.round((count / sourceTotal) * 100),
      };
    })
    .filter((s) => s.count > 0 || source === "all");

  // Funnel — point-in-time active + won in period
  const funnelStages = [
    { id: "NEW", label: "New", color: "#2563EB" },
    { id: "CONTACTED", label: "Contacted", color: "#16A34A" },
    { id: "NEGOTIATING", label: "Negotiating", color: "#F59E0B" },
    { id: "PROPOSAL_SENT", label: "Proposal sent", color: "#8B5CF6" },
    { id: "WON", label: "Won", color: "#16A34A" },
  ] as const;

  const funnel = funnelStages.map((stage, i) => {
    const count =
      stage.id === "WON"
        ? wonCount
        : active.filter((l) => l.status === stage.id).length;
    const prevCount =
      i === 0
        ? null
        : stage.id === "WON"
          ? active.filter((l) => l.status === "PROPOSAL_SENT").length
          : active.filter((l) => l.status === funnelStages[i - 1]!.id).length;
    const rateOfPrevious =
      prevCount == null || prevCount === 0
        ? null
        : Math.round((count / prevCount) * 1000) / 10;
    return {
      id: stage.id,
      label: stage.label,
      color: stage.color,
      count,
      rateOfPrevious,
    };
  });

  // Activity
  const events = (eventsCurrent ?? []) as Array<{
    event_type: string;
    channel?: string | null;
  }>;
  const whatsappReplies = events.filter(
    (e) =>
      e.event_type === "MESSAGE_SENT" ||
      e.event_type === "MESSAGE_RECEIVED" ||
      e.channel === "whatsapp"
  ).length;
  const quotesSent =
    quotationsCurrent.length ||
    events.filter((e) => e.event_type === "DOCUMENT_SENT").length;
  const followUpsScheduled = events.filter((e) => e.event_type === "FOLLOW_UP_SET").length;
  const siteVisits = events.filter((e) => e.channel === "in_person").length;
  const callsLogged = callsCurrent.length;

  const activity = [
    { key: "calls", label: "Calls logged", count: callsLogged },
    { key: "whatsapp", label: "WhatsApp replies", count: whatsappReplies },
    { key: "quotes", label: "Quotes sent", count: quotesSent },
    { key: "site_visits", label: "Site visits", count: siteVisits },
    { key: "followups", label: "Follow-ups scheduled", count: followUpsScheduled },
  ];
  const activityMax = Math.max(...activity.map((a) => a.count), 1);

  // Where deals pause — deterministic from live lead state (not invented loss reasons)
  const pauseBuckets = [
    {
      key: "overdue",
      label: "Overdue follow-up",
      count: overdueFollowUps,
    },
    {
      key: "awaiting",
      label: "Awaiting follow-up",
      count: active.filter((l) => {
        if (!l.follow_up_date) return false;
        return new Date(l.follow_up_date).getTime() >= now.getTime();
      }).length,
    },
    {
      key: "stale",
      label: "No recent activity",
      count: active.filter((l) => {
        if (l.is_stale) return true;
        const updated = l.updated_at ? new Date(l.updated_at) : new Date(l.created_at);
        return differenceInCalendarDays(now, updated) >= 7;
      }).length,
    },
    {
      key: "proposal",
      label: "Waiting on proposal feedback",
      count: active.filter((l) => l.status === "PROPOSAL_SENT").length,
    },
  ].filter((b) => b.count > 0);
  const pauseTotal = pauseBuckets.reduce((s, b) => s + b.count, 0);

  // Performance series
  const buckets = buildSeriesBuckets(range.from, range.to, granularity);
  const performanceSeries = buckets.map((b) => {
    const leadsCreated = createdCurrent.filter((l) =>
      inRange(l.created_at, b.start, b.end)
    ).length;
    const dealsWon = wins.filter((w) => inRange(w.created_at, b.start, b.end)).length;
    const revenue = wins
      .filter((w) => inRange(w.created_at, b.start, b.end))
      .reduce((s, w) => s + (Number(w.deal_value) || 0), 0);
    return {
      label: b.label,
      leadsCreated,
      dealsWon,
      revenue,
    };
  });

  // Cumulative won value for goal chart
  const sortedWins = [...wins].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  let running = 0;
  const goalSeries: Array<{ label: string; value: number }> = [
    { label: format(range.from, "d MMM"), value: 0 },
  ];
  for (const w of sortedWins) {
    running += Number(w.deal_value) || 0;
    goalSeries.push({
      label: format(new Date(w.created_at), "d MMM"),
      value: running,
    });
  }

  // Top opportunities — score desc, then value
  const topOpportunities = [...active]
    .sort((a, b) => {
      const sa = a.score ?? -1;
      const sb = b.score ?? -1;
      if (sb !== sa) return sb - sa;
      return leadValue(b) - leadValue(a);
    })
    .slice(0, 6)
    .map((l) => ({
      id: l.id,
      name: l.name?.trim() || "Unnamed lead",
      project: l.project_type?.trim() || "—",
      status: l.status,
      value: leadValue(l),
      score: l.score ?? null,
      lastActivity: l.updated_at || l.created_at,
      href: `/sales/leads?lead=${l.id}`,
    }));

  // Pipeline value by stage (for Pipeline tab)
  const pipelineByStage = funnelStages
    .filter((s) => s.id !== "WON")
    .map((stage) => {
      const stageLeads = active.filter((l) => l.status === stage.id);
      return {
        id: stage.id,
        label: stage.label,
        color: stage.color,
        count: stageLeads.length,
        value: stageLeads.reduce((s, l) => s + leadValue(l), 0),
      };
    });

  // Won by source
  const wonBySourceMap = new Map<string, { count: number; value: number }>();
  for (const w of wins) {
    const leadRaw = w.leads as
      | { source?: string | null }
      | { source?: string | null }[]
      | null;
    const lead = Array.isArray(leadRaw) ? leadRaw[0] : leadRaw;
    const b = sourceBucket(lead?.source);
    const cur = wonBySourceMap.get(b.key) ?? { count: 0, value: 0 };
    cur.count += 1;
    cur.value += Number(w.deal_value) || 0;
    wonBySourceMap.set(b.key, cur);
  }

  const sourcesDetail = sourceKeys.map((key) => {
    const created = sourceCounts.get(key) ?? 0;
    const won = wonBySourceMap.get(key) ?? { count: 0, value: 0 };
    const label = SALES_REPORT_SOURCES.find((s) => s.id === key)?.label ?? key;
    return {
      key,
      label,
      leadsCreated: created,
      dealsWon: won.count,
      wonValue: won.value,
      conversionRate: created === 0 ? null : Math.round((won.count / created) * 100),
    };
  });

  // Insight strip (deterministic)
  let insight: string | null = null;
  const topSource = [...leadSources].sort((a, b) => b.count - a.count)[0];
  if (topSource && topSource.count > 0 && sourceTotal > 0) {
    const wonFromSource = wonBySourceMap.get(topSource.key)?.count ?? 0;
    insight = `${topSource.label} is your strongest source this period — ${topSource.pct}% of new leads${
      wonFromSource > 0 ? ` and ${wonFromSource} win${wonFromSource === 1 ? "" : "s"}` : ""
    }.`;
  } else if (overdueFollowUps >= 3) {
    insight = `${overdueFollowUps} opportunities have overdue follow-ups — clear them to keep deals moving.`;
  }

  const currency = "USD"; // default; clients may store currency later
  let goalCard = {
    hasTarget: false,
    target: null as number | null,
    achieved: wonValue,
    remaining: null as number | null,
    progressPct: 0,
    series: goalSeries,
  };
  try {
    const { getGoalProgressForReports } = await import("@/lib/sales/goals/sales-goals-data");
    const supabaseAdmin = createAdminClient();
    const { data: userRow } = await supabaseAdmin
      .from("users")
      .select("client_id")
      .eq("id", opts.userId)
      .maybeSingle();
    const resolvedClientId =
      (userRow as { client_id?: string } | null)?.client_id ??
      leads.find((l) => l.client_id)?.client_id ??
      null;
    if (resolvedClientId) {
      const g = await getGoalProgressForReports({
        userId: opts.userId,
        clientId: resolvedClientId,
      });
      goalCard = {
        hasTarget: g.hasTarget,
        target: g.target,
        achieved: g.achieved,
        remaining: g.remaining,
        progressPct: g.progressPct,
        series: goalSeries,
      };
    }
  } catch {
    // Goals table may not exist yet — keep no-target card
  }

  return {
    meta: {
      period: opts.period,
      periodLabel: range.label,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      source,
      granularity,
      currency,
      generatedAt: now.toISOString(),
    },
    insight,
    kpis: {
      leadsCreated: {
        value: createdCurrent.length,
        previous: createdPrevious.length,
        trend: trendPayload(createdCurrent.length, createdPrevious.length),
      },
      dealsWon: {
        value: wonCount,
        previous: wonPrevCount,
        trend: trendPayload(wonCount, wonPrevCount),
        wonValue,
      },
      pipelineValue: {
        value: pipelineValue,
        label: "Current pipeline value",
        pointInTime: true as const,
        // Compare newly created pipeline value cohorts for trend
        trend: trendPayload(
          createdCurrent.reduce((s, l) => s + leadValue(l), 0),
          createdPrevious.reduce((s, l) => s + leadValue(l), 0)
        ),
      },
      conversionRate: {
        value: conversionRate,
        previous: conversionPrev,
        supporting: conversionRate == null ? "No closed deals yet" : "Won / closed",
        closedCount: closedNow.length,
        trend:
          conversionRate == null || conversionPrev == null
            ? { direction: "none" as const, label: "—", changePct: null }
            : {
                direction:
                  conversionRate === conversionPrev
                    ? ("flat" as const)
                    : conversionRate > conversionPrev
                      ? ("up" as const)
                      : ("down" as const),
                label:
                  conversionRate === conversionPrev
                    ? "No change"
                    : `${Math.abs(conversionRate - conversionPrev)} pts`,
                changePct: conversionRate - conversionPrev,
              },
      },
      avgResponseMinutes: {
        value: avgResponseMinutes,
        previous: avgResponsePrev,
        supporting: "Avg. first call response",
      },
      followUpsCompleted: {
        value: followUpCompletedCount,
        overdue: overdueFollowUps,
        supporting: overdueFollowUps > 0 ? `${overdueFollowUps} overdue` : "All on track",
      },
    },
    goal: goalCard,
    performanceSeries,
    leadSources: {
      total: sourceTotal,
      items: leadSources,
    },
    funnel,
    activity: activity.map((a) => ({
      ...a,
      relative: Math.round((a.count / activityMax) * 100),
    })),
    dealPauses: {
      total: pauseTotal,
      items: pauseBuckets.map((b) => ({
        ...b,
        pct: pauseTotal === 0 ? 0 : Math.round((b.count / pauseTotal) * 100),
      })),
    },
    followUpPerformance: {
      dueToday,
      completedThisWeek: followUpsCompletedThisWeek,
      overdue: overdueFollowUps,
      bestTime: null as string | null, // insufficient historical engagement data
      bestTimeAvailable: false,
    },
    topOpportunities,
    pipelineByStage,
    sourcesDetail,
    forecast: {
      available: false as const,
      message: "Forecasting is not available yet.",
    },
    currency,
  };
}

export function buildSalesReportsCsv(payload: SalesReportsPayload): string {
  const lines: string[] = [];
  lines.push("SegmiQ Sales Reports");
  lines.push(`Period,${payload.meta.periodLabel}`);
  lines.push(`Generated,${payload.meta.generatedAt}`);
  lines.push("");
  lines.push("KPI,Value");
  lines.push(`Leads created,${payload.kpis.leadsCreated.value}`);
  lines.push(`Deals won,${payload.kpis.dealsWon.value}`);
  lines.push(`Pipeline value,${payload.kpis.pipelineValue.value}`);
  lines.push(
    `Conversion rate,${payload.kpis.conversionRate.value == null ? "" : payload.kpis.conversionRate.value}`
  );
  lines.push(
    `Avg response minutes,${
      payload.kpis.avgResponseMinutes.value == null ? "" : payload.kpis.avgResponseMinutes.value
    }`
  );
  lines.push(`Follow-ups completed,${payload.kpis.followUpsCompleted.value}`);
  lines.push("");
  lines.push("Lead sources,Count,Percent");
  for (const s of payload.leadSources.items) {
    lines.push(`${s.label},${s.count},${s.pct}`);
  }
  lines.push("");
  lines.push("Top opportunities,Project,Stage,Value,Score");
  for (const o of payload.topOpportunities) {
    lines.push(
      `"${o.name.replace(/"/g, '""')}",${o.project},${o.status},${o.value},${o.score ?? ""}`
    );
  }
  return lines.join("\n");
}
