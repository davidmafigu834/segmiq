import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { viewingCalendarEventId } from "../lib/real-estate/viewing-calendar";
import { propertyWorkLinks } from "../lib/real-estate/property-register";
import {
  canCloseTransaction,
  draftListingResolution,
  lawyerDocumentAccess,
  offerAcceptGate,
  offerExpiryInstant,
  offerRevisionAfterTermChange,
  outstandingClosureChecks,
  profileRevealAllowed,
  secureLinkAccess,
  transactionStartRecovery,
  viewingAcknowledgementCopy,
  viewingBookingKey,
  viewingTimeDecision,
  claimViewingSubmission,
  issuanceTemplateDecision,
  SYNTHETIC_VIEWING_TEMPLATE,
  SYNTHETIC_OFFER_TEMPLATE,
  WORKFLOW_TEMPLATE_DECISION,
} from "../lib/real-estate/workflow/journey";

const NOW = Date.parse("2026-11-06T12:00:00.000Z");

test("mandate approval reuses one draft and keeps a failed draft recoverable", () => {
  const first = draftListingResolution({
    opportunityId: "opp-1",
    opportunityListingId: null,
    listingOpportunityId: null,
    prepared: { ok: true, listingId: "listing-1" },
  });
  const retry = draftListingResolution({
    opportunityId: "opp-1",
    opportunityListingId: "listing-1",
    listingOpportunityId: "opp-1",
    prepared: { ok: false, error: "duplicate" },
  });
  const manual = draftListingResolution({
    opportunityId: "opp-9",
    opportunityListingId: "listing-9",
    listingOpportunityId: "opp-9",
    prepared: null,
  });
  const failed = draftListingResolution({
    opportunityId: "opp-2",
    opportunityListingId: null,
    listingOpportunityId: null,
    prepared: { ok: false, error: "storage failed" },
  });
  assert.equal(first.ok && first.listingId, "listing-1");
  assert.equal(retry.ok && retry.listingId, "listing-1");
  assert.equal(retry.ok && retry.reused, true);
  assert.equal(manual.ok && manual.listingId, "listing-9");
  assert.equal(failed.ok, false);
  if (!failed.ok) assert.equal(failed.recoverable, true);
});

test("a viewing link books one authorised time and keeps a request distinct", () => {
  const slot = "2026-11-07T08:00:00.000Z";
  assert.equal(viewingTimeDecision({ requestedAt: slot, authorisedSlots: [slot], availabilityOk: true }).outcome, "book");
  assert.equal(viewingTimeDecision({ requestedAt: slot, authorisedSlots: [slot], availabilityOk: false }).outcome, "unavailable");
  assert.equal(viewingTimeDecision({ requestedAt: "2026-11-08T08:00:00.000Z", authorisedSlots: [slot], availabilityOk: true }).outcome, "request");
  assert.equal(viewingBookingKey("link-1", slot), viewingBookingKey("link-1", slot));
  assert.equal(viewingCalendarEventId("view-1"), "viewing:view-1");
  assert.match(viewingAcknowledgementCopy(true), /confirmed/i);
  assert.match(viewingAcknowledgementCopy(false), /not a confirmed booking/i);
  assert.equal(profileRevealAllowed({ recipientVerified: false, contactMatched: true }), false);
  assert.equal(profileRevealAllowed({ recipientVerified: true, contactMatched: false }), true);
});

