/** Max direct multipart upload; larger files use presigned PUT. */
export const DOCUMENT_SERVER_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

/** Max allowed document file size (Phase 1). */
export const DOCUMENT_MAX_BYTES = 50 * 1024 * 1024;

export const SYSTEM_DOCUMENT_TYPE_CODES = [
  "CONTRACT",
  "PROPOSAL",
  "PURCHASE_ORDER",
  "INVOICE",
  "COMPANY_POLICY",
  "CERTIFICATE",
  "LICENCE",
  "INSURANCE",
  "NDA",
  "SLA",
  "EMPLOYEE_DOCUMENT",
  "TECHNICAL_DOCUMENT",
  "PROJECT_DOCUMENT",
  "SUPPLIER_DOCUMENT",
  "CUSTOMER_DOCUMENT",
  "TENDER_DOCUMENT",
  "REPORT",
  "OTHER",
] as const;
