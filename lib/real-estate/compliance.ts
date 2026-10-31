/**
 * Real-estate CDD / compliance workflow.
 * SegmiQ records process and decisions. It does not determine legal sufficiency.
 * Trades quotations and deals are unchanged.
 */

export const COMPLIANCE_STATUSES = [
  "not_started",
  "in_progress",
  "awaiting_documents",
  "ready_for_review",
  "under_review",
  "more_information_required",
  "edd_required",
  "approved",
  "restricted",
  "rejected",
  "closed",
] as const;

export type ComplianceStatus = (typeof COMPLIANCE_STATUSES)[number];

export const COMPLIANCE_STATUS_LABEL: Record<ComplianceStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  awaiting_documents: "Awaiting documents",
  ready_for_review: "Ready for review",
  under_review: "Under review",
  more_information_required: "More information required",
  edd_required: "Enhanced review required",
  approved: "Approved",
  restricted: "Restricted",
  rejected: "Not approved",
  closed: "Closed",
};

/** Agent-facing copy — no internal rationale. */
export const COMPLIANCE_STATUS_AGENT_LABEL: Record<ComplianceStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  awaiting_documents: "Documents needed",
  ready_for_review: "With compliance",
  under_review: "With compliance",
  more_information_required: "More information required",
  edd_required: "Additional review required",
  approved: "Approved",
  restricted: "Compliance review required before this transaction can proceed",
  rejected: "Compliance review required before this transaction can proceed",
  closed: "Closed",
};

export const COMPLIANCE_ENTITY_TYPES = ["individual", "corporate"] as const;
export type ComplianceEntityType = (typeof COMPLIANCE_ENTITY_TYPES)[number];

export const COMPLIANCE_RISK_LEVELS = ["unclassified", "low", "medium", "high"] as const;
export type ComplianceRiskLevel = (typeof COMPLIANCE_RISK_LEVELS)[number];

export const COMPLIANCE_RISK_LABEL: Record<ComplianceRiskLevel, string> = {
  unclassified: "Unclassified",
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const COMPLIANCE_DOC_STATUSES = [
  "missing",
  "requested",
  "received",
  "under_review",
  "accepted",
  "rejected",
  "expired",
] as const;
export type ComplianceDocStatus = (typeof COMPLIANCE_DOC_STATUSES)[number];

export function detectComplianceFileType(bytes: Uint8Array): string | null {
  if (bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-") return "application/pdf";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp") {
    const brand = String.fromCharCode(...bytes.slice(8, 12)).toLowerCase();
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) return "image/heic";
  }
  return null;
}

export const COMPLIANCE_PARTY_TYPES = [
  "director",
  "beneficial_owner",
  "authorised_representative",
  "other",
] as const;
export type CompliancePartyType = (typeof COMPLIANCE_PARTY_TYPES)[number];

export const COMPLIANCE_EVENT_TYPES = [
  "CASE_CREATED",
  "INFORMATION_UPDATED",
  "DOCUMENT_UPLOADED",
  "DOCUMENT_ACCEPTED",
  "DOCUMENT_REJECTED",
  "DOCUMENT_REQUESTED",
  "DOCUMENT_ACCESSED",
  "PARTY_ADDED",
  "PARTY_REMOVED",
  "RISK_CHANGED",
  "SUBMITTED_FOR_REVIEW",
  "REVIEW_STARTED",
  "MORE_INFO_REQUESTED",
  "EDD_REQUIRED",
  "APPROVED",
  "RESTRICTED",
  "REJECTED",
  "CASE_REOPENED",
  "NOTE_ADDED",
] as const;
export type ComplianceEventType = (typeof COMPLIANCE_EVENT_TYPES)[number];

export const DEFAULT_INDIVIDUAL_DOC_TYPES = [
  "identification",
  "proof_of_address",
  "source_of_funds",
] as const;

/** Seller-side defaults for property sales (ownership + seller ID). */
export const DEFAULT_SELLER_DOC_TYPES = [
  "ownership_documents",
  "proof_of_ownership",
  "identity_seller",
] as const;

export const DEFAULT_CORPORATE_DOC_TYPES = [
  "company_registration",
  "registered_address",
  "director_identification",
  "beneficial_ownership",
  "authorised_representative_id",
] as const;

export const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  identification: "Identification document",
  proof_of_address: "Proof of address",
  source_of_funds: "Source of funds information",
  supporting: "Other supporting documentation",
  company_registration: "Company registration documents",
  registered_address: "Registered address evidence",
  director_identification: "Director identification",
  beneficial_ownership: "Beneficial ownership information",
  authorised_representative_id: "Authorised representative identification",
  transaction_support: "Supporting transaction documents",
  ownership_documents: "Ownership / title documents",
  proof_of_ownership: "Proof of ownership",
  identity_seller: "Seller identification",
};

