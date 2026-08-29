export type ViewingWorkspaceTab = "upcoming" | "completed" | "cancelled" | "all";

export const VIEWING_WORKSPACE_TABS: { id: ViewingWorkspaceTab; label: string }[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
  { id: "all", label: "All" },
];

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
