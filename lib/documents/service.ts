import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateDocumentVersionKey,
  generatePresignedDownloadUrl,
  generatePresignedUploadUrl,
  isDocumentStorageKeyForClient,
  isR2Configured,
  putObject,
} from "@/lib/storage/r2";
import {
  canArchiveDocument,
  canDownloadDocument,
  canEditDocument,
  canUploadDocuments,
  canViewDocument,
} from "@/lib/documents/permissions";
import { ensureDocumentCompanySettings, loadDocumentCompanySettings } from "@/lib/documents/settings";
import { validateDocumentFile } from "@/lib/documents/validation";
import type {
  DocumentAccessPolicyRow,
  DocumentActor,
  DocumentRow,
  DocumentVersionRow,
  DuplicateMatch,
  UploadDocumentResult,
} from "@/lib/documents/types";

export function sha256Checksum(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function joinedDocument<T>(joined: T | T[] | null | undefined): T | null {
  if (joined == null) return null;
  return Array.isArray(joined) ? (joined[0] ?? null) : joined;
}

export async function findDuplicateByChecksum(
  clientId: string,
  checksum: string
): Promise<DuplicateMatch | null> {
  const supabase = createAdminClient();
  const { data: version } = await supabase
    .from("document_versions")
    .select("id, document_id, uploaded_at, documents(id, title, archived_at)")
    .eq("client_id", clientId)
    .eq("checksum_sha256", checksum)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!version) return null;
  const doc = joinedDocument(version.documents as { id: string; title: string; archived_at: string | null } | { id: string; title: string; archived_at: string | null }[] | null);
  if (!doc || doc.archived_at) return null;

  return {
    documentId: doc.id,
    title: doc.title,
    uploadedAt: version.uploaded_at as string,
    versionId: version.id as string,
  };
}

async function loadAccessPolicy(documentId: string): Promise<DocumentAccessPolicyRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("document_access_policies")
    .select("*")
    .eq("document_id", documentId)
    .maybeSingle();
  return (data as DocumentAccessPolicyRow | null) ?? null;
}

async function recordDocumentActivity(opts: {
  clientId: string;
  documentId: string;
  versionId?: string | null;
  actorUserId?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("document_activity").insert({
    client_id: opts.clientId,
    document_id: opts.documentId,
    version_id: opts.versionId ?? null,
    actor_user_id: opts.actorUserId ?? null,
    action: opts.action,
    metadata: opts.metadata ?? {},
  });
}

async function queueProcessingJob(opts: {
  clientId: string;
  documentId: string;
  versionId: string;
}): Promise<string> {
  const settings = await loadDocumentCompanySettings(opts.clientId);
  const supabase = createAdminClient();

  if (!settings.analyze_automatically) {
    await supabase
      .from("documents")
      .update({ processing_status: "READY", updated_at: new Date().toISOString() })
      .eq("id", opts.documentId)
      .eq("client_id", opts.clientId);
    await supabase
      .from("document_versions")
      .update({ processing_status: "READY", extracted_text_status: "SKIPPED" })
      .eq("id", opts.versionId);
    return "";
  }

  const fingerprint = `pipeline:${opts.versionId}:v1`;
  const { data, error } = await supabase
    .from("document_processing_jobs")
    .upsert(
      {
        client_id: opts.clientId,
        document_id: opts.documentId,
        version_id: opts.versionId,
        job_type: "FULL_PIPELINE",
        status: "QUEUED",
        fingerprint,
        scheduled_at: new Date().toISOString(),
      },
      { onConflict: "fingerprint", ignoreDuplicates: false }
    )
    .select("id")
    .single();

  if (error) {
    const { data: existing } = await supabase
      .from("document_processing_jobs")
      .select("id")
      .eq("fingerprint", fingerprint)
      .maybeSingle();
    return (existing?.id as string) ?? "";
  }

  await supabase
    .from("documents")
    .update({ processing_status: "QUEUED", updated_at: new Date().toISOString() })
    .eq("id", opts.documentId)
    .eq("client_id", opts.clientId);

  await supabase
    .from("document_versions")
    .update({ processing_status: "QUEUED" })
    .eq("id", opts.versionId);

  const jobId = data.id as string;

  const { background } = await import("@/lib/background");
  const { runDocumentProcessingWorker } = await import("@/lib/documents/processing");
  background("documents.process", async () => {
    await runDocumentProcessingWorker(1);
  });

  return jobId;
}

function deriveTitle(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "");
  return base.replace(/[-_]+/g, " ").trim() || filename;
}

