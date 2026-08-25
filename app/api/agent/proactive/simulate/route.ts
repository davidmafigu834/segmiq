import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import { getAgentCompanySettings } from "@/lib/agent/settings";
import { getProactiveSettings } from "@/lib/agent/proactive/settings";
import { loadEvaluationContext } from "@/lib/agent/proactive/context";
import { evaluateProactivePolicy } from "@/lib/agent/proactive/policy";
import { quoteFollowUpFallback, appointmentReminderMessage } from "@/lib/agent/proactive/templates";
import { TEMPORAL_TRIGGER_TYPES } from "@/lib/agent/proactive/registry";
import { loadCachedCompanyBrainSnapshot } from "@/lib/company-brain";
import { isProactiveCustomerMessagingGloballyEnabled, isProactiveGloballyEnabled } from "@/lib/agent/proactive/settings";
import type { ProactiveJob } from "@/lib/agent/proactive/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  triggerType: z.enum([
    TEMPORAL_TRIGGER_TYPES.QUOTATION_FOLLOWUP_DUE,
    TEMPORAL_TRIGGER_TYPES.APPOINTMENT_REMINDER_DUE,
    TEMPORAL_TRIGGER_TYPES.CUSTOMER_FOLLOWUP_DUE,
    TEMPORAL_TRIGGER_TYPES.DEAL_INACTIVE,
  ]),
  leadId: z.string().uuid().optional(),
  quotationId: z.string().uuid().optional(),
});

/**
 * Test Mode for proactive evaluations. Never sends or mutates CRM.
 */
export async function POST(req: Request) {
  const auth = await resolveApiAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const supabase = createAdminClient();
  let leadId = parsed.data.leadId ?? null;
  if (!leadId && parsed.data.quotationId) {
    const { data: q } = await supabase
      .from("quotations")
      .select("lead_id, client_id")
      .eq("id", parsed.data.quotationId)
      .maybeSingle();
    leadId = (q?.lead_id as string) ?? null;
  }
  if (!leadId) return NextResponse.json({ error: "leadId or quotationId required" }, { status: 400 });

  const { data: lead } = await supabase.from("leads").select("id, client_id").eq("id", leadId).maybeSingle();
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  const clientId = lead.client_id as string;
  const allowed =
    auth.role === "SUPER_ADMIN" || (auth.clientId === clientId && auth.role === "CLIENT_MANAGER");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const job = fakeJob({
    clientId,
    leadId,
    quotationId: parsed.data.quotationId ?? null,
    triggerType: parsed.data.triggerType,
  });
  const [proactive, agent, brain, ctx] = await Promise.all([
    getProactiveSettings(clientId),
    getAgentCompanySettings(clientId),
    loadCachedCompanyBrainSnapshot(clientId).catch(() => null),
    loadEvaluationContext(job),
  ]);
  if (!ctx) return NextResponse.json({ error: "Could not load conversation context" }, { status: 404 });
  const timezone = brain?.canonical.timezone ?? "Africa/Harare";
  ctx.timezone = timezone;

  const policy = evaluateProactivePolicy({
    now: new Date(),
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

  let wouldSend: string | null = null;
  if (policy.allowed && (policy.actionMode === "CUSTOMER_MESSAGE" || policy.actionMode === "REQUEST_APPROVAL")) {
    if (job.triggerType === TEMPORAL_TRIGGER_TYPES.APPOINTMENT_REMINDER_DUE && ctx.appointment) {
      wouldSend = appointmentReminderMessage({
        customerFirstName: ctx.customerFirstName,
        purpose: ctx.appointment.purpose,
        callbackAtIso: ctx.appointment.callbackAt,
        timezone,
      });
    } else {
      wouldSend = quoteFollowUpFallback({
        customerFirstName: ctx.customerFirstName,
        quoteNumber: ctx.quotation?.quoteNumber ?? null,
        projectHint: ctx.projectHint,
        commitment: job.triggerType === TEMPORAL_TRIGGER_TYPES.CUSTOMER_FOLLOWUP_DUE,
      });
    }
  }

  return NextResponse.json({
    wouldAct: policy.allowed,
    actionMode: policy.actionMode,
    reasonCode: policy.reasonCode,
    reasons: policy.reasons,
    conditions: policy.conditions,
    wouldSend,
    tools: wouldSend ? ["messaging.send"] : [],
    executed: false,
  });
}

function fakeJob(opts: {
  clientId: string;
  leadId: string;
  quotationId: string | null;
  triggerType: string;
}): ProactiveJob {
  const nowIso = new Date().toISOString();
  return {
    id: "00000000-0000-0000-0000-000000000000",
    clientId: opts.clientId,
    leadId: opts.leadId,
    contactId: null,
    dealId: null,
    quotationId: opts.quotationId,
    quotationVersion: 1,
    appointmentId: null,
    conversationId: opts.leadId,
    triggerType: opts.triggerType,
    triggerEventId: null,
    policyId: "default",
    attemptNumber: 1,
    fingerprint: "simulate",
    status: "EVALUATING",
    scheduledAt: nowIso,
    staleAfter: null,
    evaluatedAt: nowIso,
    executedAt: null,
    decision: null,
    reasonCode: null,
    actionType: null,
    customerMessage: null,
    decisionSummary: null,
    conditions: {},
    payload: {},
    actorOrigin: "SYSTEM",
    correlationId: null,
    causationId: null,
    agentExecutionId: null,
    retryCount: 0,
    cancelledById: null,
    cancelledReason: null,
    skipReason: null,
    failureReason: null,
    createdAt: nowIso,
  };
}
