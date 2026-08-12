/**
 * Pure Company Pipeline metrics — KPIs, health, filters, sort, next-action display.
 * No I/O. Shared by the aggregator and unit tests.
 */

import { format, isToday, isTomorrow, isYesterday, startOfWeek } from "date-fns";
import type { DealAttentionState } from "@/lib/sales/deals/attention";
import type { DealCommercialValue } from "@/lib/sales/deals/commercial-value";
import { DEAL_ACTIVE_STAGES, DEAL_STAGE_LABEL, isDealActiveStage } from "@/lib/sales/deals/display";
import { getDealNextActionState } from "@/lib/sales/deals/timeline";
import { formatTrend } from "@/lib/sales/sales-dashboard-display";
import type { SalesKpiItem, SalesKpiTrend } from "@/components/dashboard/sales/types";
import type {
  CompanyPipelineDealRow,
  CompanyPipelineFilters,
  CompanyPipelineGroupBy,
  CompanyPipelineHealth,
  CompanyPipelineNextActionView,
  CompanyPipelineSort,
  CompanyPipelineTab,
  CompanyPipelineTabCounts,
} from "@/components/dashboard/company/pipeline/types";
import { DEFAULT_COMPANY_PIPELINE_FILTERS } from "@/components/dashboard/company/pipeline/types";
import type { DealRow, DealStage } from "@/types";

export const COMPANY_PIPELINE_PAGE_SIZE = 10;
export const COMPANY_PIPELINE_DEAL_CAP = 2000;

export const COMPANY_PIPELINE_TABS: { id: CompanyPipelineTab; label: string }[] = [
  { id: "all", label: "All Deals" },
  { id: "QUALIFIED", label: "Qualified" },
  { id: "SCOPING", label: "Scoping" },
  { id: "PROPOSAL_SENT", label: "Proposal sent" },
  { id: "NEGOTIATING", label: "Negotiating" },
  { id: "WON", label: "Won" },
  { id: "LOST", label: "Lost" },
];

/** Same at-risk rule as Company Dashboard (`atRisk` or urgency ≥ 70). */
export function isCompanyPipelineAtRisk(att: DealAttentionState): boolean {
  return att.atRisk || att.urgency >= 70;
}

export function companyPipelineHealth(att: DealAttentionState): CompanyPipelineHealth {
  if (isCompanyPipelineAtRisk(att)) return "at_risk";
  if (att.needsAttention) return "needs_attention";
  return "on_track";
}

export function companyPipelineHealthLabel(health: CompanyPipelineHealth): string {
  if (health === "at_risk") return "At risk";
  if (health === "needs_attention") return "Needs attention";
  return "On track";
}

/** Categorical bar only — not win probability. */
export function companyPipelineHealthBarPct(health: CompanyPipelineHealth): number {
  if (health === "at_risk") return 28;
  if (health === "needs_attention") return 58;
  return 100;
}

export function companyPipelineHealthReason(
  health: CompanyPipelineHealth,
  attentionReason: string
): string {
  const trimmed = attentionReason.trim();
  if (trimmed) return trimmed;
  if (health === "at_risk") return "This Deal needs attention before it stalls.";
  if (health === "needs_attention") return "A follow-up or estimate still needs action.";
  return "Recent activity and a clear next action are recorded.";
}

export function companyPipelineValueLabel(v: DealCommercialValue): string {
  if (v.kind === "pending") return "Value not estimated";
  return v.display;
}

/** Average of known commercial amounts only. Pending values are omitted, never treated as 0. */
export function averageKnownDealValue(amounts: number[]): number | null {
  const known = amounts.filter((n) => Number.isFinite(n));
  if (known.length === 0) return null;
  return known.reduce((sum, n) => sum + n, 0) / known.length;
}

