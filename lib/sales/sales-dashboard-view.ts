import { format, isToday, startOfDay, startOfMonth, subDays, subMonths } from "date-fns";
import { classifyLeadLane, parseBudgetValue } from "@/lib/lead-lanes";
import { leadJoinName } from "@/lib/format";
import {
  formatDealValue,
  formatDueDate,
  formatResponseTime,
  formatTrendFromPct,
  getLeadSubtitle,
  getPipelineIndustry,
  resolveNumericDealValue,
} from "@/lib/sales/sales-dashboard-display";
import { timeAgo, type PriorityLead } from "@/lib/sales-priority-lead";
import type {
  SalesActivityItem,
  SalesKpiItem,
  SalesLeadSourceItem,
  SalesPerformanceView,
  SalesPipelineStage,
  SalesPriorityTask,
} from "@/components/dashboard/sales/types";

export type SalesDashboardRaw = {
  assignmentMode?: "direct" | "pool" | "round_robin";
  priorityLeads: PriorityLead[];
  allActiveLeads: PriorityLead[];
  mirror: {
    mode: "rules" | "stall" | "ai";
    line: string;
    dominantReason?: string;
  };
  numbers: {
    totalActive: number;
    callNow: number;
    calledToday: number;
    followUpToday: number;
    slipped: number;
    convertLaterCount: number;
    wonThisMonth: number;
  };
  recentActivity: Array<{
    id: string;
    event_type: string;
    event_data: Record<string, unknown> | null;
    channel?: string | null;
    created_at: string;
    lead_id: string;
    leads: { name: string | null } | { name: string | null }[] | null;
  }>;
  recentWins: Array<{
    id: string;
    deal_value: number | null;
    days_to_close: number | null;
    created_at: string;
    lead_id?: string | null;
    leads: { name: string | null } | { name: string | null }[] | null;
  }>;
  insights?: {
    overdueFollowUps: number;
    pipelineValue: number;
    pipelineValueChangePct: number | null;
    conversionRate: number | null;
    conversionChangePct: number | null;
    avgResponseMinutes: number | null;
    wonValueThisMonth: number;
    wonChangePct: number | null;
    leadSources: Array<{
      key: string;
      label: string;
      count: number;
      changePct: number | null;
      previousCount?: number;
    }>;
    performanceTarget: number | null;
    performanceSeries: Array<{ label: string; value: number }>;
  };
};

const STAGE_DEFS: Array<{
  id: string;
  label: string;
  color: string;
  statuses: string[];
}> = [
  { id: "new", label: "New lead", color: "#2684FF", statuses: ["NEW"] },
  { id: "qualified", label: "Qualified", color: "#EAB308", statuses: ["CONTACTED"] },
  { id: "proposal", label: "Proposal sent", color: "#F59E0B", statuses: ["PROPOSAL_SENT"] },
  { id: "negotiation", label: "Negotiation", color: "#7C3AED", statuses: ["NEGOTIATING"] },
  { id: "won", label: "Won", color: "#16A34A", statuses: ["WON"] },
];

const STANDARD_SOURCES: Array<{
  key: string;
  label: string;
  brand: SalesLeadSourceItem["brand"];
}> = [
  { key: "whatsapp", label: "WhatsApp", brand: "whatsapp" },
  { key: "facebook", label: "Facebook Ads", brand: "facebook" },
  { key: "referral", label: "Referrals", brand: "referral" },
  { key: "website", label: "Website", brand: "website" },
  { key: "other", label: "Other", brand: "other" },
];

function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function leadNumericValue(lead: PriorityLead & { deal_value?: number | null }): number {
  const resolved = resolveNumericDealValue(lead);
  if (resolved.amount != null) return resolved.amount;
  return parseBudgetValue(lead.budget) ?? 0;
}

function trendToKpi(
  changePct: number | null | undefined,
  vs: string,
  opts?: { current?: number; previous?: number }
): SalesKpiItem["trend"] | undefined {
  const t = formatTrendFromPct(changePct, opts);
  if (t.direction === "none") return undefined;
  if (t.direction === "flat") return { label: t.label, direction: "flat" };
  if (t.direction === "new") return { label: `${t.label} ${vs}`.trim(), direction: "up" };
  if (t.direction === "up") return { label: `${t.label.replace(/^up\s+/i, "")} ${vs}`, direction: "up" };
  return { label: `${t.label.replace(/^down\s+/i, "")} ${vs}`, direction: "down" };
}

