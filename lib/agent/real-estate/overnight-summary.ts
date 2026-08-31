import { createAdminClient } from "@/lib/supabase/admin";
import { asRows } from "@/lib/agent/rows";
import { RE_AGENT_INTENTS } from "@/lib/agent/types";

export type ReOvernightAgentSummary = {
  windowLabel: string;
  sinceIso: string;
  untilIso: string;
  executionsCompleted: number;
  executionsFailed: number;
  executionsWaitingHuman: number;
  repliesSent: number;
  repliesDrafted: number;
  viewingApprovalsRequested: number;
  viewingApprovalsPending: number;
  escalationsOpened: number;
  humanHandoffs: number;
  reIntentCounts: Record<string, number>;
  topTools: Array<{ tool: string; count: number }>;
  highlights: string[];
  summaryLine: string;
};

const RE_INTENT_SET = new Set<string>(RE_AGENT_INTENTS);

/** Deterministic overnight window for manager visibility. */
export function resolveOvernightWindow(at: Date): { since: Date; until: Date; label: string } {
  const until = new Date(at);
  const since = new Date(at);
  if (since.getHours() < 12) {
    since.setDate(since.getDate() - 1);
    since.setHours(18, 0, 0, 0);
    return { since, until, label: "Overnight" };
  }
  since.setHours(0, 0, 0, 0);
  return { since, until, label: "Today" };
}

export function buildOvernightSummaryLine(summary: Pick<
  ReOvernightAgentSummary,
  | "windowLabel"
  | "executionsCompleted"
  | "repliesSent"
  | "viewingApprovalsPending"
  | "humanHandoffs"
>): string {
  const parts: string[] = [];
  if (summary.executionsCompleted > 0) {
    parts.push(
      `${summary.executionsCompleted} conversation${summary.executionsCompleted === 1 ? "" : "s"} handled`
    );
  }
  if (summary.repliesSent > 0) {
    parts.push(`${summary.repliesSent} repl${summary.repliesSent === 1 ? "y" : "ies"} sent`);
  }
  if (summary.viewingApprovalsPending > 0) {
    parts.push(
      `${summary.viewingApprovalsPending} viewing approval${summary.viewingApprovalsPending === 1 ? "" : "s"} waiting`
    );
  }
  if (summary.humanHandoffs > 0) {
    parts.push(`${summary.humanHandoffs} handoff${summary.humanHandoffs === 1 ? "" : "s"} to your team`);
  }
  if (!parts.length) {
    return `${summary.windowLabel}: SegmiQ Agent has no new activity in this window yet.`;
  }
  return `${summary.windowLabel}: SegmiQ Agent ${parts.join(" · ")}.`;
}

function countIntents(rows: Array<{ intents: string[] | null }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    for (const intent of row.intents ?? []) {
      if (!RE_INTENT_SET.has(intent)) continue;
      counts[intent] = (counts[intent] ?? 0) + 1;
    }
  }
  return counts;
}

function buildHighlights(summary: Omit<ReOvernightAgentSummary, "highlights" | "summaryLine">): string[] {
  const lines: string[] = [];
  if (summary.executionsCompleted > 0) {
    lines.push(`Completed ${summary.executionsCompleted} agent run${summary.executionsCompleted === 1 ? "" : "s"}.`);
  }
  if (summary.repliesSent > 0) {
    lines.push(`Sent ${summary.repliesSent} WhatsApp repl${summary.repliesSent === 1 ? "y" : "ies"}.`);
  }
  if (summary.viewingApprovalsRequested > 0) {
    lines.push(
      `Requested ${summary.viewingApprovalsRequested} viewing approval${summary.viewingApprovalsRequested === 1 ? "" : "s"}.`
    );
  }
  if (summary.viewingApprovalsPending > 0) {
    lines.push(`${summary.viewingApprovalsPending} viewing approval${summary.viewingApprovalsPending === 1 ? " is" : "s are"} still waiting.`);
  }
  if (summary.humanHandoffs > 0) {
    lines.push(`${summary.humanHandoffs} conversation${summary.humanHandoffs === 1 ? "" : "s"} handed to a person.`);
  }
  if (summary.executionsFailed > 0) {
    lines.push(`${summary.executionsFailed} agent run${summary.executionsFailed === 1 ? "" : "s"} failed — review Agent activity.`);
  }
  const topIntent = Object.entries(summary.reIntentCounts).sort((a, b) => b[1] - a[1])[0];
  if (topIntent) {
    lines.push(`Most common intent: ${topIntent[0].replace(/_/g, " ").toLowerCase()} (${topIntent[1]}).`);
  }
  return lines.slice(0, 5);
}