export type ComplianceSettings = {
  require_cdd_after_accepted_offer: boolean;
  require_approval_before_progression: boolean;
  allow_agents_to_start_cdd: boolean;
  /** When true, only users with can_review_compliance may approve/review. */
  restrict_review_to_flagged_users: boolean;
  individual_required_docs: string[];
  corporate_required_docs: string[];
};

export const DEFAULT_COMPLIANCE_SETTINGS: ComplianceSettings = {
  require_cdd_after_accepted_offer: true,
  require_approval_before_progression: true,
  allow_agents_to_start_cdd: true,
  restrict_review_to_flagged_users: false,
  individual_required_docs: [...DEFAULT_INDIVIDUAL_DOC_TYPES],
  corporate_required_docs: [...DEFAULT_CORPORATE_DOC_TYPES],
};

/** Reject malformed persisted policy values instead of silently treating them as approval. */
export function isComplianceSettingsShapeValid(raw: unknown): boolean {
  if (raw == null) return true;
  if (typeof raw !== "object" || Array.isArray(raw)) return false;
  const o = raw as Record<string, unknown>;
  for (const key of [
    "require_cdd_after_accepted_offer",
    "require_approval_before_progression",
    "allow_agents_to_start_cdd",
    "restrict_review_to_flagged_users",
  ]) {
    if (o[key] !== undefined && typeof o[key] !== "boolean") return false;
  }
  for (const key of ["individual_required_docs", "corporate_required_docs"]) {
    if (o[key] !== undefined && (!Array.isArray(o[key]) || !(o[key] as unknown[]).every((v) => typeof v === "string" && v.trim().length > 0))) {
      return false;
    }
  }
  return true;
}

export function parseComplianceSettings(raw: unknown): ComplianceSettings {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    require_cdd_after_accepted_offer:
      typeof o.require_cdd_after_accepted_offer === "boolean"
        ? o.require_cdd_after_accepted_offer
        : DEFAULT_COMPLIANCE_SETTINGS.require_cdd_after_accepted_offer,
    require_approval_before_progression:
      typeof o.require_approval_before_progression === "boolean"
        ? o.require_approval_before_progression
        : DEFAULT_COMPLIANCE_SETTINGS.require_approval_before_progression,
    allow_agents_to_start_cdd:
      typeof o.allow_agents_to_start_cdd === "boolean"
        ? o.allow_agents_to_start_cdd
        : DEFAULT_COMPLIANCE_SETTINGS.allow_agents_to_start_cdd,
    restrict_review_to_flagged_users:
      typeof o.restrict_review_to_flagged_users === "boolean"
        ? o.restrict_review_to_flagged_users
        : DEFAULT_COMPLIANCE_SETTINGS.restrict_review_to_flagged_users,
    individual_required_docs: Array.isArray(o.individual_required_docs)
      ? o.individual_required_docs.filter((x): x is string => typeof x === "string")
      : [...DEFAULT_COMPLIANCE_SETTINGS.individual_required_docs],
    corporate_required_docs: Array.isArray(o.corporate_required_docs)
      ? o.corporate_required_docs.filter((x): x is string => typeof x === "string")
      : [...DEFAULT_COMPLIANCE_SETTINGS.corporate_required_docs],
  };
}

export function requiredDocsForEntity(
  entity: ComplianceEntityType,
  settings: ComplianceSettings
): string[] {
  return entity === "corporate" ? settings.corporate_required_docs : settings.individual_required_docs;
}

export function documentTypeLabel(type: string): string {
  return DOCUMENT_TYPE_LABEL[type] ?? type.replace(/_/g, " ");
}

export function isComplianceStatus(value: string | null | undefined): value is ComplianceStatus {
  return (COMPLIANCE_STATUSES as readonly string[]).includes(String(value ?? ""));
}

export function complianceStatusLabel(status: string | null | undefined, forAgent = false): string {
  if (!isComplianceStatus(status)) return "—";
  return forAgent ? COMPLIANCE_STATUS_AGENT_LABEL[status] : COMPLIANCE_STATUS_LABEL[status];
}

const COLLECTION: ComplianceStatus[] = [
  "not_started",
  "in_progress",
  "awaiting_documents",
  "more_information_required",
];
const REVIEW: ComplianceStatus[] = ["ready_for_review", "under_review", "edd_required"];

export function compliancePhase(status: ComplianceStatus): "collection" | "review" | "decision" {
  if (COLLECTION.includes(status)) return "collection";
  if (REVIEW.includes(status)) return "review";
  return "decision";
}

