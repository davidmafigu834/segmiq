import { createHash, randomBytes, randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractDocument } from "@/lib/real-estate/due-diligence/extract";
import { evaluateDueDiligence } from "@/lib/real-estate/due-diligence/evaluate";
import { verifySellerIdentity, type VerificationImage } from "@/lib/identity-verification";
import { summarise } from "@/lib/real-estate/due-diligence/report";
import { ACCEPTED_DOCUMENT_TYPES, MAX_DOCUMENT_BYTES, type MandateDraft, type ReviewCommand } from "@/lib/real-estate/due-diligence/schema";
import {
  isPrivateDocumentStorageConfigured,
  putPrivateDocument,
  readPrivateDocument,
  signPrivateDocument,
} from "@/lib/real-estate/private-document-storage";
import {
  DOCUMENT_TYPES,
  type DocumentExtraction,
  type DocumentInput,
  type DocumentType,
  type DueDiligenceCheck,
  type Evaluation,
  type EvaluationInput,
  type IdentityOutcome,
} from "@/lib/real-estate/due-diligence/types";

export type DueDiligenceActor = {
  id: string;
  role: string;
  name: string;
};

type Failure = { ok: false; error: string; status: number };
type MandateRow = {
  id: string;
  client_id: string;
  agent_id: string;
  reference: string;
  status: string;
  report_status: string | null;
  risk_score: number | null;
  identity_result: IdentityOutcome | null;
  created_at: string;
  updated_at: string;
};

const DOCUMENT_TYPE_SET = new Set<string>(DOCUMENT_TYPES);

function fail(status: number, error: string): Failure {
  return { ok: false, status, error };
}

function dbFailure(error: { code?: string; message?: string } | null, fallback: string): Failure {
  const missing = error?.code === "42P01" || (error?.message ?? "").includes("does not exist");
  if (missing) return fail(503, "The due diligence tables are not on this database yet. Apply the migration first.");
  return fail(500, fallback);
}

function seesAll(role: string): boolean {
  return role === "CLIENT_MANAGER" || role === "SUPER_ADMIN";
}

function canSee(actor: DueDiligenceActor, mandate: { agent_id: string }): boolean {
  return seesAll(actor.role) || mandate.agent_id === actor.id;
}

function safeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 80);
  return cleaned.replace(/^\.+/, "") || "document";
}

function asExtraction(value: unknown): DocumentExtraction | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<DocumentExtraction>;
  if (!record.fields || !record.documentType || !record.quality) return null;
  return record as DocumentExtraction;
}

function asIdentity(value: unknown): IdentityOutcome | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<IdentityOutcome>;
  if (!record.status || !record.provider) return null;
  return record as IdentityOutcome;
}

function sellerFrom(row: Record<string, unknown> | null): EvaluationInput["seller"] | null {
  if (!row) return null;
  return {
    fullName: String(row.full_name ?? ""),
    idNumber: String(row.id_number ?? ""),
    phone: String(row.phone ?? ""),
    email: String(row.email ?? ""),
    maritalStatus: row.marital_status as EvaluationInput["seller"]["maritalStatus"],
    sellerKind: row.seller_kind as EvaluationInput["seller"]["sellerKind"],
    companyName: String(row.company_name ?? ""),
    actingCapacity: row.acting_capacity as EvaluationInput["seller"]["actingCapacity"],
    representativeName: String(row.representative_name ?? ""),
  };
}

function propertyFrom(row: Record<string, unknown> | null): EvaluationInput["property"] | null {
  if (!row) return null;
  const price = row.asking_price_usd;
  return {
    address: String(row.address ?? ""),
    standNumber: String(row.stand_number ?? ""),
    suburb: String(row.suburb ?? ""),
    city: String(row.city ?? ""),
    propertyType: row.property_type as EvaluationInput["property"]["propertyType"],
    tenureType: row.tenure_type as EvaluationInput["property"]["tenureType"],
    askingPriceUsd: price == null || price === "" ? null : Number(price),
    localAuthority: String(row.local_authority ?? ""),
  };
}

