import { z } from "zod";
import { now } from "@/lib/clock";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  acquireConversationLock,
  conversationAllowsAgent,
  ensureConversationAgentState,
  releaseConversationLock,
} from "@/lib/agent/conversation-state";
import { getAgentCompanySettings } from "@/lib/agent/settings";
import { loadCachedCompanyBrainSnapshot } from "@/lib/company-brain";
import { addBusinessDays } from "./business-days";
import { nextContactInstant } from "./contact-window";
import { loadEvaluationContext, type EvaluationContext } from "./context";
import { executeProactiveAction } from "./actions";
import { getJob, rescheduleJob, scheduleEvaluation, updateJob } from "./jobs";
import { evaluateProactivePolicy } from "./policy";
import { generateProactiveDecision } from "./runtime";
import { TEMPORAL_TRIGGER_TYPES, TRIGGER_REGISTRY } from "./registry";
import {
  getProactiveSettings,
  isProactiveCustomerMessagingGloballyEnabled,
  isProactiveGloballyEnabled,
} from "./settings";
import {
  appointmentReminderMessage,
  missedAppointmentMessage,
  quoteFollowUpFallback,
  sanitizeProactiveMessage,
} from "./templates";
import type { ProactiveDecisionContract, ProactiveJob } from "./types";

const decisionSchema = z.object({
  decision: z.enum([
    "NO_ACTION",
    "SEND_MESSAGE",
    "CREATE_TASK",
    "NOTIFY_HUMAN",
    "ESCALATE",
    "PREPARE_WORK",
    "WOULD_HAVE_SENT",
  ]),
  reasonCode: z.string(),
  customerMessage: z.string().max(700).optional(),
  task: z
    .object({
      title: z.string().max(200),
      dueAt: z.string().optional(),
      priority: z.string().optional(),
    })
    .optional(),
  escalation: z.object({ reason: z.string(), priority: z.string() }).optional(),
  confidence: z.number().min(0).max(1),
  summary: z.string().max(400),
});

