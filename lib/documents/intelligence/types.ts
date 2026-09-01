export const DOCUMENT_INTELLIGENCE_VERSION = "segmiq-doc-intel-2026-09-f1";

export const DOCUMENT_FACT_TYPES = [
  "DOCUMENT_REFERENCE",
  "CONTRACT_VALUE",
  "CURRENCY",
  "EFFECTIVE_DATE",
  "EXPIRY_DATE",
  "RENEWAL_DATE",
  "NOTICE_PERIOD",
  "PAYMENT_TERM",
  "DEPOSIT",
  "PARTY",
  "SIGNATORY",
  "DELIVERY_TERM",
  "WARRANTY_TERM",
  "TERMINATION_TERM",
  "PROJECT_LOCATION",
  "INVOICE_TOTAL",
  "INVOICE_DUE_DATE",
  "PO_NUMBER",
  "POLICY_NUMBER",
  "LICENCE_NUMBER",
  "OTHER",
] as const;

export type DocumentFactType = (typeof DOCUMENT_FACT_TYPES)[number];

export const KEY_TERM_FACT_TYPES: DocumentFactType[] = [
  "CONTRACT_VALUE",
  "CURRENCY",
  "PAYMENT_TERM",
  "DEPOSIT",
  "DELIVERY_TERM",
  "WARRANTY_TERM",
  "TERMINATION_TERM",
  "NOTICE_PERIOD",
  "RENEWAL_DATE",
  "PARTY",
  "SIGNATORY",
];

export type DocumentFactStatus = "EXTRACTED" | "CONFIRMED" | "CORRECTED" | "REJECTED";

export type ClassificationConfidence = "HIGH" | "MEDIUM" | "LOW";

export type ExtractedFact = {
  factType: DocumentFactType;
  label: string;
  value: unknown;
  confidence: ClassificationConfidence;
  page?: number | null;
  section?: string | null;
  clause?: string | null;
  sourceExcerpt?: string | null;
};

export type ExtractedObligation = {
  responsiblePartyType: "COMPANY" | "CUSTOMER" | "SUPPLIER" | "THIRD_PARTY" | "UNKNOWN";
  responsiblePartyText?: string | null;
  action: string;
  triggerType?: string | null;
  triggerDescription?: string | null;
  dueDate?: string | null;
  dueRuleText?: string | null;
  confidence: ClassificationConfidence;
  page?: number | null;
  clause?: string | null;
  sourceExcerpt?: string | null;
};

export type ExtractedImportantDate = {
  dateType:
    | "EFFECTIVE"
    | "EXPIRY"
    | "RENEWAL"
    | "NOTICE"
    | "DELIVERY"
    | "REVIEW"
    | "SUBMISSION"
    | "PAYMENT"
    | "OTHER";
  label: string;
  dateValue?: string | null;
  dateText?: string | null;
  confidence: ClassificationConfidence;
  page?: number | null;
  clause?: string | null;
  sourceExcerpt?: string | null;
};

export type IntelligenceExtractionResult = {
  summary: string | null;
  purpose: string | null;
  detectedLanguage: string | null;
  extractionConfidence: ClassificationConfidence;
  facts: ExtractedFact[];
  obligations: ExtractedObligation[];
  importantDates: ExtractedImportantDate[];
  model: string;
};

export type DocumentIntelligenceRow = {
  id: string;
  client_id: string;
  document_id: string;
  version_id: string;
  summary: string | null;
  purpose: string | null;
  detected_language: string | null;
  extraction_confidence: ClassificationConfidence;
  generator_version: string;
  model: string | null;
  generated_at: string;
};

export type DocumentFactRow = {
  id: string;
  client_id: string;
  document_id: string;
  version_id: string;
  fact_type: string;
  label: string;
  value_json: unknown;
  confidence: ClassificationConfidence;
  page: number | null;
  section: string | null;
  clause: string | null;
  source_chunk_id: string | null;
  source_excerpt: string | null;
  status: DocumentFactStatus;
  corrected_by: string | null;
  corrected_at: string | null;
  sort_order: number;
  created_at: string;
};

export type DocumentObligationRow = {
  id: string;
  client_id: string;
  document_id: string;
  version_id: string;
  responsible_party_type: string;
  responsible_party_text: string | null;
  action: string;
  trigger_type: string | null;
  trigger_description: string | null;
  due_date: string | null;
  due_rule_json: unknown;
  status: string;
  page: number | null;
  clause: string | null;
  source_chunk_id: string | null;
  source_excerpt: string | null;
  linked_task_id: string | null;
  confidence: ClassificationConfidence;
  created_at: string;
  updated_at: string;
};

export type DocumentImportantDateRow = {
  id: string;
  client_id: string;
  document_id: string;
  version_id: string;
  date_type: string;
  label: string;
  date_value: string | null;
  date_text: string | null;
  confidence: ClassificationConfidence;
  page: number | null;
  clause: string | null;
  source_chunk_id: string | null;
  source_excerpt: string | null;
  status: string;
  created_at: string;
};