function checkFrom(row: Record<string, unknown>): DueDiligenceCheck & { source: string; note: string | null } {
  return {
    code: String(row.code),
    label: String(row.label),
    status: row.status as DueDiligenceCheck["status"],
    critical: Boolean(row.critical),
    weight: Number(row.weight ?? 0),
    detail: String(row.detail ?? ""),
    evidence: (row.evidence && typeof row.evidence === "object" ? row.evidence : {}) as Record<string, unknown>,
    source: String(row.source ?? "rules"),
    note: row.note == null ? null : String(row.note),
  };
}

async function audit(
  clientId: string,
  mandateId: string,
  actor: string | DueDiligenceActor,
  eventType: string,
  payload: Record<string, unknown>
) {
  const supabase = createAdminClient();
  const actorId = typeof actor === "string" ? actor : actor.id;
  const actorName = typeof actor === "string" ? null : actor.name;
  await supabase.from("re_dd_audit").insert({
    client_id: clientId,
    mandate_id: mandateId,
    actor_id: actorId,
    event_type: eventType,
    payload: actorName ? { ...payload, actorName } : payload,
  });
}

async function loadMandate(clientId: string, mandateId: string, actor: DueDiligenceActor) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("re_dd_mandates")
    .select("*")
    .eq("client_id", clientId)
    .eq("id", mandateId)
    .maybeSingle();
  if (error) return dbFailure(error, "Could not load the mandate.");
  if (!data || !canSee(actor, data as MandateRow)) return fail(404, "Mandate not found.");
  return { ok: true as const, mandate: data as MandateRow };
}

async function loadBundle(clientId: string, mandateId: string, actor: DueDiligenceActor) {
  const loaded = await loadMandate(clientId, mandateId, actor);
  if (!loaded.ok) return loaded;
  const supabase = createAdminClient();
  const [seller, property, documents, checks, reports, events, reviews] = await Promise.all([
    supabase.from("re_dd_sellers").select("*").eq("mandate_id", mandateId).eq("client_id", clientId).maybeSingle(),
    supabase.from("re_dd_properties").select("*").eq("mandate_id", mandateId).eq("client_id", clientId).maybeSingle(),
    supabase.from("re_dd_documents").select("id, document_type, file_name, content_type, byte_size, status, extracted_data, extraction_error, storage_key, created_at").eq("mandate_id", mandateId).order("created_at"),
    supabase.from("re_dd_checks").select("*").eq("mandate_id", mandateId).order("code"),
    supabase.from("re_dd_reports").select("*").eq("mandate_id", mandateId).order("version", { ascending: false }).limit(1),
    supabase.from("re_dd_audit").select("id, event_type, actor_id, payload, created_at").eq("mandate_id", mandateId).order("created_at", { ascending: false }).limit(40),
    supabase.from("re_dd_reviews").select("id, action, check_code, note, actor_id, created_at").eq("mandate_id", mandateId).order("created_at", { ascending: false }).limit(20),
  ]);
  const failed = [seller.error, property.error, documents.error, checks.error, reports.error, events.error, reviews.error].find(Boolean);
  if (failed) return dbFailure(failed, "Could not load the mandate file.");
  return {
    ok: true as const,
    mandate: loaded.mandate,
    seller: (seller.data ?? null) as Record<string, unknown> | null,
    property: (property.data ?? null) as Record<string, unknown> | null,
    documents: (documents.data ?? []) as Array<Record<string, unknown>>,
    checks: ((checks.data ?? []) as Array<Record<string, unknown>>).map(checkFrom),
    report: ((reports.data ?? [])[0] ?? null) as Record<string, unknown> | null,
    audit: events.data ?? [],
    reviews: reviews.data ?? [],
  };
}

function publicDocument(row: Record<string, unknown>) {
  return {
    id: row.id,
    documentType: row.document_type,
    fileName: row.file_name,
    contentType: row.content_type,
    byteSize: row.byte_size,
    status: row.status,
    extractionError: row.extraction_error,
    extracted: asExtraction(row.extracted_data),
  };
}

function present(bundle: Exclude<Awaited<ReturnType<typeof loadBundle>>, Failure>) {
  return {
    mandate: bundle.mandate,
    seller: sellerFrom(bundle.seller),
    property: propertyFrom(bundle.property),
    documents: bundle.documents.map(publicDocument),
    checks: bundle.checks,
    report: bundle.report,
    audit: bundle.audit,
    reviews: bundle.reviews,
  };
}