export async function evaluateProactiveJob(
  jobId: string,
  opts?: { simulate?: boolean }
): Promise<{ status: string; reasonCode: string | null; summary: string | null }> {
  const job = await getJob(jobId);
  if (!job) return { status: "FAILED", reasonCode: "POLICY_BLOCKED", summary: "Job not found" };

  const [proactive, agent, brain] = await Promise.all([
    getProactiveSettings(job.clientId),
    getAgentCompanySettings(job.clientId),
    loadCachedCompanyBrainSnapshot(job.clientId).catch(() => null),
  ]);
  const timezone = brain?.canonical.timezone ?? "Africa/Harare";
  const workingDays = brain?.canonical.workingDays ?? [1, 2, 3, 4, 5];
  const ctx = await loadEvaluationContext(job);
  if (!ctx) {
    await updateJob(job.id, {
      status: "SKIPPED",
      reasonCode: "NO_ACTION_NEEDED",
      skipReason: "Lead not found",
      decisionSummary: "Lead not found",
    });
    return { status: "SKIPPED", reasonCode: "NO_ACTION_NEEDED", summary: "Lead not found" };
  }
  ctx.timezone = timezone;
  ctx.workingDays = workingDays;

  const policy = evaluateProactivePolicy({
    now: now(),
    timezone,
    job,
    maxAutonomousFollowUps: brain?.settings.maxAutonomousFollowUps ?? 2,
    proactive,
    agent,
    conversation: ctx.conversation,
    lead: ctx.lead,
    contact: ctx.contact,
    channel: ctx.channel,
    support: ctx.support,
    rateLimits: ctx.rateLimits,
    quotation: ctx.quotation,
    deal: ctx.deal,
    appointment: ctx.appointment,
    upcomingAppointmentAt: ctx.upcomingAppointmentAt,
    customerRepliedAfterQuoteSend: ctx.customerRepliedAfterQuoteSend,
    humanContactedAfterQuoteSend: ctx.humanContactedAfterQuoteSend,
    platformProactiveDisabled: !isProactiveGloballyEnabled(),
    platformCustomerMessagingDisabled: !isProactiveCustomerMessagingGloballyEnabled(),
  });

  if (policy.nextEligibleAt) {
    await rescheduleJob(job.id, policy.nextEligibleAt);
    return { status: "SCHEDULED", reasonCode: policy.reasonCode, summary: policy.reasons.join(" ") };
  }

  if (policy.reasonCode === "CHANNEL_UNAVAILABLE") {
    if (job.staleAfter && now().getTime() > new Date(job.staleAfter).getTime()) {
      await updateJob(job.id, {
        status: "EXPIRED",
        reasonCode: "STALE_AFTER_CHANNEL_FAILURE",
        skipReason: "STALE_AFTER_CHANNEL_FAILURE",
        decisionSummary: "WhatsApp was offline past the freshness window. Reminder was not sent.",
      });
      if (ctx.ownerId) {
        const { notifyOwnerOrManagers } = await import("@/lib/agent/notifications");
        await notifyOwnerOrManagers({
          clientId: job.clientId,
          ownerId: ctx.ownerId,
          leadId: job.leadId as string,
          message: "A SegmiQ reminder could not be sent because WhatsApp was disconnected too long.",
        });
      }
      return { status: "EXPIRED", reasonCode: "STALE_AFTER_CHANNEL_FAILURE", summary: "Stale after channel failure" };
    }
    await updateJob(job.id, {
      status: "WAITING_FOR_CHANNEL",
      reasonCode: "CHANNEL_UNAVAILABLE",
      decisionSummary: "Waiting for WhatsApp to reconnect. Will re-evaluate — will not mark as sent.",
      scheduledAt: new Date(now().getTime() + 5 * 60_000).toISOString(),
    });
    return { status: "WAITING_FOR_CHANNEL", reasonCode: "CHANNEL_UNAVAILABLE", summary: "WhatsApp disconnected" };
  }

  if (!policy.allowed) {
    const status = policy.terminalStatus ?? "SKIPPED";
    await updateJob(job.id, {
      status,
      reasonCode: policy.reasonCode,
      skipReason: policy.reasonCode,
      decision: "NO_ACTION",
      conditions: policy.conditions,
      decisionSummary: policy.reasons.join(" ") || policy.reasonCode,
    });
    return { status, reasonCode: policy.reasonCode, summary: policy.reasons.join(" ") };
  }

  // Re-read conversation under lock before any customer-facing execution.
  let lockHeld = false;
  const executionId = `proactive:${job.id}`;
  if (policy.actionMode === "CUSTOMER_MESSAGE" || policy.actionMode === "REQUEST_APPROVAL") {
    lockHeld = await acquireConversationLock({
      clientId: job.clientId,
      leadId: job.leadId as string,
      executionId,
    });
    if (!lockHeld) {
      await rescheduleJob(job.id, new Date(now().getTime() + 2 * 60_000));
      return { status: "SCHEDULED", reasonCode: null, summary: "Conversation busy — retry shortly" };
    }
    const state = await ensureConversationAgentState(job.clientId, job.leadId as string);
    const gate = conversationAllowsAgent(state, now());
    if (!gate.allowed) {
      await releaseConversationLock({
        clientId: job.clientId,
        leadId: job.leadId as string,
        executionId,
      });
      await updateJob(job.id, {
        status: "SKIPPED",
        reasonCode: gate.reason === "HUMAN_TAKEOVER" ? "HUMAN_ACTIVE" : "AGENT_PAUSED",
        skipReason: gate.reason,
        decision: "NO_ACTION",
        decisionSummary: gate.reason,
      });
      return { status: "SKIPPED", reasonCode: "HUMAN_ACTIVE", summary: gate.reason };
    }
  }

  try {
    const drafted = await draftAction(job, ctx, policy.actionMode, {
      simulate: Boolean(opts?.simulate) || proactive.shadowMode || agent.testMode,
      maxAttempts: brain?.settings.maxAutonomousFollowUps ?? 2,
      secondFollowUpDays: brain?.settings.secondFollowUpBusinessDays ?? 5,
      timezone,
      workingDays,
    });

    const parsed = decisionSchema.safeParse(drafted);
    const decision: ProactiveDecisionContract = parsed.success
      ? (parsed.data as ProactiveDecisionContract)
      : {
          decision: "NO_ACTION",
          reasonCode: "LOW_CONFIDENCE",
          confidence: 0,
          summary: "Decision failed validation — no customer action taken.",
        };

    if (decision.customerMessage) {
      decision.customerMessage = sanitizeProactiveMessage(decision.customerMessage);
    }

    const shadow = proactive.shadowMode || agent.testMode || Boolean(opts?.simulate);
    const result = await executeProactiveAction({
      job,
      ctx,
      policy,
      decision,
      shadow,
      agent,
      timezone,
      workingDays,
    });

    await updateJob(job.id, {
      status: result.status,
      decision: decision.decision,
      reasonCode: result.reasonCode ?? decision.reasonCode,
      actionType: result.actionType,
      customerMessage: decision.customerMessage ?? null,
      decisionSummary: decision.summary,
      conditions: policy.conditions,
      skipReason: result.skipReason ?? null,
      failureReason: result.failureReason ?? null,
      executedAt: result.status === "COMPLETED" ? now().toISOString() : null,
      agentExecutionId: result.executionId ?? null,
    });

    if (result.status === "COMPLETED" && result.actionType === "CUSTOMER_MESSAGE" && !shadow) {
      await maybeScheduleNextQuoteFollowUp(job, {
        timezone,
        workingDays,
        secondDays: brain?.settings.secondFollowUpBusinessDays ?? 5,
        maxAttempts: brain?.settings.maxAutonomousFollowUps ?? 2,
        contactWindows: proactive.config.contactWindows,
      });
    }

    return {
      status: result.status,
      reasonCode: result.reasonCode ?? decision.reasonCode,
      summary: decision.summary,
    };
  } finally {
    if (lockHeld && job.leadId) {
      await releaseConversationLock({
        clientId: job.clientId,
        leadId: job.leadId,
        executionId,
      });
    }
  }
}

