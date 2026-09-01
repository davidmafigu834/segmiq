import { createAdminClient } from "@/lib/supabase/admin";
import { getObject } from "@/lib/storage/r2";
import { DOCUMENT_EXTRACTOR_VERSION } from "@/lib/documents/processing/constants";
import { extractByMime } from "@/lib/documents/processing/extract";
import { persistExtraction } from "@/lib/documents/processing/index-content";
import {
  claimDueDocumentJobs,
  completeDocumentJob,
  failDocumentJob,
  recoverStuckDocumentJobs,
  type DocumentProcessingJobRow,
} from "@/lib/documents/processing/jobs";
import { DocumentExtractionError } from "@/lib/documents/processing/types";
import { DOCUMENT_WORKER_BATCH_SIZE } from "@/lib/documents/processing/constants";

async function setProcessingStatus(opts: {
  clientId: string;
  documentId: string;
  versionId: string;
  documentStatus: string;
  versionStatus: string;
  extractedTextStatus?: string;
  extractionError?: string | null;
}): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  await supabase
    .from("documents")
    .update({ processing_status: opts.documentStatus, updated_at: now })
    .eq("id", opts.documentId)
    .eq("client_id", opts.clientId);

  const versionPatch: Record<string, unknown> = {
    processing_status: opts.versionStatus,
  };
  if (opts.extractedTextStatus) versionPatch.extracted_text_status = opts.extractedTextStatus;
  if (opts.extractionError !== undefined) versionPatch.extraction_error = opts.extractionError;

  await supabase
    .from("document_versions")
    .update(versionPatch)
    .eq("id", opts.versionId)
    .eq("client_id", opts.clientId);
}

