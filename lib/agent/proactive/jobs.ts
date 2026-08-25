import { createAdminClient } from "@/lib/supabase/admin";
import { now } from "@/lib/clock";
import { asRow, asRows } from "@/lib/agent/rows";
import type { ActorType, ProactiveJob, ProactiveJobState } from "./types";
import { jobFingerprint } from "./registry";

type JobRow = Record<string, unknown>;

export function rowToJob(row: JobRow): ProactiveJob {
  return {
    id: row.id as string,
    clientId: row.client_id as string,
    leadId: (row.lead_id as string | null) ?? null,
    contactId: (row.contact_id as string | null) ?? null,
    dealId: (row.deal_id as string | null) ?? null,
    quotationId: (row.quotation_id as string | null) ?? null,
    quotationVersion: row.quotation_version == null ? null : Number(row.quotation_version),
    appointmentId: (row.appointment_id as string | null) ?? null,
    conversationId: (row.conversation_id as string | null) ?? null,
    triggerType: row.trigger_type as string,
    triggerEventId: (row.trigger_event_id as string | null) ?? null,
    policyId: (row.policy_id as string) || "default",
    attemptNumber: Number(row.attempt_number) || 1,
    fingerprint: row.fingerprint as string,
    status: row.status as ProactiveJobState,
    scheduledAt: row.scheduled_at as string,
    staleAfter: (row.stale_after as string | null) ?? null,
    evaluatedAt: (row.evaluated_at as string | null) ?? null,
    executedAt: (row.executed_at as string | null) ?? null,
    decision: (row.decision as string | null) ?? null,
    reasonCode: (row.reason_code as string | null) ?? null,
    actionType: (row.action_type as string | null) ?? null,
    customerMessage: (row.customer_message as string | null) ?? null,
    decisionSummary: (row.decision_summary as string | null) ?? null,
    conditions: (row.conditions as Record<string, unknown>) ?? {},
    payload: (row.payload as Record<string, unknown>) ?? {},
    actorOrigin: (row.actor_origin as ActorType | null) ?? null,
    correlationId: (row.correlation_id as string | null) ?? null,
    causationId: (row.causation_id as string | null) ?? null,
    agentExecutionId: (row.agent_execution_id as string | null) ?? null,
    retryCount: Number(row.retry_count) || 0,
    cancelledById: (row.cancelled_by_id as string | null) ?? null,
    cancelledReason: (row.cancelled_reason as string | null) ?? null,
    skipReason: (row.skip_reason as string | null) ?? null,
    failureReason: (row.failure_reason as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export type ScheduleJobInput = {
  clientId: string;
  leadId?: string | null;
  contactId?: string | null;
  dealId?: string | null;
  quotationId?: string | null;
  quotationVersion?: number | null;
  appointmentId?: string | null;
  conversationId?: string | null;
  triggerType: string;
  triggerEventId?: string | null;
  policyId?: string;
  attemptNumber?: number;
  scheduledAt: Date;
  staleAfter?: Date | null;
  payload?: Record<string, unknown>;
  actorOrigin?: ActorType | null;
  correlationId?: string | null;
  causationId?: string | null;
};

/**
 * Insert a scheduled evaluation. Duplicate fingerprints are ignored (idempotent).
 */
export async function scheduleEvaluation(input: ScheduleJobInput): Promise<ProactiveJob | null> {
  const fingerprint = jobFingerprint({
    clientId: input.clientId,
    triggerType: input.triggerType,
    entityId: input.quotationId ?? input.appointmentId ?? input.dealId ?? input.leadId ?? "unknown",
    policyId: input.policyId,
    attemptNumber: input.attemptNumber ?? 1,
  });
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("agent_proactive_jobs")
    .insert({
      client_id: input.clientId,
      lead_id: input.leadId ?? null,
      contact_id: input.contactId ?? null,
      deal_id: input.dealId ?? null,
      quotation_id: input.quotationId ?? null,
      quotation_version: input.quotationVersion ?? null,
      appointment_id: input.appointmentId ?? null,
      conversation_id: input.conversationId ?? input.leadId ?? null,
      trigger_type: input.triggerType,
      trigger_event_id: input.triggerEventId ?? null,
      policy_id: input.policyId ?? "default",
      attempt_number: input.attemptNumber ?? 1,
      fingerprint,
      status: "SCHEDULED",
      scheduled_at: input.scheduledAt.toISOString(),
      stale_after: input.staleAfter?.toISOString() ?? null,
      payload: input.payload ?? {},
      actor_origin: input.actorOrigin ?? "SYSTEM",
      correlation_id: input.correlationId ?? null,
      causation_id: input.causationId ?? null,
    })
    .select("*")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") return null;
    console.error("[proactive] schedule insert failed", error.message);
    return null;
  }
  return data ? rowToJob(data as JobRow) : null;
}

export async function rescheduleJob(jobId: string, scheduledAt: Date): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("agent_proactive_jobs")
    .update({
      status: "SCHEDULED",
      scheduled_at: scheduledAt.toISOString(),
      updated_at: now().toISOString(),
    })
    .eq("id", jobId);
}

export async function claimDueJobs(limit = 25): Promise<ProactiveJob[]> {
  const supabase = createAdminClient();
  const dueBefore = now().toISOString();
  const { data: due } = await supabase
    .from("agent_proactive_jobs")
    .select("id")
    .in("status", ["SCHEDULED", "WAITING_FOR_CHANNEL"])
    .lte("scheduled_at", dueBefore)
    .order("scheduled_at", { ascending: true })
    .limit(limit);
  const ids = (due ?? []).map((r) => r.id as string);
  if (!ids.length) return [];

  const claimed: ProactiveJob[] = [];
  for (const id of ids) {
    const { data } = await supabase
      .from("agent_proactive_jobs")
      .update({ status: "EVALUATING", evaluated_at: dueBefore, updated_at: dueBefore })
      .eq("id", id)
      .in("status", ["SCHEDULED", "WAITING_FOR_CHANNEL"])
      .select("*")
      .maybeSingle();
    if (data) claimed.push(rowToJob(data as JobRow));
  }
  return claimed;
}

export async function updateJob(
  jobId: string,
  patch: Partial<{
    status: ProactiveJobState;
    decision: string | null;
    reasonCode: string | null;
    actionType: string | null;
    customerMessage: string | null;
    decisionSummary: string | null;
    conditions: Record<string, unknown>;
    agentExecutionId: string | null;
    skipReason: string | null;
    failureReason: string | null;
    retryCount: number;
    executedAt: string | null;
    scheduledAt: string;
    cancelledById: string | null;
    cancelledReason: string | null;
  }>
): Promise<void> {
  const supabase = createAdminClient();
  const update: Record<string, unknown> = { updated_at: now().toISOString() };
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.decision !== undefined) update.decision = patch.decision;
  if (patch.reasonCode !== undefined) update.reason_code = patch.reasonCode;
  if (patch.actionType !== undefined) update.action_type = patch.actionType;
  if (patch.customerMessage !== undefined) update.customer_message = patch.customerMessage;
  if (patch.decisionSummary !== undefined) update.decision_summary = patch.decisionSummary;
  if (patch.conditions !== undefined) update.conditions = patch.conditions;
  if (patch.agentExecutionId !== undefined) update.agent_execution_id = patch.agentExecutionId;
  if (patch.skipReason !== undefined) update.skip_reason = patch.skipReason;
  if (patch.failureReason !== undefined) update.failure_reason = patch.failureReason;
  if (patch.retryCount !== undefined) update.retry_count = patch.retryCount;
  if (patch.executedAt !== undefined) update.executed_at = patch.executedAt;
  if (patch.scheduledAt !== undefined) update.scheduled_at = patch.scheduledAt;
  if (patch.cancelledById !== undefined) update.cancelled_by_id = patch.cancelledById;
  if (patch.cancelledReason !== undefined) update.cancelled_reason = patch.cancelledReason;
  await supabase.from("agent_proactive_jobs").update(update).eq("id", jobId);
}

