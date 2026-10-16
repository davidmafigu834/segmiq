/**
 * Property acquisition decisions. Opportunities are not listings.
 * Inspections are not buyer viewings. A mandate type is not legal title.
 */

import { isAgencyManager, sameOrganisation } from "@/lib/real-estate/deal-access";

export const ACQUISITION_STAGES = [
  "new_opportunity",
  "owner_contacted",
  "owner_interested",
  "inspection_scheduled",
  "inspection_completed",
  "pricing_discussion",
  "mandate_negotiation",
  "mandate_secured",
  "listing_preparation",
  "submitted_for_approval",
] as const;

export type AcquisitionStage = (typeof ACQUISITION_STAGES)[number];

export const ACQUISITION_STATUSES = [
  "active",
  "on_hold",
  "nurturing",
  "not_interested",
  "lost",
  "converted",
] as const;

export type AcquisitionStatus = (typeof ACQUISITION_STATUSES)[number];

export const ACQUISITION_SOURCES = [
  "referral",
  "whatsapp",
  "phone",
  "walk_in",
  "facebook",
  "website",
  "agent_prospecting",
  "other",
] as const;

export type AcquisitionSource = (typeof ACQUISITION_SOURCES)[number];

export const ACQUISITION_INTENTS = ["sale", "rent", "unknown"] as const;
export type AcquisitionIntent = (typeof ACQUISITION_INTENTS)[number];

export const INSPECTION_STATUSES = [
  "draft",
  "scheduled",
  "confirmed",
  "rescheduled",
  "cancelled",
  "in_progress",
  "completed",
  "incomplete",
] as const;

export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

export const PRICE_TYPES = [
  "owner_asking",
  "informal_estimate",
  "professional_valuation",
  "proposed_listing",
  "agreed_marketing",
] as const;

export type PriceType = (typeof PRICE_TYPES)[number];

export const MANDATE_TYPES = ["sole", "joint", "open"] as const;
export type MandateType = (typeof MANDATE_TYPES)[number];

export const MANDATE_STATUSES = [
  "draft",
  "awaiting_evidence",
  "submitted",
  "approved",
  "rejected",
  "expired",
  "revoked",
  "superseded",
  "legacy_unverified",
] as const;

export type MandateStatus = (typeof MANDATE_STATUSES)[number];

export const STAGE_LABEL: Record<AcquisitionStage, string> = {
  new_opportunity: "New opportunity",
  owner_contacted: "Owner contacted",
  owner_interested: "Owner interested",
  inspection_scheduled: "Inspection scheduled",
  inspection_completed: "Inspection completed",
  pricing_discussion: "Pricing discussion",
  mandate_negotiation: "Mandate negotiation",
  mandate_secured: "Mandate secured",
  listing_preparation: "Listing preparation",
  submitted_for_approval: "Submitted for listing approval",
};

export const SOURCE_LABEL: Record<AcquisitionSource, string> = {
  referral: "Referral",
  whatsapp: "WhatsApp",
  phone: "Phone call",
  walk_in: "Walk-in",
  facebook: "Facebook",
  website: "Website",
  agent_prospecting: "Agent prospecting",
  other: "Other",
};

const EVIDENCE_STAGES = new Set<AcquisitionStage>([
  "inspection_scheduled",
  "inspection_completed",
  "mandate_secured",
  "listing_preparation",
  "submitted_for_approval",
]);

export function canAccessAcquisition(opts: {
  role: string | null | undefined;
  userId: string;
  userClientId: string | null | undefined;
  resourceClientId: string;
  assignedAgentId?: string | null;
  sourcedByAgentId?: string | null;
}): boolean {
  if (opts.role === "SUPER_ADMIN") return true;
  if (!sameOrganisation(opts.userClientId, opts.resourceClientId)) return false;
  if (isAgencyManager(opts.role)) return true;
  if (opts.role !== "SALESPERSON") return false;
  return opts.assignedAgentId === opts.userId || opts.sourcedByAgentId === opts.userId;
}

export function canReviewMandate(opts: {
  role: string | null | undefined;
  userId: string;
  userClientId: string | null | undefined;
  resourceClientId: string;
}): boolean {
  if (!sameOrganisation(opts.userClientId, opts.resourceClientId) && opts.role !== "SUPER_ADMIN") {
    return false;
  }
  return isAgencyManager(opts.role);
}

