import type { SalesKpiItem } from "@/components/dashboard/sales/types";

type ViewingBadgeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "purple";

export type ViewingWorkspaceTab = "upcoming" | "completed" | "cancelled" | "all";

export const VIEWING_WORKSPACE_TABS: { id: ViewingWorkspaceTab; label: string }[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
  { id: "all", label: "All" },
];

/** Company Viewings workspace tabs (SegmiQ 2.0 table-first). */
export type ViewingCompanyTab = "upcoming" | "today" | "overdue" | "completed" | "cancelled" | "all";

export const VIEWING_COMPANY_TABS: { id: ViewingCompanyTab; label: string }[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "today", label: "Today" },
  { id: "overdue", label: "Overdue" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
  { id: "all", label: "All" },
];

export const VIEWING_COMPANY_PAGE_SIZE = 10;

export type ViewingCompanySort = "soonest" | "latest" | "buyer_asc" | "property_asc";

export type ViewingCompanyFilters = {
  agentId: string;
  feedback: "all" | "awaiting" | "recorded";
};

export const DEFAULT_VIEWING_COMPANY_FILTERS: ViewingCompanyFilters = {
  agentId: "all",
  feedback: "all",
};

/** Map DB viewing status onto workspace tabs without dropping unknown values. */
export function viewingMatchesTab(
  status: string | null | undefined,
  tab: ViewingWorkspaceTab
): boolean {
  const s = String(status ?? "").toLowerCase();
  if (tab === "all") return true;
  if (tab === "completed") return s === "completed";
  if (tab === "cancelled") return s === "cancelled" || s === "no_show";
  return s === "scheduled";
}

export function parseViewingCompanyTab(value: string | null | undefined): ViewingCompanyTab | null {
  if (
    value === "upcoming" ||
    value === "today" ||
    value === "overdue" ||
    value === "completed" ||
    value === "cancelled" ||
    value === "all"
  ) {
    return value;
  }
  return null;
}

export function viewingStatusNorm(status: string | null | undefined): string {
  return String(status ?? "").toLowerCase() || "scheduled";
}

export function viewingIsScheduled(status: string | null | undefined): boolean {
  return viewingStatusNorm(status) === "scheduled";
}

export function viewingIsOverdue(
  status: string | null | undefined,
  scheduledAt: string | null | undefined,
  now = Date.now()
): boolean {
  if (!viewingIsScheduled(status) || !scheduledAt) return false;
  const t = new Date(scheduledAt).getTime();
  return Number.isFinite(t) && t < now;
}

