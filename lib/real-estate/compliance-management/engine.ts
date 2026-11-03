/**
 * Deterministic compliance rules for SegmiQ Real Estate.
 * Templates are reviewable starting points. They are not a determination of Zimbabwean law
 * and are not enforced until an organisation activates a reviewed policy.
 * No model provider is called from this module.
 */

import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";

export const COMPLIANCE_CONTEXTS = ["buyer", "seller", "property", "transaction"] as const;
export type ComplianceContext = (typeof COMPLIANCE_CONTEXTS)[number];

export const REQUIREMENT_STATES = [
  "not_started",
  "awaiting_information",
  "submitted",
  "under_review",
  "more_information_required",
  "verified",
  "rejected",
  "waived",
  "not_applicable",
] as const;
export type RequirementState = (typeof REQUIREMENT_STATES)[number];

export const READINESS_STATES = [
  "not_started",
  "incomplete",
  "under_review",
  "action_required",
  "approved",
  "escalated",
] as const;
export type ReadinessState = (typeof READINESS_STATES)[number];

export const LEGAL_ROUTES = ["title_deed", "cession", "other"] as const;
export type LegalRoute = (typeof LEGAL_ROUTES)[number];

export const PAYMENT_EVIDENCE_STATES = [
  "reported",
  "proof_uploaded",
  "under_verification",
  "independently_confirmed",
  "disputed",
  "rejected",
] as const;
export type PaymentEvidenceState = (typeof PAYMENT_EVIDENCE_STATES)[number];

export const LEGAL_TRANSFER_STATES = [
  "not_started",
  "in_progress",
  "clearance_outstanding",
  "lodged",
  "registered",
  "not_applicable",
] as const;
export type LegalTransferState = (typeof LEGAL_TRANSFER_STATES)[number];

export const COMMERCIAL_STAGES = [
  "pending_compliance",
  "in_progress",
  "completed",
  "fallen_through",
  "cancelled",
  "draft",
] as const;

export const INVITATION_STATUSES = [
  "created",
  "sent",
  "opened",
  "in_progress",
  "submitted",
  "changes_requested",
  "expired",
  "revoked",
] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const TEMPLATE_DISCLAIMER =
  "Sample checklist for professional review. It is not an automatic statement of what Zimbabwean law requires for every customer, property or transaction.";

const REQUIREMENT_TRANSITIONS: Record<RequirementState, RequirementState[]> = {
  not_started: ["awaiting_information", "not_applicable"],
  awaiting_information: ["submitted", "not_applicable"],
  submitted: ["under_review", "more_information_required", "rejected", "verified"],
  under_review: ["verified", "more_information_required", "rejected", "waived"],
  more_information_required: ["submitted", "awaiting_information"],
  verified: ["more_information_required"],
  rejected: ["submitted", "awaiting_information"],
  waived: [],
  not_applicable: ["awaiting_information"],
};

export function canTransitionRequirement(from: RequirementState, to: RequirementState): boolean {
  if (from === to) return true;
  return REQUIREMENT_TRANSITIONS[from].includes(to);
}

export type RequirementDecision = "verify" | "request_changes" | "reject" | "waive" | "start_review" | "mark_not_applicable";

const DECISION_TARGET: Record<RequirementDecision, RequirementState> = {
  verify: "verified",
  request_changes: "more_information_required",
  reject: "rejected",
  waive: "waived",
  start_review: "under_review",
  mark_not_applicable: "not_applicable",
};

export function decisionTarget(decision: RequirementDecision): RequirementState {
  return DECISION_TARGET[decision];
}

export type CapabilityActor = {
  userId: string;
  role: string | null | undefined;
  permissions: ReadonlySet<string>;
  canReviewFlag: boolean;
  restrictReviewToFlaggedUsers: boolean;
};

export type ComplianceCapabilities = {
  viewSummary: boolean;
  collect: boolean;
  invite: boolean;
  review: boolean;
  approveEvidence: boolean;
  requestCorrection: boolean;
  managePolicy: boolean;
  assignReviewer: boolean;
  viewEscalation: boolean;
  recordFinance: boolean;
  recordConveyancing: boolean;
  viewAudit: boolean;
};