export async function loadOvernightAgentSummary(opts: {
  clientId: string;
  at?: Date;
}): Promise<ReOvernightAgentSummary> {
  const at = opts.at ?? new Date();
  const window = resolveOvernightWindow(at);
  const supabase = createAdminClient();

  const [{ data: executionsData }, { data: escalationsData }, { data: actionsData }, { count: viewingPending }] =
    await Promise.all([
      supabase
        .from("agent_executions")
        .select("id, state, intents, reply_status, created_at")
        .eq("client_id", opts.clientId)
        .eq("trigger_kind", "INBOUND")
        .gte("created_at", window.since.toISOString())
        .lte("created_at", window.until.toISOString())
        .limit(500),
      supabase
        .from("agent_escalations")
        .select("id, reason, briefing, created_at")
        .eq("client_id", opts.clientId)
        .gte("created_at", window.since.toISOString())
        .lte("created_at", window.until.toISOString())
        .limit(200),
      supabase
        .from("agent_execution_actions")
        .select("tool_name, status, created_at")
        .eq("client_id", opts.clientId)
        .gte("created_at", window.since.toISOString())
        .lte("created_at", window.until.toISOString())
        .limit(500),
      supabase
        .from("agent_conversation_state")
        .select("lead_id", { count: "exact", head: true })
        .eq("client_id", opts.clientId)
        .eq("status", "HUMAN_NEEDED")
        .eq("human_needed_reason", "VIEWING_APPROVAL"),
    ]);

  type ExecutionRow = {
    id: string;
    state: string;
    intents: string[] | null;
    reply_status: string | null;
  };
  const executions = asRows<ExecutionRow>(executionsData);
  const escalations = asRows<{
    id: string;
    reason: string;
    briefing: Record<string, unknown> | null;
  }>(escalationsData);
  const actions = asRows<{ tool_name: string; status: string }>(actionsData);

  const executionsCompleted = executions.filter((e) => e.state === "COMPLETED").length;
  const executionsFailed = executions.filter((e) => e.state === "FAILED").length;
  const executionsWaitingHuman = executions.filter((e) => e.state === "WAITING_FOR_HUMAN").length;
  const repliesSent = executions.filter((e) => e.reply_status === "SENT").length;
  const repliesDrafted = executions.filter((e) => e.reply_status === "DRAFTED").length;
  const viewingApprovalsRequested = escalations.filter(
    (e) => e.reason === "COMMERCIAL_APPROVAL" && e.briefing?.cardType === "VIEWING_APPROVAL"
  ).length;
  const humanHandoffs = escalations.length + executionsWaitingHuman;

  const toolCounts = new Map<string, number>();
  for (const action of actions) {
    if (action.status !== "EXECUTED" && action.status !== "BLOCKED") continue;
    toolCounts.set(action.tool_name, (toolCounts.get(action.tool_name) ?? 0) + 1);
  }
  const topTools = [...toolCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tool, count]) => ({ tool, count }));

  const reIntentCounts = countIntents(executions);
  const base = {
    windowLabel: window.label,
    sinceIso: window.since.toISOString(),
    untilIso: window.until.toISOString(),
    executionsCompleted,
    executionsFailed,
    executionsWaitingHuman,
    repliesSent,
    repliesDrafted,
    viewingApprovalsRequested,
    viewingApprovalsPending: viewingPending ?? 0,
    escalationsOpened: escalations.length,
    humanHandoffs,
    reIntentCounts,
    topTools,
  };

  return {
    ...base,
    highlights: buildHighlights(base),
    summaryLine: buildOvernightSummaryLine(base),
  };
}
