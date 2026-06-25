type CallLogRow = {
  outcome: string;
  reach_outcome?: string | null;
  result?: string | null;
  reason?: string | null;
  callback_at?: string | null;
  notes?: string | null;
};

const REACH: Record<string, string> = {
  reached: "Reached",
  no_answer: "No answer",
  call_back: "Call back",
};

const RESULT: Record<string, string> = {
  follow_up: "Follow-up",
  won: "Won",
  lost: "Lost",
  not_qualified: "Not qualified",
};

export function formatCallLogHeadline(log: CallLogRow): string {
  const parts: string[] = [];
  parts.push(REACH[log.reach_outcome ?? ""] ?? log.outcome.replace(/_/g, " "));
  if (log.result && log.reach_outcome === "reached") {
    parts.push(RESULT[log.result] ?? log.result);
  }
  if (log.reason?.trim()) parts.push(log.reason.trim());
  if (log.callback_at) {
    parts.push(`Callback ${new Date(log.callback_at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}`);
  }
  return parts.join(" · ");
}