export function complianceCapabilities(actor: CapabilityActor): ComplianceCapabilities {
  const has = (permission: string) => actor.permissions.has(permission);
  const reviewerBase = actor.role === "CLIENT_MANAGER" && has("compliance.review") && (!actor.restrictReviewToFlaggedUsers || actor.canReviewFlag);
  const salesperson = actor.role === "SALESPERSON";
  return {
    viewSummary: has("compliance.read"),
    collect: has("compliance.read") && (actor.role === "CLIENT_MANAGER" || salesperson),
    invite: has("compliance.invite") && (actor.role === "CLIENT_MANAGER" || salesperson),
    review: reviewerBase,
    approveEvidence: reviewerBase,
    requestCorrection: reviewerBase,
    managePolicy: actor.role === "CLIENT_MANAGER" && has("compliance.policy"),
    assignReviewer: actor.role === "CLIENT_MANAGER" && has("compliance.review"),
    viewEscalation: reviewerBase && has("compliance.escalate"),
    recordFinance: actor.role === "CLIENT_MANAGER" && has("compliance.finance"),
    recordConveyancing: actor.role === "CLIENT_MANAGER" && has("compliance.conveyancing"),
    viewAudit: has("compliance.audit") || reviewerBase,
  };
}

export function independentReviewer(actorId: string, caseRow: { createdBy?: string | null; buyerAgentId?: string | null; submittedBy?: string | null }): boolean {
  return actorId !== caseRow.createdBy && actorId !== caseRow.buyerAgentId && actorId !== caseRow.submittedBy;
}

export type RequirementSnapshot = {
  key: string;
  state: RequirementState;
  mandatory: boolean;
};

export function deriveReadiness(input: {
  caseStatus: string | null | undefined;
  requirements: RequirementSnapshot[];
}): ReadinessState {
  if (input.caseStatus === "edd_required" || input.caseStatus === "restricted") return "escalated";
  const rows = input.requirements;
  if (rows.length === 0 || rows.every((row) => row.state === "not_started")) return "not_started";
  const mandatory = rows.filter((row) => row.mandatory);
  if (mandatory.some((row) => row.state === "rejected" || row.state === "more_information_required")) return "action_required";
  const satisfied = (row: RequirementSnapshot) => row.state === "verified" || row.state === "waived" || row.state === "not_applicable";
  if (input.caseStatus === "approved" && mandatory.every(satisfied)) return "approved";
  if (rows.some((row) => row.state === "submitted" || row.state === "under_review") || input.caseStatus === "under_review" || input.caseStatus === "ready_for_review") {
    return "under_review";
  }
  return "incomplete";
}

export type AppliesWhen = {
  customerType?: "individual" | "company";
  transactionTypes?: string[];
  legalRoutes?: LegalRoute[];
  riskLevels?: Array<"low" | "medium" | "high">;
};

export type RequirementTemplate = {
  key: string;
  label: string;
  context: ComplianceContext;
  templateKey: string;
  applies: AppliesWhen;
  mandatoryFor: string[];
  evidence: "field" | "document" | "party" | "milestone" | "payment";
  waiverPermitted: boolean;
  fieldKeys?: string[];
  documentType?: string;
  help: string;
};

export type PolicyTemplate = {
  key: string;
  label: string;
  context: ComplianceContext;
  disclaimer: string;
  requirements: RequirementTemplate[];
};

const field = (partial: Omit<RequirementTemplate, "evidence" | "waiverPermitted"> & { waiverPermitted?: boolean }): RequirementTemplate => ({
  evidence: "field",
  waiverPermitted: false,
  ...partial,
});

const doc = (partial: Omit<RequirementTemplate, "evidence"> & { evidence?: "document" }): RequirementTemplate => ({
  evidence: "document",
  ...partial,
});

