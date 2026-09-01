import type { DocumentLifecycleStatus, DocumentProcessingStatus } from "@/lib/documents/types";

export const DOCUMENT_RETRIEVAL_VERSION = "segmiq-doc-retrieval-2026-09-h1";

export type DocumentSearchFilters = {
  documentTypeId?: string;
  lifecycleStatus?: DocumentLifecycleStatus | string;
  processingStatus?: string;
  entityType?: string;
  entityId?: string;
  collection?: string;
  includeArchived?: boolean;
  documentId?: string;
  currentVersionOnly?: boolean;
};

export type DocumentChunkHit = {
  chunkId: string;
  documentId: string;
  versionId: string;
  chunkIndex: number;
  content: string;
  pageNumber: number | null;
  sectionHeading: string | null;
  lexicalScore: number;
  overlapScore: number;
  score: number;
};

export type DocumentSearchHit = {
  documentId: string;
  title: string;
  originalFileName: string;
  lifecycleStatus: DocumentLifecycleStatus | string;
  processingStatus: DocumentProcessingStatus | string;
  typeLabel: string | null;
  typeCode: string | null;
  score: number;
  matchKind: "metadata" | "content" | "hybrid";
  snippet: string | null;
  pageNumber: number | null;
  chunkId: string | null;
  isCurrentVersion: boolean;
};

export type DocumentSearchResult = {
  query: string;
  hits: DocumentSearchHit[];
  chunks: DocumentChunkHit[];
  total: number;
};

export type DocumentAskCitation = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  pageNumber: number | null;
  sectionHeading: string | null;
  excerpt: string;
  score: number;
};

export type DocumentAskResult = {
  question: string;
  answer: string | null;
  confidence: "HIGH" | "MEDIUM" | "LOW" | null;
  citations: DocumentAskCitation[];
  insufficientEvidence: boolean;
};