export type ComplianceActor = {
  role: string | null | undefined;
  userId: string;
  userClientId: string | null | undefined;
  canReviewCompliance?: boolean | null;
  /** Verified, time-bound Support Access; read-only and never a review authority. */
  supportAccess?: boolean;
  hasComplianceRead?: boolean;
  hasComplianceReview?: boolean;
};

export function canCollectCompliance(
  actor: ComplianceActor,
  settings: ComplianceSettings,
  opts: { caseClientId: string; buyerAgentId?: string | null }
): boolean {
  if (actor.userClientId !== opts.caseClientId) return false;
  if (!actor.hasComplianceRead) return false;
  if (actor.role === "CLIENT_MANAGER") return true;
  if (actor.role === "SALESPERSON") {
    if (!settings.allow_agents_to_start_cdd) return false;
    return !opts.buyerAgentId || opts.buyerAgentId === actor.userId;
  }
  return false;
}

export function canViewComplianceCase(
  actor: ComplianceActor,
  opts: { caseClientId: string; buyerAgentId?: string | null }
): boolean {
  if (actor.userClientId !== opts.caseClientId) return false;
  if (actor.role === "SUPER_ADMIN") return actor.supportAccess === true;
  if (!actor.hasComplianceRead) return false;
  if (actor.role === "CLIENT_MANAGER") return true;
  if (actor.role === "SALESPERSON") {
    return !opts.buyerAgentId || opts.buyerAgentId === actor.userId;
  }
  return false;
}

/** Review/approve/restrict/reject. Platform admin is not an LJP compliance officer. */
export function canReviewCompliance(actor: ComplianceActor, settings: ComplianceSettings): boolean {
  if (actor.role !== "CLIENT_MANAGER") return false;
  if (!actor.hasComplianceReview) return false;
  if (settings.restrict_review_to_flagged_users) return Boolean(actor.canReviewCompliance);
  return true;
}

export function canSeeInternalComplianceNotes(actor: ComplianceActor, settings: ComplianceSettings): boolean {
  return canReviewCompliance(actor, settings);
}

/** Only independently accepted, current evidence satisfies a verified-evidence checkpoint. */
export function docCountsAsComplete(
  status: string | null | undefined,
  expiryDate?: string | null,
  now = new Date()
): boolean {
  if (status !== "accepted") return false;
  if (!expiryDate) return true;
  const expiry = /^\d{4}-\d{2}-\d{2}$/.test(expiryDate)
    ? new Date(`${expiryDate}T23:59:59.999Z`)
    : new Date(expiryDate);
  return Number.isFinite(expiry.getTime()) && expiry.getTime() >= now.getTime();
}

export type CddProfile = {
  legal_name?: string | null;
  date_of_birth?: string | null;
  nationality?: string | null;
  identification_type?: string | null;
  identification_reference?: string | null;
  identification_expiry?: string | null;
  residential_address?: string | null;
  occupation?: string | null;
  source_of_funds_status?: string | null;
  source_of_wealth_status?: string | null;
  registered_name?: string | null;
  trading_name?: string | null;
  registration_number?: string | null;
  jurisdiction?: string | null;
  registered_address?: string | null;
};

export function profileComplete(
  entity: ComplianceEntityType,
  profile: CddProfile | null | undefined,
  partyCount: { directors: number; beneficialOwners: number }
): { complete: boolean; missing: string[] } {
  const p = profile ?? {};
  const missing: string[] = [];
  if (entity === "individual") {
    if (!String(p.legal_name ?? "").trim()) missing.push("Full legal name");
    if (!String(p.date_of_birth ?? "").trim()) missing.push("Date of birth");
    if (!String(p.nationality ?? "").trim()) missing.push("Nationality");
    if (!String(p.identification_type ?? "").trim()) missing.push("Identification type");
    if (!String(p.identification_reference ?? "").trim()) missing.push("Identification reference");
    if (!String(p.residential_address ?? "").trim()) missing.push("Residential address");
    if (!String(p.source_of_funds_status ?? "").trim()) missing.push("Source of funds status");
  } else {
    if (!String(p.registered_name ?? "").trim()) missing.push("Registered company name");
    if (!String(p.registration_number ?? "").trim()) missing.push("Company registration number");
    if (!String(p.jurisdiction ?? "").trim()) missing.push("Jurisdiction");
    if (!String(p.registered_address ?? "").trim()) missing.push("Registered address");
    if (partyCount.directors < 1) missing.push("At least one director");
    if (partyCount.beneficialOwners < 1) missing.push("At least one beneficial owner");
  }
  return { complete: missing.length === 0, missing };
}