function individualIdentity(templateKey: string, context: ComplianceContext): RequirementTemplate[] {
  return [
    field({ key: "legal_name", label: "Full legal name", context, templateKey, applies: { customerType: "individual" }, mandatoryFor: ["review"], fieldKeys: ["legal_name"], help: "The name on the identity document." }),
    field({ key: "date_of_birth", label: "Date of birth", context, templateKey, applies: { customerType: "individual" }, mandatoryFor: ["review"], fieldKeys: ["date_of_birth"], help: "Required for an individual identity record when this policy is enforced." }),
    field({ key: "nationality", label: "Nationality", context, templateKey, applies: { customerType: "individual" }, mandatoryFor: ["review"], fieldKeys: ["nationality"], help: "Nationality as stated by the customer." }),
    field({ key: "identity_document", label: "Identity document details", context, templateKey, applies: { customerType: "individual" }, mandatoryFor: ["review"], fieldKeys: ["identification_type", "identification_reference"], help: "Type and reference. Do not treat the number alone as verified identity." }),
    doc({ key: "identity_document_copy", label: "Identity document copy", context, templateKey, applies: { customerType: "individual" }, mandatoryFor: ["review"], waiverPermitted: false, documentType: "identification", help: "A copy is submitted evidence. It is not verified until a reviewer accepts it." }),
    field({ key: "residential_address", label: "Residential address", context, templateKey, applies: { customerType: "individual" }, mandatoryFor: ["review"], fieldKeys: ["residential_address"], help: "Current residential address." }),
    doc({ key: "address_evidence", label: "Address evidence", context, templateKey, applies: { customerType: "individual" }, mandatoryFor: [], waiverPermitted: true, documentType: "proof_of_address", help: "Collect when the active policy marks address evidence as required for the risk." }),
    field({ key: "acting_for_another", label: "Acting for another person", context, templateKey, applies: { customerType: "individual" }, mandatoryFor: ["review"], fieldKeys: ["acting_for_another"], help: "Whether the customer is acting for someone else." }),
    field({ key: "source_of_funds", label: "Source of funds", context, templateKey, applies: { customerType: "individual" }, mandatoryFor: ["review"], fieldKeys: ["source_of_funds_status"], help: "How the customer will fund the transaction. A description is not confirmation of funds." }),
  ];
}

function companyIdentity(templateKey: string, context: ComplianceContext): RequirementTemplate[] {
  return [
    field({ key: "registered_name", label: "Registered legal name", context, templateKey, applies: { customerType: "company" }, mandatoryFor: ["review"], fieldKeys: ["registered_name"], help: "Name on the registration record." }),
    field({ key: "registration_number", label: "Registration particulars", context, templateKey, applies: { customerType: "company" }, mandatoryFor: ["review"], fieldKeys: ["registration_number", "jurisdiction"], help: "Registration number and jurisdiction." }),
    field({ key: "registered_address", label: "Registered address", context, templateKey, applies: { customerType: "company" }, mandatoryFor: ["review"], fieldKeys: ["registered_address"], help: "Registered office address." }),
    doc({ key: "company_registration", label: "Registration evidence", context, templateKey, applies: { customerType: "company" }, mandatoryFor: ["review"], waiverPermitted: false, documentType: "company_registration", help: "Registration evidence for the legal entity." }),
    { key: "directors", label: "Directors", context, templateKey, applies: { customerType: "company" }, mandatoryFor: ["review"], evidence: "party", waiverPermitted: false, help: "At least one director when this policy is enforced." },
    { key: "beneficial_owners", label: "Beneficial owners", context, templateKey, applies: { customerType: "company" }, mandatoryFor: ["review"], evidence: "party", waiverPermitted: false, help: "Controlling persons are recorded as separate parties, not one text field." },
    doc({ key: "representative_authority", label: "Signing authority", context, templateKey, applies: { customerType: "company" }, mandatoryFor: ["review"], waiverPermitted: false, documentType: "authorised_representative_id", help: "Evidence that the representative may act." }),
  ];
}

