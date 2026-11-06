/**
 * Rules for the seller-mandate to Sold journey.
 * These functions do not read the database. Callers use the existing
 * intake, mandate, viewing, offer, and transaction services.
 *
 * Live public PDFs for a viewing acknowledgement or an offer still need
 * the agency's approved template and signing method. Until that template
 * is selected, these rules can be exercised with synthetic fixtures only.
 */

export const WORKFLOW_TEMPLATE_DECISION =
  "Select the agency-approved viewing acknowledgement template and offer-to-purchase template, including the signing method, before issuing either public link.";

export type SecureLinkScope = {
  clientId: string;
  purpose: "seller_mandate" | "viewing_acknowledgement" | "offer_buyer" | "offer_seller" | "lawyer_invitation";
  recordId: string;
  revision: string;
  recipientId: string | null;
  expiresAt: string;
  revokedAt: string | null;
};

export function secureLinkAccess(input: {
  link: SecureLinkScope;
  clientId: string;
  purpose: SecureLinkScope["purpose"];
  recordId: string;
  revision: string;
  recipientId: string | null;
  nowMs: number;
}): { ok: true } | { ok: false; error: string } {
  const link = input.link;
  if (link.clientId !== input.clientId || link.purpose !== input.purpose || link.recordId !== input.recordId || link.revision !== input.revision) {
    return { ok: false, error: "This link does not match the requested record." };
  }
  if (link.recipientId && link.recipientId !== input.recipientId) {
    return { ok: false, error: "This link is for a different recipient." };
  }
  if (link.revokedAt) return { ok: false, error: "This link has been revoked." };
  if (!(Date.parse(link.expiresAt) > input.nowMs)) return { ok: false, error: "This link has expired." };
  return { ok: true };
}

/** A contact match never opens a saved profile or its prefilled answers. */
export function profileRevealAllowed(input: { recipientVerified: boolean; contactMatched: boolean }): boolean {
  return input.recipientVerified;
}

export function draftListingResolution(input: {
  opportunityId: string;
  opportunityListingId: string | null;
  listingOpportunityId: string | null;
  prepared: { ok: true; listingId: string } | { ok: false; error: string } | null;
}): { ok: true; listingId: string; reused: boolean } | { ok: false; recoverable: true; error: string } {
  const mutual = Boolean(input.opportunityListingId && input.listingOpportunityId === input.opportunityId);
  if (mutual) return { ok: true, listingId: input.opportunityListingId as string, reused: true };
  if (!input.prepared) {
    return { ok: false, recoverable: true, error: "The draft listing was not created. Retry the approval." };
  }
  if (!input.prepared.ok) return { ok: false, recoverable: true, error: input.prepared.error };
  return { ok: true, listingId: input.prepared.listingId, reused: false };
}

export const SYNTHETIC_VIEWING_TEMPLATE = "synthetic-viewing-acknowledgement";
export const SYNTHETIC_OFFER_TEMPLATE = "synthetic-offer-to-purchase";

export function issuanceTemplateDecision(input: {
  templateKey: string;
  approvedAgencyTemplate: boolean;
  syntheticIssuanceEnabled: boolean;
}): { ok: true; synthetic: boolean } | { ok: false; error: string } {
  if (input.approvedAgencyTemplate) return { ok: true, synthetic: false };
  if (
    input.syntheticIssuanceEnabled &&
    (input.templateKey === SYNTHETIC_VIEWING_TEMPLATE || input.templateKey === SYNTHETIC_OFFER_TEMPLATE)
  ) {
    return { ok: true, synthetic: true };
  }
  return { ok: false, error: WORKFLOW_TEMPLATE_DECISION };
}

export function viewingBookingKey(linkId: string, slotIso: string): string {
  return `viewing-link:${linkId}:${slotIso}`;
}

export function viewingLinkBookingKey(linkId: string): string {
  return `viewing-link:${linkId}:confirmed`;
}

export function claimViewingSubmission(input: {
  linkId: string;
  existingViewingId: string | null;
  requestedAt: string;
  authorisedSlots: readonly string[];
  availabilityOk: boolean;
}): { outcome: "existing"; viewingId: string; copy: string } | { outcome: "book"; idempotencyKey: string; copy: string } | { outcome: "request"; idempotencyKey: string; copy: string } | { outcome: "unavailable"; copy: string } {
  if (input.existingViewingId) {
    return { outcome: "existing", viewingId: input.existingViewingId, copy: viewingAcknowledgementCopy(true) };
  }
  const decision = viewingTimeDecision(input);
  if (decision.outcome === "unavailable") {
    return { outcome: "unavailable", copy: "That time is no longer available. Ask the agency for another time." };
  }
  if (decision.outcome === "request") {
    return {
      outcome: "request",
      idempotencyKey: `${viewingBookingKey(input.linkId, input.requestedAt)}:request`,
      copy: viewingAcknowledgementCopy(false),
    };
  }
  return { outcome: "book", idempotencyKey: viewingLinkBookingKey(input.linkId), copy: viewingAcknowledgementCopy(true) };
}