function evaluationInput(bundle: Exclude<Awaited<ReturnType<typeof loadBundle>>, Failure>, identity: IdentityOutcome | null): EvaluationInput | null {
  const seller = sellerFrom(bundle.seller);
  const property = propertyFrom(bundle.property);
  if (!seller || !property) return null;
  const documents: DocumentInput[] = bundle.documents.flatMap((row) => {
    const declared = String(row.document_type);
    if (!DOCUMENT_TYPE_SET.has(declared)) return [];
    return [{
      id: String(row.id),
      declaredType: declared as DocumentType,
      fileName: String(row.file_name),
      extracted: asExtraction(row.extracted_data),
    }];
  });
  return { seller, property, documents, identity };
}

export async function createMandate(args: { clientId: string; actor: DueDiligenceActor; draft: MandateDraft }) {
  const supabase = createAdminClient();
  const id = randomUUID();
  const reference = `DD-${randomBytes(4).toString("hex").toUpperCase()}`;
  const now = new Date().toISOString();
  const mandate = await supabase.from("re_dd_mandates").insert({
    id,
    client_id: args.clientId,
    agent_id: args.actor.id,
    reference,
    status: "draft",
    created_at: now,
    updated_at: now,
  }).select("id, reference").single();
  if (mandate.error || !mandate.data) return dbFailure(mandate.error, "Could not open the mandate.");

  const seller = args.draft.seller;
  const property = args.draft.property;
  const sellerInsert = await supabase.from("re_dd_sellers").insert({
    client_id: args.clientId,
    mandate_id: id,
    full_name: seller.fullName,
    id_number: seller.idNumber,
    phone: seller.phone,
    email: seller.email,
    marital_status: seller.maritalStatus,
    seller_kind: seller.sellerKind,
    company_name: seller.companyName,
    acting_capacity: seller.actingCapacity,
    representative_name: seller.representativeName,
  });
  const propertyInsert = sellerInsert.error ? { error: sellerInsert.error } : await supabase.from("re_dd_properties").insert({
    client_id: args.clientId,
    mandate_id: id,
    address: property.address,
    stand_number: property.standNumber,
    suburb: property.suburb,
    city: property.city,
    property_type: property.propertyType,
    tenure_type: property.tenureType,
    asking_price_usd: property.askingPriceUsd,
    local_authority: property.localAuthority,
  });
  if (sellerInsert.error || propertyInsert.error) {
    await supabase.from("re_dd_mandates").delete().eq("id", id).eq("client_id", args.clientId);
    return dbFailure(sellerInsert.error ?? propertyInsert.error, "Could not save the seller and property.");
  }
  await audit(args.clientId, id, args.actor, "mandate_created", { reference });
  return { ok: true as const, mandate: mandate.data };
}

export async function listMandates(args: { clientId: string; actor: DueDiligenceActor }) {
  const supabase = createAdminClient();
  let query = supabase
    .from("re_dd_mandates")
    .select("id, reference, status, report_status, risk_score, agent_id, created_at, updated_at, re_dd_sellers(full_name), re_dd_properties(address, stand_number, suburb, city, tenure_type)")
    .eq("client_id", args.clientId)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (!seesAll(args.actor.role)) query = query.eq("agent_id", args.actor.id);
  const { data, error } = await query;
  if (error) return dbFailure(error, "Could not load mandates.");
  return { ok: true as const, mandates: data ?? [] };
}

export async function getMandate(args: { clientId: string; mandateId: string; actor: DueDiligenceActor }) {
  const bundle = await loadBundle(args.clientId, args.mandateId, args.actor);
  if (!bundle.ok) return bundle;
  return { ok: true as const, ...present(bundle) };
}