export function sumKnownDealValue(amounts: Array<number | null>): {
  total: number;
  knownCount: number;
  pendingCount: number;
} {
  let total = 0;
  let knownCount = 0;
  let pendingCount = 0;
  for (const n of amounts) {
    if (n == null || !Number.isFinite(n)) {
      pendingCount += 1;
      continue;
    }
    total += n;
    knownCount += 1;
  }
  return { total, knownCount, pendingCount };
}

export function isNextActionDueTodayOrOverdue(
  deal: Pick<DealRow, "stage" | "next_action_at" | "next_action_label">,
  now: Date = new Date()
): boolean {
  const next = getDealNextActionState(deal);
  if (!next.hasNextAction || !next.at) return false;
  if (next.isOverdue) return true;
  const d = new Date(next.at);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function formatExpectedDecision(iso: string | null | undefined): string {
  if (!iso) return "Not set";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not set";
  return format(d, "MMM d, yyyy");
}

export function formatClosedDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return format(d, "MMM d, yyyy");
}

export function formatNextActionView(
  deal: Pick<DealRow, "stage" | "next_action_at" | "next_action_label">,
  now: Date = new Date()
): CompanyPipelineNextActionView {
  const next = getDealNextActionState(deal);
  if (!next.hasNextAction || !next.at) {
    return {
      hasNextAction: false,
      isOverdue: false,
      label: null,
      at: null,
      whenLabel: null,
      urgency: null,
    };
  }
  const d = new Date(next.at);
  if (Number.isNaN(d.getTime())) {
    return {
      hasNextAction: true,
      isOverdue: false,
      label: next.label,
      at: next.at,
      whenLabel: null,
      urgency: null,
    };
  }
  let urgency: CompanyPipelineNextActionView["urgency"] = "later";
  let whenLabel = format(d, "EEE, d MMM");
  if (next.isOverdue) {
    urgency = "overdue";
    whenLabel = "Overdue";
  } else if (isToday(d)) {
    urgency = "today";
    whenLabel = format(d, "'Today,' h:mm a");
  } else if (isTomorrow(d)) {
    urgency = "tomorrow";
    whenLabel = format(d, "'Tomorrow,' h:mm a");
  } else if (isYesterday(d)) {
    urgency = "overdue";
    whenLabel = "Overdue";
  } else {
    const days = Math.round((d.getTime() - now.getTime()) / 86_400_000);
    if (days <= 7) urgency = "soon";
  }
  return {
    hasNextAction: true,
    isOverdue: next.isOverdue,
    label: next.label,
    at: next.at,
    whenLabel,
    urgency,
  };
}

export function locationFromDealOrLead(
  dealLocation: string | null | undefined,
  formData: Record<string, unknown> | null | undefined
): string | null {
  const direct = dealLocation?.trim();
  if (direct) return direct;
  if (!formData || typeof formData !== "object") return null;
  for (const key of ["location", "suburb", "city", "area", "address"]) {
    const v = formData[key];
    if (typeof v === "string" && v.trim() && v.trim() !== "undefined") return v.trim();
  }
  return null;
}

export function decisionMakerLabel(
  name: string | null | undefined,
  status: string | null | undefined
): string | null {
  const n = name?.trim();
  if (n) {
    if (status === "YES") return `${n} (Decision maker)`;
    if (status === "NO") return `${n} (Not the decision maker)`;
    return n;
  }
  if (status === "YES") return "Decision maker confirmed";
  if (status === "NO") return "Not the decision maker";
  if (status === "UNKNOWN") return "Not added";
  return null;
}

export function emptyTabCounts(): CompanyPipelineTabCounts {
  return {
    all: 0,
    QUALIFIED: 0,
    SCOPING: 0,
    PROPOSAL_SENT: 0,
    NEGOTIATING: 0,
    WON: 0,
    LOST: 0,
  };
}