async function draftAction(
  job: ProactiveJob,
  ctx: EvaluationContext,
  actionMode: string,
  opts: {
    simulate: boolean;
    maxAttempts: number;
    secondFollowUpDays: number;
    timezone: string;
    workingDays: number[];
  }
): Promise<ProactiveDecisionContract> {
  if (!ctx) {
    return { decision: "NO_ACTION", reasonCode: "NO_ACTION_NEEDED", confidence: 1, summary: "Missing context" };
  }

  if (actionMode === "NOTIFY") {
    return {
      decision: "NOTIFY_HUMAN",
      reasonCode: "NO_ACTION_NEEDED",
      confidence: 1,
      summary: notifySummary(job, ctx),
    };
  }
  if (actionMode === "CREATE_TASK") {
    return {
      decision: "CREATE_TASK",
      reasonCode: job.attemptNumber > opts.maxAttempts ? "MAX_ATTEMPTS_REACHED" : "NO_ACTION_NEEDED",
      confidence: 1,
      summary: taskSummary(job, ctx),
      task: { title: taskTitle(job, ctx) },
    };
  }
  if (actionMode === "REQUEST_APPROVAL") {
    const message = templateMessage(job, ctx, opts.timezone);
    return {
      decision: "WOULD_HAVE_SENT",
      reasonCode: "APPROVAL_REQUIRED",
      customerMessage: message,
      confidence: 0.8,
      summary: "Drafted for human approval.",
    };
  }

  const def = TRIGGER_REGISTRY[job.triggerType];
  if (def && !def.needsModel) {
    const message = templateMessage(job, ctx, opts.timezone);
    return {
      decision: opts.simulate ? "WOULD_HAVE_SENT" : "SEND_MESSAGE",
      reasonCode: "NO_ACTION_NEEDED",
      customerMessage: message,
      confidence: 1,
      summary: `Template reminder for ${job.triggerType}.`,
    };
  }

  try {
    const generated = await generateProactiveDecision({ job, ctx, timezone: opts.timezone });
    if (generated) return generated;
  } catch (err) {
    console.error("[proactive] model decision failed", err);
  }

  if (job.triggerType === TEMPORAL_TRIGGER_TYPES.APPOINTMENT_REMINDER_DUE) {
    return {
      decision: "SEND_MESSAGE",
      reasonCode: "NO_ACTION_NEEDED",
      customerMessage: templateMessage(job, ctx, opts.timezone),
      confidence: 0.7,
      summary: "Used the appointment reminder template after the model was unavailable.",
    };
  }

  return {
    decision: "CREATE_TASK",
    reasonCode: "LOW_CONFIDENCE",
    confidence: 0,
    summary: "Model unavailable — created a salesperson task instead of sending a message.",
    task: { title: taskTitle(job, ctx) },
  };
}

function templateMessage(
  job: ProactiveJob,
  ctx: EvaluationContext,
  timezone: string
): string {
  if (job.triggerType === TEMPORAL_TRIGGER_TYPES.APPOINTMENT_REMINDER_DUE && ctx.appointment) {
    return appointmentReminderMessage({
      customerFirstName: ctx.customerFirstName,
      purpose: ctx.appointment.purpose,
      callbackAtIso: ctx.appointment.callbackAt,
      timezone,
    });
  }
  if (job.triggerType === TEMPORAL_TRIGGER_TYPES.APPOINTMENT_FOLLOWUP_DUE) {
    return missedAppointmentMessage({
      customerFirstName: ctx.customerFirstName,
      purpose: ctx.appointment?.purpose ?? null,
    });
  }
  return quoteFollowUpFallback({
    customerFirstName: ctx.customerFirstName,
    quoteNumber: ctx.quotation?.quoteNumber ?? null,
    projectHint: ctx.projectHint,
    commitment: job.triggerType === TEMPORAL_TRIGGER_TYPES.CUSTOMER_FOLLOWUP_DUE,
  });
}