export async function addDocument(args: {
  clientId: string;
  mandateId: string;
  actor: DueDiligenceActor;
  documentType: DocumentType;
  fileName: string;
  contentType: string;
  bytes: Buffer;
}) {
  if (!ACCEPTED_DOCUMENT_TYPES.includes(args.contentType as (typeof ACCEPTED_DOCUMENT_TYPES)[number])) {
    return fail(400, "Upload a PDF, JPEG, PNG, or WebP file.");
  }
  if (args.bytes.length === 0 || args.bytes.length > MAX_DOCUMENT_BYTES) {
    return fail(400, "Each document must be under 8 MB.");
  }
  if (!isPrivateDocumentStorageConfigured()) {
    return fail(503, "Private document storage is not configured, so the file was not saved.");
  }
  const loaded = await loadMandate(args.clientId, args.mandateId, args.actor);
  if (!loaded.ok) return loaded;
  if (loaded.mandate.status === "processing" || loaded.mandate.status === "cleared") {
    return fail(409, "This mandate is not accepting documents right now.");
  }
  const supabase = createAdminClient();
  const id = randomUUID();
  const key = `clients/${args.clientId}/due-diligence/${args.mandateId}/${id}-${safeFileName(args.fileName)}`;
  const sha256 = createHash("sha256").update(args.bytes).digest("hex");
  try {
    await putPrivateDocument(key, args.bytes, args.contentType);
  } catch {
    return fail(503, "The document could not be stored.");
  }
  const inserted = await supabase.from("re_dd_documents").insert({
    id,
    client_id: args.clientId,
    mandate_id: args.mandateId,
    document_type: args.documentType,
    file_name: args.fileName.slice(0, 180) || "document",
    content_type: args.contentType,
    byte_size: args.bytes.length,
    storage_key: key,
    sha256,
    status: "uploaded",
  }).select("id, document_type, file_name, status").single();
  if (inserted.error) {
    return dbFailure(inserted.error, "The file was stored but the record could not be saved.");
  }
  await supabase.from("re_dd_mandates").update({ updated_at: new Date().toISOString(), status: loaded.mandate.status === "rejected" ? "draft" : loaded.mandate.status }).eq("id", args.mandateId);
  await audit(args.clientId, args.mandateId, args.actor, "document_uploaded", {
    documentId: id,
    documentType: args.documentType,
    fileName: args.fileName,
    sha256,
  });
  return { ok: true as const, document: inserted.data };
}

export async function signDocument(args: { clientId: string; mandateId: string; documentId: string; actor: DueDiligenceActor }) {
  const loaded = await loadMandate(args.clientId, args.mandateId, args.actor);
  if (!loaded.ok) return loaded;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("re_dd_documents")
    .select("storage_key, file_name, content_type")
    .eq("id", args.documentId)
    .eq("mandate_id", args.mandateId)
    .eq("client_id", args.clientId)
    .maybeSingle();
  if (error) return dbFailure(error, "Could not load the document.");
  if (!data) return fail(404, "Document not found.");
  try {
    const url = await signPrivateDocument(String(data.storage_key), String(data.file_name), String(data.content_type));
    return { ok: true as const, url };
  } catch {
    return fail(503, "The document cannot be downloaded from this deployment.");
  }
}

async function writeReport(clientId: string, mandateId: string, evaluation: Evaluation) {
  const supabase = createAdminClient();
  const existing = await supabase.from("re_dd_reports").select("version").eq("mandate_id", mandateId).order("version", { ascending: false }).limit(1);
  const version = Number(existing.data?.[0]?.version ?? 0) + 1;
  const now = new Date().toISOString();
  const report = await supabase.from("re_dd_reports").insert({
    client_id: clientId,
    mandate_id: mandateId,
    version,
    status: evaluation.status,
    risk_score: evaluation.score,
    summary: evaluation.summary,
    reasons: evaluation.redFlags,
    recommendations: evaluation.recommendations,
    comparison: evaluation.comparison,
    missing_documents: evaluation.missingDocuments,
  }).select("*").single();
  if (report.error) return dbFailure(report.error, "Could not save the report.");
  const mandate = await supabase.from("re_dd_mandates").update({
    status: "report_ready",
    report_status: evaluation.status,
    risk_score: evaluation.score,
    updated_at: now,
  }).eq("id", mandateId).eq("client_id", clientId);
  if (mandate.error) return dbFailure(mandate.error, "The report was saved but the mandate status was not updated.");
  return { ok: true as const, report: report.data };
}