async function recordActivity(opts: {
  clientId: string;
  documentId: string;
  versionId: string;
  action: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("document_activity").insert({
    client_id: opts.clientId,
    document_id: opts.documentId,
    version_id: opts.versionId,
    action: opts.action,
    metadata: opts.metadata ?? {},
  });
}

export async function processDocumentJob(job: DocumentProcessingJobRow): Promise<void> {
  const supabase = createAdminClient();

  const { data: version } = await supabase
    .from("document_versions")
    .select("*")
    .eq("id", job.version_id)
    .eq("document_id", job.document_id)
    .eq("client_id", job.client_id)
    .maybeSingle();

  if (!version) {
    await failDocumentJob(job.id, "Document version not found.", { retry: false });
    return;
  }

  if (version.checksum_sha256 === "pending") {
    await failDocumentJob(job.id, "Upload not finalized (checksum pending).", { retry: true, retryDelayMs: 30_000 });
    return;
  }

  await setProcessingStatus({
    clientId: job.client_id,
    documentId: job.document_id,
    versionId: job.version_id,
    documentStatus: "EXTRACTING",
    versionStatus: "EXTRACTING",
  });
  await recordActivity({
    clientId: job.client_id,
    documentId: job.document_id,
    versionId: job.version_id,
    action: "PROCESSING_STARTED",
  });

  let buffer: Buffer;
  try {
    buffer = await getObject(version.storage_key as string);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Storage read failed.";
    await setProcessingStatus({
      clientId: job.client_id,
      documentId: job.document_id,
      versionId: job.version_id,
      documentStatus: "FAILED",
      versionStatus: "FAILED",
      extractedTextStatus: "FAILED",
      extractionError: message,
    });
    await failDocumentJob(job.id, message);
    await recordActivity({
      clientId: job.client_id,
      documentId: job.document_id,
      versionId: job.version_id,
      action: "PROCESSING_FAILED",
      metadata: { reason: message },
    });
    return;
  }

  try {
    await setProcessingStatus({
      clientId: job.client_id,
      documentId: job.document_id,
      versionId: job.version_id,
      documentStatus: "ANALYZING",
      versionStatus: "ANALYZING",
    });

    const result = await extractByMime(
      buffer,
      version.mime_type as string,
      version.original_file_name as string
    );

    if (result.passwordProtected) {
      throw new DocumentExtractionError(
        "PASSWORD_PROTECTED",
        "This PDF is password protected and cannot currently be analyzed."
      );
    }

    await setProcessingStatus({
      clientId: job.client_id,
      documentId: job.document_id,
      versionId: job.version_id,
      documentStatus: "INDEXING",
      versionStatus: "INDEXING",
    });

    const { chunkCount } = await persistExtraction({
      clientId: job.client_id,
      documentId: job.document_id,
      versionId: job.version_id,
      result,
    });

    const { data: documentRow } = await supabase
      .from("documents")
      .select("title")
      .eq("id", job.document_id)
      .eq("client_id", job.client_id)
      .maybeSingle();

    const { classifyDocumentRecord } = await import("@/lib/documents/classification");
    const classification = await classifyDocumentRecord({
      clientId: job.client_id,
      documentId: job.document_id,
      versionId: job.version_id,
      filename: version.original_file_name as string,
      plainText: result.plainText,
      title: (documentRow?.title as string) ?? (version.original_file_name as string),
    });

    if (result.plainText.trim().length >= 80) {
      const { extractDocumentIntelligence } = await import("@/lib/documents/intelligence");
      const { data: docTypeRow } = await supabase
        .from("documents")
        .select("document_type_id")
        .eq("id", job.document_id)
        .eq("client_id", job.client_id)
        .maybeSingle();

      await extractDocumentIntelligence({
        clientId: job.client_id,
        documentId: job.document_id,
        versionId: job.version_id,
        filename: version.original_file_name as string,
        plainText: result.plainText,
        title: (documentRow?.title as string) ?? (version.original_file_name as string),
        documentTypeId: (docTypeRow?.document_type_id as string | null) ?? null,
        documentTypeCode: classification.classification.documentTypeCode,
      });
    }

    let linkingNeedsReview = false;
    if (result.plainText.trim().length >= 80) {
      const { autoLinkDocumentRecords } = await import("@/lib/documents/linking");
      const linking = await autoLinkDocumentRecords({
        clientId: job.client_id,
        documentId: job.document_id,
        versionId: job.version_id,
        title: (documentRow?.title as string) ?? (version.original_file_name as string),
        filename: version.original_file_name as string,
        plainText: result.plainText,
      });
      linkingNeedsReview = linking.needsReview;
    }

    let documentStatus = "READY";
    let versionStatus = "READY";
    let extractedTextStatus = "EXTRACTED";
    let extractionError: string | null = null;

    if (result.skipped && result.skipReason) {
      extractedTextStatus = "SKIPPED";
      documentStatus = "READY";
      extractionError = result.skipReason;
    } else if (result.likelyScanned && result.plainText.length < 40) {
      extractedTextStatus = "PARTIAL";
      documentStatus = "NEEDS_REVIEW";
      versionStatus = "NEEDS_REVIEW";
      extractionError =
        "This document appears to be scanned or image-based. Text extraction found little or no content.";
    } else if (!result.plainText.trim()) {
      extractedTextStatus = "FAILED";
      documentStatus = "NEEDS_REVIEW";
      versionStatus = "NEEDS_REVIEW";
      extractionError = "No extractable text was found.";
    } else if (classification.needsReview) {
      documentStatus = "NEEDS_REVIEW";
      versionStatus = "NEEDS_REVIEW";
    } else if (linkingNeedsReview) {
      documentStatus = "NEEDS_REVIEW";
      versionStatus = "NEEDS_REVIEW";
    }

    await setProcessingStatus({
      clientId: job.client_id,
      documentId: job.document_id,
      versionId: job.version_id,
      documentStatus,
      versionStatus,
      extractedTextStatus,
      extractionError,
    });

    await completeDocumentJob(job.id, { extractorVersion: DOCUMENT_EXTRACTOR_VERSION });
    await recordActivity({
      clientId: job.client_id,
      documentId: job.document_id,
      versionId: job.version_id,
      action: "PROCESSING_COMPLETED",
      metadata: {
        chunkCount,
        charCount: result.plainText.length,
        tableCount: result.tables.length,
        extractorVersion: DOCUMENT_EXTRACTOR_VERSION,
        classification: classification.classification.documentTypeCode,
        categoryAction: classification.category.action,
      },
    });
  } catch (err) {
    const isExtraction = err instanceof DocumentExtractionError;
    const message = err instanceof Error ? err.message : "Processing failed.";
    const isPassword = isExtraction && err.code === "PASSWORD_PROTECTED";

    await setProcessingStatus({
      clientId: job.client_id,
      documentId: job.document_id,
      versionId: job.version_id,
      documentStatus: isPassword ? "READY" : "FAILED",
      versionStatus: isPassword ? "READY" : "FAILED",
      extractedTextStatus: isPassword ? "SKIPPED" : "FAILED",
      extractionError: message,
    });

    await failDocumentJob(job.id, message, { retry: !isExtraction && !isPassword });
    await recordActivity({
      clientId: job.client_id,
      documentId: job.document_id,
      versionId: job.version_id,
      action: "PROCESSING_FAILED",
      metadata: { reason: message, code: isExtraction ? err.code : undefined },
    });
  }
}

export async function runDocumentProcessingWorker(
  limit = DOCUMENT_WORKER_BATCH_SIZE
): Promise<{ recovered: number; claimed: number; completed: number; failed: number }> {
  const recovered = await recoverStuckDocumentJobs();
  const jobs = await claimDueDocumentJobs(limit);
  let completed = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      await processDocumentJob(job);
      const supabase = createAdminClient();
      const { data } = await supabase
        .from("document_processing_jobs")
        .select("status")
        .eq("id", job.id)
        .maybeSingle();
      if (data?.status === "COMPLETED") completed += 1;
      else if (data?.status === "FAILED") failed += 1;
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : "Unexpected worker error.";
      await failDocumentJob(job.id, message);
    }
  }

  return { recovered, claimed: jobs.length, completed, failed };
}
