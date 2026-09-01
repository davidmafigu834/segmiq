import { createAdminClient } from "@/lib/supabase/admin";
import { DOCUMENT_INTELLIGENCE_VERSION } from "@/lib/documents/intelligence/types";
import type { IntelligenceExtractionResult } from "@/lib/documents/intelligence/types";

function parseIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

export async function persistDocumentIntelligence(opts: {
  clientId: string;
  documentId: string;
  versionId: string;
  documentTypeCode: string;
  result: IntelligenceExtractionResult;
}): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  await supabase.from("document_intelligence").upsert(
    {
      client_id: opts.clientId,
      document_id: opts.documentId,
      version_id: opts.versionId,
      summary: opts.result.summary,
      purpose: opts.result.purpose,
      detected_language: opts.result.detectedLanguage,
      extraction_confidence: opts.result.extractionConfidence,
      generator_version: DOCUMENT_INTELLIGENCE_VERSION,
      model: opts.result.model,
      generated_at: now,
    },
    { onConflict: "version_id" }
  );

  await supabase
    .from("document_facts")
    .delete()
    .eq("client_id", opts.clientId)
    .eq("version_id", opts.versionId)
    .in("status", ["EXTRACTED", "REJECTED"]);

  await supabase
    .from("document_obligations")
    .delete()
    .eq("client_id", opts.clientId)
    .eq("version_id", opts.versionId)
    .eq("status", "DETECTED");

  await supabase
    .from("document_important_dates")
    .delete()
    .eq("client_id", opts.clientId)
    .eq("version_id", opts.versionId)
    .eq("status", "DETECTED");

  if (opts.result.facts.length) {
    await supabase.from("document_facts").insert(
      opts.result.facts.map((fact, index) => ({
        client_id: opts.clientId,
        document_id: opts.documentId,
        version_id: opts.versionId,
        fact_type: fact.factType,
        label: fact.label,
        value_json: fact.value,
        confidence: fact.confidence,
        page: fact.page ?? null,
        section: fact.section ?? null,
        clause: fact.clause ?? null,
        source_excerpt: fact.sourceExcerpt ?? null,
        status: "EXTRACTED",
        sort_order: index,
      }))
    );
  }

  if (opts.result.obligations.length) {
    await supabase.from("document_obligations").insert(
      opts.result.obligations.map((row) => ({
        client_id: opts.clientId,
        document_id: opts.documentId,
        version_id: opts.versionId,
        responsible_party_type: row.responsiblePartyType,
        responsible_party_text: row.responsiblePartyText ?? null,
        action: row.action,
        trigger_type: row.triggerType ?? null,
        trigger_description: row.triggerDescription ?? null,
        due_date: parseIsoDate(row.dueDate),
        due_rule_json: row.dueRuleText ? { text: row.dueRuleText } : null,
        status: "DETECTED",
        page: row.page ?? null,
        clause: row.clause ?? null,
        source_excerpt: row.sourceExcerpt ?? null,
        confidence: row.confidence,
        updated_at: now,
      }))
    );
  }

  if (opts.result.importantDates.length) {
    await supabase.from("document_important_dates").insert(
      opts.result.importantDates.map((row) => ({
        client_id: opts.clientId,
        document_id: opts.documentId,
        version_id: opts.versionId,
        date_type: row.dateType,
        label: row.label,
        date_value: parseIsoDate(row.dateValue),
        date_text: row.dateText ?? null,
        confidence: row.confidence,
        page: row.page ?? null,
        clause: row.clause ?? null,
        source_excerpt: row.sourceExcerpt ?? null,
        status: "DETECTED",
      }))
    );
  }

  await supabase.from("document_activity").insert({
    client_id: opts.clientId,
    document_id: opts.documentId,
    version_id: opts.versionId,
    action: "METADATA_EDITED",
    metadata: {
      kind: "intelligence",
      factCount: opts.result.facts.length,
      obligationCount: opts.result.obligations.length,
      dateCount: opts.result.importantDates.length,
      documentTypeCode: opts.documentTypeCode,
      confidence: opts.result.extractionConfidence,
    },
  });
}