function normalizeSourceKey(raw: string | null | undefined): string {
  const s = (raw ?? "other").toLowerCase();
  if (s.includes("whatsapp") || s === "wa") return "whatsapp";
  if (s.includes("facebook") || s.includes("meta") || s === "fb") return "facebook";
  if (s.includes("refer")) return "referral";
  if (s.includes("web") || s.includes("site") || s.includes("form")) return "website";
  return "other";
}

function taskForLead(lead: PriorityLead, now: Date): { label: string; detail: string } {
  const lane = classifyLeadLane(lead, now).lane;
  if (lane === "call_now") {
    return { label: "First contact", detail: lead.priorityLabel || "New enquiry waiting" };
  }
  if (lane === "recover") {
    return { label: "Recover lead", detail: "Slipped — re-engage today" };
  }
  if (lead.follow_up_date) {
    return {
      label: "Follow-up call",
      detail: lead.timeline?.trim() || lead.budget?.trim() || "Promised follow-up",
    };
  }
  if (lead.status === "PROPOSAL_SENT") {
    return { label: "Quote review", detail: "Proposal sent — check feedback" };
  }
  if (lead.status === "NEGOTIATING") {
    return { label: "Project discussion", detail: "In negotiation" };
  }
  return { label: "Follow up", detail: lead.priorityLabel || "Keep the deal moving" };
}

export function buildSalesKpis(data: SalesDashboardRaw, now = new Date()): SalesKpiItem[] {
  const overdue =
    data.insights?.overdueFollowUps ??
    data.allActiveLeads.filter((l) => {
      if (!l.follow_up_date) return false;
      const d = new Date(l.follow_up_date);
      return d.getTime() < now.getTime() && !isToday(d);
    }).length;

  const followUps = data.numbers.followUpToday + data.numbers.callNow;
  const pipelineValue =
    data.insights?.pipelineValue ??
    data.allActiveLeads.reduce((sum, l) => sum + leadNumericValue(l), 0);

  const conversion = data.insights?.conversionRate;
  const response = data.insights?.avgResponseMinutes ?? null;
  const wonValue = data.insights?.wonValueThisMonth ?? 0;

  return [
    {
      id: "followups",
      label: "Follow-ups due",
      value: String(followUps),
      supporting: overdue > 0 ? `${overdue} overdue` : "All on track",
      trend:
        overdue > 0
          ? { label: `${overdue} overdue`, direction: "alert" }
          : { label: "All on track", direction: "flat" },
      icon: "followups",
      href: "/sales/followups",
    },
    {
      id: "pipeline",
      label: "Pipeline value",
      value: formatDealValue(pipelineValue === 0 ? 0 : pipelineValue),
      supporting: "Active deals",
      trend: trendToKpi(data.insights?.pipelineValueChangePct, "vs last 30 days"),
      icon: "pipeline",
      href: "/sales/leads",
    },
    {
      id: "won",
      label: "Deals won this month",
      value: String(data.numbers.wonThisMonth),
      supporting:
        data.numbers.wonThisMonth === 0
          ? "No deals won this month"
          : formatDealValue(wonValue),
      trend:
        data.numbers.wonThisMonth === 0 && (data.insights?.wonChangePct == null || data.insights.wonChangePct === 0)
          ? undefined
          : trendToKpi(data.insights?.wonChangePct, "vs last month", {
              current: data.numbers.wonThisMonth,
              previous:
                data.insights?.wonChangePct == null
                  ? undefined
                  : data.numbers.wonThisMonth === 0
                    ? 0
                    : undefined,
            }),
      icon: "won",
      href: "/sales/won-lost",
    },
    {
      id: "conversion",
      label: "Conversion rate",
      value: conversion == null ? "—" : `${Math.round(conversion)}%`,
      supporting: conversion == null ? "No closed deals yet" : "Won / closed",
      trend:
        conversion == null
          ? undefined
          : trendToKpi(data.insights?.conversionChangePct, "vs last month"),
      icon: "conversion",
      href: "/sales/reports",
    },
    {
      id: "response",
      label: "Response time",
      value: formatResponseTime(response),
      supporting: "Avg. first reply",
      icon: "response",
      href: "/sales/reports",
    },
  ];
}

