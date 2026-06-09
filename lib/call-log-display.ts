import { format } from "date-fns";
import { CALL_RESULT_LABELS, REACH_OUTCOME_LABELS, type CallResult, type ReachOutcome } from "@/lib/call-log-constants";

export type CallLogDisplayRow = {
  outcome: string;
  reach_outcome?: string | null;
  result?: string | null;
  reason?: string | null;
  callback_at?: string | null;
  notes?: string | null;
};

const LEGACY_OUTCOME_LABELS: Record<string, string> = {
  ANSWERED: "Answered",
  NO_ANSWER: "No answer",
  FOLLOW_UP: "Follow-up",
  WON: "Won",
  LOST: "Lost",
  NOT_QUALIFIED: "Not qualified",
};

function reachLabel(reach: string | null | undefined, legacyOutcome: string): string {
  if (reach === "reached") return "Reached";
  if (reach === "no_answer") return "No answer";
  if (reach === "call_back") return "Call back";
  return LEGACY_OUTCOME_LABELS[legacyOutcome] ?? legacyOutcome.replaceAll("_", " ");
}

export function formatCallLogHeadline(log: CallLogDisplayRow): string {
  const parts: string[] = [];
  parts.push(reachLabel(log.reach_outcome, log.outcome));

  const result = log.result as CallResult | null | undefined;
  if (result && log.reach_outcome === "reached") {
    parts.push(CALL_RESULT_LABELS[result] ?? result);
  }

  if (log.reason?.trim()) {
    parts.push(log.reason.trim());
  }

  if (log.callback_at) {
    parts.push(`callback ${format(new Date(log.callback_at), "EEE h:mm a")}`);
  }

  return parts.join(" · ");
}

export function formatReachOutcomeLabel(reach: ReachOutcome): string {
  return REACH_OUTCOME_LABELS[reach];
}