export const POLICY_TEMPLATES: PolicyTemplate[] = [
  { key: "individual_purchaser", label: "Individual purchaser", context: "buyer", disclaimer: TEMPLATE_DISCLAIMER, requirements: individualIdentity("individual_purchaser", "buyer") },
  { key: "company_purchaser", label: "Company purchaser", context: "buyer", disclaimer: TEMPLATE_DISCLAIMER, requirements: companyIdentity("company_purchaser", "buyer") },
  { key: "individual_seller", label: "Individual seller", context: "seller", disclaimer: TEMPLATE_DISCLAIMER, requirements: individualIdentity("individual_seller", "seller") },
  { key: "company_seller", label: "Company seller", context: "seller", disclaimer: TEMPLATE_DISCLAIMER, requirements: companyIdentity("company_seller", "seller") },
  {
    key: "listing_readiness",
    label: "Property listing readiness",
    context: "property",
    disclaimer: TEMPLATE_DISCLAIMER,
    requirements: [
      doc({ key: "seller_authority", label: "Authority to market", context: "property", templateKey: "listing_readiness", applies: {}, mandatoryFor: ["listing_publication"], waiverPermitted: false, documentType: "seller_authority", help: "Authority for this property. It is not the seller's whole identity file." }),
      doc({ key: "marketing_mandate", label: "Agency marketing mandate", context: "property", templateKey: "listing_readiness", applies: {}, mandatoryFor: ["listing_publication"], waiverPermitted: false, documentType: "marketing_mandate", help: "Signed mandate for this listing." }),
      doc({ key: "ownership_evidence", label: "Ownership or rights evidence", context: "property", templateKey: "listing_readiness", applies: {}, mandatoryFor: ["listing_publication"], waiverPermitted: false, documentType: "ownership_documents", help: "Evidence appropriate to the legal route. A title deed is not assumed for every property." }),
      doc({ key: "title_deed_copy", label: "Title deed copy", context: "property", templateKey: "listing_readiness", applies: { legalRoutes: ["title_deed"] }, mandatoryFor: ["listing_publication"], waiverPermitted: false, documentType: "title_deed", help: "Applies to the title-deed route only." }),
      doc({ key: "cession_rights", label: "Cession or rights evidence", context: "property", templateKey: "listing_readiness", applies: { legalRoutes: ["cession"] }, mandatoryFor: ["listing_publication"], waiverPermitted: false, documentType: "cession_rights", help: "Applies to a cession or transfer-of-rights route." }),
    ],
  },
  {
    key: "residential_sale",
    label: "Residential sale",
    context: "transaction",
    disclaimer: TEMPLATE_DISCLAIMER,
    requirements: [
      doc({ key: "agreement_of_sale", label: "Agreement of sale", context: "transaction", templateKey: "residential_sale", applies: { transactionTypes: ["sale", "new_development"] }, mandatoryFor: ["review"], waiverPermitted: false, documentType: "agreement_of_sale", help: "An uploaded agreement is not proof that every required party has signed." }),
      field({ key: "conditions", label: "Conditions recorded", context: "transaction", templateKey: "residential_sale", applies: { transactionTypes: ["sale", "new_development"] }, mandatoryFor: [], waiverPermitted: true, fieldKeys: ["conditions_note"], help: "Conditions stay visible until a reviewer accepts them." }),
    ],
  },
  {
    key: "title_deed_transfer",
    label: "Title-deed transfer",
    context: "transaction",
    disclaimer: TEMPLATE_DISCLAIMER,
    requirements: [
      { key: "conveyancer_instructed", label: "Conveyancer instructed", context: "transaction", templateKey: "title_deed_transfer", applies: { legalRoutes: ["title_deed"] }, mandatoryFor: ["legal_registration"], evidence: "milestone", waiverPermitted: false, help: "Recorded by authorised staff. Instruction is not registration." },
      { key: "rates_clearance", label: "Rates clearance", context: "transaction", templateKey: "title_deed_transfer", applies: { legalRoutes: ["title_deed"] }, mandatoryFor: ["legal_registration"], evidence: "document", waiverPermitted: false, documentType: "rates_clearance", help: "Include only when this route applies." },
      { key: "cgt_clearance", label: "Capital gains tax clearance", context: "transaction", templateKey: "title_deed_transfer", applies: { legalRoutes: ["title_deed"] }, mandatoryFor: ["legal_registration"], evidence: "document", waiverPermitted: true, documentType: "cgt_clearance", help: "A waiver needs an authorised reason. It is not a tax ruling." },
      { key: "deeds_lodged", label: "Deeds lodgement", context: "transaction", templateKey: "title_deed_transfer", applies: { legalRoutes: ["title_deed"] }, mandatoryFor: ["legal_registration"], evidence: "milestone", waiverPermitted: false, help: "Lodgement is not registration." },
      { key: "registration_confirmed", label: "Registration confirmed", context: "transaction", templateKey: "title_deed_transfer", applies: { legalRoutes: ["title_deed"] }, mandatoryFor: ["legal_registration"], evidence: "milestone", waiverPermitted: false, help: "Requires authorised confirmation and evidence." },
    ],
  },
  {
    key: "cession_transfer",
    label: "Cession or transfer of rights",
    context: "transaction",
    disclaimer: TEMPLATE_DISCLAIMER,
    requirements: [
      { key: "cession_submitted", label: "Cession submitted", context: "transaction", templateKey: "cession_transfer", applies: { legalRoutes: ["cession"] }, mandatoryFor: ["legal_registration"], evidence: "milestone", waiverPermitted: false, help: "Submission of a cession is not completion." },
      { key: "cession_confirmed", label: "Cession completion confirmed", context: "transaction", templateKey: "cession_transfer", applies: { legalRoutes: ["cession"] }, mandatoryFor: ["legal_registration"], evidence: "milestone", waiverPermitted: false, help: "Authorised confirmation for this route." },
    ],
  },
  {
    key: "transaction_completion",
    label: "Basic transaction completion",
    context: "transaction",
    disclaimer: TEMPLATE_DISCLAIMER,
    requirements: [
      { key: "payment_evidence", label: "Payment evidence", context: "transaction", templateKey: "transaction_completion", applies: {}, mandatoryFor: ["review"], evidence: "payment", waiverPermitted: false, help: "Proof uploaded is not independently confirmed payment." },
      { key: "handover_record", label: "Handover record", context: "transaction", templateKey: "transaction_completion", applies: {}, mandatoryFor: [], evidence: "milestone", waiverPermitted: true, help: "Possession handover does not create a completed title transfer." },
    ],
  },
];