export function buildPriorityTasks(
  data: SalesDashboardRaw,
  now = new Date(),
  limit = 6
): SalesPriorityTask[] {
  const scored = [...data.allActiveLeads]
    .map((lead) => {
      const lane = classifyLeadLane(lead, now).lane;
      const rank =
        lane === "call_now" ? 0 : lane === "follow_ups" ? 1 : lane === "recover" ? 2 : 3;
      return { lead, rank };
    })
    .sort((a, b) => a.rank - b.rank || a.lead.created_at.localeCompare(b.lead.created_at));

  return scored.slice(0, limit).map(({ lead }) => {
    const lane = classifyLeadLane(lead, now).lane;
    const due = formatDueDate(lead.follow_up_date, {
      now,
      overdueFallback: lane === "recover",
    });
    if (lane === "call_now" && !lead.follow_up_date) {
      due.label = "Now";
      due.overdue = false;
    }
    const task = taskForLead(lead, now);
    const subtitle = getLeadSubtitle(lead);
    return {
      id: lead.id,
      leadId: lead.id,
      clientId: lead.client_id,
      name: lead.name?.trim() || "Unnamed lead",
      initials: initials(lead.name),
      industry: subtitle,
      location: "",
      dueLabel: due.label,
      overdue: due.overdue,
      taskLabel: task.label,
      taskDetail: task.detail,
      phone: lead.phone,
      formData: lead.form_data ?? null,
      href: `/sales/leads?lead=${lead.id}`,
    };
  });
}

export function buildPipelineStages(
  data: SalesDashboardRaw,
  wonLeads: Array<PriorityLead & { deal_value?: number | null }> = []
): SalesPipelineStage[] {
  const byStatus = new Map<string, PriorityLead[]>();
  for (const lead of data.allActiveLeads) {
    const list = byStatus.get(lead.status) ?? [];
    list.push(lead);
    byStatus.set(lead.status, list);
  }
  if ((byStatus.get("WON")?.length ?? 0) === 0 && wonLeads.length) {
    byStatus.set("WON", wonLeads);
  }

  return STAGE_DEFS.map((stage) => {
    const deals = stage.statuses.flatMap((s) => byStatus.get(s) ?? []);
    const value = deals.reduce((sum, l) => sum + leadNumericValue(l), 0);
    const preview = deals.slice(0, 2).map((lead) => {
      const resolved = resolveNumericDealValue(lead as PriorityLead & { deal_value?: number | null });
      return {
        id: lead.id,
        name: lead.name?.trim() || "Unnamed lead",
        industry: getPipelineIndustry(lead),
        valueLabel: formatDealValue(resolved.amount, { compact: true }),
        href: `/sales/leads?lead=${lead.id}`,
      };
    });
    return {
      id: stage.id,
      label: stage.label,
      color: stage.color,
      dealCount: deals.length,
      valueLabel: formatDealValue(value === 0 && deals.length === 0 ? null : value),
      deals: preview,
      remainingCount: Math.max(0, deals.length - preview.length),
    };
  });
}

export type LeadSourcePeriod =
  | "this_month"
  | "last_month"
  | "last_7_days"
  | "last_30_days"
  | "all";

export const LEAD_SOURCE_PERIOD_OPTIONS: Array<{ id: LeadSourcePeriod; label: string }> = [
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "last_7_days", label: "Last 7 days" },
  { id: "last_30_days", label: "Last 30 days" },
  { id: "all", label: "All time" },
];

function periodWindows(
  period: LeadSourcePeriod,
  now: Date
): {
  from: Date | null;
  to: Date | null;
  prevFrom: Date | null;
  prevTo: Date | null;
} {
  if (period === "all") {
    return { from: null, to: null, prevFrom: null, prevTo: null };
  }
  if (period === "this_month") {
    const from = startOfMonth(now);
    const prevFrom = startOfMonth(subMonths(now, 1));
    return { from, to: null, prevFrom, prevTo: from };
  }
  if (period === "last_month") {
    const from = startOfMonth(subMonths(now, 1));
    const to = startOfMonth(now);
    const prevFrom = startOfMonth(subMonths(now, 2));
    return { from, to, prevFrom, prevTo: from };
  }
  if (period === "last_7_days") {
    const from = startOfDay(subDays(now, 6));
    const prevFrom = startOfDay(subDays(now, 13));
    return { from, to: null, prevFrom, prevTo: from };
  }
  const from = startOfDay(subDays(now, 29));
  const prevFrom = startOfDay(subDays(now, 59));
  return { from, to: null, prevFrom, prevTo: from };
}