export function checklistCompleteness(opts: {
  entity: ComplianceEntityType;
  settings: ComplianceSettings;
  profile: CddProfile | null | undefined;
  docs: Array<{ document_type: string; required: boolean; status: string; expiry_date?: string | null }>;
  partyCount: { directors: number; beneficialOwners: number };
}): {
  completed: number;
  required: number;
  readyForReview: boolean;
  items: Array<{ id: string; label: string; met: boolean }>;
} {
  const items: Array<{ id: string; label: string; met: boolean }> = [];
  const profile = profileComplete(opts.entity, opts.profile, opts.partyCount);
  items.push({
    id: "client_information",
    label: opts.entity === "corporate" ? "Company information" : "Client information",
    met: profile.complete,
  });
  const requiredTypes = requiredDocsForEntity(opts.entity, opts.settings);
  for (const type of requiredTypes) {
    const row = opts.docs.find((d) => d.document_type === type);
    items.push({
      id: type,
      label: documentTypeLabel(type),
      met: Boolean(row && docCountsAsComplete(row.status, row.expiry_date)),
    });
  }
  const required = items.length;
  const completed = items.filter((i) => i.met).length;
  return { completed, required, readyForReview: completed === required && required > 0, items };
}

export function riskChangeRequiresReason(
  from: ComplianceRiskLevel,
  to: ComplianceRiskLevel
): boolean {
  return to === "high" || from === "high";
}

const REVIEW_TRANSITIONS: Record<string, ComplianceStatus[]> = {
  not_started: ["in_progress", "awaiting_documents", "closed"],
  in_progress: ["awaiting_documents", "ready_for_review", "closed"],
  awaiting_documents: ["in_progress", "ready_for_review", "closed"],
  ready_for_review: ["under_review", "in_progress", "closed"],
  under_review: [
    "approved",
    "more_information_required",
    "edd_required",
    "restricted",
    "rejected",
  ],
  more_information_required: ["in_progress", "awaiting_documents", "ready_for_review", "under_review"],
  edd_required: ["under_review", "approved", "restricted", "rejected", "more_information_required"],
  approved: ["closed", "restricted"],
  restricted: ["under_review", "closed"],
  rejected: ["under_review", "closed"],
  closed: ["in_progress"],
};

export function canTransitionCompliance(from: ComplianceStatus, to: ComplianceStatus): boolean {
  if (from === to) return true;
  return (REVIEW_TRANSITIONS[from] ?? []).includes(to);
}

export type ComplianceCheckpoint =
  | "accepted_offer_progression"
  | "transaction_progression"
  | "transaction_completion"
  | "milestone_completion"
  | "listing_completion"
  | "lead_won";

export type ComplianceGateReason =
  | "CHECKPOINT_NOT_APPLICABLE"
  | "APPROVED"
  | "CASE_REQUIRED"
  | "CASE_PENDING"
  | "CASE_ON_HOLD"
  | "CASE_CONTEXT_INVALID"
  | "POLICY_INVALID";

export function complianceCaseMatchesContext(input: {
  caseClientId: string | null | undefined;
  caseContactId: string | null | undefined;
  caseOfferId: string | null | undefined;
  caseListingId: string | null | undefined;
  caseLeadId: string | null | undefined;
  clientId: string;
  contactId?: string | null;
  offerId?: string | null;
  listingId?: string | null;
  leadId?: string | null;
}): boolean {
  return input.caseClientId === input.clientId &&
    (!input.contactId || input.caseContactId === input.contactId) &&
    (!input.offerId || input.caseOfferId === input.offerId) &&
    (!input.listingId || input.caseListingId === input.listingId) &&
    (!input.leadId || input.caseLeadId === input.leadId);
}

export type ComplianceGateResult =
  | {
      ok: true;
      applicable: boolean;
      allowed: true;
      checkpoint: ComplianceCheckpoint;
      caseId: string | null;
      reason: "CHECKPOINT_NOT_APPLICABLE" | "APPROVED";
      requiresReview: false;
    }
  | {
      ok: false;
      applicable: true;
      allowed: false;
      checkpoint: ComplianceCheckpoint;
      caseId: string | null;
      reason: Exclude<ComplianceGateReason, "CHECKPOINT_NOT_APPLICABLE" | "APPROVED">;
      requiresReview: boolean;
      code: "COMPLIANCE_APPROVAL_REQUIRED" | "COMPLIANCE_HOLD" | "COMPLIANCE_POLICY_INVALID";
      message: string;
      status: string | null;
    };

