import { now } from "@/lib/clock";
import { createAdminClient } from "@/lib/supabase/admin";
import { background } from "@/lib/background";
import { LOCK_STALE_MS } from "./conversation-state";
import { conversationNeedsStaleResume, MAX_STALE_FAILURES } from "./stale-resume-policy";
import { createAgentEscalation, resolveOpenRateLimitEscalations } from "./escalation";
import { handleAgentInboundMessage } from "./runtime";
import { getAgentCompanySettings } from "./settings";
import type { InboundConversationEvent } from "./types";
import { asRow, asRows } from "./rows";

export { conversationNeedsStaleResume, MAX_STALE_FAILURES } from "./stale-resume-policy";
export type { StaleResumeCandidate } from "./stale-resume-policy";

/** One LLM resume per cron tick — a full agent run can take ~60s. */
const MAX_RESUMES_PER_TICK = 2;

type ConversationRow = {
  lead_id: string;
  client_id: string;
  status: string;
  agent_enabled: boolean;
  human_takeover: boolean;
  human_needed_reason: string | null;
  last_customer_message_at: string | null;
  last_agent_message_at: string | null;
  lock_acquired_at: string | null;
  updated_at: string;
};

function log(event: string, data: Record<string, unknown>): void {
  console.log(JSON.stringify({ ts: now().toISOString(), scope: "agent", event, ...data }));
}

/**
 * Finalize zombie RUNNING/QUEUED executions and resume unanswered AI_HANDLING
 * threads after the 3-minute lock TTL — typically after an LLM 429 killed the
 * webhook. Does not wait for the model; resumes run in waitUntil.
 */
export async function recoverStaleAgentConversations(): Promise<{
  finalized: number;
  queued: number;
  exhausted: number;
}> {
  const supabase = createAdminClient();
  const at = now();
  const staleBefore = new Date(at.getTime() - LOCK_STALE_MS).toISOString();

  const { data: staleLocks } = await supabase
    .from("agent_conversation_state")
    .select("pending_execution_id, lead_id, client_id")
    .not("pending_execution_id", "is", null)
    .lt("lock_acquired_at", staleBefore)
    .limit(40);
  const staleLockRows = asRows<{
    pending_execution_id: string;
    lead_id: string;
    client_id: string;
  }>(staleLocks);
  const staleExecIds = staleLockRows.map((r) => r.pending_execution_id).filter(Boolean);

  let finalizedRows: Array<{ id: string; lead_id: string; client_id: string }> = [];
  if (staleExecIds.length) {
    const { data: zombies } = await supabase
      .from("agent_executions")
      .update({
        state: "FAILED",
        error_code: "STALE_RUN",
        error_message: "Run did not finish within the conversation lock TTL (process likely timed out).",
        completed_at: at.toISOString(),
        trigger_message_id: null,
      })
      .in("id", staleExecIds)
      .in("state", ["RUNNING", "QUEUED"])
      .select("id, lead_id, client_id");
    finalizedRows = asRows<{ id: string; lead_id: string; client_id: string }>(zombies);
    await supabase
      .from("agent_conversation_state")
      .update({
        pending_execution_id: null,
        lock_acquired_at: null,
        updated_at: at.toISOString(),
      })
      .in("pending_execution_id", staleExecIds);
  }
  for (const lock of staleLockRows) {
    if (finalizedRows.some((z) => z.lead_id === lock.lead_id)) continue;
    finalizedRows.push({
      id: lock.pending_execution_id,
      lead_id: lock.lead_id,
      client_id: lock.client_id,
    });
  }
  const finalized = finalizedRows.length;

  const { data: handling } = await supabase
    .from("agent_conversation_state")
    .select(
      "lead_id, client_id, status, agent_enabled, human_takeover, human_needed_reason, last_customer_message_at, last_agent_message_at, lock_acquired_at, updated_at"
    )
    .in("status", ["AI_HANDLING", "HUMAN_NEEDED"])
    .eq("agent_enabled", true)
    .eq("human_takeover", false)
    .lt("updated_at", staleBefore)
    .order("last_customer_message_at", { ascending: false })
    .limit(20);
  const rows = asRows<ConversationRow>(handling);

  const fromZombies = new Map<string, { clientId: string; leadId: string }>();
  for (const z of finalizedRows) {
    fromZombies.set(z.lead_id, { clientId: z.client_id, leadId: z.lead_id });
  }

  const candidates: Array<{ clientId: string; leadId: string }> = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (
      !conversationNeedsStaleResume(
        {
          status: row.status,
          agentEnabled: row.agent_enabled,
          humanTakeover: row.human_takeover,
          lastCustomerMessageAt: row.last_customer_message_at,
          lastAgentMessageAt: row.last_agent_message_at,
          lockAcquiredAt: row.lock_acquired_at,
          updatedAt: row.updated_at,
          humanNeededReason: row.human_needed_reason,
        },
        at
      )
    ) {
      continue;
    }
    seen.add(row.lead_id);
    candidates.push({ clientId: row.client_id, leadId: row.lead_id });
  }
  for (const z of fromZombies.values()) {
    if (seen.has(z.leadId)) continue;
    candidates.push(z);
  }

  let queued = 0;
  let exhausted = 0;
  for (const c of candidates) {
    if (queued >= MAX_RESUMES_PER_TICK) break;
    const result = await queueStaleResume(c.clientId, c.leadId);
    if (result === "queued") queued += 1;
    else if (result === "exhausted") exhausted += 1;
  }

  if (finalized || queued || exhausted) {
    log("stale_resume.tick", { finalized, queued, exhausted, candidates: candidates.length });
  }
  return { finalized, queued, exhausted };
}

