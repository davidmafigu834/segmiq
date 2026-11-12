/** Operational labels for the Zimbabwe sale-mandate check. Not a statement of law. */

export const TENURE_TYPES = ["title_deed", "council_cession", "developer_cession"] as const;
export type TenureType = (typeof TENURE_TYPES)[number];

export const DOCUMENT_TYPES = [
  "national_id",
  "title_deed",
  "cession_agreement",
  "agreement_of_sale",
  "rates_clearance",
  "utility_clearance",
  "power_of_attorney",
  "company_resolution",
  "subdivision_permit",
  "development_permit",
  "certificate_of_compliance",
  "survey_diagram",
  "selfie",
  "other",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const MARITAL_STATUSES = ["single", "married", "divorced", "widowed", "other"] as const;
export type MaritalStatus = (typeof MARITAL_STATUSES)[number];

export const SELLER_KINDS = ["individual", "company"] as const;
export type SellerKind = (typeof SELLER_KINDS)[number];

export const ACTING_CAPACITIES = ["owner", "representative"] as const;
export type ActingCapacity = (typeof ACTING_CAPACITIES)[number];

export const PROPERTY_TYPES = ["residential", "commercial", "land", "sectional", "other"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const CHECK_STATUSES = ["pass", "warning", "fail", "not_applicable"] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];

export const REPORT_STATUSES = ["pass", "conditional_pass", "fail"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const MANDATE_STATUSES = ["draft", "processing", "report_ready", "cleared", "rejected"] as const;
export type MandateStatus = (typeof MANDATE_STATUSES)[number];

export const TENURE_LABEL: Record<TenureType, string> = {
  title_deed: "Title deed",
  council_cession: "Local authority cession",
  developer_cession: "Developer cession",
};

export const DOCUMENT_LABEL: Record<DocumentType, string> = {
  national_id: "National ID",
  title_deed: "Title deed",
  cession_agreement: "Cession agreement",
  agreement_of_sale: "Agreement of sale",
  rates_clearance: "Rates clearance",
  utility_clearance: "Utility clearance",
  power_of_attorney: "Power of attorney",
  company_resolution: "Company resolution",
  subdivision_permit: "Subdivision permit",
  development_permit: "Development permit",
  certificate_of_compliance: "Certificate of compliance",
  survey_diagram: "Surveyor General diagram",
  selfie: "Selfie",
  other: "Other document",
};

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  pass: "Pass",
  conditional_pass: "Conditional pass",
  fail: "Fail",
};

export const CHECK_STATUS_LABEL: Record<CheckStatus, string> = {
  pass: "Pass",
  warning: "Needs attention",
  fail: "Fail",
  not_applicable: "Not applicable",
};

export type ExtractedFields = {
  fullName: string | null;
  otherNames: string[];
  idNumber: string | null;
  dateOfBirth: string | null;
  propertyDescription: string | null;
  standNumber: string | null;
  suburb: string | null;
  city: string | null;
  deedNumber: string | null;
  /** Agreement, cession, or permit number when the document is not a deed. */
  agreementNumber: string | null;
  localAuthority: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  developerName: string | null;
  permitNumber: string | null;
  /** Caveats, bonds, endorsements, or other restrictions printed on the page. */
  restrictions: string[];
};

export type DocumentExtraction = {
  documentType: DocumentType | "unknown";
  confidence: number;
  quality: "readable" | "poor" | "suspicious";
  qualityNotes: string;
  redFlags: string[];
  fields: ExtractedFields;
};

/** Clear can proceed. Review needs an agent. Fail should not be treated as the same person. */
export type IdentityDecision = "clear" | "review" | "fail";

export type IdentityOutcome = {
  provider: "smile_id" | "unconfigured";
  status: "verified" | "mismatch" | "inconclusive" | "not_configured" | "error";
  detail: string;
  reference: string | null;
  returnedName: string | null;
  /** Present on results from the identity service. Older rows only have status. */
  decision?: IdentityDecision;
  /** 0–100 when the provider scored the check. Null when it did not. */
  confidence?: number | null;
  documentChecked?: boolean;
  faceMatch?: "matched" | "unmatched" | "not_compared";
  liveness?: "passed" | "failed" | "not_captured";
  /** True while Smile ID has accepted the photos and has not returned a result. */
  pending?: boolean;
};

export type SellerInput = {
  fullName: string;
  idNumber: string;
  phone: string;
  email: string;
  maritalStatus: MaritalStatus;
  sellerKind: SellerKind;
  companyName: string;
  actingCapacity: ActingCapacity;
  representativeName: string;
};

export type PropertyInput = {
  address: string;
  standNumber: string;
  suburb: string;
  city: string;
  propertyType: PropertyType;
  tenureType: TenureType;
  askingPriceUsd: number | null;
  localAuthority: string;
};

export type DocumentInput = {
  id: string;
  declaredType: DocumentType;
  fileName: string;
  extracted: DocumentExtraction | null;
};

export type EvaluationInput = {
  seller: SellerInput;
  property: PropertyInput;
  documents: DocumentInput[];
  identity: IdentityOutcome | null;
};

export type DueDiligenceCheck = {
  code: string;
  label: string;
  status: CheckStatus;
  critical: boolean;
  /** Points removed from a starting score of 100 when this check fails or needs attention. */
  weight: number;
  detail: string;
  evidence: Record<string, unknown>;
};

export type ComparisonCell = {
  documentId: string;
  documentType: string;
  fileName: string;
  value: string;
};

export type ComparisonRow = {
  field: string;
  entered: string;
  documents: ComparisonCell[];
  consistent: boolean;
};

export type Evaluation = {
  checks: DueDiligenceCheck[];
  score: number;
  reasons: string[];
  status: ReportStatus;
  summary: string;
  recommendations: string[];
  missingDocuments: string[];
  comparison: ComparisonRow[];
  redFlags: string[];
  checklist: ChecklistItem[];
};

export type ChecklistItem = {
  code: string;
  label: string;
  status: "pass" | "fail" | "missing";
  detail: string;
};

/** Shown on every report. The engine assists the agent; it does not clear transfer. */
export const REPORT_LIMIT =
  "These checks help an agent decide whether a file is ready to market. They do not replace a conveyancer, the Deeds Registry, or the local authority.";
