import {
  getDocumentForActor,
  getDocumentVersionContent,
  listDocumentTypes,
  toDocumentActor,
} from "@/lib/documents/service";
import { listDocumentTags } from "@/lib/documents/classification";
import { loadDocumentIntelligenceBundle } from "@/lib/documents/intelligence";
import { loadDocumentEntityLinks } from "@/lib/documents/linking";
import { listDocumentActivity, listDocumentVersions } from "@/lib/documents/list-service";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DocumentActor } from "@/lib/documents/types";

export type DocumentClassificationAuditSummary = {
  document_type_code: string | null;
  type_confidence: string;
  category_confidence: string;
  category_action: string;
  suggested_category_name: string | null;
  needs_review: boolean;
  tags: string[];
  model: string | null;
  created_at: string;
  details: Record<string, unknown>;
};

async function getLatestClassificationAudit(
  clientId: string,
  documentId: string
): Promise<DocumentClassificationAuditSummary | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("document_classification_audit")
    .select(
      "document_type_code, type_confidence, category_confidence, category_action, suggested_category_name, needs_review, tags, model, created_at, details"
    )
    .eq("client_id", clientId)
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as DocumentClassificationAuditSummary | null) ?? null;
}

async function getCategoryName(clientId: string, categoryId: string | null): Promise<string | null> {
  if (!categoryId) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("document_categories")
    .select("name")
    .eq("client_id", clientId)
    .eq("id", categoryId)
    .maybeSingle();
  return (data?.name as string) ?? null;
}

export async function getCompanyDocumentDetailData(opts: {
  clientId: string;
  documentId: string;
  actor: DocumentActor;
}) {
  const result = await getDocumentForActor({
    clientId: opts.clientId,
    documentId: opts.documentId,
    actor: opts.actor,
  });

  if (!result.ok) return result;

  const [versions, activity, types, content, tags, classification, categoryName, intelligence, links] =
    await Promise.all([
    listDocumentVersions({
      clientId: opts.clientId,
      documentId: opts.documentId,
      actor: opts.actor,
    }),
    listDocumentActivity({
      clientId: opts.clientId,
      documentId: opts.documentId,
      actor: opts.actor,
    }),
    listDocumentTypes(opts.clientId),
    result.version
      ? getDocumentVersionContent(
          opts.clientId,
          opts.documentId,
          result.version.id,
          opts.actor
        )
      : Promise.resolve(null),
    listDocumentTags(opts.clientId, opts.documentId),
    getLatestClassificationAudit(opts.clientId, opts.documentId),
    getCategoryName(opts.clientId, result.document.category_id),
    loadDocumentIntelligenceBundle({
      clientId: opts.clientId,
      documentId: opts.documentId,
      versionId: result.version?.id ?? null,
    }),
    loadDocumentEntityLinks(opts.clientId, opts.documentId),
  ]);

  const typeLabel =
    types.find((t) => t.id === result.document.document_type_id)?.label ?? null;

  return {
    ok: true as const,
    document: result.document,
    version: result.version,
    policy: result.policy,
    versions,
    activity,
    typeLabel,
    content,
    tags,
    classification,
    categoryName,
    intelligence,
    links,
  };
}

export { toDocumentActor };
