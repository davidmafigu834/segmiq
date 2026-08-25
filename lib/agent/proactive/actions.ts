import { now } from "@/lib/clock";
import { createAdminClient } from "@/lib/supabase/admin";
import { logFollowUpSet } from "@/lib/lead-events";
import { notifyOwnerOrManagers } from "@/lib/agent/notifications";
import { sendCanonicalWhatsAppText } from "@/lib/whatsapp/message-service";
import { updateConversationAgentState } from "@/lib/agent/conversation-state";
import type { AgentCompanySettings } from "@/lib/agent/types";
import type { PolicyEvaluation, ProactiveDecisionContract, ProactiveJob, ProactiveJobState } from "./types";
import type { EvaluationContext } from "./context";
import { TEMPORAL_TRIGGER_TYPES } from "./registry";
import { DOMAIN_EVENT_TYPES } from "./registry";
import { emitDomainEvent } from "./events";
import { setProactiveCircuit } from "./settings";

const AGENT_ACTOR = { id: null as string | null, name: "SegmiQ Agent", role: "SYSTEM" as const };

export type ActionResult = {
  status: ProactiveJobState;
  actionType: string | null;
  reasonCode: string | null;
  skipReason?: string | null;
  failureReason?: string | null;
  executionId?: string | null;
};

export async function executeProactiveAction(opts: {
  job: ProactiveJob;
  ctx: EvaluationContext;
  policy: PolicyEvaluation;
  decision: ProactiveDecisionContract;
  shadow: boolean;
  agent: AgentCompanySettings;
  timezone: string;
  workingDays: number[];
}): Promise<ActionResult> {
  const { job, ctx, decision, shadow } = opts;

  if (decision.decision === "NO_ACTION") {
    return {
      status: "SKIPPED",
      actionType: "NO_ACTION",
      reasonCode: decision.reasonCode,
      skipReason: decision.reasonCode,
    };
  }

  if (shadow && (decision.decision === "SEND_MESSAGE" || decision.decision === "WOULD_HAVE_SENT")) {
    await recordExecution(job, ctx, {
      summary: decision.summary,
      reply: decision.customerMessage ?? null,
      replyStatus: "SUPPRESSED",
      reasonCode: "SHADOW_MODE",
    });
    return {
      status: "COMPLETED",
      actionType: "WOULD_HAVE_SENT",
      reasonCode: "SHADOW_MODE",
    };
  }

  if (decision.decision === "WOULD_HAVE_SENT" || opts.policy.actionMode === "REQUEST_APPROVAL") {
    if (ctx.ownerId) {
      await notifyOwnerOrManagers({
        clientId: job.clientId,
        ownerId: ctx.ownerId,
        leadId: ctx.lead.id,
        message: `SegmiQ drafted a follow-up for approval: ${decision.summary}`,
      });
    }
    return {
      status: "WAITING_FOR_HUMAN",
      actionType: "REQUEST_APPROVAL",
      reasonCode: "APPROVAL_REQUIRED",
    };
  }

  if (decision.decision === "NOTIFY_HUMAN") {
    if (ctx.ownerId) {
      await notifyOwnerOrManagers({
        clientId: job.clientId,
        ownerId: ctx.ownerId,
        leadId: ctx.lead.id,
        message: decision.summary,
      });
    }
    return { status: "COMPLETED", actionType: "NOTIFY", reasonCode: decision.reasonCode };
  }

  if (decision.decision === "CREATE_TASK" || decision.decision === "ESCALATE") {
    await createCanonicalFollowUp(job, ctx, decision.task?.title ?? decision.summary);
    if (ctx.ownerId) {
      await notifyOwnerOrManagers({
        clientId: job.clientId,
        ownerId: ctx.ownerId,
        leadId: ctx.lead.id,
        message: decision.summary,
      });
    }
    return { status: "COMPLETED", actionType: "CREATE_TASK", reasonCode: decision.reasonCode };
  }

  if (decision.decision === "SEND_MESSAGE") {
    const body = decision.customerMessage?.trim();
    if (!body) {
      return {
        status: "FAILED",
        actionType: "CUSTOMER_MESSAGE",
        reasonCode: "LOW_CONFIDENCE",
        failureReason: "No customer message was generated.",
      };
    }
    const send = await sendCanonicalWhatsAppText({
      clientId: job.clientId,
      leadId: ctx.lead.id,
      to: "",
      body,
      actorId: null,
      actorName: "SegmiQ Agent",
      actorRole: "SYSTEM",
    });
    if (!send.ok) {
      const unavailable = /CONNECTION|disconnect|not connected|unavailable/i.test(send.error ?? "");
      await maybeTripCircuit(job.clientId);
      if (unavailable) {
        return {
          status: "WAITING_FOR_CHANNEL",
          actionType: null,
          reasonCode: "CHANNEL_UNAVAILABLE",
          failureReason: send.error ?? "WhatsApp send failed",
        };
      }
      return {
        status: "FAILED",
        actionType: "CUSTOMER_MESSAGE",
        reasonCode: "CHANNEL_UNAVAILABLE",
        failureReason: send.error ?? "Send failed",
      };
    }
    await updateConversationAgentState(job.clientId, ctx.lead.id, {
      lastAgentMessageAt: now().toISOString(),
      status: "WAITING_ON_CUSTOMER",
    });
    await emitDomainEvent({
      clientId: job.clientId,
      type: DOMAIN_EVENT_TYPES.CONVERSATION_AGENT_MESSAGE,
      entityType: "CONVERSATION",
      entityId: ctx.lead.id,
      actorType: "AGENT",
      idempotencyKey: `agent-msg:${job.id}`,
      payload: { proactiveJobId: job.id },
      causationId: job.id,
    });
    if (job.triggerType === TEMPORAL_TRIGGER_TYPES.CUSTOMER_FOLLOWUP_DUE) {
      await completeFollowUpDate(ctx.lead.id, job.clientId, "Completed by SegmiQ Agent");
    }
    await recordExecution(job, ctx, {
      summary: decision.summary,
      reply: body,
      replyStatus: "SENT",
      reasonCode: decision.reasonCode,
    });
    return { status: "COMPLETED", actionType: "CUSTOMER_MESSAGE", reasonCode: decision.reasonCode };
  }

  return {
    status: "SKIPPED",
    actionType: "NO_ACTION",
    reasonCode: "NO_ACTION_NEEDED",
    skipReason: "NO_ACTION_NEEDED",
  };
}