export type RequirementDimensions = {
  customerType: "individual" | "company";
  transactionType?: string | null;
  legalRoute?: LegalRoute | null;
  riskLevel?: "unclassified" | "low" | "medium" | "high" | null;
};

export function requirementApplies(requirement: RequirementTemplate, dimensions: RequirementDimensions): boolean {
  const applies = requirement.applies;
  if (applies.customerType && applies.customerType !== dimensions.customerType) return false;
  if (applies.transactionTypes && dimensions.transactionType && !applies.transactionTypes.includes(dimensions.transactionType)) return false;
  if (applies.transactionTypes && !dimensions.transactionType) return false;
  if (applies.legalRoutes) {
    if (!dimensions.legalRoute || !applies.legalRoutes.includes(dimensions.legalRoute)) return false;
  }
  if (applies.riskLevels && dimensions.riskLevel && dimensions.riskLevel !== "unclassified" && !applies.riskLevels.includes(dimensions.riskLevel)) return false;
  return true;
}

export function instantiateTemplate(template: PolicyTemplate, dimensions: RequirementDimensions): RequirementTemplate[] {
  return template.requirements.filter((requirement) => requirementApplies(requirement, dimensions));
}

export function templateByKey(key: string): PolicyTemplate | undefined {
  return POLICY_TEMPLATES.find((template) => template.key === key);
}

export function defaultTemplateKey(context: ComplianceContext, customerType: "individual" | "company", legalRoute?: LegalRoute | null): string {
  if (context === "buyer") return customerType === "company" ? "company_purchaser" : "individual_purchaser";
  if (context === "seller") return customerType === "company" ? "company_seller" : "individual_seller";
  if (context === "property") return "listing_readiness";
  if (legalRoute === "cession") return "cession_transfer";
  if (legalRoute === "title_deed") return "title_deed_transfer";
  return "residential_sale";
}

export type UploadedEvidence = { present: boolean; state: RequirementState };

/** A file in a slot is submitted evidence. It does not verify the requirement. */
export function stateAfterUpload(current: RequirementState): RequirementState | null {
  if (current === "awaiting_information" || current === "not_started" || current === "more_information_required" || current === "rejected") return "submitted";
  if (current === "submitted" || current === "under_review") return current;
  return null;
}

export function filePresenceDoesNotVerify(state: RequirementState, filePresent: boolean): boolean {
  return filePresent && state !== "verified" && state !== "waived";
}

export function evaluateDecision(input: {
  decision: RequirementDecision;
  from: RequirementState;
  waiverPermitted: boolean;
  reason?: string | null;
  actorIsIndependent: boolean;
  actorMayReview: boolean;
}): { ok: true; to: RequirementState } | { ok: false; error: string } {
  if (!input.actorMayReview) return { ok: false, error: "You cannot review this requirement." };
  const to = decisionTarget(input.decision);
  if (!canTransitionRequirement(input.from, to)) return { ok: false, error: "That decision is not available from the current requirement state." };
  if ((input.decision === "verify" || input.decision === "waive" || input.decision === "reject") && !input.actorIsIndependent) {
    return { ok: false, error: "Independent review is required." };
  }
  if (input.decision === "waive") {
    if (!input.waiverPermitted) return { ok: false, error: "This requirement cannot be waived under the current policy." };
    if (!input.reason || input.reason.trim().length < 8) return { ok: false, error: "A waiver needs a recorded reason." };
  }
  if ((input.decision === "request_changes" || input.decision === "reject") && !input.reason?.trim()) {
    return { ok: false, error: "Record what needs to change." };
  }
  return { ok: true, to };
}