export function countPipelineTabs(rows: Array<{ stage: DealStage }>): CompanyPipelineTabCounts {
  const counts = emptyTabCounts();
  for (const row of rows) {
    if (isDealActiveStage(row.stage)) {
      counts.all += 1;
      counts[row.stage] += 1;
    } else if (row.stage === "WON") {
      counts.WON += 1;
    } else if (row.stage === "LOST") {
      counts.LOST += 1;
    }
  }
  return counts;
}

export function matchesCompanyPipelineTab(
  row: Pick<CompanyPipelineDealRow, "stage">,
  tab: CompanyPipelineTab
): boolean {
  if (tab === "all") return isDealActiveStage(row.stage);
  return row.stage === tab;
}

export function companyPipelineFiltersActive(filters: CompanyPipelineFilters): boolean {
  return (
    filters.ownerId !== "all" ||
    filters.health !== "all" ||
    filters.nextAction !== "all" ||
    filters.source !== "all" ||
    filters.valueMin.trim() !== "" ||
    filters.valueMax.trim() !== ""
  );
}

function parseBound(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function matchesCompanyPipelineSearch(
  row: CompanyPipelineDealRow,
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    row.dealName,
    row.category,
    row.customerName,
    row.customerLocation,
    row.customerPhone,
    row.ownerName,
    row.stageLabel,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function matchesCompanyPipelineFilters(
  row: CompanyPipelineDealRow,
  filters: CompanyPipelineFilters,
  now: Date = new Date()
): boolean {
  if (filters.ownerId !== "all" && row.ownerId !== filters.ownerId) return false;
  if (filters.health !== "all" && row.health !== filters.health) return false;
  if (filters.source !== "all" && row.sourceKey !== filters.source) return false;

  if (filters.nextAction !== "all") {
    if (filters.nextAction === "none") {
      if (row.nextAction.hasNextAction) return false;
    } else if (!row.nextAction.at) {
      return false;
    } else {
      const d = new Date(row.nextAction.at);
      if (Number.isNaN(d.getTime())) return false;
      if (filters.nextAction === "overdue") {
        if (!row.nextAction.isOverdue) return false;
      } else if (filters.nextAction === "today") {
        if (!isToday(d) || row.nextAction.isOverdue) return false;
      } else if (filters.nextAction === "week") {
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        if (d < weekStart || d >= weekEnd) return false;
      }
    }
  }

  const min = parseBound(filters.valueMin);
  const max = parseBound(filters.valueMax);
  if (min != null || max != null) {
    if (row.valueKnown == null) return false;
    if (min != null && row.valueKnown < min) return false;
    if (max != null && row.valueKnown > max) return false;
  }
  return true;
}

export function sortCompanyPipelineRows(
  rows: CompanyPipelineDealRow[],
  sort: CompanyPipelineSort
): CompanyPipelineDealRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (sort === "value") {
      const av = a.valueKnown ?? -1;
      const bv = b.valueKnown ?? -1;
      if (bv !== av) return bv - av;
    } else if (sort === "expected_decision") {
      const at = a.expectedDecisionAt ? Date.parse(a.expectedDecisionAt) : Number.POSITIVE_INFINITY;
      const bt = b.expectedDecisionAt ? Date.parse(b.expectedDecisionAt) : Number.POSITIVE_INFINITY;
      if (at !== bt) return at - bt;
    } else if (sort === "newest") {
      const at = Date.parse(a.createdAt);
      const bt = Date.parse(b.createdAt);
      if (bt !== at) return bt - at;
    } else if (sort === "last_activity") {
      const at = Date.parse(a.lastActivityAt);
      const bt = Date.parse(b.lastActivityAt);
      if (bt !== at) return bt - at;
    } else if (sort === "attention") {
      if (b.urgency !== a.urgency) return b.urgency - a.urgency;
    } else {
      const aNext = a.nextAction.at ? Date.parse(a.nextAction.at) : Number.POSITIVE_INFINITY;
      const bNext = b.nextAction.at ? Date.parse(b.nextAction.at) : Number.POSITIVE_INFINITY;
      if (aNext !== bNext) return aNext - bNext;
      if (b.urgency !== a.urgency) return b.urgency - a.urgency;
    }
    return a.dealName.localeCompare(b.dealName);
  });
  return copy;
}

