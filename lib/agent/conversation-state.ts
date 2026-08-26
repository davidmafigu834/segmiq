import { now } from "@/lib/clock";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AgentConversationState, AgentConversationStatus } from "./types";
import { STALE_RESUME_AFTER_MS, isRateLimitHold } from "./stale-resume-policy";

/** Stale lock recovery: a run holding the lock longer than this is dead. */
export const LOCK_STALE_MS = STALE_RESUME_AFTER_MS;

type StateRow = Record<string, unknown>;

function rowToState(row: StateRow): AgentConversationState {
  return {
    leadId: row.lead_id as string,
    clientId: row.client_id as string,
    agentEnabled: (row.agent_enabled as boolean) ?? true,
    status: (row.status as AgentConversationStatus) ?? "IDLE",
    humanNeededReason: (row.human_needed_reason as string | null) ?? null,
    pausedUntil: (row.paused_until as string | null) ?? null,
    pausedById: (row.paused_by_id as string | null) ?? null,
    pauseReason: (row.pause_reason as string | null) ?? null,
    humanTakeover: (row.human_takeover as boolean) ?? false,
    lastAgentMessageAt: (row.last_agent_message_at as string | null) ?? null,
    lastHumanMessageAt: (row.last_human_message_at as string | null) ?? null,
    lastCustomerMessageAt: (row.last_customer_message_at as string | null) ?? null,
    pendingExecutionId: (row.pending_execution_id as string | null) ?? null,
    lockAcquiredAt: (row.lock_acquired_at as string | null) ?? null,
  };
}

export async function getConversationAgentState(
  clientId: string,
  leadId: string
): Promise<AgentConversationState | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agent_conversation_state")
    .select("*")
    .eq("lead_id", leadId)
    .eq("client_id", clientId)
    .maybeSingle();
  return data ? rowToState(data as StateRow) : null;
}

export async function ensureConversationAgentState(
  clientId: string,
  leadId: string
): Promise<AgentConversationState> {
  const existing = await getConversationAgentState(clientId, leadId);
  if (existing) return existing;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agent_conversation_state")
    .upsert({ lead_id: leadId, client_id: clientId }, { onConflict: "lead_id" })
    .select("*")
    .single();
  return rowToState((data ?? { lead_id: leadId, client_id: clientId }) as StateRow);
}

/**
 * Acquire the per-conversation execution lock: succeeds only when no live
 * execution owns it (NULL) or the previous lock is stale. Conditional update
 * on the current value makes this safe across concurrent workers.
 */
export async function acquireConversationLock(opts: {
  clientId: string;
  leadId: string;
  executionId: string;
}): Promise<boolean> {
  const supabase = createAdminClient();
  await ensureConversationAgentState(opts.clientId, opts.leadId);
  const ts = now().toISOString();

  const { data: claimed } = await supabase
    .from("agent_conversation_state")
    .update({ pending_execution_id: opts.executionId, lock_acquired_at: ts, updated_at: ts })
    .eq("lead_id", opts.leadId)
    .eq("client_id", opts.clientId)
    .is("pending_execution_id", null)
    .select("lead_id");
  if (claimed?.length) return true;

  // Steal only demonstrably stale locks.
  const staleBefore = new Date(now().getTime() - LOCK_STALE_MS).toISOString();
  const { data: stolen } = await supabase
    .from("agent_conversation_state")
    .update({ pending_execution_id: opts.executionId, lock_acquired_at: ts, updated_at: ts })
    .eq("lead_id", opts.leadId)
    .eq("client_id", opts.clientId)
    .not("pending_execution_id", "is", null)
    .lt("lock_acquired_at", staleBefore)
    .select("lead_id");
  return Boolean(stolen?.length);
}

export async function releaseConversationLock(opts: {
  clientId: string;
  leadId: string;
  executionId: string;
}): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("agent_conversation_state")
    .update({
      pending_execution_id: null,
      lock_acquired_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("lead_id", opts.leadId)
    .eq("client_id", opts.clientId)
    .eq("pending_execution_id", opts.executionId);
}

export async function updateConversationAgentState(
  clientId: string,
  leadId: string,
  patch: Partial<{
    status: AgentConversationStatus;
    humanNeededReason: string | null;
    agentEnabled: boolean;
    pausedUntil: string | null;
    pausedById: string | null;
    pauseReason: string | null;
    humanTakeover: boolean;
    lastAgentMessageAt: string;
    lastHumanMessageAt: string;
    lastCustomerMessageAt: string;
  }>
): Promise<void> {
  const supabase = createAdminClient();
  const update: Record<string, unknown> = {
    lead_id: leadId,
    client_id: clientId,
    updated_at: new Date().toISOString(),
  };
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.humanNeededReason !== undefined) update.human_needed_reason = patch.humanNeededReason;
  if (patch.agentEnabled !== undefined) update.agent_enabled = patch.agentEnabled;
  if (patch.pausedUntil !== undefined) update.paused_until = patch.pausedUntil;
  if (patch.pausedById !== undefined) update.paused_by_id = patch.pausedById;
  if (patch.pauseReason !== undefined) update.pause_reason = patch.pauseReason;
  if (patch.humanTakeover !== undefined) update.human_takeover = patch.humanTakeover;
  if (patch.lastAgentMessageAt !== undefined) update.last_agent_message_at = patch.lastAgentMessageAt;
  if (patch.lastHumanMessageAt !== undefined) update.last_human_message_at = patch.lastHumanMessageAt;
  if (patch.lastCustomerMessageAt !== undefined)
    update.last_customer_message_at = patch.lastCustomerMessageAt;
  await supabase.from("agent_conversation_state").upsert(update, { onConflict: "lead_id" });
}

/**
 * Should the agent act on this conversation right now?
 * Pure decision from the state row — global/company gates live in the runtime.
 */
export function conversationAllowsAgent(
  state: AgentConversationState | null,
  now = new Date()
): { allowed: true } | { allowed: false; reason: string } {
  if (!state) return { allowed: true };
  if (!state.agentEnabled) return { allowed: false, reason: "AGENT_DISABLED_FOR_CONVERSATION" };
  if (state.humanTakeover) return { allowed: false, reason: "HUMAN_TAKEOVER" };
  if (state.status === "PAUSED") {
    if (!state.pausedUntil || new Date(state.pausedUntil).getTime() > now.getTime()) {
      return { allowed: false, reason: "PAUSED" };
    }
  } else if (state.pausedUntil && new Date(state.pausedUntil).getTime() > now.getTime()) {
    return { allowed: false, reason: "PAUSED" };
  }
  if (state.status === "HUMAN_NEEDED" && !isRateLimitHold(state.status, state.humanNeededReason)) {
    return { allowed: false, reason: "HUMAN_NEEDED" };
  }
  return { allowed: true };
}