function taskTitle(
  job: ProactiveJob,
  ctx: EvaluationContext
): string {
  if (job.triggerType === TEMPORAL_TRIGGER_TYPES.QUOTATION_FOLLOWUP_DUE) {
    return `Quotation ${ctx.quotation?.quoteNumber ?? ""} has received no response after Agent follow-ups.`.trim();
  }
  if (job.triggerType === TEMPORAL_TRIGGER_TYPES.DEAL_INACTIVE) {
    return "Deal has had no meaningful activity — needs a next action.";
  }
  if (job.triggerType === TEMPORAL_TRIGGER_TYPES.DEAL_NEXT_ACTION_MISSING) {
    return "Active Deal has no upcoming task or appointment.";
  }
  if (job.triggerType === TEMPORAL_TRIGGER_TYPES.APPOINTMENT_FOLLOWUP_DUE) {
    return job.payload.kind === "completed"
      ? "Appointment completed — prepare the next commercial step / quotation."
      : "Appointment was missed — help reschedule.";
  }
  if (job.triggerType === TEMPORAL_TRIGGER_TYPES.QUOTATION_EXPIRING_SOON) {
    return `Quotation ${ctx.quotation?.quoteNumber ?? ""} expires soon.`;
  }
  return "Follow up with this customer.";
}

function taskSummary(
  job: ProactiveJob,
  ctx: EvaluationContext
): string {
  return taskTitle(job, ctx);
}

function notifySummary(
  job: ProactiveJob,
  ctx: EvaluationContext
): string {
  if (job.triggerType === TEMPORAL_TRIGGER_TYPES.CONVERSATION_RESPONSE_SLA) {
    return "Customer enquiry has been waiting without a response.";
  }
  if (job.triggerType === TEMPORAL_TRIGGER_TYPES.APPOINTMENT_SALESPERSON_REMINDER && ctx.appointment) {
    return `Upcoming appointment at ${ctx.appointment.callbackAt}.`;
  }
  if (job.triggerType === TEMPORAL_TRIGGER_TYPES.QUOTATION_EXPIRING_SOON) {
    return `Quotation ${ctx.quotation?.quoteNumber ?? ""} expires soon.`;
  }
  return "SegmiQ flagged this for a person to review.";
}

async function maybeScheduleNextQuoteFollowUp(
  job: ProactiveJob,
  opts: {
    timezone: string;
    workingDays: number[];
    secondDays: number;
    maxAttempts: number;
    contactWindows: import("./types").ProactiveContactWindows;
  }
): Promise<void> {
  if (job.triggerType !== TEMPORAL_TRIGGER_TYPES.QUOTATION_FOLLOWUP_DUE) return;
  if (job.attemptNumber >= opts.maxAttempts) return;
  const nextAt = nextContactInstant(
    addBusinessDays({ from: now(), days: opts.secondDays, timezone: opts.timezone, workingDays: opts.workingDays }),
    opts.timezone,
    opts.contactWindows
  );
  await scheduleEvaluation({
    clientId: job.clientId,
    leadId: job.leadId,
    contactId: job.contactId,
    dealId: job.dealId,
    quotationId: job.quotationId,
    quotationVersion: job.quotationVersion,
    conversationId: job.conversationId,
    triggerType: TEMPORAL_TRIGGER_TYPES.QUOTATION_FOLLOWUP_DUE,
    attemptNumber: job.attemptNumber + 1,
    scheduledAt: nextAt,
    staleAfter: new Date(nextAt.getTime() + 36 * 3600_000),
    payload: job.payload,
    actorOrigin: "AGENT",
    causationId: job.id,
  });
}

export async function runDueProactiveJobs(limit = 20): Promise<{ claimed: number; evaluated: number }> {
  const { claimDueJobs } = await import("./jobs");
  const claimed = await claimDueJobs(limit);
  let evaluated = 0;
  for (const job of claimed) {
    try {
      await evaluateProactiveJob(job.id);
      evaluated += 1;
    } catch (err) {
      console.error("[proactive] job evaluation failed", job.id, err);
      await updateJob(job.id, {
        status: "FAILED",
        failureReason: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { claimed: claimed.length, evaluated };
}

/** Recover EVALUATING jobs stuck after a worker crash. */
export async function recoverStuckEvaluations(): Promise<number> {
  const supabase = createAdminClient();
  const staleBefore = new Date(now().getTime() - 10 * 60_000).toISOString();
  const { data } = await supabase
    .from("agent_proactive_jobs")
    .update({ status: "SCHEDULED", updated_at: now().toISOString() })
    .eq("status", "EVALUATING")
    .lt("updated_at", staleBefore)
    .select("id");
  return data?.length ?? 0;
}