async function queueStaleResume(
  clientId: string,
  leadId: string
): Promise<"queued" | "skipped" | "exhausted"> {
  const supabase = createAdminClient();
  const { data: state } = await supabase
    .from("agent_conversation_state")
    .select("last_customer_message_at, last_agent_message_at, status, agent_enabled, human_takeover")
    .eq("lead_id", leadId)
    .eq("client_id", clientId)
    .maybeSingle();
  const row = asRow<{
    last_customer_message_at: string | null;
    last_agent_message_at: string | null;
    status: string;
    agent_enabled: boolean;
    human_takeover: boolean;
  }>(state);
  if (!row?.agent_enabled || row.human_takeover) return "skipped";
  if (row.last_customer_message_at) {
    const customerAt = new Date(row.last_customer_message_at).getTime();
    const agentAt = row.last_agent_message_at ? new Date(row.last_agent_message_at).getTime() : 0;
    if (agentAt >= customerAt) return "skipped";
  }

  const since = row.last_customer_message_at ?? new Date(now().getTime() - LOCK_STALE_MS).toISOString();
  const { count } = await supabase
    .from("agent_executions")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId)
    .gte("created_at", since)
    .in("error_code", ["RATE_LIMITED", "STALE_RUN"]);
  if ((count ?? 0) >= MAX_STALE_FAILURES) {
    const settings = await getAgentCompanySettings(clientId);
    await createAgentEscalation({
      clientId,
      leadId,
      executionId: null,
      reason: "RATE_LIMITED",
      summary:
        "The agent could not finish this customer message after several cool-down retries. The last inbound message has NOT been answered.",
      ownerId: null,
      escalationUserId: settings.escalationUserId,
    });
    log("stale_resume.exhausted", { leadId, failures: count });
    return "exhausted";
  }

  const event = await loadInboundEvent(clientId, leadId);
  if (!event) return "skipped";

  await resolveOpenRateLimitEscalations(clientId, leadId);
  const { updateConversationAgentState } = await import("./conversation-state");
  await updateConversationAgentState(clientId, leadId, {
    status: "AI_HANDLING",
    humanNeededReason: null,
  });

  background("segmiqAgentStaleResume", () =>
    handleAgentInboundMessage(event, {
      skipDebounceWait: true,
      retryOnLlmRateLimit: false,
      escalateOnLlmRateLimit: false,
    })
  );
  log("stale_resume.queued", { leadId, messageId: event.messageId });
  return "queued";
}

async function loadInboundEvent(clientId: string, leadId: string): Promise<InboundConversationEvent | null> {
  const supabase = createAdminClient();
  const { data: message } = await supabase
    .from("whatsapp_messages")
    .select("id, body, message_type, created_at")
    .eq("client_id", clientId)
    .eq("lead_id", leadId)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const msg = asRow<{ id: string; body: string | null; message_type: string; created_at: string }>(message);
  if (!msg) return null;

  const { data: lead } = await supabase
    .from("leads")
    .select("assigned_to_id, contact_id, whatsapp_conversation_type")
    .eq("id", leadId)
    .maybeSingle();
  const leadRow = asRow<{
    assigned_to_id: string | null;
    contact_id: string | null;
    whatsapp_conversation_type: string | null;
  }>(lead);

  const conversationType = leadRow?.whatsapp_conversation_type;
  return {
    messageId: msg.id,
    clientId,
    leadId,
    contactId: leadRow?.contact_id ?? null,
    channel: "whatsapp",
    messageType: msg.message_type || "text",
    text: msg.body ?? "",
    hasAttachment: msg.message_type !== "text",
    timestamp: msg.created_at,
    ownerId: leadRow?.assigned_to_id ?? null,
    conversationType:
      conversationType === "SUPPORT" || conversationType === "GENERAL" ? conversationType : "SALES",
    isNewLead: false,
  };
}
