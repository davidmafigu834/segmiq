import { createAdminClient } from "@/lib/supabase/admin";
import { asRow, asRows } from "@/lib/agent/rows";
import { now } from "@/lib/clock";
import type { LearningJobState, LearningSkipReason, LearningSource } from "./types";
import { jobFingerprint, pendingConversationFingerprint } from "./policy";
import { LEARNING_EXTRACTOR_VERSION } from "./types";

export type LearningJob = {
  id: string;
  clientId: string;
  conversationId: string | null;
  source: LearningSource;
  fingerprint: string;
  status: LearningJobState;
  skipReason: string | null;
  retryCount: number;
  scheduledAt: string;
  payload: Record<string, unknown>;
};

type JobRow = Record<string, unknown>;

function rowToJob(row: JobRow): LearningJob {
  return {
    id: row.id as string,
    clientId: row.client_id as string,
    conversationId: (row.conversation_id as string | null) ?? null,
    source: row.source as LearningSource,
    fingerprint: row.fingerprint as string,
    status: row.status as LearningJobState,
    skipReason: (row.skip_reason as string | null) ?? null,
    retryCount: Number(row.retry_count) || 0,
    scheduledAt: row.scheduled_at as string,
    payload: (row.payload as Record<string, unknown>) ?? {},
  };
}

export async function scheduleLearningJob(opts: {
  clientId: string;
  conversationId?: string | null;
  source: LearningSource;
  scheduledAt?: Date;
  fingerprint?: string;
  payload?: Record<string, unknown>;
}): Promise<LearningJob | null> {
  const fingerprint =
    opts.fingerprint ??
    (opts.conversationId
      ? pendingConversationFingerprint(opts.clientId, opts.conversationId)
      : jobFingerprint({
          clientId: opts.clientId,
          conversationId: opts.conversationId ?? "none",
          source: opts.source,
          extractorVersion: LEARNING_EXTRACTOR_VERSION,
          extra: String(Date.now()),
        }));
  const supabase = createAdminClient();
  const scheduledAt = (opts.scheduledAt ?? now()).toISOString();
  const { data, error } = await supabase
    .from("agent_learning_jobs")
    .insert({
      client_id: opts.clientId,
      conversation_id: opts.conversationId ?? null,
      source: opts.source,
      fingerprint,
      status: "QUEUED",
      scheduled_at: scheduledAt,
      payload: opts.payload ?? {},
      extractor_version: LEARNING_EXTRACTOR_VERSION,
    })
    .select("*")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") {
      await supabase
        .from("agent_learning_jobs")
        .update({
          scheduled_at: scheduledAt,
          payload: opts.payload ?? {},
          updated_at: now().toISOString(),
        })
        .eq("client_id", opts.clientId)
        .eq("fingerprint", fingerprint)
        .eq("status", "QUEUED");
      const { data: existing } = await supabase
        .from("agent_learning_jobs")
        .select("*")
        .eq("client_id", opts.clientId)
        .eq("fingerprint", fingerprint)
        .maybeSingle();
      return existing ? rowToJob(existing as JobRow) : null;
    }
    console.error("[learning] schedule insert failed", error.message);
    return null;
  }
  return data ? rowToJob(data as JobRow) : null;
}

export async function claimDueLearningJobs(limit = 8): Promise<LearningJob[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agent_learning_jobs")
    .select("*")
    .eq("status", "QUEUED")
    .lte("scheduled_at", now().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(limit);
  const jobs = asRows<JobRow>(data).map(rowToJob);
  const claimed: LearningJob[] = [];
  for (const job of jobs) {
    const { data: updated } = await supabase
      .from("agent_learning_jobs")
      .update({
        status: "PROCESSING",
        started_at: now().toISOString(),
        updated_at: now().toISOString(),
      })
      .eq("id", job.id)
      .eq("status", "QUEUED")
      .select("id")
      .maybeSingle();
    if (updated) claimed.push({ ...job, status: "PROCESSING" });
  }
  return claimed;
}

export async function finishLearningJob(
  jobId: string,
  patch: {
    status: LearningJobState;
    skipReason?: LearningSkipReason | string | null;
    failureReason?: string | null;
    inputTokens?: number;
    outputTokens?: number;
    latencyMs?: number;
    modelProvider?: string | null;
    modelVersion?: string | null;
    promptVersion?: string | null;
  }
): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("agent_learning_jobs")
    .update({
      status: patch.status,
      skip_reason: patch.skipReason ?? null,
      failure_reason: patch.failureReason ?? null,
      input_tokens: patch.inputTokens ?? null,
      output_tokens: patch.outputTokens ?? null,
      latency_ms: patch.latencyMs ?? null,
      model_provider: patch.modelProvider ?? null,
      model_version: patch.modelVersion ?? null,
      prompt_version: patch.promptVersion ?? null,
      completed_at: now().toISOString(),
      updated_at: now().toISOString(),
    })
    .eq("id", jobId);
}

export async function retryLearningJob(jobId: string, retryCount: number): Promise<void> {
  const delayMin = Math.min(30, 2 ** Math.min(retryCount, 5));
  const supabase = createAdminClient();
  await supabase
    .from("agent_learning_jobs")
    .update({
      status: "QUEUED",
      retry_count: retryCount + 1,
      scheduled_at: new Date(now().getTime() + delayMin * 60_000).toISOString(),
      updated_at: now().toISOString(),
    })
    .eq("id", jobId);
}

export async function recoverStuckLearningJobs(): Promise<number> {
  const supabase = createAdminClient();
  const cutoff = new Date(now().getTime() - 10 * 60_000).toISOString();
  const { data } = await supabase
    .from("agent_learning_jobs")
    .update({
      status: "QUEUED",
      updated_at: now().toISOString(),
    })
    .eq("status", "PROCESSING")
    .lt("started_at", cutoff)
    .select("id");
  return asRows(data).length;
}

export async function countTodayTokens(clientId: string): Promise<number> {
  const supabase = createAdminClient();
  const start = new Date(now());
  start.setUTCHours(0, 0, 0, 0);
  const { data } = await supabase
    .from("agent_learning_jobs")
    .select("input_tokens, output_tokens")
    .eq("client_id", clientId)
    .gte("created_at", start.toISOString());
  return asRows<{ input_tokens: number | null; output_tokens: number | null }>(data).reduce(
    (sum, row) => sum + (row.input_tokens ?? 0) + (row.output_tokens ?? 0),
    0
  );
}

export async function getLearningCursor(
  clientId: string,
  conversationId: string
): Promise<{ lastAnalyzedMessageId: string | null } | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agent_learning_cursors")
    .select("last_analyzed_message_id")
    .eq("client_id", clientId)
    .eq("conversation_id", conversationId)
    .maybeSingle();
  const row = asRow<{ last_analyzed_message_id: string | null }>(data);
  return row ? { lastAnalyzedMessageId: row.last_analyzed_message_id } : null;
}

export async function upsertLearningCursor(opts: {
  clientId: string;
  conversationId: string;
  messageId: string;
  jobId: string;
}): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("agent_learning_cursors").upsert(
    {
      client_id: opts.clientId,
      conversation_id: opts.conversationId,
      last_analyzed_message_id: opts.messageId,
      last_analyzed_at: now().toISOString(),
      last_job_id: opts.jobId,
      updated_at: now().toISOString(),
    },
    { onConflict: "client_id,conversation_id" }
  );
}
