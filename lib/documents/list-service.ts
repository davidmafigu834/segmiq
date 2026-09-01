import { createAdminClient } from "@/lib/supabase/admin";
import { DOCUMENT_COLLECTIONS, getCollectionDefinition, type DocumentCollectionId } from "@/lib/documents/collections";
import { canViewDocument } from "@/lib/documents/permissions";
import { searchDocuments } from "@/lib/documents/retrieval";
import type { DocumentActor, DocumentRow, DocumentTypeRow, DocumentVersionRow } from "@/lib/documents/types";

export type DocumentListFilters = {
  q?: string;
  collection?: DocumentCollectionId | string;
  lifecycleStatus?: string;
  processingStatus?: string;
  documentTypeId?: string;
  includeArchived?: boolean;
};

export type DocumentListItem = DocumentRow & {
  document_type?: Pick<DocumentTypeRow, "code" | "label"> | null;
  searchSnippet?: string | null;
  searchPageNumber?: number | null;
};

export type DocumentActivityRow = {
  id: string;
  client_id: string;
  document_id: string;
  version_id: string | null;
  actor_user_id: string | null;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type DocumentsHomeSummary = {
  collections: Array<{ id: string; label: string; count: number }>;
  attention: {
    needsReview: number;
    failed: number;
    processing: number;
    total: number;
  };
};

async function loadAccessPolicy(documentId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("document_access_policies")
    .select("*")
    .eq("document_id", documentId)
    .maybeSingle();
  return data;
}

async function resolveTypeIds(clientId: string, codes: string[]): Promise<string[]> {
  if (!codes.length) return [];
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("document_types")
    .select("id")
    .or(`client_id.is.null,client_id.eq.${clientId}`)
    .in("code", codes);
  return (data ?? []).map((r) => r.id as string);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyCollectionFilter(query: any, collection: string, typeIds: string[]) {
  const def = getCollectionDefinition(collection);
  if (!def) return query;

  if ("typeCodes" in def && def.typeCodes) {
    if (!typeIds.length) return query.eq("id", "00000000-0000-0000-0000-000000000000");
    return query.in("document_type_id", typeIds);
  }
  if ("lifecycleStatuses" in def && def.lifecycleStatuses) {
    return query.in("lifecycle_status", [...def.lifecycleStatuses]);
  }
  if ("attention" in def && def.attention) {
    return query.in("processing_status", ["NEEDS_REVIEW", "FAILED"]);
  }
  if ("recentDays" in def && def.recentDays) {
    const since = new Date();
    since.setDate(since.getDate() - def.recentDays);
    return query.gte("created_at", since.toISOString());
  }
  return query;
}

export async function listDocumentsFiltered(opts: {
  clientId: string;
  actor: DocumentActor;
  limit?: number;
  offset?: number;
  filters?: DocumentListFilters;
}): Promise<{ documents: DocumentListItem[]; total: number }> {
  const supabase = createAdminClient();
  const limit = Math.min(opts.limit ?? 50, 100);
  const offset = opts.offset ?? 0;
  const filters = opts.filters ?? {};

  if (filters.q?.trim()) {
    const search = await searchDocuments({
      clientId: opts.clientId,
      actor: opts.actor,
      query: filters.q.trim(),
      limit,
      offset,
      filters: {
        lifecycleStatus: filters.lifecycleStatus,
        processingStatus: filters.processingStatus,
        documentTypeId: filters.documentTypeId,
        includeArchived: filters.includeArchived,
        collection: filters.collection,
      },
      audit: true,
    });

    if (!search.hits.length) {
      return { documents: [], total: 0 };
    }

    const supabase = createAdminClient();
    const ids = search.hits.map((h) => h.documentId);
    const { data } = await supabase
      .from("documents")
      .select("*, document_types(code, label)")
      .eq("client_id", opts.clientId)
      .in("id", ids);

    const byId = new Map(
      (data ?? []).map((row) => {
        const doc = row as DocumentListItem & { document_types?: DocumentListItem["document_type"] };
        return [
          doc.id,
          {
            ...doc,
            document_type: Array.isArray(doc.document_types)
              ? doc.document_types[0] ?? null
              : doc.document_types ?? null,
          } satisfies DocumentListItem,
        ];
      })
    );

    const documents = search.hits
      .map((hit) => {
        const doc = byId.get(hit.documentId);
        if (!doc) return null;
        return {
          ...doc,
          searchSnippet: hit.snippet,
          searchPageNumber: hit.pageNumber,
        };
      })
      .filter((doc): doc is DocumentListItem => Boolean(doc));

    return { documents, total: search.total };
  }

  let typeIds: string[] = [];
  if (filters.collection) {
    const def = getCollectionDefinition(filters.collection);
    if (def && "typeCodes" in def && def.typeCodes) {
      typeIds = await resolveTypeIds(opts.clientId, [...def.typeCodes]);
    }
  }

  let query = supabase
    .from("documents")
    .select("*, document_types(code, label)", { count: "exact" })
    .eq("client_id", opts.clientId)
    .order("updated_at", { ascending: false });

  if (!filters.includeArchived) {
    query = query.is("archived_at", null);
  }
  if (filters.q?.trim()) {
    const term = filters.q.trim().replace(/[%_]/g, "");
    query = query.or(`title.ilike.%${term}%,original_file_name.ilike.%${term}%`);
  }
  if (filters.lifecycleStatus) {
    query = query.eq("lifecycle_status", filters.lifecycleStatus);
  }
  if (filters.processingStatus) {
    if (filters.processingStatus === "PROCESSING") {
      query = query.in("processing_status", ["QUEUED", "EXTRACTING", "ANALYZING", "INDEXING"]);
    } else {
      query = query.eq("processing_status", filters.processingStatus);
    }
  }
  if (filters.documentTypeId) {
    query = query.eq("document_type_id", filters.documentTypeId);
  }
  if (filters.collection) {
    query = applyCollectionFilter(query, filters.collection, typeIds);
  }

  const { data, count, error } = await query.range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);

  const documents: DocumentListItem[] = [];
  for (const row of data ?? []) {
    const doc = row as DocumentListItem & { document_types?: DocumentListItem["document_type"] };
    const policy = await loadAccessPolicy(doc.id);
    if (canViewDocument(opts.actor, doc, policy)) {
      documents.push({
        ...doc,
        document_type: Array.isArray(doc.document_types)
          ? doc.document_types[0] ?? null
          : doc.document_types ?? null,
      });
    }
  }

  return { documents, total: count ?? documents.length };
}

export async function getDocumentsHomeSummary(
  clientId: string,
  actor: DocumentActor
): Promise<DocumentsHomeSummary> {
  const supabase = createAdminClient();
  const base = () =>
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .is("archived_at", null);

  const collectionCounts = await Promise.all(
    DOCUMENT_COLLECTIONS.map(async (col) => {
      let typeIds: string[] = [];
      if ("typeCodes" in col && col.typeCodes) {
        typeIds = await resolveTypeIds(clientId, [...col.typeCodes]);
      }
      let q = base();
      q = applyCollectionFilter(q, col.id, typeIds);
      const { count } = await q;
      return { id: col.id, label: col.label, count: count ?? 0 };
    })
  );

  const [needsReview, failed, processing] = await Promise.all([
    base().eq("processing_status", "NEEDS_REVIEW"),
    base().eq("processing_status", "FAILED"),
    base().in("processing_status", ["QUEUED", "EXTRACTING", "ANALYZING", "INDEXING"]),
  ]);

  const attention = {
    needsReview: needsReview.count ?? 0,
    failed: failed.count ?? 0,
    processing: processing.count ?? 0,
    total: (needsReview.count ?? 0) + (failed.count ?? 0),
  };

  // Permission filter is expensive for counts; managers see tenant-wide counts.
  if (actor.role === "SALESPERSON") {
    const { documents } = await listDocumentsFiltered({
      clientId,
      actor,
      limit: 1,
      filters: { collection: "needs_attention" },
    });
    attention.total = documents.length > 0 ? attention.total : 0;
  }

  return { collections: collectionCounts, attention };
}

export async function listDocumentVersions(opts: {
  clientId: string;
  documentId: string;
  actor: DocumentActor;
}): Promise<DocumentVersionRow[]> {
  const supabase = createAdminClient();
  const { data: document } = await supabase
    .from("documents")
    .select("*")
    .eq("id", opts.documentId)
    .eq("client_id", opts.clientId)
    .maybeSingle();

  if (!document) return [];

  const policy = await loadAccessPolicy(opts.documentId);
  if (!canViewDocument(opts.actor, document as DocumentRow, policy)) return [];

  const { data } = await supabase
    .from("document_versions")
    .select("*")
    .eq("document_id", opts.documentId)
    .eq("client_id", opts.clientId)
    .order("version_number", { ascending: false });

  return (data as DocumentVersionRow[]) ?? [];
}

export async function listDocumentActivity(opts: {
  clientId: string;
  documentId: string;
  actor: DocumentActor;
  limit?: number;
}): Promise<DocumentActivityRow[]> {
  const supabase = createAdminClient();
  const { data: document } = await supabase
    .from("documents")
    .select("*")
    .eq("id", opts.documentId)
    .eq("client_id", opts.clientId)
    .maybeSingle();

  if (!document) return [];

  const policy = await loadAccessPolicy(opts.documentId);
  if (!canViewDocument(opts.actor, document as DocumentRow, policy)) return [];

  const limit = Math.min(opts.limit ?? 50, 100);
  const { data } = await supabase
    .from("document_activity")
    .select("*")
    .eq("document_id", opts.documentId)
    .eq("client_id", opts.clientId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data as DocumentActivityRow[]) ?? [];
}
