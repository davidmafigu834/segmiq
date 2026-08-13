/**
 * Pure Company Leads metrics — KPIs, tabs, filters, sort, score signals.
 * No I/O. Shared by the aggregator and unit tests.
 */

import { format, isToday, isTomorrow, isYesterday, startOfDay, subDays } from "date-fns";
import type { SalesKpiItem, SalesKpiTrend } from "@/components/dashboard/sales/types";
import { formatResponseTime, formatTrend } from "@/lib/sales/sales-dashboard-display";
import { leadScoreBand, leadScoreLabel } from "@/lib/sales/format";
import { formatLeadSource } from "@/lib/sales/leads-directory/format";
import type {
  CompanyLeadRow,
  CompanyLeadScoreSignal,
  CompanyLeadsFilters,
  CompanyLeadsNextActionView,
  CompanyLeadsSort,
  CompanyLeadsTab,
  CompanyLeadsTabCounts,
} from "@/components/dashboard/company/leads/types";
import { DEFAULT_COMPANY_LEADS_FILTERS } from "@/components/dashboard/company/leads/types";

export const COMPANY_LEADS_PAGE_SIZE = 10;
export const COMPANY_LEADS_CAP = 2000;
export const HOT_SCORE_THRESHOLD = 70;

/** Same qualified set as Company Dashboard. */
export const QUALIFIED_LEAD_STATUSES = new Set([
  "QUALIFIED",
  "CONVERTED_TO_DEAL",
  "PROPOSAL_SENT",
  "NEGOTIATING",
  "WON",
]);

/** Lifecycle after a real customer contact — not viewed / assigned / edited. */
export const CONTACTED_OR_BEYOND = new Set([
  "CONTACTED",
  "QUALIFIED",
  "CONVERTED_TO_DEAL",
  "PROPOSAL_SENT",
  "NEGOTIATING",
  "WON",
  "LOST",
]);

export const COMPANY_LEADS_TABS: { id: CompanyLeadsTab; label: string }[] = [
  { id: "all", label: "All Leads" },
  { id: "new", label: "New" },
  { id: "hot", label: "Hot" },
  { id: "contacted", label: "Contacted" },
  { id: "qualified", label: "Qualified" },
  { id: "not_qualified", label: "Not Qualified" },
];

export function isHotIntent(score: number | null | undefined): boolean {
  return leadScoreBand(score) === "hot";
}

export function companyLeadLifecycleLabel(status: string | null | undefined): string {
  if (!status) return "—";
  if (status === "NEW") return "New";
  if (status === "CONTACTED") return "Contacted";
  if (status === "QUALIFIED") return "Qualified";
  if (status === "CONVERTED_TO_DEAL") return "Deal created";
  if (status === "NOT_QUALIFIED") return "Not Qualified";
  if (status === "PROPOSAL_SENT") return "Proposal sent";
  if (status === "NEGOTIATING") return "Negotiating";
  if (status === "WON") return "Won";
  if (status === "LOST") return "Lost";
  return status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function companyLeadLifecycleTone(
  status: string | null | undefined
): "info" | "success" | "warning" | "danger" | "neutral" | "purple" {
  if (status === "NEW" || status === "CONTACTED") return "info";
  if (status === "QUALIFIED" || status === "CONVERTED_TO_DEAL" || status === "WON") return "success";
  if (status === "NOT_QUALIFIED" || status === "LOST") return "danger";
  if (status === "NEGOTIATING") return "warning";
  if (status === "PROPOSAL_SENT") return "purple";
  return "neutral";
}

export function companyLeadHasDeal(opts: {
  status: string;
  activeDealId?: string | null;
}): boolean {
  return opts.status === "CONVERTED_TO_DEAL" || Boolean(opts.activeDealId);
}

export function formatCompanyLeadCreatedAt(
  iso: string | null | undefined,
  now: Date = new Date()
): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  if (isToday(d)) return format(d, "'Today,' h:mm a");
  if (isYesterday(d)) return format(d, "'Yesterday,' h:mm a");
  if (d.getFullYear() === now.getFullYear()) return format(d, "d MMM");
  return format(d, "d MMM yyyy");
}