async function createCanonicalFollowUp(
  job: ProactiveJob,
  ctx: EvaluationContext,
  title: string
): Promise<void> {
  const supabase = createAdminClient();
  const today = now().toISOString().slice(0, 10);
  await supabase
    .from("leads")
    .update({
      follow_up_date: today,
      follow_up_source: "SYSTEM_POLICY",
      follow_up_execution_mode: "HUMAN_ONLY",
      updated_at: now().toISOString(),
    })
    .eq("id", ctx.lead.id)
    .eq("client_id", job.clientId);
  await logFollowUpSet({
    leadId: ctx.lead.id,
    clientId: job.clientId,
    actor: AGENT_ACTOR,
    followUpDate: today,
    notes: title,
  });
}

async function completeFollowUpDate(leadId: string, clientId: string, note: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("leads")
    .update({ follow_up_date: null, updated_at: now().toISOString() })
    .eq("id", leadId)
    .eq("client_id", clientId);
  await logFollowUpSet({
    leadId,
    clientId,
    actor: AGENT_ACTOR,
    followUpDate: now().toISOString().slice(0, 10),
    notes: note,
  });
}

async function recordExecution(
  job: ProactiveJob,
  ctx: EvaluationContext,
  opts: { summary: string; reply: string | null; replyStatus: string; reasonCode: string }
): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("agent_executions").insert({
    client_id: job.clientId,
    lead_id: ctx.lead.id,
    state: "COMPLETED",
    trigger_kind: "PROACTIVE",
    proactive_job_id: job.id,
    reason_code: opts.reasonCode,
    decision_summary: opts.summary.slice(0, 500),
    customer_reply: opts.reply,
    reply_status: opts.replyStatus,
    proactive_touched: true,
    test_mode: opts.reasonCode === "SHADOW_MODE",
    completed_at: now().toISOString(),
  });
}

async function maybeTripCircuit(clientId: string): Promise<void> {
  const supabase = createAdminClient();
  const since = new Date(now().getTime() - 15 * 60_000).toISOString();
  const { count } = await supabase
    .from("agent_proactive_jobs")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("status", "FAILED")
    .gte("updated_at", since);
  if ((count ?? 0) >= 8) {
    await setProactiveCircuit(clientId, true, "Repeated send failures in the last 15 minutes");
  }
}