export function viewingIsToday(
  scheduledAt: string | null | undefined,
  now = new Date()
): boolean {
  if (!scheduledAt) return false;
  const d = new Date(scheduledAt);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function viewingMatchesCompanyTab(
  row: { status: string; scheduled_at: string },
  tab: ViewingCompanyTab,
  now = Date.now()
): boolean {
  if (tab === "all") return true;
  if (tab === "completed") return viewingMatchesTab(row.status, "completed");
  if (tab === "cancelled") return viewingMatchesTab(row.status, "cancelled");
  if (!viewingIsScheduled(row.status)) return false;
  if (tab === "today") return viewingIsToday(row.scheduled_at, new Date(now));
  if (tab === "overdue") return viewingIsOverdue(row.status, row.scheduled_at, now);
  return !viewingIsOverdue(row.status, row.scheduled_at, now);
}

export function viewingCompanyTabCounts(
  rows: Array<{ status: string; scheduled_at: string }>,
  now = Date.now()
): Record<ViewingCompanyTab, number> {
  const next: Record<ViewingCompanyTab, number> = {
    upcoming: 0,
    today: 0,
    overdue: 0,
    completed: 0,
    cancelled: 0,
    all: rows.length,
  };
  for (const row of rows) {
    if (viewingMatchesCompanyTab(row, "upcoming", now)) next.upcoming += 1;
    if (viewingMatchesCompanyTab(row, "today", now)) next.today += 1;
    if (viewingMatchesCompanyTab(row, "overdue", now)) next.overdue += 1;
    if (viewingMatchesCompanyTab(row, "completed", now)) next.completed += 1;
    if (viewingMatchesCompanyTab(row, "cancelled", now)) next.cancelled += 1;
  }
  return next;
}

export function viewingStatusTone(status: string | null | undefined): ViewingBadgeTone {
  const s = viewingStatusNorm(status);
  if (s === "completed") return "success";
  if (s === "cancelled") return "neutral";
  if (s === "no_show") return "danger";
  return "info";
}

export function viewingSentimentLabel(sentiment: string | null | undefined): string {
  const s = String(sentiment ?? "").toLowerCase();
  if (s === "positive") return "Positive";
  if (s === "neutral") return "Neutral";
  if (s === "negative") return "Negative";
  return "Not recorded";
}

export function viewingSentimentTone(sentiment: string | null | undefined): ViewingBadgeTone {
  const s = String(sentiment ?? "").toLowerCase();
  if (s === "positive") return "success";
  if (s === "negative") return "danger";
  if (s === "neutral") return "neutral";
  return "neutral";
}

export function viewingMatchesSearch(
  row: {
    contact_name: string | null;
    listing_address: string | null;
    listing_suburb: string | null;
    agent_name: string | null;
  },
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [row.contact_name, row.listing_address, row.listing_suburb, row.agent_name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function viewingCompanyFiltersActive(filters: ViewingCompanyFilters): boolean {
  return filters.agentId !== "all" || filters.feedback !== "all";
}

export function viewingMatchesCompanyFilters(
  row: { agent_id: string | null; feedback_text: string | null },
  filters: ViewingCompanyFilters
): boolean {
  if (filters.agentId !== "all") {
    if (filters.agentId === "unassigned") {
      if (row.agent_id) return false;
    } else if (row.agent_id !== filters.agentId) {
      return false;
    }
  }
  if (filters.feedback === "awaiting") {
    if (row.feedback_text?.trim()) return false;
  } else if (filters.feedback === "recorded") {
    if (!row.feedback_text?.trim()) return false;
  }
  return true;
}

export function sortViewingCompanyRows<
  T extends { scheduled_at: string; contact_name: string | null; listing_address: string | null; listing_suburb: string | null },
>(rows: T[], sort: ViewingCompanySort): T[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (sort === "latest") return b.scheduled_at.localeCompare(a.scheduled_at);
    if (sort === "buyer_asc") {
      return (a.contact_name ?? "").localeCompare(b.contact_name ?? "", undefined, { sensitivity: "base" });
    }
    if (sort === "property_asc") {
      const pa = [a.listing_address, a.listing_suburb].filter(Boolean).join(", ");
      const pb = [b.listing_address, b.listing_suburb].filter(Boolean).join(", ");
      return pa.localeCompare(pb, undefined, { sensitivity: "base" });
    }
    return a.scheduled_at.localeCompare(b.scheduled_at);
  });
  return copy;
}

export function viewingCompanyKpis(
  rows: Array<{ status: string; scheduled_at: string; feedback_text: string | null }>,
  now = Date.now()
): SalesKpiItem[] {
  const counts = viewingCompanyTabCounts(rows, now);
  let awaitingFeedback = 0;
  for (const row of rows) {
    if (viewingMatchesTab(row.status, "completed") && !row.feedback_text?.trim()) awaitingFeedback += 1;
  }
  return [
    {
      id: "upcoming",
      label: "Upcoming",
      value: String(counts.upcoming),
      supporting: "Scheduled ahead",
      icon: "followups",
      href: "/client/viewings?tab=upcoming",
    },
    {
      id: "today",
      label: "Today",
      value: String(counts.today),
      supporting: "On today's diary",
      icon: "customers",
      href: "/client/viewings?tab=today",
    },
    {
      id: "overdue",
      label: "Overdue",
      value: String(counts.overdue),
      supporting: counts.overdue ? "Needs attention" : "None overdue",
      icon: "followups",
      href: "/client/viewings?tab=overdue",
      trend: counts.overdue ? { label: "Needs attention", direction: "alert" } : undefined,
    },
    {
      id: "completed",
      label: "Completed",
      value: String(counts.completed),
      supporting: "With or without notes",
      icon: "won",
      href: "/client/viewings?tab=completed",
    },
    {
      id: "awaiting",
      label: "Awaiting feedback",
      value: String(awaitingFeedback),
      supporting: "Completed, no notes yet",
      icon: "enquiries",
      href: "/client/viewings?tab=completed&feedback=awaiting",
    },
  ];
}

/**
 * Viewings have no client_id column. Scope them through listing IDs that already
 * belong to the authenticated company. Never query viewings with an empty IN ().
 */
export function viewingsFetchPlan(
  clientListingIds: Array<string | null | undefined>
): { kind: "empty"; listingIds: string[] } | { kind: "scoped"; listingIds: string[] } {
  const listingIds = [...new Set(clientListingIds.filter((id): id is string => Boolean(id)))];
  if (listingIds.length === 0) return { kind: "empty", listingIds: [] };
  return { kind: "scoped", listingIds };
}

export function viewingStatusLabel(status: string | null | undefined): string {
  const s = String(status ?? "").toLowerCase();
  if (s === "scheduled") return "Scheduled";
  if (s === "completed") return "Completed";
  if (s === "cancelled") return "Cancelled";
  if (s === "no_show") return "No show";
  if (!s) return "Scheduled";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