function countSourcesInRange(
  leads: PriorityLead[],
  from: Date | null,
  to: Date | null
): Map<string, number> {
  const counted = new Map<string, number>();
  for (const lead of leads) {
    const created = new Date(lead.created_at);
    if (Number.isNaN(created.getTime())) continue;
    if (from && created < from) continue;
    if (to && created >= to) continue;
    const key = normalizeSourceKey(lead.source);
    counted.set(key, (counted.get(key) ?? 0) + 1);
  }
  return counted;
}

export function buildLeadSources(
  data: SalesDashboardRaw,
  period: LeadSourcePeriod = "this_month",
  now = new Date()
): SalesLeadSourceItem[] {
  const { from, to, prevFrom, prevTo } = periodWindows(period, now);

  // Server insights are authoritative for "this month" (includes closed leads).
  if (period === "this_month" && (data.insights?.leadSources?.length ?? 0) > 0) {
    const fromInsights = new Map(
      (data.insights?.leadSources ?? []).map((s) => [normalizeSourceKey(s.key), s])
    );
    return STANDARD_SOURCES.map((std) => {
      const insight = fromInsights.get(std.key);
      const count = insight?.count ?? 0;
      const previous = insight?.previousCount;
      const changePct = insight?.changePct ?? null;
      const safe = formatTrendFromPct(changePct, {
        current: count,
        previous: previous ?? undefined,
      });
      const direction =
        count === 0 && (changePct === -100 || changePct === 100 || changePct === 0)
          ? "none"
          : safe.direction === "none" && changePct == null
            ? "none"
            : count === 0 && changePct != null && Math.abs(changePct) === 100
              ? "none"
              : safe.direction;

      return {
        id: std.key,
        label: insight?.label || std.label,
        count,
        changePct: direction === "none" ? null : changePct,
        brand: std.brand,
        trendLabel:
          direction === "none"
            ? "—"
            : direction === "new"
              ? "New"
              : direction === "flat"
                ? "No change"
                : direction === "up"
                  ? `up ${Math.abs(changePct ?? 0)}%`
                  : `down ${Math.abs(changePct ?? 0)}%`,
        trendDirection: direction === "new" ? "up" : direction === "none" ? "flat" : direction,
      };
    }).sort((a, b) => b.count - a.count);
  }

  const currentCounts = countSourcesInRange(data.allActiveLeads, from, to);
  const previousCounts =
    prevFrom && prevTo
      ? countSourcesInRange(data.allActiveLeads, prevFrom, prevTo)
      : new Map<string, number>();

  return STANDARD_SOURCES.map((std) => {
    const count = currentCounts.get(std.key) ?? 0;
    const previous = previousCounts.get(std.key) ?? 0;
    const changePct =
      period === "all"
        ? null
        : previous === 0 && count === 0
          ? null
          : previous === 0
            ? count > 0
              ? 100
              : null
            : Math.round(((count - previous) / previous) * 100);
    const safe = formatTrendFromPct(changePct, { current: count, previous });
    const direction =
      period === "all"
        ? "none"
        : count === 0 && (changePct === -100 || changePct === 100 || changePct === 0)
          ? "none"
          : safe.direction === "none" && changePct == null
            ? "none"
            : count === 0 && changePct != null && Math.abs(changePct) === 100
              ? "none"
              : safe.direction;

    return {
      id: std.key,
      label: std.label,
      count,
      changePct: direction === "none" ? null : changePct,
      brand: std.brand,
      trendLabel:
        direction === "none"
          ? "—"
          : direction === "new"
            ? "New"
            : direction === "flat"
              ? "No change"
              : direction === "up"
                ? `up ${Math.abs(changePct ?? 0)}%`
                : `down ${Math.abs(changePct ?? 0)}%`,
      trendDirection: direction === "new" ? "up" : direction === "none" ? "flat" : direction,
    };
  }).sort((a, b) => b.count - a.count);
}

