import type { FocusMode, FocusModeResult, SalesActionRecommendation } from "./types";
import { focusModeCopy } from "./reasons";
import type { PipelineCoverageResult } from "./types";

const LATE_STAGE = new Set(["NEGOTIATING", "PROPOSAL_SENT"]);

/**
 * Derive BUILD / MOVE / CLOSE from goal + pipeline + priority actions.
 * Action queue always wins — focus is strategic context, not a blocker.
 */
export function deriveFocusMode(opts: {
  priorityActions: SalesActionRecommendation[];
  coverage: PipelineCoverageResult;
  lateStageCount: number;
  activeDealCount: number;
}): FocusModeResult {
  const priorityActionCount = opts.priorityActions.filter(
    (a) => a.actionType !== "PROSPECT_NEW_CUSTOMERS" && a.actionType !== "ADD_VALID_PROSPECT"
  ).length;

  const hasUrgentDealWork = priorityActionCount > 0;
  const coverageLow =
    opts.coverage.available &&
    opts.coverage.coverageRatio != null &&
    opts.coverage.coverageRatio < 1;
  const coverageUnavailableNeedingBuild =
    !opts.coverage.available &&
    opts.coverage.remainingGoalValue != null &&
    opts.coverage.remainingGoalValue > 0 &&
    opts.activeDealCount < 3;

  let mode: FocusMode;

  if (
    hasUrgentDealWork &&
    opts.lateStageCount > 0 &&
    opts.priorityActions.some(
      (a) =>
        a.actionType === "FOLLOW_UP_QUOTE" ||
        a.actionType === "FOLLOW_UP_NEGOTIATION" ||
        (a.customer?.status && LATE_STAGE.has(String(a.customer.status)))
    )
  ) {
    mode = "CLOSE";
  } else if (hasUrgentDealWork) {
    mode = "MOVE";
  } else if (coverageLow || coverageUnavailableNeedingBuild || opts.activeDealCount === 0) {
    mode = "BUILD";
  } else if (opts.lateStageCount >= Math.max(1, Math.floor(opts.activeDealCount / 2))) {
    mode = "CLOSE";
  } else {
    mode = "MOVE";
  }

  const copy = focusModeCopy(mode);
  let body: string;
  if (mode === "BUILD") {
    body =
      priorityActionCount === 0
        ? "Your priority deal queue is clear. Create new opportunities today."
        : "Your pipeline needs more opportunities. Keep adding genuine prospects.";
  } else if (mode === "CLOSE") {
    body =
      "You have strong late-stage opportunities. Focus on decision-making conversations and proposal follow-up.";
  } else {
    body =
      priorityActionCount > 0
        ? `You have ${priorityActionCount} priorit${priorityActionCount === 1 ? "y" : "ies"} to work. Focus on follow-ups and moving deals to the next decision point.`
        : "You have opportunities to work. Keep every active deal moving.";
  }

  return {
    mode,
    title: copy.title,
    body,
    priorityActionCount,
  };
}
