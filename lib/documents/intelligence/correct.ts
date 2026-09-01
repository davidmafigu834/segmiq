import { createAdminClient } from "@/lib/supabase/admin";
import { DOCUMENT_INTELLIGENCE_VERSION } from "@/lib/documents/intelligence/types";
import type { DocumentFactStatus } from "@/lib/documents/intelligence/types";
import { canCorrectDocumentIntelligence } from "@/lib/documents/permissions";
import type { DocumentActor } from "@/lib/documents/types";

export async function updateDocumentFactStatus(opts: {
  clientId: string;
  documentId: string;
  factId: string;
  actor: DocumentActor;
  action: "confirm" | "reject";
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (!canCorrectDocumentIntelligence(opts.actor)) {
    return { ok: false, error: "Forbidden.", status: 403 };
  }

  const status: DocumentFactStatus = opts.action === "confirm" ? "CONFIRMED" : "REJECTED";
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: fact } = await supabase
    .from("document_facts")
    .select("id, value_json, fact_type")
    .eq("id", opts.factId)
    .eq("client_id", opts.clientId)
    .eq("document_id", opts.documentId)
    .maybeSingle();

  if (!fact) return { ok: false, error: "Fact not found.", status: 404 };

  await supabase
    .from("document_facts")
    .update({
      status,
      corrected_by: opts.actor.userId,
      corrected_at: now,
    })
    .eq("id", opts.factId)
    .eq("client_id", opts.clientId);

  await supabase.from("document_activity").insert({
    client_id: opts.clientId,
    document_id: opts.documentId,
    action: "METADATA_EDITED",
    metadata: {
      kind: "fact_review",
      factId: opts.factId,
      action: opts.action,
      factType: fact.fact_type,
    },
  });

  return { ok: true };
}

export async function correctDocumentFact(opts: {
  clientId: string;
  documentId: string;
  factId: string;
  actor: DocumentActor;
  correctedValue: unknown;
  documentTypeCode?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (!canCorrectDocumentIntelligence(opts.actor)) {
    return { ok: false, error: "Forbidden.", status: 403 };
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: fact } = await supabase
    .from("document_facts")
    .select("id, value_json, fact_type, version_id")
    .eq("id", opts.factId)
    .eq("client_id", opts.clientId)
    .eq("document_id", opts.documentId)
    .maybeSingle();

  if (!fact) return { ok: false, error: "Fact not found.", status: 404 };

  await supabase
    .from("document_facts")
    .update({
      value_json: opts.correctedValue,
      status: "CORRECTED",
      corrected_by: opts.actor.userId,
      corrected_at: now,
    })
    .eq("id", opts.factId)
    .eq("client_id", opts.clientId);

  await supabase.from("document_fact_corrections").insert({
    client_id: opts.clientId,
    fact_id: opts.factId,
    document_id: opts.documentId,
    original_value_json: fact.value_json,
    corrected_value_json: opts.correctedValue,
    document_type_code: opts.documentTypeCode ?? fact.fact_type,
    extractor_version: DOCUMENT_INTELLIGENCE_VERSION,
    corrected_by: opts.actor.userId,
  });

  await supabase.from("document_activity").insert({
    client_id: opts.clientId,
    document_id: opts.documentId,
    version_id: fact.version_id as string,
    action: "METADATA_EDITED",
    metadata: {
      kind: "fact_correction",
      factId: opts.factId,
      factType: fact.fact_type,
    },
  });

  return { ok: true };
}
