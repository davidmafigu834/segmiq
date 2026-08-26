import { createAdminClient } from "@/lib/supabase/admin";
import { logLeadEvent } from "@/lib/lead-events";
import { notifyAgentAlert, notifyOwnerOrManagers } from "./notifications";
import { escalationSeverity } from "./policy";
import { RATE_LIMIT_HOLD_REASON } from "./stale-resume-policy";
import type { AgentEscalationReason } from "./types";
import { asRow } from "./rows";

const REASON_LABELS: Record<AgentEscalationReason, string> = {
  LOW_CONFIDENCE: "Agent was not confident how to proceed",
  CUSTOMER_REQUESTED_HUMAN: "Customer asked for a person",
  PRICING_DISPUTE: "Pricing dispute",
  COMPLAINT: "Customer complaint",
  TECHNICAL_RISK: "Technical decision needs a human",
  COMMERCIAL_APPROVAL: "Commercial approval required",
  UNSUPPORTED_REQUEST: "Request the agent cannot handle",
  POLICY_BLOCKED: "Company policy blocked the action",
  CONFLICTING_CUSTOMER_DATA: "Conflicting customer information",
  SYSTEM_FAILURE: "System failure during agent run",
  RATE_LIMITED: RATE_LIMIT_HOLD_REASON,
  ATTACHMENT_REVIEW: "Attachment needs human review",
  KNOWLEDGE_CONFLICT: "Approved knowledge conflicts with current company data",
};

export function escalationReasonLabel(reason: AgentEscalationReason): string {
  return REASON_LABELS[reason] ?? reason;
}

export type CreateEscalationInput = {
  clientId: string;
  leadId: string;
  executionId: string | null;
  reason: AgentEscalationReason;
  summary: string;
  /** Structured handoff briefing — facts only, no fabrication. */
  briefing?: Record<string, unknown> | null;
  ownerId: string | null;
  escalationUserId?: string | null;
};

export async function createAgentEscalation(input: CreateEscalationInput): Promise<string | null> {
  const supabase = createAdminClient();
  const severity = escalationSeverity(input.reason);
  const assignedUserId = input.ownerId ?? input.escalationUserId ?? null;

  const { data: escalation, error } = await supabase
    .from("agent_escalations")
    .insert({
      client_id: input.clientId,
      lead_id: input.leadId,
      execution_id: input.executionId,
      reason: input.reason,
      severity,
      summary: input.summary.slice(0, 1000),
      briefing: input.briefing ?? null,
      assigned_user_id: assignedUserId,
      status: "OPEN",
    })
    .select("id")
    .single();
  if (error) {
    console.error("[agent] escalation insert failed", error.message);
    return null;
  }

  // Conversation is visibly marked HUMAN NEEDED — never a silent stop.
  await supabase.from("agent_conversation_state").upsert(
    {
      lead_id: input.leadId,
      client_id: input.clientId,
      status: "HUMAN_NEEDED",
      human_needed_reason: escalationReasonLabel(input.reason),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "lead_id" }
  );

  await logLeadEvent({
    leadId: input.leadId,
    clientId: input.clientId,
    actor: { id: null, name: "SegmiQ Agent", role: "SYSTEM" },
    eventType: "NOTE_ADDED",
    eventData: {
      note: `SegmiQ Agent requested human help — ${escalationReasonLabel(input.reason)}: ${input.summary.slice(0, 300)}`,
      agent: true,
      escalation_reason: input.reason,
    },
  });

  const message = `SegmiQ Agent needs a human: ${escalationReasonLabel(input.reason)}`;
  if (assignedUserId) {
    await notifyAgentAlert({ userId: assignedUserId, message, leadId: input.leadId });
  } else {
    await notifyOwnerOrManagers({
      clientId: input.clientId,
      ownerId: null,
      leadId: input.leadId,
      message,
    });
  }

  return asRow<{ id: string }>(escalation)?.id ?? null;
}

/** Drop transient 429 handoffs so the agent can continue after cool-down. */
export async function resolveOpenRateLimitEscalations(clientId: string, leadId: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("agent_escalations")
    .update({
      status: "RESOLVED",
      resolved_at: new Date().toISOString(),
    })
    .eq("client_id", clientId)
    .eq("lead_id", leadId)
    .eq("reason", "RATE_LIMITED")
    .eq("status", "OPEN");
}
