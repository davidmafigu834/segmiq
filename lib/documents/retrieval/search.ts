import { createAdminClient } from "@/lib/supabase/admin";
import { getCollectionDefinition } from "@/lib/documents/collections";
import { canViewDocument } from "@/lib/documents/permissions";
import type { DocumentActor, DocumentRow } from "@/lib/documents/types";
import {
  buildSnippet,
  fuseSearchScore,
  metadataMatchScore,
  scoreChunkOverlap,
  toFtsQuery,
} from "@/lib/documents/retrieval/ranking";
import type {
  DocumentChunkHit,
  DocumentSearchFilters,
  DocumentSearchHit,
  DocumentSearchResult,
} from "@/lib/documents/retrieval/types";

type ChunkRow = {
  id: string;
  document_id: string;
  version_id: string;
  chunk_index: number;
  content: string;
  page_number: number | null;
  section_heading: string | null;
  documents: {
    id: string;
    title: string;
    original_file_name: string;
    lifecycle_status: string;
    processing_status: string;
    current_version_id: string | null;
    document_type_id: string | null;
    archived_at: string | null;
    owner_user_id: string | null;
    uploaded_by: string | null;
    client_id: string;
    document_types?: { code: string; label: string } | { code: string; label: string }[] | null;
  };
};

type RawChunkRow = Omit<ChunkRow, "documents"> & {
  documents: ChunkRow["documents"] | ChunkRow["documents"][] | null;
};

function normalizeChunkRows(data: unknown): ChunkRow[] {
  if (!Array.isArray(data)) return [];

  const rows: ChunkRow[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const raw = row as RawChunkRow;
    const doc = Array.isArray(raw.documents) ? raw.documents[0] : raw.documents;
    if (!doc) continue;
    rows.push({
      id: raw.id,
      document_id: raw.document_id,
      version_id: raw.version_id,
      chunk_index: raw.chunk_index,
      content: raw.content,
      page_number: raw.page_number,
      section_heading: raw.section_heading,
      documents: doc,
    });
  }
  return rows;
}

async function resolveCollectionTypeIds(clientId: string, collection?: string): Promise<string[]> {
  if (!collection) return [];
  const def = getCollectionDefinition(collection);
  if (!def || !("typeCodes" in def) || !def.typeCodes) return [];
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("document_types")
    .select("id")
    .or(`client_id.is.null,client_id.eq.${clientId}`)
    .in("code", [...def.typeCodes]);
  return (data ?? []).map((r) => r.id as string);
}

async function loadAccessPolicy(documentId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("document_access_policies")
    .select("*")
    .eq("document_id", documentId)
    .maybeSingle();
  return data;
}

async function loadEntityLabelsForDocuments(
  clientId: string,
  documentIds: string[]
): Promise<Map<string, string[]>> {
  if (!documentIds.length) return new Map();
  const supabase = createAdminClient();
  const { data: links } = await supabase
    .from("document_entity_links")
    .select("document_id, entity_type, entity_id, confirmed")
    .eq("client_id", clientId)
    .in("document_id", documentIds);

  const labels = new Map<string, string[]>();
  for (const link of links ?? []) {
    const docId = link.document_id as string;
    const bucket = labels.get(docId) ?? [];
    bucket.push(`${link.entity_type}:${link.entity_id}`);
    labels.set(docId, bucket);
  }
  return labels;
}

async function filterAccessibleDocuments(
  actor: DocumentActor,
  rows: ChunkRow[]
): Promise<ChunkRow[]> {
  const cache = new Map<string, boolean>();
  const out: ChunkRow[] = [];

  for (const row of rows) {
    const doc = row.documents;
    if (!doc) continue;
    if (!cache.has(doc.id)) {
      const policy = await loadAccessPolicy(doc.id);
      cache.set(
        doc.id,
        canViewDocument(actor, doc as unknown as DocumentRow, policy)
      );
    }
    if (cache.get(doc.id)) out.push(row);
  }

  return out;
}

function buildChunkQuery(
  supabase: ReturnType<typeof createAdminClient>,
  opts: {
    clientId: string;
    filters: DocumentSearchFilters;
    collectionTypeIds: string[];
    fts: string | null;
  }
) {
  let chunkQuery = supabase
    .from("document_chunks")
    .select(
      `id, document_id, version_id, chunk_index, content, page_number, section_heading,
      documents!inner(
        id, title, original_file_name, lifecycle_status, processing_status,
        current_version_id, document_type_id, archived_at, owner_user_id, uploaded_by, client_id,
        document_types(code, label)
      )`
    )
    .eq("client_id", opts.clientId);

  if (opts.filters.documentId) {
    chunkQuery = chunkQuery.eq("document_id", opts.filters.documentId);
  }
  if (!opts.filters.includeArchived) {
    chunkQuery = chunkQuery.is("documents.archived_at", null);
  }
  if (opts.filters.lifecycleStatus) {
    chunkQuery = chunkQuery.eq("documents.lifecycle_status", opts.filters.lifecycleStatus);
  }
  if (opts.filters.documentTypeId) {
    chunkQuery = chunkQuery.eq("documents.document_type_id", opts.filters.documentTypeId);
  } else if (opts.collectionTypeIds.length) {
    chunkQuery = chunkQuery.in("documents.document_type_id", opts.collectionTypeIds);
  }

  if (opts.fts) {
    chunkQuery = chunkQuery.textSearch("search_vector", opts.fts, {
      type: "plain",
      config: "simple",
    });
  }

  return chunkQuery;
}

