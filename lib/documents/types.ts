export const DOCUMENT_LIFECYCLE_STATUSES = [
  "DRAFT",
  "UNDER_REVIEW",
  "FINAL",
  "SIGNED",
  "ACTIVE",
  "EXPIRED",
  "TERMINATED",
  "SUPERSEDED",
  "ARCHIVED",
] as const;

export type DocumentLifecycleStatus = (typeof DOCUMENT_LIFECYCLE_STATUSES)[number];

export const DOCUMENT_PROCESSING_STATUSES = [
  "UPLOADED",
  "QUEUED",
  "EXTRACTING",
  "ANALYZING",
  "INDEXING",
  "READY",
  "NEEDS_REVIEW",
  "FAILED",
] as const;

export type DocumentProcessingStatus = (typeof DOCUMENT_PROCESSING_STATUSES)[number];

export const DOCUMENT_SOURCES = [
  "UPLOAD",
  "EMAIL_IMPORT",
  "CRM_GENERATED",
  "AGENT_GENERATED",
  "EXTERNAL_INTEGRATION",
  "MIGRATION",
] as const;

export type DocumentSource = (typeof DOCUMENT_SOURCES)[number];

export const DOCUMENT_ACCESS_SCOPES = [
  "COMPANY",
  "TEAM",
  "ROLE",
  "USER",
  "PRIVATE",
  "LINKED_RECORD",
] as const;

export type DocumentAccessScope = (typeof DOCUMENT_ACCESS_SCOPES)[number];

export const DOCUMENT_CLASSIFICATIONS = [
  "GENERAL",
  "FINANCIAL",
  "LEGAL",
  "HR",
  "EXECUTIVE",
  "CONFIDENTIAL",
] as const;

export type DocumentClassification = (typeof DOCUMENT_CLASSIFICATIONS)[number];

export const DOCUMENT_ACTIVITY_ACTIONS = [
  "UPLOADED",
  "DOWNLOADED",
  "VIEWED",
  "METADATA_EDITED",
  "ARCHIVED",
  "VERSION_ADDED",
  "PROCESSING_STARTED",
  "PROCESSING_COMPLETED",
  "PROCESSING_FAILED",
] as const;

export type DocumentActivityAction = (typeof DOCUMENT_ACTIVITY_ACTIONS)[number];

export type DocumentRow = {
  id: string;
  client_id: string;
  title: string;
  original_file_name: string;
  document_type_id: string | null;
  category_id: string | null;
  lifecycle_status: DocumentLifecycleStatus;
  processing_status: DocumentProcessingStatus;
  current_version_id: string | null;
  owner_user_id: string | null;
  owning_team_id: string | null;
  source: DocumentSource;
  description: string | null;
  uploaded_by: string | null;
  legacy_source_table: string | null;
  legacy_source_id: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type DocumentVersionRow = {
  id: string;
  client_id: string;
  document_id: string;
  version_number: number;
  storage_key: string;
  original_file_name: string;
  mime_type: string;
  size_bytes: number;
  checksum_sha256: string;
  extracted_text_status: string;
  processing_status: DocumentProcessingStatus;
  version_label: string | null;
  is_current: boolean;
  uploaded_by: string | null;
  uploaded_at: string;
  supersedes_version_id: string | null;
  extraction_error?: string | null;
};

export type DocumentTypeRow = {
  id: string;
  client_id: string | null;
  code: string;
  label: string;
  is_system: boolean;
  is_active: boolean;
  display_order: number;
};

export type DocumentAccessPolicyRow = {
  id: string;
  client_id: string;
  document_id: string;
  scope_type: DocumentAccessScope;
  scope_id: string | null;
  classification: DocumentClassification;
};

export type DocumentCompanySettingsRow = {
  client_id: string;
  enabled: boolean;
  default_scope_type: DocumentAccessScope;
  default_classification: DocumentClassification;
  auto_classify: boolean;
  auto_create_category: boolean;
  auto_link_high_confidence: boolean;
  analyze_automatically: boolean;
  extract_obligations: boolean;
  extract_key_terms: boolean;
  expiry_alerts: boolean;
  expiry_alert_days: number;
  suggest_categories_when_uncertain: boolean;
  min_auto_create_category_confidence: "HIGH" | "MEDIUM" | "LOW";
};

export type DocumentVersionContentRow = {
  version_id: string;
  client_id: string;
  document_id: string;
  plain_text: string | null;
  pages: unknown;
  tables: unknown;
  char_count: number;
  word_count: number;
  extractor_version: string;
  extracted_at: string;
};

export type DocumentActor = {
  userId: string;
  role: string;
  clientId: string | null;
};

export type DuplicateMatch = {
  documentId: string;
  title: string;
  uploadedAt: string;
  versionId: string;
};

export type UploadDocumentResult =
  | {
      ok: true;
      document: DocumentRow;
      version: DocumentVersionRow;
      duplicate?: DuplicateMatch;
      processingJobId: string;
    }
  | { ok: false; error: string; status: number; duplicate?: DuplicateMatch };