async function replaceEngineChecks(clientId: string, mandateId: string, checks: DueDiligenceCheck[]) {
  const supabase = createAdminClient();
  const existing = await supabase.from("re_dd_checks").select("code, source").eq("mandate_id", mandateId);
  if (existing.error) return dbFailure(existing.error, "Could not load the previous checks.");
  const human = new Set((existing.data ?? []).filter((row) => row.source === "human").map((row) => String(row.code)));
  const removable = (existing.data ?? []).filter((row) => row.source !== "human").map((row) => String(row.code));
  if (removable.length > 0) {
    const removed = await supabase.from("re_dd_checks").delete().eq("mandate_id", mandateId).in("code", removable);
    if (removed.error) return dbFailure(removed.error, "Could not refresh the checklist.");
  }
  const rows = checks.filter((item) => !human.has(item.code)).map((item) => ({
    client_id: clientId,
    mandate_id: mandateId,
    code: item.code,
    label: item.label,
    status: item.status,
    critical: item.critical,
    weight: item.weight,
    detail: item.detail,
    evidence: item.evidence,
    source: "rules",
    updated_at: new Date().toISOString(),
  }));
  if (rows.length > 0) {
    const inserted = await supabase.from("re_dd_checks").insert(rows);
    if (inserted.error) return dbFailure(inserted.error, "Could not save the checklist.");
  }
  for (const item of checks.filter((check) => human.has(check.code))) {
    const current = await supabase.from("re_dd_checks").select("evidence").eq("mandate_id", mandateId).eq("code", item.code).maybeSingle();
    const evidence = (current.data?.evidence && typeof current.data.evidence === "object" ? current.data.evidence : {}) as Record<string, unknown>;
    await supabase.from("re_dd_checks").update({
      evidence: { ...evidence, latestEngineStatus: item.status, latestEngineDetail: item.detail },
      updated_at: new Date().toISOString(),
    }).eq("mandate_id", mandateId).eq("code", item.code);
  }
  return { ok: true as const };
}

/**
 * Reads each stored document, looks up the ID number, then scores the file.
 * A human override is kept. The report is a new version, so earlier runs stay in the audit table.
 */