export function viewingTimeDecision(input: {
  requestedAt: string;
  authorisedSlots: readonly string[];
  availabilityOk: boolean;
}): { outcome: "book" } | { outcome: "request" } | { outcome: "unavailable" } {
  const authorised = input.authorisedSlots.some((slot) => Date.parse(slot) === Date.parse(input.requestedAt));
  if (!authorised) return { outcome: "request" };
  if (!input.availabilityOk) return { outcome: "unavailable" };
  return { outcome: "book" };
}

export function viewingAcknowledgementCopy(booked: boolean): string {
  return booked
    ? "This time is confirmed. The appointment is on the agency calendar."
    : "This is a request. It is not a confirmed booking until the agency schedules it.";
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function offerExpiryInstant(signedAt: string, templateValidityDays: number | null): string {
  const days = templateValidityDays != null && templateValidityDays > 0 ? templateValidityDays : 7;
  return new Date(Date.parse(signedAt) + days * DAY_MS).toISOString();
}

export function offerAcceptGate(input: {
  issuance: "manual" | "seller_link";
  actor: "staff" | "seller_link";
  revisionStatus: "buyer_signed" | "superseded" | "revoked" | "accepted" | "declined";
  expiresAt: string;
  nowMs: number;
}): { ok: true } | { ok: false; error: string; status: 409 } {
  if (input.issuance === "seller_link" && input.actor !== "seller_link") {
    return { ok: false, status: 409, error: "The seller accepts this offer on the issued link." };
  }
  if (input.issuance === "manual" && input.actor === "seller_link") {
    return { ok: false, status: 409, error: "This offer is not open on a seller link." };
  }
  if (input.revisionStatus === "superseded" || input.revisionStatus === "revoked") {
    return { ok: false, status: 409, error: "This revision can no longer be accepted." };
  }
  if (!(Date.parse(input.expiresAt) > input.nowMs)) {
    return { ok: false, status: 409, error: "This offer has expired." };
  }
  return { ok: true };
}

export function offerRevisionAfterTermChange(input: { revision: string; termsChanged: boolean }): { revision: string; requiresBuyerSignature: boolean } {
  if (!input.termsChanged) return { revision: input.revision, requiresBuyerSignature: false };
  const next = String(Number(input.revision) + 1);
  return { revision: Number.isFinite(Number(next)) ? next : `${input.revision}-2`, requiresBuyerSignature: true };
}

export type ClosureMilestone = { key: string; status: string };
export type ClosureEvidence = { label: string; state: "missing" | "uploaded" | "verified" | "waived"; exceptionRecorded?: boolean };

const SALE_REQUIRED = ["agreement_signed", "conveyancing_complete", "keys_handed_over"];
const RENTAL_REQUIRED = ["agreement_signed", "keys_handed_over"];

export function canCloseTransaction(role: string | null | undefined): boolean {
  return role === "CLIENT_MANAGER" || role === "SUPER_ADMIN";
}

export function outstandingClosureChecks(input: {
  transactionType: string;
  milestones: readonly ClosureMilestone[];
  evidence: readonly ClosureEvidence[];
}): string[] {
  const required = input.transactionType === "rental" || input.transactionType === "property_management" ? RENTAL_REQUIRED : SALE_REQUIRED;
  const byKey = new Map(input.milestones.map((row) => [row.key, row.status]));
  const missing = required.filter((key) => {
    const status = byKey.get(key);
    return status !== "done" && status !== "skipped";
  });
  const evidence = input.evidence
    .filter((row) => row.state !== "verified" && !(row.state === "waived" && row.exceptionRecorded))
    .map((row) => `${row.label} (${row.state === "uploaded" ? "uploaded, not verified" : row.state === "waived" ? "skipped without a recorded exception" : "missing"})`);
  return [...missing, ...evidence];
}

export function lawyerDocumentAccess(input: {
  clientId: string;
  transactionId: string;
  documentId: string;
  sharedDocumentIds: readonly string[];
  invitationClientId: string;
  invitationTransactionId: string;
  recipientId: string;
  actorRecipientId: string | null;
  expiresAt: string;
  revokedAt: string | null;
  nowMs: number;
}): { ok: true } | { ok: false; error: string } {
  if (input.invitationClientId !== input.clientId || input.invitationTransactionId !== input.transactionId) {
    return { ok: false, error: "This invitation is for a different transaction." };
  }
  if (!input.actorRecipientId || input.actorRecipientId !== input.recipientId) {
    return { ok: false, error: "This invitation is for a different recipient." };
  }
  if (input.revokedAt || !(Date.parse(input.expiresAt) > input.nowMs)) {
    return { ok: false, error: "This invitation is no longer active." };
  }
  if (!input.sharedDocumentIds.includes(input.documentId)) {
    return { ok: false, error: "This document was not shared for the transaction." };
  }
  return { ok: true };
}

export function transactionStartRecovery(result: { ok: true } | { ok: false; error: string } | null): { state: "started" } | { state: "recovery"; error: string } {
  if (result?.ok) return { state: "started" };
  return { state: "recovery", error: result?.error ?? "The transaction did not start. Retry acceptance to finish it." };
}