const PAYMENT_TRANSITIONS: Record<PaymentEvidenceState, PaymentEvidenceState[]> = {
  reported: ["proof_uploaded", "disputed"],
  proof_uploaded: ["under_verification", "rejected", "disputed"],
  under_verification: ["independently_confirmed", "rejected", "disputed"],
  independently_confirmed: ["disputed"],
  disputed: ["under_verification", "rejected"],
  rejected: ["proof_uploaded"],
};

export function canTransitionPayment(from: PaymentEvidenceState, to: PaymentEvidenceState): boolean {
  return from === to || PAYMENT_TRANSITIONS[from].includes(to);
}

/** Uploaded proof never becomes independently confirmed. */
export function paymentStateAfterProof(current: PaymentEvidenceState): PaymentEvidenceState | null {
  if (current === "reported" || current === "rejected") return "proof_uploaded";
  return null;
}

export function confirmPayment(input: { from: PaymentEvidenceState; actorMayRecordFinance: boolean }): { ok: true; to: "independently_confirmed" } | { ok: false; error: string } {
  if (!input.actorMayRecordFinance) return { ok: false, error: "Financial verification needs an authorised reviewer." };
  if (!canTransitionPayment(input.from, "independently_confirmed")) return { ok: false, error: "Payment cannot be confirmed from this state." };
  return { ok: true, to: "independently_confirmed" };
}

export function legalTransferAfterMilestone(input: {
  milestoneKey: string;
  milestoneDone: boolean;
  route: LegalRoute | null;
  current: LegalTransferState;
}): LegalTransferState {
  if (!input.milestoneDone) return input.current;
  if (input.milestoneKey === "keys_handed_over" || input.milestoneKey === "handover_record" || input.milestoneKey === "handover_authorised") return input.current;
  if (input.milestoneKey === "deeds_or_cession_lodged" || input.milestoneKey === "cession_submitted" || input.milestoneKey === "deeds_lodged") return "lodged";
  if (input.milestoneKey === "registration_confirmed" || input.milestoneKey === "cession_confirmed") return "registered";
  if (input.milestoneKey === "conveyancer_instructed" || input.milestoneKey === "conveyancing_started") {
    return input.current === "not_started" ? "in_progress" : input.current;
  }
  return input.current;
}

export function commercialStageDoesNotImplyTransfer(commercialStatus: string, legal: LegalTransferState): boolean {
  return commercialStatus === "completed" && legal !== "registered";
}

export type ReuseInput = {
  sameOrganisation: boolean;
  sourceStatus: string;
  sourceApprovedAt: string | null;
  validityDays: number;
  now: Date;
  policyAllowsReuse: boolean;
  materialUnchanged: boolean;
  sourceRisk: string;
  nextRisk: string;
};

export function verificationMayBeReused(input: ReuseInput): { allowed: boolean; reason: string } {
  if (!input.sameOrganisation) return { allowed: false, reason: "Verification belongs to another organisation." };
  if (!input.policyAllowsReuse) return { allowed: false, reason: "The active policy does not allow reuse." };
  if (input.sourceStatus !== "approved" || !input.sourceApprovedAt) return { allowed: false, reason: "Only an approved verification can be considered." };
  const approved = new Date(input.sourceApprovedAt).getTime();
  if (!Number.isFinite(approved) || approved + input.validityDays * 86400000 < input.now.getTime()) {
    return { allowed: false, reason: "The earlier verification is outside the policy validity period." };
  }
  if (!input.materialUnchanged) return { allowed: false, reason: "Material customer information has changed." };
  const rank: Record<string, number> = { unclassified: 0, low: 1, medium: 2, high: 3 };
  if ((rank[input.nextRisk] ?? 0) > (rank[input.sourceRisk] ?? 0)) {
    return { allowed: false, reason: "The new matter has a higher risk category." };
  }
  return { allowed: true, reason: "Policy permits a reference to the existing verification. Documents are not copied." };
}

export function hashSecret(value: string, pepper: string): string {
  return createHash("sha256").update(`${pepper}:${value}`).digest("hex");
}