export function formatCompanyLeadActivityAt(iso: string | null | undefined): string {
  if (!iso) return "Not contacted yet";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not contacted yet";
  if (isToday(d)) return format(d, "'Today,' h:mm a");
  if (isYesterday(d)) return format(d, "'Yesterday,' h:mm a");
  return format(d, "d MMM yyyy, h:mm a");
}

export function formatLastActivityLabel(iso: string | null | undefined): string {
  if (!iso) return "No activity yet";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "No activity yet";
  if (isToday(d)) return format(d, "'Today,' h:mm a");
  if (isYesterday(d)) return format(d, "'Yesterday,' h:mm a");
  return format(d, "d MMM yyyy, h:mm a");
}

export function formatLeadNextActionView(
  followUpAt: string | null | undefined,
  opts?: { label?: string | null; now?: Date; customerWaiting?: boolean }
): CompanyLeadsNextActionView {
  const now = opts?.now ?? new Date();
  const waiting = Boolean(opts?.customerWaiting);
  if (!followUpAt) {
    return {
      hasNextAction: waiting,
      isOverdue: waiting,
      label: waiting ? "Reply to customer" : null,
      at: null,
      whenLabel: waiting ? "Waiting" : null,
      urgency: waiting ? "overdue" : null,
      completable: false,
    };
  }
  const d = new Date(followUpAt);
  if (Number.isNaN(d.getTime())) {
    return {
      hasNextAction: true,
      isOverdue: false,
      label: opts?.label?.trim() || "Follow up",
      at: followUpAt,
      whenLabel: null,
      urgency: null,
      completable: true,
    };
  }
  let urgency: CompanyLeadsNextActionView["urgency"] = "later";
  let whenLabel = format(d, "EEE, d MMM");
  const overdue = d.getTime() < now.getTime() && !isToday(d);
  if (overdue) {
    urgency = "overdue";
    whenLabel = "Overdue";
  } else if (isToday(d)) {
    urgency = "today";
    whenLabel = "Today";
  } else if (isTomorrow(d)) {
    urgency = "tomorrow";
    whenLabel = "Tomorrow";
  } else {
    const days = Math.round((d.getTime() - now.getTime()) / 86_400_000);
    if (days <= 7) urgency = "soon";
  }
  return {
    hasNextAction: true,
    isOverdue: overdue,
    label: opts?.label?.trim() || (waiting ? "Reply to customer" : "Follow up"),
    at: followUpAt,
    whenLabel,
    urgency,
    completable: !waiting,
  };
}

/**
 * Explainable signals from stored score breakdown + qualification fields.
 * Only returns facts that are actually present — never a static mock checklist.
 */