export type StageEvidence = {
  hasScheduledInspection: boolean;
  hasCompletedInspection: boolean;
  hasValidMandate: boolean;
  hasListing: boolean;
  listingApproval: string | null;
};

export function assertStageChange(nextStage: AcquisitionStage, evidence: StageEvidence): { ok: true } | { ok: false; error: string } {
  if (!EVIDENCE_STAGES.has(nextStage)) return { ok: true };
  if (nextStage === "inspection_scheduled" && !evidence.hasScheduledInspection && !evidence.hasCompletedInspection) {
    return { ok: false, error: "Schedule an inspection before moving to Inspection scheduled." };
  }
  if (nextStage === "inspection_completed" && !evidence.hasCompletedInspection) {
    return { ok: false, error: "Complete an inspection before moving to Inspection completed." };
  }
  if (nextStage === "mandate_secured" && !evidence.hasValidMandate) {
    return {
      ok: false,
      error: "Mandate secured needs an approved mandate that has not expired. Recording the stage does not create one.",
    };
  }
  if (nextStage === "listing_preparation" && !evidence.hasListing) {
    return { ok: false, error: "Prepare a listing draft before moving to Listing preparation." };
  }
  if (nextStage === "submitted_for_approval") {
    const approval = evidence.listingApproval;
    if (!evidence.hasListing || (approval !== "pending_approval" && approval !== "approved")) {
      return { ok: false, error: "Submit the listing draft for approval before using this stage." };
    }
  }
  return { ok: true };
}

export function effectiveMandateStatus(input: {
  status: string;
  expiryDate: string | null;
  revocationEffectiveDate?: string | null;
  now?: Date;
}): string {
  if (input.status !== "approved") return input.status;
  const now = input.now ?? new Date();
  if (input.revocationEffectiveDate) {
    const effective = new Date(`${input.revocationEffectiveDate}T00:00:00.000Z`);
    if (effective.getTime() <= now.getTime()) return "revoked";
  }
  if (!input.expiryDate) return "approved";
  const expiry = new Date(`${input.expiryDate}T23:59:59.999Z`);
  if (expiry.getTime() < now.getTime()) return "expired";
  const soon = now.getTime() + 30 * 24 * 60 * 60 * 1000;
  if (expiry.getTime() <= soon) return "expiring_soon";
  return "approved";
}

export function isMandateCurrentlyValid(input: {
  status: string;
  expiryDate: string | null;
  revocationEffectiveDate?: string | null;
  now?: Date;
}): boolean {
  const status = effectiveMandateStatus(input);
  return status === "approved" || status === "expiring_soon";
}