export async function runDueDiligence(args: { clientId: string; mandateId: string; actor: DueDiligenceActor }) {
  const bundle = await loadBundle(args.clientId, args.mandateId, args.actor);
  if (!bundle.ok) return bundle;
  if (bundle.mandate.status === "cleared") return fail(409, "This mandate is already cleared. Reject it before running the check again.");
  const supabase = createAdminClient();
  await supabase.from("re_dd_mandates").update({ status: "processing", updated_at: new Date().toISOString() }).eq("id", args.mandateId);

  try {
    const nationalIds: VerificationImage[] = [];
    const selfies: VerificationImage[] = [];
    const livenessFrames: VerificationImage[] = [];
    for (const row of bundle.documents) {
      const key = String(row.storage_key ?? "");
      let bytes: Buffer | null = null;
      try {
        bytes = key ? await readPrivateDocument(key) : null;
      } catch {
        bytes = null;
      }
      if (!bytes) {
        await supabase.from("re_dd_documents").update({
          status: "failed",
          extraction_error: "The stored file could not be read.",
        }).eq("id", String(row.id));
        row.extracted_data = null;
        row.status = "failed";
        row.extraction_error = "The stored file could not be read.";
        continue;
      }
      const declared = String(row.document_type);
      const contentType = String(row.content_type ?? "");
      const image = { bytes, contentType, fileName: String(row.file_name ?? "document") };
      if (declared === "national_id" && (contentType === "image/jpeg" || contentType === "image/png")) nationalIds.push(image);
      if (declared === "selfie" && (contentType === "image/jpeg" || contentType === "image/png")) {
        if (/^liveness[-_]/i.test(image.fileName)) livenessFrames.push(image);
        else selfies.push(image);
      }
      if (!DOCUMENT_TYPE_SET.has(declared) || declared === "selfie") {
        await supabase.from("re_dd_documents").update({ status: "extracted", extraction_error: null, extracted_data: null }).eq("id", String(row.id));
        row.status = "extracted";
        continue;
      }
      const extracted = await extractDocument({
        declaredType: declared as DocumentType,
        fileName: String(row.file_name),
        contentType: String(row.content_type),
        bytes,
      });
      if (!extracted.ok) {
        await supabase.from("re_dd_documents").update({ status: "failed", extraction_error: extracted.error }).eq("id", String(row.id));
        row.extracted_data = null;
        row.extraction_error = extracted.error;
        row.status = "failed";
        await audit(args.clientId, args.mandateId, args.actor, "extraction_failed", { documentId: row.id, error: extracted.error });
        continue;
      }
      await supabase.from("re_dd_documents").update({
        status: "extracted",
        extracted_data: extracted.extraction,
        extraction_error: null,
      }).eq("id", String(row.id));
      row.extracted_data = extracted.extraction;
      row.status = "extracted";
      row.extraction_error = null;
      await audit(args.clientId, args.mandateId, args.actor, "extraction_completed", {
        documentId: row.id,
        documentType: extracted.extraction.documentType,
        quality: extracted.extraction.quality,
        model: extracted.model,
      });
    }

    const seller = sellerFrom(bundle.seller);
    const previous = asIdentity(bundle.mandate.identity_result);
    const identity = seller
      ? await verifySellerIdentity({
        idNumber: seller.idNumber,
        fullName: seller.fullName,
        email: seller.email,
        phone: seller.phone,
        jobId: args.mandateId,
        userId: args.actor.id,
        nationalId: nationalIds[0] ?? null,
        selfie: selfies[0] ?? null,
        livenessFrames,
        pendingJobId: previous?.pending ? previous.reference : null,
      })
      : null;
    if (identity) {
      await supabase.from("re_dd_mandates").update({ identity_result: identity }).eq("id", args.mandateId);
      await audit(args.clientId, args.mandateId, args.actor, "identity_checked", {
        provider: identity.provider,
        status: identity.status,
        decision: identity.decision ?? null,
        confidence: identity.confidence ?? null,
        reference: identity.reference,
      });
    }

    const input = evaluationInput(bundle, identity);
    if (!input) {
      await supabase.from("re_dd_mandates").update({ status: "draft", updated_at: new Date().toISOString() }).eq("id", args.mandateId);
      return fail(409, "The seller or property record is missing.");
    }
    const engine = evaluateDueDiligence(input);
    const saved = await replaceEngineChecks(args.clientId, args.mandateId, engine.checks);
    if (!saved.ok) {
      await supabase.from("re_dd_mandates").update({ status: "draft", updated_at: new Date().toISOString() }).eq("id", args.mandateId);
      return saved;
    }
    const fresh = await loadBundle(args.clientId, args.mandateId, args.actor);
    if (!fresh.ok) {
      await supabase.from("re_dd_mandates").update({ status: "draft", updated_at: new Date().toISOString() }).eq("id", args.mandateId);
      return fresh;
    }
    const summary = summarise(input, fresh.checks);
    const report = await writeReport(args.clientId, args.mandateId, { checks: fresh.checks, ...summary });
    if (!report.ok) {
      await supabase.from("re_dd_mandates").update({ status: "draft", updated_at: new Date().toISOString() }).eq("id", args.mandateId);
      return report;
    }
    await audit(args.clientId, args.mandateId, args.actor, "checks_run", {
      status: summary.status,
      score: summary.score,
      version: report.report.version,
    });
    return {
      ok: true as const,
      report: report.report,
      status: summary.status,
      score: summary.score,
      summary: summary.summary,
      checklist: summary.checklist,
      redFlags: summary.redFlags,
      recommendations: summary.recommendations,
      missingDocuments: summary.missingDocuments,
    };
  } catch (error) {
    await supabase.from("re_dd_mandates").update({ status: "draft", updated_at: new Date().toISOString() }).eq("id", args.mandateId);
    const message = error instanceof Error ? error.message : "The check failed.";
    await audit(args.clientId, args.mandateId, args.actor, "checks_failed", { message });
    return fail(500, "The due diligence check failed before a report could be saved.");
  }
}

async function rescore(clientId: string, mandateId: string, actor: DueDiligenceActor) {
  const bundle = await loadBundle(clientId, mandateId, actor);
  if (!bundle.ok) return bundle;
  const input = evaluationInput(bundle, asIdentity(bundle.mandate.identity_result));
  if (!input) return fail(409, "The seller or property record is missing.");
  const summary = summarise(input, bundle.checks);
  return writeReport(clientId, mandateId, { checks: bundle.checks, ...summary });
}