test("offer revisions expire on the boundary and a failed transaction start stays visible", () => {
  const signedAt = "2026-11-06T10:00:00.000Z";
  const expiry = offerExpiryInstant(signedAt, null);
  assert.equal(expiry, "2026-11-13T10:00:00.000Z");
  assert.equal(offerExpiryInstant(signedAt, 3), "2026-11-09T10:00:00.000Z");
  const open = offerAcceptGate({
    issuance: "seller_link",
    actor: "seller_link",
    revisionStatus: "buyer_signed",
    expiresAt: expiry,
    nowMs: Date.parse(expiry) - 1,
  });
  const closed = offerAcceptGate({
    issuance: "seller_link",
    actor: "seller_link",
    revisionStatus: "buyer_signed",
    expiresAt: expiry,
    nowMs: Date.parse(expiry),
  });
  assert.equal(open.ok, true);
  assert.equal(closed.ok, false);
  assert.equal(offerAcceptGate({
    issuance: "seller_link",
    actor: "staff",
    revisionStatus: "buyer_signed",
    expiresAt: expiry,
    nowMs: NOW,
  }).ok, false);
  assert.equal(offerAcceptGate({
    issuance: "manual",
    actor: "staff",
    revisionStatus: "buyer_signed",
    expiresAt: expiry,
    nowMs: NOW,
  }).ok, true);
  assert.equal(offerAcceptGate({
    issuance: "seller_link",
    actor: "seller_link",
    revisionStatus: "superseded",
    expiresAt: expiry,
    nowMs: NOW,
  }).ok, false);
  const revised = offerRevisionAfterTermChange({ revision: "2", termsChanged: true });
  assert.equal(revised.revision, "3");
  assert.equal(revised.requiresBuyerSignature, true);
  assert.deepEqual(transactionStartRecovery({ ok: false, error: "insert failed" }), { state: "recovery", error: "insert failed" });
  assert.deepEqual(transactionStartRecovery(null), { state: "recovery", error: "The transaction did not start. Retry acceptance to finish it." });
  assert.deepEqual(transactionStartRecovery({ ok: true }), { state: "started" });
});

test("sold stays blocked until the required checks pass and a lawyer loses access when revoked", () => {
  assert.equal(canCloseTransaction("SALESPERSON"), false);
  assert.equal(canCloseTransaction("CLIENT_MANAGER"), true);
  const blocked = outstandingClosureChecks({
    transactionType: "sale",
    milestones: [
      { key: "agreement_signed", status: "done" },
      { key: "conveyancing_complete", status: "pending" },
      { key: "keys_handed_over", status: "done" },
    ],
    evidence: [{ label: "Rates clearance", state: "uploaded" }],
  });
  assert.ok(blocked.includes("conveyancing_complete"));
  assert.ok(blocked.some((item) => item.includes("not verified")));
  const ready = outstandingClosureChecks({
    transactionType: "sale",
    milestones: [
      { key: "agreement_signed", status: "done" },
      { key: "conveyancing_complete", status: "done" },
      { key: "keys_handed_over", status: "skipped" },
    ],
    evidence: [{ label: "Rates clearance", state: "verified" }],
  });
  assert.deepEqual(ready, []);
  const link = {
    clientId: "org-1",
    purpose: "lawyer_invitation" as const,
    recordId: "txn-1",
    revision: "1",
    recipientId: "lawyer-1",
    expiresAt: "2026-12-01T00:00:00.000Z",
    revokedAt: null,
  };
  assert.equal(secureLinkAccess({ link, clientId: "org-2", purpose: link.purpose, recordId: link.recordId, revision: "1", recipientId: "lawyer-1", nowMs: NOW }).ok, false);
  assert.equal(secureLinkAccess({ link: { ...link, revokedAt: "2026-11-06T00:00:00.000Z" }, clientId: "org-1", purpose: link.purpose, recordId: link.recordId, revision: "1", recipientId: "lawyer-1", nowMs: NOW }).ok, false);
  const shared = lawyerDocumentAccess({
    clientId: "org-1",
    transactionId: "txn-1",
    documentId: "pdf-1",
    sharedDocumentIds: ["pdf-1"],
    invitationClientId: "org-1",
    invitationTransactionId: "txn-1",
    recipientId: "lawyer-1",
    actorRecipientId: "lawyer-1",
    expiresAt: link.expiresAt,
    revokedAt: null,
    nowMs: NOW,
  });
  assert.equal(shared.ok, true);
  const revoked = lawyerDocumentAccess({ ...{
    clientId: "org-1",
    transactionId: "txn-1",
    documentId: "pdf-1",
    sharedDocumentIds: ["pdf-1"],
    invitationClientId: "org-1",
    invitationTransactionId: "txn-1",
    recipientId: "lawyer-1",
    actorRecipientId: "lawyer-1",
    expiresAt: link.expiresAt,
    revokedAt: "2026-11-06T00:00:00.000Z",
    nowMs: NOW,
  } });
  assert.equal(revoked.ok, false);
  const links = propertyWorkLinks({
    surface: "client",
    listingId: "listing-1",
    opportunityId: "opp-1",
    sellerContactId: "seller-1",
    buyerSearchId: "buyer-1",
    viewingId: "view-1",
    offerId: "offer-1",
    transactionId: "txn-1",
  });
  assert.ok(links.some((item) => item.href === "/client/viewings?viewing=view-1"));
  assert.ok(links.some((item) => item.href === "/client/transactions/txn-1"));
  assert.ok(links.some((item) => item.href === "/client/buyers/buyer-1"));
  assert.ok(links.some((item) => item.label === "Seller"));
  assert.match(WORKFLOW_TEMPLATE_DECISION, /viewing acknowledgement/);
});