export function groupKeyForRow(
  row: CompanyPipelineDealRow,
  groupBy: CompanyPipelineGroupBy
): { key: string; label: string } {
  if (groupBy === "owner") {
    return {
      key: row.ownerId ?? "unassigned",
      label: row.ownerName?.trim() || "Unassigned",
    };
  }
  if (groupBy === "stage") {
    return { key: row.stage, label: DEAL_STAGE_LABEL[row.stage] ?? row.stage };
  }
  return { key: "all", label: "" };
}

export function pipelineTrend(
  current: number,
  previous: number,
  vs: string
): SalesKpiTrend | undefined {
  const t = formatTrend(current, previous);
  if (t.direction === "none") return undefined;
  if (t.direction === "flat") return { label: `${t.label} ${vs}`.trim(), direction: "flat" };
  if (t.direction === "new") return { label: `${t.label} ${vs}`.trim(), direction: "up" };
  if (t.direction === "up") return { label: `${t.label} ${vs}`, direction: "up" };
  return { label: `${t.label} ${vs}`, direction: "down" };
}

export function buildCompanyPipelineKpis(opts: {
  pipelineKnown: number;
  awaitingEstimate: number;
  activeDeals: number;
  wonThisMonth: number;
  wonLastMonth: number;
  avgDealValue: number | null;
  avgLabel: string;
  dealsAtRisk: number;
  nextActionsDue: number;
  currencyLabel: (n: number) => string;
}): SalesKpiItem[] {
  const pipelineValue =
    opts.activeDeals > 0 && opts.pipelineKnown === 0 && opts.awaitingEstimate > 0
      ? "—"
      : opts.currencyLabel(opts.pipelineKnown);

  const pipelineSupporting =
    opts.awaitingEstimate > 0
      ? `${opts.awaitingEstimate} Deal${opts.awaitingEstimate === 1 ? "" : "s"} awaiting estimate`
      : "Active Deals only";

  return [
    {
      id: "pipeline-value",
      label: "Total Pipeline Value",
      value: pipelineValue,
      supporting: pipelineSupporting,
      icon: "pipeline",
    },
    {
      id: "active-deals",
      label: "Active Deals",
      value: String(opts.activeDeals),
      supporting: "Qualified through Negotiating",
      icon: "deals",
    },
    {
      id: "won-month",
      label: "Won This Month",
      value: String(opts.wonThisMonth),
      supporting: opts.wonThisMonth === 0 ? "No Wins this month" : "Closed Won Deals",
      trend: pipelineTrend(opts.wonThisMonth, opts.wonLastMonth, "vs last month"),
      icon: "won",
    },
    {
      id: "avg-value",
      label: "Avg. Deal Value",
      value: opts.avgDealValue == null ? "—" : opts.avgLabel,
      supporting: "Known active Deal values",
      icon: "conversion",
    },
    {
      id: "at-risk",
      label: "Deals at Risk",
      value: String(opts.dealsAtRisk),
      supporting:
        opts.dealsAtRisk === 0
          ? "No active Deals currently need risk attention"
          : "View details",
      icon: "followups",
      href: "/client/leads/pipeline?health=at_risk",
    },
    {
      id: "next-actions",
      label: "Next Actions Due",
      value: String(opts.nextActionsDue),
      supporting: "Due today or overdue",
      icon: "response",
    },
  ];
}

export function isClosedPipelineTab(tab: CompanyPipelineTab): boolean {
  return tab === "WON" || tab === "LOST";
}

export { DEAL_ACTIVE_STAGES, DEFAULT_COMPANY_PIPELINE_FILTERS };
