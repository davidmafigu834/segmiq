import { createAdminClient } from "@/lib/supabase/admin";
import { KEY_TERM_FACT_TYPES } from "@/lib/documents/intelligence/types";
import type {
  DocumentFactRow,
  DocumentImportantDateRow,
  DocumentIntelligenceRow,
  DocumentObligationRow,
} from "@/lib/documents/intelligence/types";

export type DocumentIntelligenceBundle = {
  intelligence: DocumentIntelligenceRow | null;
  facts: DocumentFactRow[];
  keyTerms: DocumentFactRow[];
  obligations: DocumentObligationRow[];
  importantDates: DocumentImportantDateRow[];
};

export async function loadDocumentIntelligenceBundle(opts: {
  clientId: string;
  documentId: string;
  versionId: string | null;
}): Promise<DocumentIntelligenceBundle> {
  const supabase = createAdminClient();

  if (!opts.versionId) {
    return {
      intelligence: null,
      facts: [],
      keyTerms: [],
      obligations: [],
      importantDates: [],
    };
  }

  const [intelligenceRes, factsRes, obligationsRes, datesRes] = await Promise.all([
    supabase
      .from("document_intelligence")
      .select("*")
      .eq("client_id", opts.clientId)
      .eq("version_id", opts.versionId)
      .maybeSingle(),
    supabase
      .from("document_facts")
      .select("*")
      .eq("client_id", opts.clientId)
      .eq("version_id", opts.versionId)
      .neq("status", "REJECTED")
      .order("sort_order", { ascending: true }),
    supabase
      .from("document_obligations")
      .select("*")
      .eq("client_id", opts.clientId)
      .eq("version_id", opts.versionId)
      .neq("status", "CANCELLED")
      .order("created_at", { ascending: true }),
    supabase
      .from("document_important_dates")
      .select("*")
      .eq("client_id", opts.clientId)
      .eq("version_id", opts.versionId)
      .neq("status", "REJECTED")
      .order("date_value", { ascending: true, nullsFirst: false }),
  ]);

  const facts = (factsRes.data as DocumentFactRow[]) ?? [];
  const keyTerms = facts.filter(
    (fact) =>
      KEY_TERM_FACT_TYPES.includes(fact.fact_type as (typeof KEY_TERM_FACT_TYPES)[number]) ||
      /payment|warranty|delivery|termination|renewal|notice/i.test(fact.label)
  );

  return {
    intelligence: (intelligenceRes.data as DocumentIntelligenceRow | null) ?? null,
    facts,
    keyTerms,
    obligations: (obligationsRes.data as DocumentObligationRow[]) ?? [],
    importantDates: (datesRes.data as DocumentImportantDateRow[]) ?? [],
  };
}