export async function reviewMandate(args: {
  clientId: string;
  mandateId: string;
  actor: DueDiligenceActor;
  command: ReviewCommand;
}) {
  const bundle = await loadBundle(args.clientId, args.mandateId, args.actor);
  if (!bundle.ok) return bundle;
  if (bundle.mandate.status === "processing") return fail(409, "Wait for the current check to finish.");
  if (bundle.mandate.status === "cleared" && args.command.action !== "note") {
    return fail(409, "This mandate is cleared. Reject it before changing the checks.");
  }
  const supabase = createAdminClient();
  const command = args.command;

  if (command.action === "note") {
    const review = await supabase.from("re_dd_reviews").insert({
      client_id: args.clientId,
      mandate_id: args.mandateId,
      actor_id: args.actor.id,
      action: "note",
      note: command.note,
    });
    if (review.error) return dbFailure(review.error, "Could not save the note.");
    await audit(args.clientId, args.mandateId, args.actor, "note_added", { note: command.note });
    return { ok: true as const };
  }

  if (command.action === "override" || command.action === "revert_override") {
    const current = bundle.checks.find((item) => item.code === command.checkCode);
    if (!current) return fail(404, "That check is not on this mandate.");
    if (command.action === "revert_override") {
      if (current.source !== "human") return fail(409, "That check has no override to revert.");
      const previousStatus = current.evidence.previousStatus;
      const previousDetail = current.evidence.previousDetail;
      if (typeof previousStatus !== "string" || typeof previousDetail !== "string") {
        return fail(409, "This override has no earlier result to restore. Run the check again.");
      }
      const restored = await supabase.from("re_dd_checks").update({
        status: previousStatus,
        detail: previousDetail,
        source: "rules",
        note: null,
        updated_at: new Date().toISOString(),
      }).eq("mandate_id", args.mandateId).eq("code", command.checkCode);
      if (restored.error) return dbFailure(restored.error, "Could not revert the override.");
    } else {
      const updated = await supabase.from("re_dd_checks").update({
        status: command.status,
        detail: command.note,
        source: "human",
        note: command.note,
        evidence: {
          ...current.evidence,
          previousStatus: current.source === "human" ? current.evidence.previousStatus ?? current.status : current.status,
          previousDetail: current.source === "human" ? current.evidence.previousDetail ?? current.detail : current.detail,
        },
        updated_at: new Date().toISOString(),
      }).eq("mandate_id", args.mandateId).eq("code", command.checkCode);
      if (updated.error) return dbFailure(updated.error, "Could not save the override.");
    }
    const review = await supabase.from("re_dd_reviews").insert({
      client_id: args.clientId,
      mandate_id: args.mandateId,
      actor_id: args.actor.id,
      action: command.action,
      check_code: command.checkCode,
      note: command.action === "override" ? command.note : null,
      payload: command.action === "override" ? { status: command.status } : {},
    });
    if (review.error) return dbFailure(review.error, "The check changed, but the review note was not saved.");
    const report = await rescore(args.clientId, args.mandateId, args.actor);
    if (!report.ok) return report;
    await audit(args.clientId, args.mandateId, args.actor, command.action === "override" ? "check_overridden" : "override_reverted", {
      checkCode: command.checkCode,
      status: report.report.status,
      score: report.report.risk_score,
    });
    return { ok: true as const, report: report.report };
  }

  if (!bundle.report) return fail(409, "Run the check before recording a clearance decision.");
  if (command.action === "clear" && bundle.report.status === "fail") {
    return fail(409, "A failed report cannot be cleared. Override the failed items or reject the file.");
  }
  const status = command.action === "clear" ? "cleared" : "rejected";
  const updated = await supabase.from("re_dd_mandates").update({
    status,
    updated_at: new Date().toISOString(),
  }).eq("id", args.mandateId).eq("client_id", args.clientId);
  if (updated.error) return dbFailure(updated.error, "Could not record the decision.");
  await supabase.from("re_dd_reviews").insert({
    client_id: args.clientId,
    mandate_id: args.mandateId,
    actor_id: args.actor.id,
    action: command.action,
    note: command.note,
    payload: { reportStatus: bundle.report.status, riskScore: bundle.report.risk_score },
  });
  await audit(args.clientId, args.mandateId, args.actor, status === "cleared" ? "clearance_marked" : "clearance_rejected", {
    note: command.note,
    reportStatus: bundle.report.status,
  });
  return { ok: true as const };
}
