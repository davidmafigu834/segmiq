export const DOCUMENT_LINKER_VERSION = "segmiq-doc-link-2026-09-g1";

export const DOCUMENT_ENTITY_TYPES = [
  "CUSTOMER",
  "LEAD",
  "DEAL",
  "QUOTATION",
  "PRODUCT",
  "PACKAGE",
  "PROJECT",
  "USER",
  "TEAM",
  "SUPPORT_CASE",
] as const;

export type DocumentEntityType = (typeof DOCUMENT_ENTITY_TYPES)[number];

export const DOCUMENT_LINK_TYPES = [
  "PRIMARY_CUSTOMER",
  "RELATED_CUSTOMER",
  "SOURCE_LEAD",
  "SOURCE_DEAL",
  "SOURCE_QUOTATION",
  "GENERATED_FROM",
  "RELATED",
  "MANUAL",
] as const;

export type DocumentLinkType = (typeof DOCUMENT_LINK_TYPES)[number];

export type LinkConfidence = "HIGH" | "MEDIUM" | "LOW";

export type DocumentEntityLinkRow = {
  id: string;
  client_id: string;
  document_id: string;
  entity_type: DocumentEntityType;
  entity_id: string;
  link_type: DocumentLinkType;
  confidence: LinkConfidence;
  source: "HUMAN" | "AGENT";
  confirmed: boolean;
  match_reason: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type EnrichedDocumentEntityLink = DocumentEntityLinkRow & {
  label: string;
  subtitle: string | null;
  href: string;
};

export type LinkCandidate = {
  entityType: DocumentEntityType;
  entityId: string;
  linkType: DocumentLinkType;
  confidence: LinkConfidence;
  matchReason: string;
  label: string;
  subtitle?: string | null;
  metadata?: Record<string, unknown>;
};

export type ExtractedLinkSignals = {
  partyNames: string[];
  emails: string[];
  phones: string[];
  quoteNumbers: string[];
};