export function companyLeadScoreSignals(input: {
  scoreBreakdown?: Record<string, number> | null;
  source?: string | null;
  budget?: string | null;
  customerNeed?: string | null;
  buyingTimeframe?: string | null;
  decisionMakerStatus?: string | null;
  projectType?: string | null;
  status?: string | null;
}): CompanyLeadScoreSignal[] {
  const out: CompanyLeadScoreSignal[] = [];
  const breakdown = input.scoreBreakdown ?? {};
  const need = input.customerNeed?.trim();
  if (need) out.push({ id: "need", label: "Need captured", done: true });

  const budgetText = input.budget?.trim();
  const budgetScore = Number(breakdown.budget) || 0;
  if (budgetText || budgetScore > 0) {
    out.push({ id: "budget", label: "Budget indicated", done: true });
  }

  const timeframe = input.buyingTimeframe?.trim();
  if (timeframe) out.push({ id: "timeframe", label: "Timeframe captured", done: true });

  if (input.decisionMakerStatus === "YES") {
    out.push({ id: "decision", label: "Decision maker confirmed", done: true });
  }

  const project = input.projectType?.trim();
  if (project) out.push({ id: "project", label: "Service identified", done: true });

  if ((Number(breakdown.calls) || 0) > 0) {
    out.push({ id: "calls", label: "Reached by phone", done: true });
  }
  if ((Number(breakdown.assets_sent) || 0) > 0) {
    out.push({ id: "assets", label: "Sales material sent", done: true });
  }

  const src = (input.source ?? "").toUpperCase();
  if (src.includes("WHATSAPP") || (Number(breakdown.source) || 0) >= 6) {
    if (src.includes("WHATSAPP")) {
      out.push({ id: "wa", label: "WhatsApp enquiry", done: true });
    } else if ((Number(breakdown.source) || 0) > 0) {
      out.push({ id: "source", label: "High-intent source", done: true });
    }
  }

  if (input.status === "QUALIFIED" || input.status === "CONVERTED_TO_DEAL") {
    out.push({ id: "qualified", label: "Opportunity confirmed", done: true });
  }

  const seen = new Set<string>();
  const unique: CompanyLeadScoreSignal[] = [];
  for (const s of out) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    unique.push(s);
    if (unique.length >= 4) break;
  }
  return unique;
}

export function customerNeedFromLead(opts: {
  customerNeed?: string | null;
  formData?: Record<string, unknown> | null;
  projectType?: string | null;
}): string | null {
  const direct = opts.customerNeed?.trim();
  if (direct) return direct;
  const fd = opts.formData;
  if (fd && typeof fd === "object") {
    for (const key of ["need", "customer_need", "message", "first_message", "enquiry", "notes"]) {
      const v = fd[key];
      if (typeof v === "string" && v.trim() && v.trim() !== "undefined") return v.trim();
    }
  }
  const project = opts.projectType?.trim();
  return project || null;
}

export function emptyTabCounts(): CompanyLeadsTabCounts {
  return {
    all: 0,
    new: 0,
    hot: 0,
    contacted: 0,
    qualified: 0,
    not_qualified: 0,
  };
}

export function matchesCompanyLeadsTab(
  row: Pick<CompanyLeadRow, "lifecycle" | "leadScore">,
  tab: CompanyLeadsTab
): boolean {
  if (tab === "all") return true;
  if (tab === "new") return row.lifecycle === "NEW";
  if (tab === "hot") {
    return row.lifecycle !== "NOT_QUALIFIED" && isHotIntent(row.leadScore);
  }
  if (tab === "contacted") return row.lifecycle === "CONTACTED";
  if (tab === "qualified") return QUALIFIED_LEAD_STATUSES.has(row.lifecycle);
  return row.lifecycle === "NOT_QUALIFIED";
}

export function countCompanyLeadsTabs(
  rows: Array<Pick<CompanyLeadRow, "lifecycle" | "leadScore">>
): CompanyLeadsTabCounts {
  const counts = emptyTabCounts();
  for (const row of rows) {
    counts.all += 1;
    if (row.lifecycle === "NEW") counts.new += 1;
    if (row.lifecycle !== "NOT_QUALIFIED" && isHotIntent(row.leadScore)) counts.hot += 1;
    if (row.lifecycle === "CONTACTED") counts.contacted += 1;
    if (QUALIFIED_LEAD_STATUSES.has(row.lifecycle)) counts.qualified += 1;
    if (row.lifecycle === "NOT_QUALIFIED") counts.not_qualified += 1;
  }
  return counts;
}

export function companyLeadsFiltersActive(filters: CompanyLeadsFilters): boolean {
  return (
    filters.ownerId !== "all" ||
    filters.source !== "all" ||
    filters.lifecycle !== "all" ||
    filters.intent !== "all" ||
    filters.hasDeal !== "all" ||
    filters.firstContact !== "all"
  );
}