export function buildRecentActivity(data: SalesDashboardRaw): SalesActivityItem[] {
  const fromEvents = data.recentActivity.map((event): SalesActivityItem => {
    const name = leadJoinName(event.leads) ?? "Unknown";
    const channel = event.channel ?? (event.event_data?.channel as string | undefined);
    let kind: SalesActivityItem["kind"] = "other";
    let title = event.event_type.replace(/_/g, " ").toLowerCase();
    let detail: string | null = null;

    if (event.event_type === "CALL_LOGGED") {
      kind = channel === "whatsapp" ? "whatsapp" : "call";
      title =
        kind === "whatsapp" ? `${name} replied on WhatsApp` : `Call logged with ${name}`;
      const out = String(event.event_data?.outcome ?? "").toLowerCase().replace(/_/g, " ");
      detail = out || null;
    } else if (event.event_type === "DOCUMENT_SENT") {
      kind = "quote";
      title = `${name} received a document`;
      detail = String(event.event_data?.document_name ?? "Proposal");
    } else if (event.event_type === "STATUS_CHANGED") {
      const to = String(event.event_data?.to_status ?? "").toUpperCase();
      if (to === "WON") {
        kind = "won";
        title = `${name} won`;
      } else {
        kind = "other";
        title = `${name} moved to ${to.toLowerCase().replace(/_/g, " ")}`;
      }
    } else if (event.event_type === "FOLLOW_UP_SET") {
      kind = "call";
      title = `Follow-up scheduled for ${name}`;
    }

    return {
      id: event.id,
      kind,
      title,
      detail,
      timeLabel: timeAgo(event.created_at),
      href: `/sales/leads?lead=${event.lead_id}`,
    };
  });

  const fromWins = data.recentWins.slice(0, 3).map((win): SalesActivityItem => {
    const name = leadJoinName(win.leads) ?? "Unknown";
    const value =
      win.deal_value != null && Number(win.deal_value) > 0
        ? formatDealValue(Number(win.deal_value))
        : null;
    return {
      id: `win-${win.id}`,
      kind: "won",
      title: value ? `${name} won deal worth ${value}` : `${name} won`,
      detail: win.days_to_close != null ? `${win.days_to_close}d to close` : null,
      timeLabel: timeAgo(win.created_at),
      href: win.lead_id ? `/sales/leads?lead=${win.lead_id}` : "/sales/won-lost",
    };
  });

  const merged = [...fromEvents];
  for (const w of fromWins) {
    if (!merged.some((m) => m.kind === "won" && m.title.startsWith(w.title.split(" ")[0]!))) {
      merged.push(w);
    }
  }
  return merged.slice(0, 6);
}

export function buildPerformance(data: SalesDashboardRaw, now = new Date()): SalesPerformanceView {
  const achieved =
    data.insights?.wonValueThisMonth ??
    data.recentWins.reduce((s, w) => s + (Number(w.deal_value) || 0), 0);
  const target = data.insights?.performanceTarget;
  const hasTarget = target != null && target > 0;
  const progressPct = hasTarget
    ? Math.min(100, Math.round((achieved / target!) * 100))
    : 0;
  const remaining = hasTarget ? Math.max(0, target! - achieved) : 0;

  const series =
    data.insights?.performanceSeries?.length
      ? data.insights.performanceSeries
      : buildEmptyMonthSeries(now);

  const hasChartData = series.some((p) => p.value > 0) || achieved > 0;

  return {
    progressPct,
    target: hasTarget ? target! : 0,
    achieved,
    remaining,
    series,
    hasTarget,
    hasChartData,
  };
}

function buildEmptyMonthSeries(now: Date): Array<{ label: string; value: number }> {
  const start = startOfMonth(now);
  const mid = new Date(start);
  mid.setDate(15);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  end.setDate(0);
  return [
    { label: format(start, "d MMM"), value: 0 },
    { label: format(mid, "d MMM"), value: 0 },
    { label: format(end, "d MMM"), value: 0 },
  ];
}

export function greetingPart(date = new Date()): "morning" | "afternoon" | "evening" {
  const h = date.getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

export function formatDashboardDate(date = new Date()): string {
  return format(date, "EEEE, d MMMM").toUpperCase();
}

export function monthLabel(date = new Date()): string {
  return format(date, "MMMM yyyy");
}

export function previousMonthWindow(now = new Date()) {
  const thisStart = startOfMonth(now);
  const prevStart = startOfMonth(subMonths(now, 1));
  return { thisStart, prevStart, thisEnd: now };
}
