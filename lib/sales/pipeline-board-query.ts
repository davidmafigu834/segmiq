import { getDealAttentionState, getDealNextActionState, type DealActiveStage } from "@/lib/sales/deals";
import { formatLeadSource } from "@/lib/sales/leads-directory/format";
import { scoreLabel } from "@/lib/inbox/scoring";
import type { PipelineDealCardItem } from "@/components/sales/pipeline/PipelineDealCard";

type DealBoardItem = PipelineDealCardItem;

export type DealTemperature = "hot" | "warm" | "cold";
export type NextActionBucket = "overdue" | "today" | "upcoming" | "none";
export type DealBoardSort = "attention" | "updated_desc" | "updated_asc" | "next_soonest";

export type BoardFilters = {
  stages: DealActiveStage[];
  atRisk: boolean;
  noNextAction: boolean;
  sources: string[];
  hasQuote: "any" | "yes" | "no";
  temperatures: DealTemperature[];
  nextActions: NextActionBucket[];
};

export const EMPTY_FILTERS: BoardFilters = {
  stages: [],
  atRisk: false,
  noNextAction: false,
  sources: [],
  hasQuote: "any",
  temperatures: [],
  nextActions: [],
};

export function dealTemperature(item: Pick<DealBoardItem, "leadScore" | "leadManualPriority">): DealTemperature | null {
  if (item.leadManualPriority === "hot" || item.leadManualPriority === "warm" || item.leadManualPriority === "cold") {
    return item.leadManualPriority;
  }
  if (item.leadScore == null || !Number.isFinite(item.leadScore)) return null;
  const label = scoreLabel(item.leadScore);
  if (label === "Hot") return "hot";
  if (label === "Warm") return "warm";
  return "cold";
}

export function nextActionBucket(deal: DealBoardItem["deal"], now: Date): NextActionBucket {
  const next = getDealNextActionState(deal);
  if (!next.hasNextAction || !next.at) return "none";
  if (next.isOverdue) return "overdue";
  const due = new Date(next.at);
  const sameDay =
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate();
  return sameDay ? "today" : "upcoming";
}

export function filtersActive(filters: BoardFilters): boolean {
  return (
    filters.stages.length > 0 ||
    filters.atRisk ||
    filters.noNextAction ||
    filters.sources.length > 0 ||
    filters.hasQuote !== "any" ||
    filters.temperatures.length > 0 ||
    filters.nextActions.length > 0
  );
}

/** Groups of criteria, not the number of matching deals. */
export function activeFilterGroupCount(filters: BoardFilters): number {
  return (
    (filters.stages.length > 0 ? 1 : 0) +
    (filters.atRisk ? 1 : 0) +
    (filters.noNextAction ? 1 : 0) +
    (filters.sources.length > 0 ? 1 : 0) +
    (filters.hasQuote !== "any" ? 1 : 0) +
    (filters.temperatures.length > 0 ? 1 : 0) +
    (filters.nextActions.length > 0 ? 1 : 0)
  );
}

export function applyBoardFilters(item: DealBoardItem, filters: BoardFilters, now: Date): boolean {
  if (filters.stages.length && !filters.stages.includes(item.deal.stage as DealActiveStage)) return false;
  const attention = getDealAttentionState(item.deal, now);
  if (filters.atRisk && !attention.atRisk) return false;
  if (filters.noNextAction && item.deal.next_action_at) return false;
  if (filters.sources.length) {
    const key = formatLeadSource(item.leadSource).key;
    if (!filters.sources.includes(key)) return false;
  }
  if (filters.hasQuote === "yes" && item.quoteCount === 0) return false;
  if (filters.hasQuote === "no" && item.quoteCount > 0) return false;
  if (filters.temperatures.length) {
    const temperature = dealTemperature(item);
    if (!temperature || !filters.temperatures.includes(temperature)) return false;
  }
  if (filters.nextActions.length && !filters.nextActions.includes(nextActionBucket(item.deal, now))) return false;
  return true;
}