export function matchesCompanyLeadsSearch(row: CompanyLeadRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    row.identity,
    row.enquiryContext,
    row.location,
    row.phone,
    row.email,
    row.ownerName,
    row.sourceLabel,
    row.lifecycleLabel,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function matchesCompanyLeadsFilters(
  row: CompanyLeadRow,
  filters: CompanyLeadsFilters
): boolean {
  if (filters.ownerId === "unassigned") {
    if (row.ownerId) return false;
  } else if (filters.ownerId !== "all" && row.ownerId !== filters.ownerId) {
    return false;
  }
  if (filters.source !== "all" && row.sourceKey !== filters.source) return false;
  if (filters.lifecycle !== "all" && row.lifecycle !== filters.lifecycle) return false;
  if (filters.intent !== "all" && row.intent !== filters.intent) return false;
  if (filters.hasDeal === "has_deal" && !row.hasDeal) return false;
  if (filters.hasDeal === "no_deal" && row.hasDeal) return false;
  if (filters.firstContact === "contacted" && !row.firstContactAt) return false;
  if (filters.firstContact === "not_contacted" && row.firstContactAt) return false;
  return true;
}

export function sortCompanyLeadsRows(rows: CompanyLeadRow[], sort: CompanyLeadsSort): CompanyLeadRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (sort === "oldest") {
      const at = Date.parse(a.createdAt);
      const bt = Date.parse(b.createdAt);
      if (at !== bt) return at - bt;
    } else if (sort === "score") {
      const as = a.leadScore ?? -1;
      const bs = b.leadScore ?? -1;
      if (bs !== as) return bs - as;
    } else if (sort === "last_activity") {
      const at = a.lastActivityAt ? Date.parse(a.lastActivityAt) : 0;
      const bt = b.lastActivityAt ? Date.parse(b.lastActivityAt) : 0;
      if (bt !== at) return bt - at;
    } else if (sort === "next_action") {
      const aNext = a.nextAction.at ? Date.parse(a.nextAction.at) : Number.POSITIVE_INFINITY;
      const bNext = b.nextAction.at ? Date.parse(b.nextAction.at) : Number.POSITIVE_INFINITY;
      if (aNext !== bNext) return aNext - bNext;
    } else if (sort === "response_urgency") {
      const aWait = !a.firstContactAt ? 1 : 0;
      const bWait = !b.firstContactAt ? 1 : 0;
      if (bWait !== aWait) return bWait - aWait;
      const as = a.leadScore ?? -1;
      const bs = b.leadScore ?? -1;
      if (bs !== as) return bs - as;
      const at = Date.parse(a.createdAt);
      const bt = Date.parse(b.createdAt);
      if (bt !== at) return bt - at;
    } else {
      const at = Date.parse(a.createdAt);
      const bt = Date.parse(b.createdAt);
      if (bt !== at) return bt - at;
    }
    return a.identity.localeCompare(b.identity);
  });
  return copy;
}

export function leadsTrend(
  current: number,
  previous: number,
  vs: string,
  opts?: { invertGood?: boolean }
): SalesKpiTrend | undefined {
  const t = formatTrend(current, previous);
  if (t.direction === "none") return undefined;
  if (t.direction === "flat") return { label: `${t.label} ${vs}`.trim(), direction: "flat" };
  if (t.direction === "new") return { label: `${t.label} ${vs}`.trim(), direction: "up" };
  if (opts?.invertGood) {
    if (t.direction === "down") {
      return { label: `${t.label} ${vs}`.trim(), direction: "up" };
    }
    return { label: `${t.label} ${vs}`.trim(), direction: "down" };
  }
  if (t.direction === "up") return { label: `${t.label} ${vs}`, direction: "up" };
  return { label: `${t.label} ${vs}`, direction: "down" };
}

export function conversionRate(converted: number, cohort: number): number | null {
  if (cohort <= 0) return null;
  return Math.round((converted / cohort) * 1000) / 10;
}

export function periodBounds(now: Date = new Date()): {
  period30Start: Date;
  period60Start: Date;
} {
  const today = startOfDay(now);
  return {
    period30Start: subDays(today, 30),
    period60Start: subDays(today, 60),
  };
}