export async function cancelJobs(opts: {
  clientId: string;
  reason: string;
  triggerTypes?: string[];
  quotationId?: string;
  appointmentId?: string;
  dealId?: string;
  leadId?: string;
  cancelledById?: string | null;
}): Promise<number> {
  const supabase = createAdminClient();
  let query = supabase
    .from("agent_proactive_jobs")
    .update({
      status: "CANCELLED",
      skip_reason: opts.reason,
      cancelled_reason: opts.reason,
      cancelled_by_id: opts.cancelledById ?? null,
      updated_at: now().toISOString(),
    })
    .eq("client_id", opts.clientId)
    .in("status", ["SCHEDULED", "WAITING_FOR_CHANNEL", "WAITING_FOR_HUMAN", "WAITING_FOR_POLICY"]);
  if (opts.triggerTypes?.length) query = query.in("trigger_type", opts.triggerTypes);
  if (opts.quotationId) query = query.eq("quotation_id", opts.quotationId);
  if (opts.appointmentId) query = query.eq("appointment_id", opts.appointmentId);
  if (opts.dealId) query = query.eq("deal_id", opts.dealId);
  if (opts.leadId) query = query.eq("lead_id", opts.leadId);
  const { data } = await query.select("id");
  return data?.length ?? 0;
}