type CreateDocumentCoreOpts = {
  clientId: string;
  actor: DocumentActor;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  title?: string;
  description?: string | null;
  documentTypeId?: string | null;
  source?: string;
  skipDuplicateCheck?: boolean;
  storageKey?: string;
  buffer?: Buffer;
};

async function createDocumentWithVersion(
  opts: CreateDocumentCoreOpts
): Promise<UploadDocumentResult> {
  if (!canUploadDocuments(opts.actor)) {
    return { ok: false, error: "Forbidden.", status: 403 };
  }

  const settings = await loadDocumentCompanySettings(opts.clientId);
  if (!settings.enabled) {
    return { ok: false, error: "Documents module is not enabled for this company.", status: 403 };
  }

  let duplicate: DuplicateMatch | undefined;
  if (!opts.skipDuplicateCheck) {
    const match = await findDuplicateByChecksum(opts.clientId, opts.checksum);
    if (match) duplicate = match;
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const title = opts.title?.trim() || deriveTitle(opts.filename);

  const { data: document, error: docError } = await supabase
    .from("documents")
    .insert({
      client_id: opts.clientId,
      title,
      original_file_name: opts.filename,
      document_type_id: opts.documentTypeId ?? null,
      description: opts.description ?? null,
      uploaded_by: opts.actor.userId,
      owner_user_id: opts.actor.userId,
      source: opts.source ?? "UPLOAD",
      processing_status: "UPLOADED",
      lifecycle_status: "DRAFT",
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (docError || !document) {
    return { ok: false, error: docError?.message ?? "Failed to create document.", status: 500 };
  }

  const documentId = document.id as string;
  const versionId = crypto.randomUUID();
  const storageKey =
    opts.storageKey ??
    generateDocumentVersionKey(opts.clientId, documentId, versionId, opts.filename);

  if (opts.buffer) {
    if (!isR2Configured()) {
      return { ok: false, error: "Secure document storage is not configured.", status: 503 };
    }
    await putObject(storageKey, opts.buffer, opts.mimeType, {
      contentDisposition: `attachment; filename="${opts.filename.replace(/["\\]/g, "")}"`,
      cacheControl: "private, max-age=0",
    });
  }

  const { data: version, error: versionError } = await supabase
    .from("document_versions")
    .insert({
      id: versionId,
      client_id: opts.clientId,
      document_id: documentId,
      version_number: 1,
      storage_key: storageKey,
      original_file_name: opts.filename,
      mime_type: opts.mimeType,
      size_bytes: opts.sizeBytes,
      checksum_sha256: opts.checksum,
      is_current: true,
      uploaded_by: opts.actor.userId,
      uploaded_at: now,
      processing_status: opts.buffer ? "UPLOADED" : "UPLOADED",
    })
    .select("*")
    .single();

  if (versionError || !version) {
    await supabase.from("documents").delete().eq("id", documentId);
    return { ok: false, error: versionError?.message ?? "Failed to create version.", status: 500 };
  }

  await supabase
    .from("documents")
    .update({ current_version_id: versionId, updated_at: now })
    .eq("id", documentId);

  await supabase.from("document_access_policies").insert({
    client_id: opts.clientId,
    document_id: documentId,
    scope_type: settings.default_scope_type,
    classification: settings.default_classification,
  });

  await recordDocumentActivity({
    clientId: opts.clientId,
    documentId,
    versionId,
    actorUserId: opts.actor.userId,
    action: "UPLOADED",
    metadata: { filename: opts.filename, sizeBytes: opts.sizeBytes },
  });

  const processingJobId = await queueProcessingJob({
    clientId: opts.clientId,
    documentId,
    versionId,
  });

  return {
    ok: true,
    document: { ...document, current_version_id: versionId } as DocumentRow,
    version: version as DocumentVersionRow,
    duplicate,
    processingJobId,
  };
}

export async function uploadDocument(opts: {
  clientId: string;
  actor: DocumentActor;
  file: { buffer: Buffer; filename: string; contentType: string };
  title?: string;
  description?: string | null;
  documentTypeId?: string | null;
  skipDuplicateCheck?: boolean;
  forceUploadDespiteDuplicate?: boolean;
}): Promise<UploadDocumentResult> {
  await ensureDocumentCompanySettings(opts.clientId);

  const validation = validateDocumentFile(
    opts.file.filename,
    opts.file.contentType,
    opts.file.buffer.length
  );
  if (!validation.ok) {
    return { ok: false, error: validation.error, status: 400 };
  }

  const checksum = sha256Checksum(opts.file.buffer);

  if (!opts.forceUploadDespiteDuplicate && !opts.skipDuplicateCheck) {
    const duplicate = await findDuplicateByChecksum(opts.clientId, checksum);
    if (duplicate) {
      return {
        ok: false,
        error: "DUPLICATE_FILE",
        status: 409,
        duplicate,
      };
    }
  }

  return createDocumentWithVersion({
    clientId: opts.clientId,
    actor: opts.actor,
    filename: validation.safeFilename,
    mimeType: validation.mimeType,
    sizeBytes: opts.file.buffer.length,
    checksum,
    title: opts.title,
    description: opts.description,
    documentTypeId: opts.documentTypeId,
    buffer: opts.file.buffer,
    skipDuplicateCheck: opts.skipDuplicateCheck || opts.forceUploadDespiteDuplicate,
  });
}

export async function createPresignedDocumentUpload(opts: {
  clientId: string;
  actor: DocumentActor;
  filename: string;
  contentType: string;
  sizeBytes: number;
  title?: string;
  description?: string | null;
  documentTypeId?: string | null;
}): Promise<
  | {
      ok: true;
      documentId: string;
      versionId: string;
      uploadUrl: string;
      storageKey: string;
    }
  | { ok: false; error: string; status: number }
> {
  await ensureDocumentCompanySettings(opts.clientId);

  if (!canUploadDocuments(opts.actor)) {
    return { ok: false, error: "Forbidden.", status: 403 };
  }

  const settings = await loadDocumentCompanySettings(opts.clientId);
  if (!settings.enabled) {
    return { ok: false, error: "Documents module is not enabled for this company.", status: 403 };
  }

  if (!isR2Configured()) {
    return { ok: false, error: "Secure document storage is not configured.", status: 503 };
  }

  const validation = validateDocumentFile(opts.filename, opts.contentType, opts.sizeBytes);
  if (!validation.ok) {
    return { ok: false, error: validation.error, status: 400 };
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const title = opts.title?.trim() || deriveTitle(validation.safeFilename);
  const documentId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const storageKey = generateDocumentVersionKey(
    opts.clientId,
    documentId,
    versionId,
    validation.safeFilename
  );

  const { error: docError } = await supabase.from("documents").insert({
    id: documentId,
    client_id: opts.clientId,
    title,
    original_file_name: validation.safeFilename,
    document_type_id: opts.documentTypeId ?? null,
    description: opts.description ?? null,
    uploaded_by: opts.actor.userId,
    owner_user_id: opts.actor.userId,
    source: "UPLOAD",
    processing_status: "UPLOADED",
    lifecycle_status: "DRAFT",
    created_at: now,
    updated_at: now,
  });

  if (docError) {
    return { ok: false, error: docError.message, status: 500 };
  }

  const { error: versionError } = await supabase.from("document_versions").insert({
    id: versionId,
    client_id: opts.clientId,
    document_id: documentId,
    version_number: 1,
    storage_key: storageKey,
    original_file_name: validation.safeFilename,
    mime_type: validation.mimeType,
    size_bytes: opts.sizeBytes,
    checksum_sha256: "pending",
    is_current: true,
    uploaded_by: opts.actor.userId,
    uploaded_at: now,
    processing_status: "UPLOADED",
  });

  if (versionError) {
    await supabase.from("documents").delete().eq("id", documentId);
    return { ok: false, error: versionError.message, status: 500 };
  }

  await supabase
    .from("documents")
    .update({ current_version_id: versionId })
    .eq("id", documentId);

  await supabase.from("document_access_policies").insert({
    client_id: opts.clientId,
    document_id: documentId,
    scope_type: settings.default_scope_type,
    classification: settings.default_classification,
  });

  const uploadUrl = await generatePresignedUploadUrl(storageKey, validation.mimeType);

  return {
    ok: true,
    documentId,
    versionId,
    uploadUrl,
    storageKey,
  };
}

export async function completePresignedDocumentUpload(opts: {
  clientId: string;
  actor: DocumentActor;
  documentId: string;
  versionId: string;
  checksum: string;
  skipDuplicateCheck?: boolean;
  forceUploadDespiteDuplicate?: boolean;
}): Promise<UploadDocumentResult> {
  const supabase = createAdminClient();

  const { data: version } = await supabase
    .from("document_versions")
    .select("*, documents(*)")
    .eq("id", opts.versionId)
    .eq("document_id", opts.documentId)
    .eq("client_id", opts.clientId)
    .maybeSingle();

  if (!version) {
    return { ok: false, error: "Document version not found.", status: 404 };
  }

  if (!isDocumentStorageKeyForClient(opts.clientId, version.storage_key as string)) {
    return { ok: false, error: "Invalid storage key.", status: 400 };
  }

  if (!opts.skipDuplicateCheck && !opts.forceUploadDespiteDuplicate) {
    const duplicate = await findDuplicateByChecksum(opts.clientId, opts.checksum);
    if (duplicate && duplicate.documentId !== opts.documentId) {
      return {
        ok: false,
        error: "DUPLICATE_FILE",
        status: 409,
        duplicate,
      };
    }
  }

  await supabase
    .from("document_versions")
    .update({ checksum_sha256: opts.checksum })
    .eq("id", opts.versionId);

  await recordDocumentActivity({
    clientId: opts.clientId,
    documentId: opts.documentId,
    versionId: opts.versionId,
    actorUserId: opts.actor.userId,
    action: "UPLOADED",
  });

  const processingJobId = await queueProcessingJob({
    clientId: opts.clientId,
    documentId: opts.documentId,
    versionId: opts.versionId,
  });

  const document = joinedDocument(version.documents as DocumentRow | DocumentRow[] | null);
  if (!document) {
    return { ok: false, error: "Document not found.", status: 404 };
  }

  return {
    ok: true,
    document,
    version: { ...version, checksum_sha256: opts.checksum } as DocumentVersionRow,
    processingJobId,
  };
}

export async function getDocumentForActor(opts: {
  clientId: string;
  documentId: string;
  actor: DocumentActor;
  recordView?: boolean;
}): Promise<
  | {
      ok: true;
      document: DocumentRow;
      version: DocumentVersionRow | null;
      policy: DocumentAccessPolicyRow | null;
    }
  | { ok: false; error: string; status: number }
> {
  const supabase = createAdminClient();
  const { data: document } = await supabase
    .from("documents")
    .select("*")
    .eq("id", opts.documentId)
    .eq("client_id", opts.clientId)
    .maybeSingle();

  if (!document) {
    return { ok: false, error: "Document not found.", status: 404 };
  }

  const policy = await loadAccessPolicy(opts.documentId);
  if (!canViewDocument(opts.actor, document as DocumentRow, policy)) {
    return { ok: false, error: "Forbidden.", status: 403 };
  }

  let version: DocumentVersionRow | null = null;
  if (document.current_version_id) {
    const { data } = await supabase
      .from("document_versions")
      .select("*")
      .eq("id", document.current_version_id)
      .maybeSingle();
    version = (data as DocumentVersionRow | null) ?? null;
  }

  if (opts.recordView !== false) {
    await recordDocumentActivity({
      clientId: opts.clientId,
      documentId: opts.documentId,
      versionId: document.current_version_id,
      actorUserId: opts.actor.userId,
      action: "VIEWED",
    });
  }

  return {
    ok: true,
    document: document as DocumentRow,
    version,
    policy,
  };
}

export async function listDocuments(opts: {
  clientId: string;
  actor: DocumentActor;
  limit?: number;
  offset?: number;
  includeArchived?: boolean;
}): Promise<{ documents: DocumentRow[]; total: number }> {
  const supabase = createAdminClient();
  const limit = Math.min(opts.limit ?? 50, 100);
  const offset = opts.offset ?? 0;

  let query = supabase
    .from("documents")
    .select("*", { count: "exact" })
    .eq("client_id", opts.clientId)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (!opts.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  const documents: DocumentRow[] = [];
  for (const row of data ?? []) {
    const policy = await loadAccessPolicy(row.id as string);
    if (canViewDocument(opts.actor, row as DocumentRow, policy)) {
      documents.push(row as DocumentRow);
    }
  }

  return { documents, total: count ?? documents.length };
}

export async function signDocumentDownload(opts: {
  clientId: string;
  documentId: string;
  actor: DocumentActor;
  versionId?: string;
}): Promise<{ ok: true; url: string } | { ok: false; error: string; status: number }> {
  const result = await getDocumentForActor({
    clientId: opts.clientId,
    documentId: opts.documentId,
    actor: opts.actor,
    recordView: false,
  });

  if (!result.ok) return result;

  const policy = result.policy;
  if (!canDownloadDocument(opts.actor, result.document, policy)) {
    return { ok: false, error: "Forbidden.", status: 403 };
  }

  const version =
    opts.versionId && opts.versionId !== result.version?.id
      ? await loadVersion(opts.clientId, opts.documentId, opts.versionId)
      : result.version;

  if (!version) {
    return { ok: false, error: "Version not found.", status: 404 };
  }

  if (!isDocumentStorageKeyForClient(opts.clientId, version.storage_key)) {
    return { ok: false, error: "Invalid storage key.", status: 400 };
  }

  if (!isR2Configured()) {
    return { ok: false, error: "Secure document storage is not configured.", status: 503 };
  }

  const url = await generatePresignedDownloadUrl(
    version.storage_key,
    version.original_file_name,
    version.mime_type
  );

  await recordDocumentActivity({
    clientId: opts.clientId,
    documentId: opts.documentId,
    versionId: version.id,
    actorUserId: opts.actor.userId,
    action: "DOWNLOADED",
  });

  return { ok: true, url };
}

async function loadVersion(
  clientId: string,
  documentId: string,
  versionId: string
): Promise<DocumentVersionRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("document_versions")
    .select("*")
    .eq("id", versionId)
    .eq("document_id", documentId)
    .eq("client_id", clientId)
    .maybeSingle();
  return (data as DocumentVersionRow | null) ?? null;
}

export async function archiveDocument(opts: {
  clientId: string;
  documentId: string;
  actor: DocumentActor;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (!canArchiveDocument(opts.actor)) {
    return { ok: false, error: "Forbidden.", status: 403 };
  }

  const supabase = createAdminClient();
  const { data: document } = await supabase
    .from("documents")
    .select("*")
    .eq("id", opts.documentId)
    .eq("client_id", opts.clientId)
    .maybeSingle();

  if (!document) {
    return { ok: false, error: "Document not found.", status: 404 };
  }

  const policy = await loadAccessPolicy(opts.documentId);
  if (!canViewDocument(opts.actor, document as DocumentRow, policy)) {
    return { ok: false, error: "Forbidden.", status: 403 };
  }

  const now = new Date().toISOString();
  await supabase
    .from("documents")
    .update({
      archived_at: now,
      lifecycle_status: "ARCHIVED",
      updated_at: now,
    })
    .eq("id", opts.documentId);

  await recordDocumentActivity({
    clientId: opts.clientId,
    documentId: opts.documentId,
    actorUserId: opts.actor.userId,
    action: "ARCHIVED",
  });

  return { ok: true };
}

export async function updateDocumentMetadata(opts: {
  clientId: string;
  documentId: string;
  actor: DocumentActor;
  patch: {
    title?: string;
    description?: string | null;
    documentTypeId?: string | null;
    categoryId?: string | null;
    lifecycleStatus?: string;
  };
}): Promise<{ ok: true; document: DocumentRow } | { ok: false; error: string; status: number }> {
  if (!canEditDocument(opts.actor)) {
    return { ok: false, error: "Forbidden.", status: 403 };
  }

  const existing = await getDocumentForActor({
    clientId: opts.clientId,
    documentId: opts.documentId,
    actor: opts.actor,
  });
  if (!existing.ok) return existing;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (opts.patch.title !== undefined) updates.title = opts.patch.title;
  if (opts.patch.description !== undefined) updates.description = opts.patch.description;
  if (opts.patch.documentTypeId !== undefined) updates.document_type_id = opts.patch.documentTypeId;
  if (opts.patch.categoryId !== undefined) updates.category_id = opts.patch.categoryId;
  if (opts.patch.lifecycleStatus !== undefined) updates.lifecycle_status = opts.patch.lifecycleStatus;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("documents")
    .update(updates)
    .eq("id", opts.documentId)
    .eq("client_id", opts.clientId)
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Update failed.", status: 500 };
  }

  await recordDocumentActivity({
    clientId: opts.clientId,
    documentId: opts.documentId,
    actorUserId: opts.actor.userId,
    action: "METADATA_EDITED",
    metadata: opts.patch,
  });

  return { ok: true, document: data as DocumentRow };
}

export async function listDocumentTypes(clientId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("document_types")
    .select("*")
    .or(`client_id.is.null,client_id.eq.${clientId}`)
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  return data ?? [];
}

export async function requestDocumentReprocess(opts: {
  clientId: string;
  documentId: string;
  actor: DocumentActor;
}): Promise<{ ok: true; jobId: string } | { ok: false; error: string; status: number }> {
  const existing = await getDocumentForActor({
    clientId: opts.clientId,
    documentId: opts.documentId,
    actor: opts.actor,
    recordView: false,
  });
  if (!existing.ok) return existing;

  if (!canEditDocument(opts.actor)) {
    return { ok: false, error: "Forbidden.", status: 403 };
  }

  const versionId = existing.version?.id;
  if (!versionId) {
    return { ok: false, error: "No document version to process.", status: 400 };
  }

  const { enqueueDocumentReprocess } = await import("@/lib/documents/processing");
  const { background } = await import("@/lib/background");
  const { runDocumentProcessingWorker } = await import("@/lib/documents/processing");

  const jobId = await enqueueDocumentReprocess({
    clientId: opts.clientId,
    documentId: opts.documentId,
    versionId,
    jobType: "REPROCESS",
  });

  if (!jobId) {
    return { ok: false, error: "Could not queue reprocessing.", status: 500 };
  }

  const supabase = createAdminClient();
  await supabase
    .from("documents")
    .update({ processing_status: "QUEUED", updated_at: new Date().toISOString() })
    .eq("id", opts.documentId);
  await supabase
    .from("document_versions")
    .update({ processing_status: "QUEUED" })
    .eq("id", versionId);

  background("documents.reprocess", async () => {
    await runDocumentProcessingWorker(1);
  });

  return { ok: true, jobId };
}

export async function getDocumentVersionContent(
  clientId: string,
  documentId: string,
  versionId: string,
  actor: DocumentActor
) {
  const existing = await getDocumentForActor({
    clientId,
    documentId,
    actor,
    recordView: false,
  });
  if (!existing.ok) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("document_version_content")
    .select("*")
    .eq("version_id", versionId)
    .eq("document_id", documentId)
    .eq("client_id", clientId)
    .maybeSingle();

  return data;
}

export function toDocumentActor(session: {
  userId: string;
  role: string;
  clientId: string | null;
}): DocumentActor {
  return {
    userId: session.userId,
    role: session.role,
    clientId: session.clientId,
  };
}