export function inPeriod(iso: string, from: Date, toExclusive?: Date): boolean {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  if (t < from.getTime()) return false;
  if (toExclusive && t >= toExclusive.getTime()) return false;
  return true;
}

export function parseCompanyLeadsTab(raw: string | null | undefined): CompanyLeadsTab | null {
  if (!raw) return null;
  const v = raw.trim();
  if (v === "QUALIFIED" || v === "qualified") return "qualified";
  if (v === "NEW" || v === "new") return "new";
  if (v === "HOT" || v === "hot") return "hot";
  if (v === "CONTACTED" || v === "contacted") return "contacted";
  if (v === "NOT_QUALIFIED" || v === "not_qualified") return "not_qualified";
  if (v === "all") return "all";
  return null;
}

export function buildCompanyLeadsKpis(opts: {
  newLeads: number;
  newLeadsPrev: number;
  hotLeads: number;
  hotLeadsPrev: number | null;
  contacted: number;
  contactedPrev: number;
  qualified: number;
  qualifiedPrev: number;
  conversionPct: number | null;
  conversionPrev: number | null;
  avgResponseMinutes: number | null;
  avgResponseMinutesPrev: number | null;
}): SalesKpiItem[] {
  const vs = "vs last 30 days";
  const conversionValue =
    opts.conversionPct == null ? "—" : `${opts.conversionPct}%`;
  const conversionTrend =
    opts.conversionPct != null && opts.conversionPrev != null
      ? leadsTrend(opts.conversionPct, opts.conversionPrev, vs)
      : undefined;

  const responseTrend =
    opts.avgResponseMinutes != null && opts.avgResponseMinutesPrev != null
      ? leadsTrend(opts.avgResponseMinutes, opts.avgResponseMinutesPrev, vs, {
          invertGood: true,
        })
      : undefined;

  return [
    {
      id: "new-leads",
      label: "New Leads",
      value: String(opts.newLeads),
      supporting: "Last 30 days",
      trend: leadsTrend(opts.newLeads, opts.newLeadsPrev, vs),
      icon: "enquiries",
      href: "/client/leads?tab=new",
    },
    {
      id: "hot-leads",
      label: "Hot Leads",
      value: String(opts.hotLeads),
      supporting: "Score 70+",
      trend:
        opts.hotLeadsPrev != null ? leadsTrend(opts.hotLeads, opts.hotLeadsPrev, vs) : undefined,
      icon: "followups",
      href: "/client/leads?tab=hot",
    },
    {
      id: "contacted",
      label: "Contacted",
      value: String(opts.contacted),
      supporting: "First response recorded",
      trend: leadsTrend(opts.contacted, opts.contactedPrev, vs),
      icon: "deals",
      href: "/client/leads?tab=contacted",
    },
    {
      id: "qualified",
      label: "Qualified",
      value: String(opts.qualified),
      supporting: "Last 30 days",
      trend: leadsTrend(opts.qualified, opts.qualifiedPrev, vs),
      icon: "won",
      href: "/client/leads?tab=qualified",
    },
    {
      id: "conversion",
      label: "Conversion Rate",
      value: conversionValue,
      supporting: "Lead → Deal · last 30 days",
      trend: conversionTrend,
      icon: "conversion",
    },
    {
      id: "response",
      label: "Avg. Response Time",
      value: formatResponseTime(opts.avgResponseMinutes),
      supporting: "Lead captured → first response",
      trend: responseTrend,
      icon: "response",
      href: "/client/reports",
    },
  ];
}

export function sourceOptionFromRaw(raw: string | null | undefined) {
  return formatLeadSource(raw);
}

export function intentLabelForScore(score: number | null | undefined): string | null {
  const label = leadScoreLabel(score);
  if (!label) return null;
  return `${label} Lead`;
}

export { DEFAULT_COMPANY_LEADS_FILTERS, formatLeadSource, leadScoreBand, leadScoreLabel };