export async function getJob(jobId: string, clientId?: string): Promise<ProactiveJob | null> {
  const supabase = createAdminClient();
  let query = supabase.from("agent_proactive_jobs").select("*").eq("id", jobId);
  if (clientId) query = query.eq("client_id", clientId);
  const { data } = await query.maybeSingle();
  return data ? rowToJob(data as JobRow) : null;
}

export async function listJobs(opts: {
  clientId: string;
  leadId?: string;
  statuses?: ProactiveJobState[];
  triggerType?: string;
  limit?: number;
  scheduledFrom?: string;
  scheduledTo?: string;
}): Promise<ProactiveJob[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("agent_proactive_jobs")
    .select("*")
    .eq("client_id", opts.clientId)
    .order("scheduled_at", { ascending: true })
    .limit(opts.limit ?? 80);
  if (opts.leadId) query = query.eq("lead_id", opts.leadId);
  if (opts.statuses?.length) query = query.in("status", opts.statuses);
  if (opts.triggerType) query = query.eq("trigger_type", opts.triggerType);
  if (opts.scheduledFrom) query = query.gte("scheduled_at", opts.scheduledFrom);
  if (opts.scheduledTo) query = query.lte("scheduled_at", opts.scheduledTo);
  const { data } = await query;
  return asRows<JobRow>(data).map(rowToJob);
}

export async function upcomingJobForLead(clientId: string, leadId: string): Promise<ProactiveJob | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agent_proactive_jobs")
    .select("*")
    .eq("client_id", clientId)
    .eq("lead_id", leadId)
    .in("status", ["SCHEDULED", "WAITING_FOR_CHANNEL", "WAITING_FOR_HUMAN"])
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ? rowToJob(asRow<JobRow>(data) as JobRow) : null;
}

export async function countJobsToday(clientId: string): Promise<Record<string, number>> {
  const supabase = createAdminClient();
  const start = new Date(now());
  start.setUTCHours(0, 0, 0, 0);
  const iso = start.toISOString();
  const statuses: ProactiveJobState[] = [
    "SCHEDULED",
    "WAITING_FOR_HUMAN",
    "WAITING_FOR_CHANNEL",
    "COMPLETED",
    "SKIPPED",
    "FAILED",
    "EXPIRED",
    "CANCELLED",
  ];
  const counts: Record<string, number> = {};
  await Promise.all(
    statuses.map(async (status) => {
      let q = supabase
        .from("agent_proactive_jobs")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("status", status);
      if (status === "COMPLETED" || status === "SKIPPED" || status === "FAILED" || status === "EXPIRED") {
        q = q.gte("updated_at", iso);
      }
      const { count } = await q;
      counts[status] = count ?? 0;
    })
  );
  return counts;
}
