export const DOCUMENT_CLASSIFIER_VERSION = "segmiq-doc-classify-1";

export const CONFIDENCE_LEVELS = ["HIGH", "MEDIUM", "LOW"] as const;
export type ClassificationConfidence = (typeof CONFIDENCE_LEVELS)[number];

export type ClassificationTypeCode =
  | "CONTRACT"
  | "PROPOSAL"
  | "PURCHASE_ORDER"
  | "INVOICE"
  | "COMPANY_POLICY"
  | "CERTIFICATE"
  | "LICENCE"
  | "INSURANCE"
  | "NDA"
  | "SLA"
  | "EMPLOYEE_DOCUMENT"
  | "TECHNICAL_DOCUMENT"
  | "PROJECT_DOCUMENT"
  | "SUPPLIER_DOCUMENT"
  | "CUSTOMER_DOCUMENT"
  | "TENDER_DOCUMENT"
  | "REPORT"
  | "OTHER";

export type ClassificationResult = {
  documentTypeCode: ClassificationTypeCode;
  typeConfidence: ClassificationConfidence;
  suggestedCategoryName: string | null;
  categoryConfidence: ClassificationConfidence;
  tags: string[];
  lifecycleHint: "DRAFT" | "SIGNED" | "ACTIVE" | null;
  titleHint: string | null;
  reasoning: string | null;
};

export type CategoryMatchResult = {
  categoryId: string;
  categoryName: string;
  score: number;
  action: "REUSED" | "SUGGESTED" | "AUTO_CREATED" | "SKIPPED" | "NONE";
};