test("one viewing link confirms one appointment and a clash stays a request", () => {
  const first = claimViewingSubmission({
    linkId: "link-1",
    existingViewingId: null,
    requestedAt: "2026-11-10T09:00:00.000Z",
    authorisedSlots: ["2026-11-10T09:00:00.000Z", "2026-11-10T11:00:00.000Z"],
    availabilityOk: true,
  });
  const otherSlot = claimViewingSubmission({
    linkId: "link-1",
    existingViewingId: null,
    requestedAt: "2026-11-10T11:00:00.000Z",
    authorisedSlots: ["2026-11-10T09:00:00.000Z", "2026-11-10T11:00:00.000Z"],
    availabilityOk: true,
  });
  assert.equal(first.outcome, "book");
  assert.equal(otherSlot.outcome, "book");
  assert.equal(first.idempotencyKey, otherSlot.idempotencyKey);
  assert.equal(first.idempotencyKey, "viewing-link:link-1:confirmed");
  const replay = claimViewingSubmission({
    linkId: "link-1",
    existingViewingId: "view-1",
    requestedAt: "2026-11-10T09:00:00.000Z",
    authorisedSlots: ["2026-11-10T09:00:00.000Z"],
    availabilityOk: true,
  });
  assert.equal(replay.outcome, "existing");
  assert.equal(replay.viewingId, "view-1");
  const clash = claimViewingSubmission({
    linkId: "link-2",
    existingViewingId: null,
    requestedAt: "2026-11-10T09:00:00.000Z",
    authorisedSlots: ["2026-11-10T09:00:00.000Z"],
    availabilityOk: false,
  });
  assert.equal(clash.outcome, "unavailable");
  const live = issuanceTemplateDecision({ templateKey: SYNTHETIC_VIEWING_TEMPLATE, approvedAgencyTemplate: false, syntheticIssuanceEnabled: false });
  const practice = issuanceTemplateDecision({ templateKey: SYNTHETIC_OFFER_TEMPLATE, approvedAgencyTemplate: false, syntheticIssuanceEnabled: true });
  assert.equal(live.ok, false);
  assert.equal(practice.ok, true);
  const waived = outstandingClosureChecks({
    transactionType: "sale",
    milestones: [
      { key: "agreement_signed", status: "done" },
      { key: "conveyancing_complete", status: "done" },
      { key: "keys_handed_over", status: "done" },
    ],
    evidence: [{ label: "Rates clearance", state: "waived" }],
  });
  assert.ok(waived.some((item) => /exception/.test(item)));
  const excepted = outstandingClosureChecks({
    transactionType: "sale",
    milestones: [
      { key: "agreement_signed", status: "done" },
      { key: "conveyancing_complete", status: "done" },
      { key: "keys_handed_over", status: "done" },
    ],
    evidence: [{ label: "Rates clearance", state: "waived", exceptionRecorded: true }],
  });
  assert.deepEqual(excepted, []);
});

test("journey routes call the saved rules", () => {
  const viewing = readFileSync(new URL("../app/api/clients/[clientId]/workflow/viewing-links/route.ts", import.meta.url), "utf8");
  const offers = readFileSync(new URL("../app/api/public/journey/[token]/route.ts", import.meta.url), "utf8");
  const lawyer = readFileSync(new URL("../app/api/clients/[clientId]/transactions/[transactionId]/lawyer/route.ts", import.meta.url), "utf8");
  assert.match(viewing, /issueViewingLink/);
  assert.match(offers, /submitViewingLink/);
  assert.match(offers, /sellerOfferDecision/);
  assert.match(lawyer, /createDocumentInvitation/);
  assert.match(lawyer, /lawyerDocumentAccess/);
});