export async function searchDocumentChunks(opts: {
  clientId: string;
  actor: DocumentActor;
  query: string;
  limit?: number;
  filters?: DocumentSearchFilters;
  scoreThreshold?: number;
  overlapThreshold?: number;
  ftsFallback?: boolean;
}): Promise<DocumentChunkHit[]> {
  const query = opts.query.trim();
  if (!query) return [];

  const fts = toFtsQuery(query);
  const supabase = createAdminClient();
  const limit = Math.min(opts.limit ?? 24, 60);
  const filters = opts.filters ?? {};
  const collectionTypeIds = await resolveCollectionTypeIds(opts.clientId, filters.collection);

  let chunkQuery = buildChunkQuery(supabase, {
    clientId: opts.clientId,
    filters,
    collectionTypeIds,
    fts,
  });

  const { data } = await chunkQuery.limit(limit * 4);
  let rows = normalizeChunkRows(data);

  if (!rows.length && fts && opts.ftsFallback) {
    const fallbackQuery = buildChunkQuery(supabase, {
      clientId: opts.clientId,
      filters,
      collectionTypeIds,
      fts: null,
    });
    const { data: fallbackData } = await fallbackQuery.limit(limit * 8);
    rows = normalizeChunkRows(fallbackData);
  }

  if (filters.currentVersionOnly !== false) {
    rows = rows.filter((row) => row.version_id === row.documents.current_version_id);
  }

  if (filters.entityType && filters.entityId) {
    const { data: entityLinks } = await supabase
      .from("document_entity_links")
      .select("document_id")
      .eq("client_id", opts.clientId)
      .eq("entity_type", filters.entityType)
      .eq("entity_id", filters.entityId);
    const allowed = new Set((entityLinks ?? []).map((l) => l.document_id as string));
    rows = rows.filter((row) => allowed.has(row.document_id));
  }

  rows = await filterAccessibleDocuments(opts.actor, rows);

  const scoreThreshold = opts.scoreThreshold ?? 0.18;
  const overlapThreshold = opts.overlapThreshold ?? 0.2;

  return rows
    .map((row) => {
      const overlap = scoreChunkOverlap(query, row.content);
      const lexical = fts && row.content ? 0.72 : 0;
      const score = fuseSearchScore({
        metadataScore: 0,
        lexicalScore: lexical,
        overlapScore: overlap,
        lifecycleStatus: row.documents.lifecycle_status,
        processingStatus: row.documents.processing_status,
        isCurrentVersion: row.version_id === row.documents.current_version_id,
      });
      return {
        chunkId: row.id,
        documentId: row.document_id,
        versionId: row.version_id,
        chunkIndex: row.chunk_index,
        content: row.content,
        pageNumber: row.page_number,
        sectionHeading: row.section_heading,
        lexicalScore: lexical,
        overlapScore: overlap,
        score,
      };
    })
    .filter((row) => row.score >= scoreThreshold || row.overlapScore >= overlapThreshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function searchDocuments(opts: {
  clientId: string;
  actor: DocumentActor;
  query: string;
  limit?: number;
  offset?: number;
  filters?: DocumentSearchFilters;
  audit?: boolean;
}): Promise<DocumentSearchResult> {
  const query = opts.query.trim();
  const limit = Math.min(opts.limit ?? 25, 50);
  const offset = opts.offset ?? 0;
  const filters = opts.filters ?? {};
  const collectionTypeIds = await resolveCollectionTypeIds(opts.clientId, filters.collection);

  if (!query) {
    return { query, hits: [], chunks: [], total: 0 };
  }

  const supabase = createAdminClient();

  let metadataQuery = supabase
    .from("documents")
    .select("*, document_types(code, label)")
    .eq("client_id", opts.clientId)
    .order("updated_at", { ascending: false })
    .limit(80);

  if (!filters.includeArchived) metadataQuery = metadataQuery.is("archived_at", null);
  if (filters.lifecycleStatus) metadataQuery = metadataQuery.eq("lifecycle_status", filters.lifecycleStatus);
  if (filters.processingStatus) metadataQuery = metadataQuery.eq("processing_status", filters.processingStatus);
  if (filters.documentTypeId) metadataQuery = metadataQuery.eq("document_type_id", filters.documentTypeId);
  else if (collectionTypeIds.length) metadataQuery = metadataQuery.in("document_type_id", collectionTypeIds);
  if (filters.documentId) metadataQuery = metadataQuery.eq("id", filters.documentId);

  const term = query.replace(/[%_]/g, "");
  metadataQuery = metadataQuery.or(`title.ilike.%${term}%,original_file_name.ilike.%${term}%`);

  const [{ data: metadataDocs }, chunks] = await Promise.all([
    metadataQuery,
    searchDocumentChunks({
      clientId: opts.clientId,
      actor: opts.actor,
      query,
      limit: 40,
      filters,
    }),
  ]);

  const docIds = [...new Set((metadataDocs ?? []).map((d) => d.id as string))];
  const labelsMap = await loadEntityLabelsForDocuments(opts.clientId, docIds);

  const hitMap = new Map<string, DocumentSearchHit>();

  for (const doc of metadataDocs ?? []) {
    const policy = await loadAccessPolicy(doc.id as string);
    if (!canViewDocument(opts.actor, doc as DocumentRow, policy)) continue;

    const type = Array.isArray(doc.document_types)
      ? doc.document_types[0]
      : doc.document_types;
    const metaScore = metadataMatchScore(query, {
      title: doc.title as string,
      originalFileName: doc.original_file_name as string,
      entityLabels: labelsMap.get(doc.id as string) ?? [],
    });
    if (metaScore < 0.2) continue;

    const score = fuseSearchScore({
      metadataScore: metaScore,
      lexicalScore: 0,
      overlapScore: 0,
      lifecycleStatus: doc.lifecycle_status as string,
      processingStatus: doc.processing_status as string,
      isCurrentVersion: true,
    });

    hitMap.set(doc.id as string, {
      documentId: doc.id as string,
      title: doc.title as string,
      originalFileName: doc.original_file_name as string,
      lifecycleStatus: doc.lifecycle_status as string,
      processingStatus: doc.processing_status as string,
      typeLabel: type?.label ?? null,
      typeCode: type?.code ?? null,
      score,
      matchKind: "metadata",
      snippet: null,
      pageNumber: null,
      chunkId: null,
      isCurrentVersion: true,
    });
  }

  for (const chunk of chunks) {
    const existing = hitMap.get(chunk.documentId);
    const snippet = buildSnippet(chunk.content);
    const contentScore = fuseSearchScore({
      metadataScore: existing?.score ? existing.score * 0.35 : 0,
      lexicalScore: chunk.lexicalScore,
      overlapScore: chunk.overlapScore,
      lifecycleStatus: existing?.lifecycleStatus ?? "DRAFT",
      processingStatus: existing?.processingStatus ?? "READY",
      isCurrentVersion: true,
    });

    if (!existing || contentScore > existing.score) {
      hitMap.set(chunk.documentId, {
        documentId: chunk.documentId,
        title: existing?.title ?? "Document",
        originalFileName: existing?.originalFileName ?? "",
        lifecycleStatus: existing?.lifecycleStatus ?? "DRAFT",
        processingStatus: existing?.processingStatus ?? "READY",
        typeLabel: existing?.typeLabel ?? null,
        typeCode: existing?.typeCode ?? null,
        score: contentScore,
        matchKind: existing ? "hybrid" : "content",
        snippet,
        pageNumber: chunk.pageNumber,
        chunkId: chunk.chunkId,
        isCurrentVersion: true,
      });
    }
  }

  // Enrich missing metadata on content-only hits
  const missingIds = [...hitMap.values()]
    .filter((h) => !h.originalFileName)
    .map((h) => h.documentId);
  if (missingIds.length) {
    const { data: docs } = await supabase
      .from("documents")
      .select("id, title, original_file_name, lifecycle_status, processing_status, document_types(code, label)")
      .in("id", missingIds);
    for (const doc of docs ?? []) {
      const hit = hitMap.get(doc.id as string);
      if (!hit) continue;
      const type = Array.isArray(doc.document_types) ? doc.document_types[0] : doc.document_types;
      hit.title = doc.title as string;
      hit.originalFileName = doc.original_file_name as string;
      hit.lifecycleStatus = doc.lifecycle_status as string;
      hit.processingStatus = doc.processing_status as string;
      hit.typeLabel = type?.label ?? null;
      hit.typeCode = type?.code ?? null;
    }
  }

  const hits = [...hitMap.values()].sort((a, b) => b.score - a.score);
  const paged = hits.slice(offset, offset + limit);

  if (opts.audit !== false) {
    await supabase.from("document_search_audit").insert({
      client_id: opts.clientId,
      actor_user_id: opts.actor.userId,
      query,
      filters,
      result_count: hits.length,
      document_ids: paged.map((h) => h.documentId),
      chunk_ids: paged.map((h) => h.chunkId).filter((id): id is string => Boolean(id)),
    });
  }

  return {
    query,
    hits: paged,
    chunks: chunks.slice(0, 12),
    total: hits.length,
  };
}

export async function retrieveChunksForDocument(opts: {
  clientId: string;
  actor: DocumentActor;
  documentId: string;
  query: string;
  limit?: number;
}): Promise<DocumentChunkHit[]> {
  return searchDocumentChunks({
    clientId: opts.clientId,
    actor: opts.actor,
    query: opts.query,
    limit: opts.limit ?? 8,
    filters: {
      documentId: opts.documentId,
      currentVersionOnly: true,
    },
  });
}