export function secretsMatch(value: string, pepper: string, hash: string): boolean {
  const next = Buffer.from(hashSecret(value, pepper));
  const current = Buffer.from(hash);
  if (next.length !== current.length) return false;
  return timingSafeEqual(next, current);
}

export function newInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function newOtpCode(): string {
  return String(randomInt(0, 1000000)).padStart(6, "0");
}

export function invitationAccess(input: {
  status: InvitationStatus;
  expiresAt: string;
  now: Date;
  revoked: boolean;
}): { ok: true } | { ok: false; reason: "expired" | "revoked" | "closed" } {
  if (input.revoked || input.status === "revoked") return { ok: false, reason: "revoked" };
  if (new Date(input.expiresAt).getTime() <= input.now.getTime() || input.status === "expired") return { ok: false, reason: "expired" };
  if (input.status === "submitted") return { ok: false, reason: "closed" };
  return { ok: true };
}

export function otpAccess(input: { attempts: number; expiresAt: string; now: Date; verified: boolean }): { ok: true } | { ok: false; reason: "locked" | "expired" | "already_verified" } {
  if (input.verified) return { ok: false, reason: "already_verified" };
  if (input.attempts >= 5) return { ok: false, reason: "locked" };
  if (new Date(input.expiresAt).getTime() <= input.now.getTime()) return { ok: false, reason: "expired" };
  return { ok: true };
}

export function safeAuditSummary(action: string): string {
  const known: Record<string, string> = {
    INVITATION_CREATED: "A document request was created.",
    INVITATION_SENT: "A document request was sent.",
    INVITATION_SUBMITTED: "A customer submission was received.",
    INVITATION_REVOKED: "A document request was revoked.",
    REQUIREMENT_DECIDED: "A requirement decision was recorded.",
    ESCALATED: "A restricted review was recorded.",
    PAYMENT_EVIDENCE: "Payment evidence status changed.",
    LEGAL_MILESTONE: "A legal-transfer milestone was recorded.",
  };
  return known[action] ?? "Compliance activity was recorded.";
}

export function maskProfileForAgent(profile: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const source = profile ?? {};
  const hidden = new Set(["identification_reference", "source_of_funds_detail", "source_of_wealth_detail"]);
  const visible: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (hidden.has(key)) continue;
    visible[key] = value;
  }
  return visible;
}

export function agentStatusLabel(status: string, readiness: ReadinessState): string {
  if (status === "edd_required" || status === "restricted" || readiness === "escalated") return "Additional review required";
  if (status === "approved" || readiness === "approved") return "Approved";
  if (readiness === "action_required") return "More information required";
  if (readiness === "under_review") return "With compliance";
  if (readiness === "incomplete" || readiness === "not_started") return "Documents needed";
  return "In progress";
}

export function listingPublicationDecision(input: {
  enforcementActive: boolean;
  caseReadiness: ReadinessState | null;
}): "inactive" | "clear" | "blocked" {
  if (!input.enforcementActive) return "inactive";
  return input.caseReadiness === "approved" ? "clear" : "blocked";
}

export function nextActionLabel(input: { readiness: ReadinessState; missing: string[]; canReview: boolean }): string {
  if (input.readiness === "escalated") return input.canReview ? "Open the restricted review." : "Waiting on compliance.";
  if (input.readiness === "action_required") return input.missing[0] ? `Correct: ${input.missing[0]}` : "Correct the requested item.";
  if (input.readiness === "under_review") return input.canReview ? "Review the submission." : "Waiting on a reviewer.";
  if (input.readiness === "approved") return "No compliance action is outstanding.";
  if (input.missing[0]) return `Collect: ${input.missing[0]}`;
  return "Open the checklist.";
}

export const ALLOWED_PROFILE_KEYS = [
  "legal_name",
  "date_of_birth",
  "place_of_birth",
  "nationality",
  "identification_type",
  "identification_reference",
  "residential_address",
  "occupation",
  "acting_for_another",
  "representative_name",
  "transaction_purpose",
  "funding_method",
  "source_of_funds_status",
  "registered_name",
  "registration_number",
  "jurisdiction",
  "registered_address",
  "business_activity",
  "conditions_note",
] as const;

export function pickProfileFields(input: Record<string, unknown>, allowed: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of allowed) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) out[key] = value.trim().slice(0, 500);
  }
  return out;
}