function isIsoDate(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

/** A renewal is a new mandate linked to the previous one. Nothing renews automatically. */
export function mandateRenewalError(input: {
  previousStatus: string;
  previousSupersededById: string | null;
  previousRevocationEffectiveDate?: string | null;
  startDate: string | null | undefined;
  expiryDate: string | null | undefined;
  hasEvidence: boolean;
  submit: boolean;
}): string | null {
  if (input.previousSupersededById) return "This mandate has already been renewed or replaced.";
  if (input.previousRevocationEffectiveDate) return "A revoked mandate cannot be renewed. Record a new mandate instead.";
  if (input.previousStatus !== "approved" && input.previousStatus !== "expired") {
    return "Only an approved or expired mandate can be renewed.";
  }
  if (!isIsoDate(input.startDate) || !isIsoDate(input.expiryDate)) return "Enter the renewal start and expiry dates.";
  if (input.expiryDate <= input.startDate) return "The expiry date must be after the start date.";
  if (input.submit && !input.hasEvidence) return "Attach the signed renewal before submitting it for review.";
  return null;
}

export function mandateRevocationError(input: {
  status: string;
  alreadyRevoked: boolean;
  reason: string | null | undefined;
  effectiveDate: string | null | undefined;
  startDate: string | null;
}): string | null {
  if (input.alreadyRevoked) return "This mandate is already revoked.";
  if (input.status !== "approved" && input.status !== "submitted") return "Only an approved or submitted mandate can be revoked.";
  if (!input.reason?.trim()) return "Record why the mandate was revoked.";
  if (!isIsoDate(input.effectiveDate)) return "Enter the date the revocation takes effect.";
  if (input.startDate && input.effectiveDate < input.startDate) return "The revocation cannot take effect before the mandate started.";
  return null;
}

/** Approving a mandate must not leave two approved mandates on one listing. */
export function mandateApprovalConflict(input: {
  previousMandateId: string | null;
  otherApprovedIds: string[];
}): string | null {
  const unlinked = input.otherApprovedIds.filter((id) => id !== input.previousMandateId);
  if (unlinked.length) return "Another approved mandate covers this listing. Record this one as its renewal, or revoke the other first.";
  return null;
}

/** A professional valuation needs a document or a verification reference. */
export function valuationEvidenceError(input: {
  priceType: string;
  documentId: string | null | undefined;
  verificationReference: string | null | undefined;
}): string | null {
  if (input.priceType !== "professional_valuation") return null;
  if (input.documentId || input.verificationReference?.trim()) return null;
  return "Attach the valuation report or enter the valuer's reference.";
}

export function canRecordProfessionalValuation(role: string | null | undefined): boolean {
  return isAgencyManager(role);
}

export function quickOpportunityReady(input: {
  contactId?: string | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  suburb?: string | null;
  city?: string | null;
  address?: string | null;
  locationNotes?: string | null;
}): { ok: true } | { ok: false; error: string } {
  const hasPerson = Boolean(input.contactId || input.ownerName?.trim() || input.ownerPhone?.trim());
  const hasPlace = Boolean(
    input.suburb?.trim() || input.city?.trim() || input.address?.trim() || input.locationNotes?.trim()
  );
  if (!hasPerson) return { ok: false, error: "Add an owner name, phone, or existing contact." };
  if (!hasPlace) return { ok: false, error: "Add a suburb, city, address, or location note." };
  return { ok: true };
}

export function conversionDecision(input: {
  existingListingId: string | null;
  hasValidMandate: boolean;
  managerOverride: boolean;
}): { ok: true; alreadyConverted: boolean } | { ok: false; error: string } {
  if (input.existingListingId) return { ok: true, alreadyConverted: true };
  if (!input.hasValidMandate && !input.managerOverride) {
    return {
      ok: false,
      error: "An approved mandate is required before preparing a listing. A manager can record an explicit exception.",
    };
  }
  return { ok: true, alreadyConverted: false };
}

export function listingBecomesMatchable(input: {
  approvalStatus: string | null;
  listingStatus: string | null;
}): boolean {
  return input.approvalStatus === "approved" && (input.listingStatus === "available" || input.listingStatus === "reserved");
}

function significantPhoneDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "").replace(/^0+/, "");
}

export function duplicateContactCandidates<T extends { id: string; phone: string | null; name: string | null }>(
  existing: T[],
  phone: string | null | undefined,
  name: string | null | undefined
): T[] {
  const needlePhone = significantPhoneDigits(phone);
  const needleName = (name ?? "").trim().toLowerCase();
  return existing.filter((row) => {
    const rowPhone = significantPhoneDigits(row.phone);
    if (
      needlePhone.length >= 7 &&
      rowPhone.length >= 7 &&
      (rowPhone.endsWith(needlePhone) || needlePhone.endsWith(rowPhone))
    ) {
      return true;
    }
    if (needleName && (row.name ?? "").trim().toLowerCase() === needleName) return true;
    return false;
  });
}

export function acquisitionSummary(rows: Array<{
  status: string;
  stage: string;
  nextActionAt: string | null;
  mandateStatus: string | null;
  mandateExpiry: string | null;
  inspectionStatus: string | null;
  inspectionAt: string | null;
  listingApproval: string | null;
}>, now = new Date()) {
  const active = rows.filter((row) => row.status === "active" || row.status === "nurturing");
  return {
    active: active.length,
    inspectionsUpcoming: rows.filter((row) =>
      (row.inspectionStatus === "scheduled" || row.inspectionStatus === "confirmed" || row.inspectionStatus === "rescheduled") &&
      row.inspectionAt != null &&
      new Date(row.inspectionAt).getTime() >= now.getTime()
    ).length,
    mandatesPending: rows.filter((row) => row.mandateStatus === "submitted" || row.mandateStatus === "awaiting_evidence").length,
    listingsAwaitingApproval: rows.filter((row) => row.listingApproval === "pending_approval").length,
    overdueFollowUps: rows.filter((row) => {
      if (row.status === "lost" || row.status === "converted" || row.status === "not_interested") return false;
      if (!row.nextActionAt) return false;
      return new Date(row.nextActionAt).getTime() < now.getTime();
    }).length,
  };
}