export function evaluateComplianceGate(opts: {
  isRealEstate: boolean;
  settings: ComplianceSettings;
  /** True when an accepted offer exists for this listing/lead. */
  hasAcceptedOffer: boolean;
  caseStatus: ComplianceStatus | null;
  checkpoint?: ComplianceCheckpoint;
  caseId?: string | null;
  policyValid?: boolean;
  contextValid?: boolean;
}): ComplianceGateResult {
  const checkpoint = opts.checkpoint ?? "accepted_offer_progression";
  const caseId = opts.caseId ?? null;
  if (!opts.isRealEstate || !opts.settings.require_approval_before_progression || !opts.settings.require_cdd_after_accepted_offer) {
    return { ok: true, applicable: false, allowed: true, checkpoint, caseId: null, reason: "CHECKPOINT_NOT_APPLICABLE", requiresReview: false };
  }
  if (opts.policyValid === false) {
    return { ok: false, applicable: true, allowed: false, checkpoint, caseId: null, reason: "POLICY_INVALID", requiresReview: true, code: "COMPLIANCE_POLICY_INVALID", message: "Compliance policy could not be verified. Ask a manager to review the configuration.", status: null };
  }
  if (!opts.hasAcceptedOffer) {
    return { ok: true, applicable: false, allowed: true, checkpoint, caseId: null, reason: "CHECKPOINT_NOT_APPLICABLE", requiresReview: false };
  }
  if (opts.contextValid === false) {
    return { ok: false, applicable: true, allowed: false, checkpoint, caseId, reason: "CASE_CONTEXT_INVALID", requiresReview: true, code: "COMPLIANCE_APPROVAL_REQUIRED", message: "Compliance approval for this transaction could not be verified.", status: opts.caseStatus };
  }
  if (!opts.caseStatus) {
    return {
      ok: false,
      applicable: true,
      allowed: false,
      checkpoint,
      caseId: null,
      reason: "CASE_REQUIRED",
      requiresReview: true,
      code: "COMPLIANCE_APPROVAL_REQUIRED",
      message: "Compliance approval is required before this transaction can move forward.",
      status: null,
    };
  }
  if (opts.caseStatus === "approved") return { ok: true, applicable: true, allowed: true, checkpoint, caseId, reason: "APPROVED", requiresReview: false };
  if (opts.caseStatus === "restricted" || opts.caseStatus === "rejected") {
    return {
      ok: false,
      applicable: true,
      allowed: false,
      checkpoint,
      caseId,
      reason: "CASE_ON_HOLD",
      requiresReview: true,
      code: "COMPLIANCE_HOLD",
      message: "Compliance review required before this transaction can proceed.",
      status: opts.caseStatus,
    };
  }
  return {
    ok: false,
    applicable: true,
    allowed: false,
    checkpoint,
    caseId,
    reason: "CASE_PENDING",
    requiresReview: true,
    code: "COMPLIANCE_APPROVAL_REQUIRED",
    message: "Compliance approval is required before this transaction can move forward.",
    status: opts.caseStatus,
  };
}

export type ComplianceAttentionReason =
  | "ready_for_review"
  | "edd_required"
  | "awaiting_documents"
  | "more_information_required"
  | "restricted";

export function deriveComplianceAttention(
  status: ComplianceStatus
): { reason: ComplianceAttentionReason; why: string } | null {
  if (status === "ready_for_review") return { reason: "ready_for_review", why: "Ready for review" };
  if (status === "edd_required") return { reason: "edd_required", why: "Enhanced review required" };
  if (status === "awaiting_documents" || status === "in_progress" || status === "not_started") {
    return { reason: "awaiting_documents", why: "Awaiting documents" };
  }
  if (status === "more_information_required") {
    return { reason: "more_information_required", why: "More information required" };
  }
  if (status === "restricted") return { reason: "restricted", why: "Restricted" };
  return null;
}

/** Operational hold copy for managers — no internal rationale. */
export function operationalComplianceLabel(status: ComplianceStatus | null | undefined): string | null {
  if (!status || status === "closed") return null;
  if (status === "approved") return "Approved";
  if (status === "restricted" || status === "rejected") return "Compliance hold";
  return COMPLIANCE_STATUS_LABEL[status];
}

export function agentNextDocumentAction(
  docs: Array<{ document_type: string; required: boolean; status: string }>
): { type: string; label: string } | null {
  const next = docs.find((d) => d.required && !docCountsAsComplete(d.status) && d.status !== "rejected");
  const rejected = docs.find((d) => d.status === "rejected");
  const pick = rejected ?? next;
  if (!pick) return null;
  return { type: pick.document_type, label: `Upload ${documentTypeLabel(pick.document_type)}` };
}
