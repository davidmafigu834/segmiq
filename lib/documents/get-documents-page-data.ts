import { listDocumentTypes, toDocumentActor } from "@/lib/documents/service";
import {
  getDocumentsHomeSummary,
  listDocumentsFiltered,
  type DocumentListFilters,
} from "@/lib/documents/list-service";
import type { DocumentActor } from "@/lib/documents/types";

export async function getCompanyDocumentsPageData(opts: {
  clientId: string;
  actor: DocumentActor;
  filters?: DocumentListFilters;
  limit?: number;
  offset?: number;
}) {
  const [summary, list, types] = await Promise.all([
    getDocumentsHomeSummary(opts.clientId, opts.actor),
    listDocumentsFiltered({
      clientId: opts.clientId,
      actor: opts.actor,
      limit: opts.limit ?? 25,
      offset: opts.offset ?? 0,
      filters: opts.filters,
    }),
    listDocumentTypes(opts.clientId),
  ]);

  return {
    summary,
    documents: list.documents,
    total: list.total,
    types,
  };
}

export { toDocumentActor };
