import { createAdminClient } from "@/lib/supabase/admin";

export type DocumentProcessingJobRow = {
  id: string;
  client_id: string;
  document_id: string;
  version_id: string;
  job_type: string;
  status: string;
  fingerprint: string;
  retry_count: number;
  max_retries: number;
  scheduled_at: string;
  failure_reason: string | null;
  extractor_version: string | null;
};

export async function claimDueDocumentJobs(limit = 5): Promise<DocumentProcessingJobRow[]> {
  const supabase = createAdminClient();
  const dueBefore = new Date().toISOString();

  const { data: due } = await supabase
    .from("document_processing_jobs")
    .select("id")
    .eq("status", "QUEUED")
    .lte("scheduled_at", dueBefore)
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  const claimed: DocumentProcessingJobRow[] = [];
  for (const row of due ?? []) {
    const { data } = await supabase
      .from("document_processing_jobs")
      .update({
        status: "RUNNING",
        started_at: dueBefore,
        updated_at: dueBefore,
      })
      .eq("id", row.id as string)
      .eq("status", "QUEUED")
      .select("*")
      .maybeSingle();

    if (data) claimed.push(data as DocumentProcessingJobRow);
  }
  return claimed;
}

export async function completeDocumentJob(
  jobId: string,
  opts?: { extractorVersion?: string }
): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  await supabase
    .from("document_processing_jobs")
    .update({
      status: "COMPLETED",
      completed_at: now,
      updated_at: now,
      extractor_version: opts?.extractorVersion ?? null,
      failure_reason: null,
    })
    .eq("id", jobId);
}

export async function failDocumentJob(
  jobId: string,
  reason: string,
  opts?: { retry?: boolean; retryDelayMs?: number }
): Promise<void> {
  const supabase = createAdminClient();
  const { data: job } = await supabase
    .from("document_processing_jobs")
    .select("retry_count, max_retries, client_id, document_id, version_id, fingerprint")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) return;

  const retryCount = Number(job.retry_count) || 0;
  const maxRetries = Number(job.max_retries) || 3;
  const canRetry = opts?.retry !== false && retryCount < maxRetries;

  if (canRetry) {
    const scheduledAt = new Date(Date.now() + (opts?.retryDelayMs ?? 60_000)).toISOString();
    await supabase
      .from("document_processing_jobs")
      .update({
        status: "QUEUED",
        retry_count: retryCount + 1,
        scheduled_at: scheduledAt,
        failure_reason: reason,
        started_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    return;
  }

  await supabase
    .from("document_processing_jobs")
    .update({
      status: "FAILED",
      failure_reason: reason,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

export async function recoverStuckDocumentJobs(staleMinutes = 15): Promise<number> {
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - staleMinutes * 60_000).toISOString();
  const { data } = await supabase
    .from("document_processing_jobs")
    .select("id, retry_count, max_retries")
    .eq("status", "RUNNING")
    .lt("started_at", cutoff);

  let recovered = 0;
  for (const row of data ?? []) {
    const retryCount = Number(row.retry_count) || 0;
    const maxRetries = Number(row.max_retries) || 3;
    if (retryCount >= maxRetries) {
      await supabase
        .from("document_processing_jobs")
        .update({
          status: "FAILED",
          failure_reason: "Processing timed out.",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id as string);
    } else {
      await supabase
        .from("document_processing_jobs")
        .update({
          status: "QUEUED",
          retry_count: retryCount + 1,
          scheduled_at: new Date().toISOString(),
          started_at: null,
          failure_reason: "Recovered from stuck RUNNING state.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id as string);
    }
    recovered += 1;
  }
  return recovered;
}

export async function enqueueDocumentReprocess(opts: {
  clientId: string;
  documentId: string;
  versionId: string;
  jobType?: "FULL_PIPELINE" | "REPROCESS" | "INDEX_ONLY";
}): Promise<string | null> {
  const supabase = createAdminClient();
  const fingerprint = `${opts.jobType ?? "REPROCESS"}:${opts.versionId}:${Date.now()}`;
  const { data, error } = await supabase
    .from("document_processing_jobs")
    .insert({
      client_id: opts.clientId,
      document_id: opts.documentId,
      version_id: opts.versionId,
      job_type: opts.jobType ?? "REPROCESS",
      status: "QUEUED",
      fingerprint,
      scheduled_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) return null;
  return data.id as string;
}
