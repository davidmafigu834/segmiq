import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  asPropertyCategories,
  categoryFit,
  isRejectionReset,
  listingCandidateFilter,
  notificationKey,
  notificationPlan,
  rejectedListingsForSearch,
  rejectionStillApplies,
  searchCandidateFilter,
  wantedCategories,
  type MatchPair,
} from "../lib/real-estate/buyer-match";
import {
  canSeeTransactionDocument,
  commissionActionBlocked,
  commissionActionPermitted,
  commissionTotals,
  cumulativePatch,
  decimalToCents,
  documentDecisionError,
  handoverDrift,
  initialAllocationLines,
  reportSaleOnce,
  statusAfterAction,
} from "../lib/real-estate/agency-operations";
import { isMissingFunctionError, parseAtomicError } from "../lib/real-estate/atomic-rpc";
import { chunk, readAllPages } from "../lib/real-estate/paging";
import {
  canChangeViewing,
  maskViewingContact,
  viewingAccess,
  viewingReminderDue,
  viewingTransitionError,
} from "../lib/real-estate/viewing-access";
import {
  effectiveMandateStatus,
  isMandateCurrentlyValid,
  mandateApprovalConflict,
  mandateRenewalError,
  mandateRevocationError,
  valuationEvidenceError,
} from "../lib/real-estate/acquisition-plan";
import {
  canOpenRegisterTransaction,
  registerIssues,
  registerMandateState,
} from "../lib/real-estate/listing-register-rules";
import { ledgerCommissionSummary } from "../lib/real-estate/operations-report";
import { reAgencyOperationsEnabled } from "../lib/real-estate/feature-flags";

describe("property categories", () => {
  it("only accepts exact category ids", () => {
    assert.deepEqual(asPropertyCategories(["House", "3 bed house", "residential stand", "house"]), ["house", "residential_stand"]);
  });

  it("separates confirmed, unknown and conflicting categories", () => {
    assert.equal(categoryFit([], "house"), "no_preference");
    assert.equal(categoryFit(["house"], "house"), "confirmed");
    assert.equal(categoryFit(["house"], null), "unknown");
    assert.equal(categoryFit(["house"], "commercial"), "conflict");
  });

  it("prefers explicit categories and only uses a legacy type that is an exact id", () => {
    assert.deepEqual(wantedCategories({ propertyCategories: ["apartment"], propertyType: "house" }), ["apartment"]);
    assert.deepEqual(wantedCategories({ propertyCategories: [], propertyType: "townhouse" }), ["townhouse"]);
    assert.deepEqual(wantedCategories({ propertyCategories: null, propertyType: "nice place" }), []);
  });

  it("keeps unknown price and unknown category in the candidate filter", () => {
    assert.equal(
      listingCandidateFilter({ budgetMax: 100000, allowAboveBudget: false, categories: ["house"] }),
      "and(price.is.null,property_category.is.null),and(price.is.null,property_category.in.(house)),and(price.lte.100000,property_category.is.null),and(price.lte.100000,property_category.in.(house))"
    );
    assert.equal(listingCandidateFilter({ budgetMax: 100000, allowAboveBudget: true, categories: [] }), null);
    assert.equal(listingCandidateFilter({ budgetMax: null, allowAboveBudget: false, categories: ["house"], includeCategory: false }), null);
    assert.equal(searchCandidateFilter(250000), "budget_max.is.null,budget_max.gte.250000,allow_above_budget.eq.true");
    assert.equal(searchCandidateFilter(null), null);
  });
});

describe("search-specific rejections", () => {
  const base = { rejectionReason: "location", rejectedFingerprint: "100000|harare|available" };

  it("applies a rejection in this search", () => {
    const rejected = rejectedListingsForSearch("s1", [{ searchId: "s1", listingId: "l1", state: "not_interested", ...base }]);
    assert.ok(rejected.has("l1"));
  });

  it("lets another search hold its own active record for the same listing", () => {
    const rejected = rejectedListingsForSearch("s2", [
      { searchId: "s1", listingId: "l1", state: "not_interested", ...base },
      { searchId: "s2", listingId: "l1", state: "interested" },
    ]);
    assert.equal(rejected.has("l1"), false);
  });

  it("lapses a price rejection only after the price drops", () => {
    const interest = { rejectionReason: "above_budget", rejectedFingerprint: "100000|harare|available" };
    assert.equal(rejectionStillApplies(interest, "100000|harare|available"), true);
    assert.equal(rejectionStillApplies(interest, "90000|harare|available"), false);
    assert.equal(rejectionStillApplies({ rejectionReason: "location", rejectedFingerprint: "100000|x|y" }, "1|x|y"), true);
  });

  it("treats a move away from not interested as a reset", () => {
    assert.equal(isRejectionReset("not_interested", "interested"), true);
    assert.equal(isRejectionReset("interested", "not_interested"), false);
  });
});

describe("match notifications", () => {
  const pair: MatchPair = { listingId: "l1", searchId: "s1", agentId: "a1", fingerprint: "1|x|available" };

  it("does not repeat a live notification and revives an invalidated one once", () => {
    assert.deepEqual(notificationPlan([pair, pair], []), { insert: [pair], revive: [] });
    assert.deepEqual(notificationPlan([pair], [{ key: notificationKey(pair), invalidated: false }]), { insert: [], revive: [] });
    assert.deepEqual(notificationPlan([pair], [{ key: notificationKey(pair), invalidated: true }]), { insert: [], revive: [pair] });
  });
});

describe("commission ledger rules", () => {
  it("counts one sale amount per transaction", () => {
    const report = reportSaleOnce([
      { transactionId: "t1", agreedCents: 18_000_000 },
      { transactionId: "t1", agreedCents: 18_000_000 },
      { transactionId: "t2", agreedCents: 5_000_000 },
    ]);
    assert.deepEqual(report, { transactions: 2, volumeCents: 23_000_000, duplicatesIgnored: 1 });
    assert.throws(() => reportSaleOnce([{ transactionId: "t3", agreedCents: 1.5 }]));
  });

  it("converts decimals to cents without float drift", () => {
    assert.equal(decimalToCents("180000.00"), 18_000_000);
    assert.equal(decimalToCents("0.105"), 11);
    assert.equal(decimalToCents(0.1 + 0.2), 30);
    assert.equal(decimalToCents("-12.344"), -1234);
    assert.equal(decimalToCents("abc"), null);
    assert.equal(decimalToCents(null), null);
  });

  it("keeps legacy amounts apart and never counts cancelled commission as projected", () => {
    const totals = commissionTotals(
      [
        { status: "earned", grossCents: 1000, earnedCents: 1000, invoicedCents: 0, reportedReceivedCents: 0, verifiedReceivedCents: 0 },
        { status: "cancelled", grossCents: 500, earnedCents: 0, invoicedCents: 0, reportedReceivedCents: 0, verifiedReceivedCents: 0 },
        { status: "unverified_legacy", grossCents: 700, earnedCents: 0, invoicedCents: 0, reportedReceivedCents: 0, verifiedReceivedCents: 0, provenance: "legacy_transaction_fields" },
      ],
      [
        { amountCents: 600, approvalStatus: "approved", payoutCents: 200 },
        { amountCents: 400, approvalStatus: "pending", payoutCents: 0 },
      ]
    );
    assert.equal(totals.projectedCents, 1000);
    assert.equal(totals.legacyUnverifiedCents, 700);
    assert.equal(totals.approvedCents, 600);
    assert.equal(totals.outstandingPayableCents, 400);
    assert.equal(totals.paidCents, 200);
  });

  it("never moves the headline status backwards and keeps a dispute until it is resolved", () => {
    assert.equal(statusAfterAction("allocation_approved", "report_receipt"), "allocation_approved");
    assert.equal(statusAfterAction("disputed", "earn"), "disputed");
    assert.equal(statusAfterAction("projected", "cancel"), "cancelled");
  });

  it("grows cumulative amounts and never lowers them", () => {
    const current = { earnedCents: 0, invoicedCents: 0, reportedReceivedCents: 300, verifiedReceivedCents: 0 };
    assert.deepEqual(cumulativePatch({ action: "report_receipt", grossCents: 1000, amountCents: 200, current, nowIso: "t" }), {
      reported_received_cents: 500,
      reported_received_at: "t",
    });
    assert.deepEqual(
      cumulativePatch({ action: "earn", grossCents: 1000, current: { ...current, earnedCents: 1200 }, nowIso: "t" }),
      { earned_cents: 1200, earned_at: "t" }
    );
  });

  it("limits finance actions and lets beneficiaries only report or dispute", () => {
    const agent = { role: "SALESPERSON", capabilities: [] as string[], isBeneficiary: true };
    assert.equal(commissionActionPermitted({ ...agent, action: "approve_allocations" }), false);
    assert.equal(commissionActionPermitted({ ...agent, action: "verify_receipt" }), false);
    assert.equal(commissionActionPermitted({ ...agent, action: "report_receipt" }), true);
    assert.equal(commissionActionPermitted({ ...agent, action: "dispute" }), true);
    assert.equal(commissionActionPermitted({ ...agent, isBeneficiary: false, action: "dispute" }), false);
    assert.equal(commissionActionPermitted({ role: "CLIENT_MANAGER", capabilities: [], isBeneficiary: false, action: "approve_allocations" }), true);
  });

  it("refuses to cancel a commission with a verified receipt or payout", () => {
    assert.match(commissionActionBlocked("verified_received", "cancel") ?? "", /cannot be cancelled/);
    assert.match(commissionActionBlocked("paid", "cancel") ?? "", /cannot be cancelled/);
    assert.match(commissionActionBlocked("disputed", "approve_allocations") ?? "", /Resolve the dispute/);
    assert.equal(commissionActionBlocked("earned", "invoice"), null);
  });

  it("has no default split", () => {
    assert.deepEqual(initialAllocationLines(null), []);
    assert.deepEqual(initialAllocationLines({ lines: [{ beneficiaryId: "u1", mode: "percent", basisPoints: 10000 }] }), [
      { beneficiaryId: "u1", mode: "percent", basisPoints: 10000 },
    ]);
  });
});

describe("report commission summary", () => {
  it("prefers a live ledger row, ignores cancelled rows and uses legacy fields only without a ledger row", () => {
    const summary = ledgerCommissionSummary(
      [
        { id: "t1", listing_agent_commission_amount: "100.00" },
        { id: "t1", listing_agent_commission_amount: "100.00" },
        { id: "t2", listing_agent_commission_amount: "50.00", selling_agent_commission_amount: "25.50" },
        { id: "t3" },
      ],
      [
        { transaction_id: "t1", gross_cents: 9000, status: "unverified_legacy", provenance: "legacy_transaction_fields" },
        { transaction_id: "t1", gross_cents: 12000, status: "verified_received", provenance: "agent", verified_received_cents: 12000 },
        { transaction_id: "t3", gross_cents: 4000, status: "cancelled", provenance: "agent" },
      ]
    );
    assert.equal(summary.grossCents, 12000 + 7550);
    assert.equal(summary.verifiedReceivedCents, 12000);
    assert.equal(summary.legacyUnverifiedCents, 7550);
    assert.equal(summary.transactionsWithoutCommission, 1);
    assert.equal(summary.ledgerAvailable, true);
  });
});

describe("transaction documents", () => {
  it("requires a reason to reject or request a replacement", () => {
    assert.ok(documentDecisionError("rejected", " "));
    assert.ok(documentDecisionError("replacement_requested", null));
    assert.equal(documentDecisionError("verified", null), null);
  });

  it("hides finance documents from participants without finance capability", () => {
    const participant = { isManager: false, capabilities: [] as string[], isParticipant: true, isUploader: false };
    assert.equal(canSeeTransactionDocument({ ...participant, visibility: "participants" }), true);
    assert.equal(canSeeTransactionDocument({ ...participant, visibility: "finance" }), false);
    assert.equal(canSeeTransactionDocument({ ...participant, visibility: "managers" }), false);
    assert.equal(canSeeTransactionDocument({ ...participant, capabilities: ["confirm_payment"], visibility: "finance" }), true);
    assert.equal(canSeeTransactionDocument({ ...participant, isParticipant: false, visibility: "participants" }), false);
  });
});

describe("handover drift", () => {
  it("reports records added or removed since the preview", () => {
    assert.deepEqual(handoverDrift(["listing:1", "viewing:2"], ["listing:1", "viewing:3"]), {
      added: ["viewing:3"],
      removed: ["viewing:2"],
      changed: true,
    });
    assert.equal(handoverDrift(["a"], ["a"]).changed, false);
  });
});

describe("atomic functions", () => {
  it("recognises a function that is not deployed", () => {
    assert.equal(isMissingFunctionError({ code: "PGRST202", message: "x" }), true);
    assert.equal(isMissingFunctionError({ message: "function public.re_accept_offer does not exist" }), true);
    assert.equal(isMissingFunctionError({ code: "23505", message: "duplicate" }), false);
  });

  it("maps business errors raised in SQL to HTTP statuses", () => {
    assert.deepEqual(parseAtomicError({ message: "RE409: Listing already reserved" }), { status: 409, error: "Listing already reserved" });
    assert.equal(parseAtomicError({ code: "23505", message: "dup" }).status, 409);
    assert.equal(parseAtomicError({ code: "40001", message: "serialization" }).status, 409);
    assert.equal(parseAtomicError({ message: "boom" }).status, 500);
  });
});

describe("paging", () => {
  it("reads every page and flags the ceiling instead of capping silently", async () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({ id: i }));
    const fetchPage = async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null });
    const all = await readAllPages(fetchPage, { pageSize: 10, ceiling: 100 });
    assert.equal(all.rows.length, 25);
    assert.equal(all.incomplete, false);
    const capped = await readAllPages(fetchPage, { pageSize: 10, ceiling: 20 });
    assert.equal(capped.rows.length, 20);
    assert.equal(capped.incomplete, true);
  });

  it("reports a failed page as incomplete with the error", async () => {
    const failed = await readAllPages(async () => ({ data: null, error: { message: "down" } }), { pageSize: 10 });
    assert.equal(failed.incomplete, true);
    assert.equal(failed.error?.message, "down");
  });

  it("chunks ids", () => {
    assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  });
});

describe("viewing access", () => {
  const base = { actorId: "a1", role: "SALESPERSON", viewingAgentId: null, searchAgentId: null, listingAgentId: null, isListingCollaborator: false };

  it("gives managers everything and agents only their own work", () => {
    assert.equal(viewingAccess({ ...base, role: "CLIENT_MANAGER" }), "full");
    assert.equal(viewingAccess({ ...base, viewingAgentId: "a1" }), "full");
    assert.equal(viewingAccess({ ...base, searchAgentId: "a1" }), "full");
    assert.equal(viewingAccess({ ...base, listingAgentId: "a1" }), "listing_only");
    assert.equal(viewingAccess({ ...base, isListingCollaborator: true }), "listing_only");
    assert.equal(viewingAccess({ ...base, viewingAgentId: "a2" }), "none");
  });

  it("limits listing-only access to feedback and reassignment to managers", () => {
    assert.equal(canChangeViewing("listing_only", "feedback", "SALESPERSON"), true);
    assert.equal(canChangeViewing("listing_only", "reschedule", "SALESPERSON"), false);
    assert.equal(canChangeViewing("full", "reassign", "SALESPERSON"), false);
    assert.equal(canChangeViewing("full", "reassign", "CLIENT_MANAGER"), true);
    assert.equal(canChangeViewing("none", "feedback", "CLIENT_MANAGER"), false);
  });

  it("closes completed and no-show viewings and only reschedules a cancelled one", () => {
    assert.ok(viewingTransitionError("completed", "scheduled"));
    assert.ok(viewingTransitionError("no_show", "completed"));
    assert.ok(viewingTransitionError("cancelled", "completed"));
    assert.equal(viewingTransitionError("cancelled", "scheduled"), null);
    assert.equal(viewingTransitionError("scheduled", "completed"), null);
  });

  it("masks the buyer for listing-only access", () => {
    const row = { id: "v1", contact: { id: "c1", name: "Tendai Moyo", phone: "+263771234567" } };
    assert.deepEqual(maskViewingContact(row, "listing_only").contact, { id: "c1", name: "Tendai M.", phone: null });
    assert.equal(maskViewingContact(row, "full").contact?.phone, "+263771234567");
  });

  it("sends one reminder per scheduled time", () => {
    const now = new Date("2026-10-16T08:00:00Z");
    const scheduledAt = "2026-10-16T09:00:00Z";
    assert.equal(viewingReminderDue({ status: "scheduled", scheduledAt, reminderSentFor: null, now, leadMinutes: 120 }), true);
    assert.equal(viewingReminderDue({ status: "scheduled", scheduledAt, reminderSentFor: scheduledAt, now, leadMinutes: 120 }), false);
    assert.equal(
      viewingReminderDue({ status: "scheduled", scheduledAt, reminderSentFor: "2026-10-15T09:00:00Z", now, leadMinutes: 120 }),
      true
    );
    assert.equal(viewingReminderDue({ status: "cancelled", scheduledAt, reminderSentFor: null, now, leadMinutes: 120 }), false);
  });
});

describe("mandates", () => {
  const now = new Date("2026-10-16T12:00:00Z");

  it("treats a revocation as effective from its date", () => {
    assert.equal(effectiveMandateStatus({ status: "approved", expiryDate: "2027-06-01", revocationEffectiveDate: "2026-10-16", now }), "revoked");
    assert.equal(effectiveMandateStatus({ status: "approved", expiryDate: "2027-06-01", revocationEffectiveDate: "2026-11-01", now }), "approved");
    assert.equal(isMandateCurrentlyValid({ status: "approved", expiryDate: "2026-11-01", now }), true);
    assert.equal(effectiveMandateStatus({ status: "approved", expiryDate: "2026-10-15", now }), "expired");
  });

  it("only renews an approved or expired mandate once, with dates and evidence to submit", () => {
    const ok = { previousStatus: "approved", previousSupersededById: null, startDate: "2026-11-01", expiryDate: "2027-11-01", hasEvidence: true, submit: true };
    assert.equal(mandateRenewalError(ok), null);
    assert.ok(mandateRenewalError({ ...ok, previousSupersededById: "m2" }));
    assert.ok(mandateRenewalError({ ...ok, previousRevocationEffectiveDate: "2026-10-01" }));
    assert.ok(mandateRenewalError({ ...ok, previousStatus: "draft" }));
    assert.ok(mandateRenewalError({ ...ok, expiryDate: "2026-10-01" }));
    assert.ok(mandateRenewalError({ ...ok, hasEvidence: false }));
    assert.equal(mandateRenewalError({ ...ok, hasEvidence: false, submit: false }), null);
  });

  it("requires a reason and a valid effective date to revoke", () => {
    const ok = { status: "approved", alreadyRevoked: false, reason: "Owner withdrew", effectiveDate: "2026-10-20", startDate: "2026-01-01" };
    assert.equal(mandateRevocationError(ok), null);
    assert.ok(mandateRevocationError({ ...ok, reason: " " }));
    assert.ok(mandateRevocationError({ ...ok, effectiveDate: "20/10/2026" }));
    assert.ok(mandateRevocationError({ ...ok, effectiveDate: "2025-12-01" }));
    assert.ok(mandateRevocationError({ ...ok, alreadyRevoked: true }));
  });

  it("allows approving a renewal of the only other approved mandate", () => {
    assert.equal(mandateApprovalConflict({ previousMandateId: "m1", otherApprovedIds: ["m1"] }), null);
    assert.ok(mandateApprovalConflict({ previousMandateId: "m1", otherApprovedIds: ["m1", "m9"] }));
    assert.ok(mandateApprovalConflict({ previousMandateId: null, otherApprovedIds: ["m9"] }));
  });

  it("requires evidence for a professional valuation", () => {
    assert.ok(valuationEvidenceError({ priceType: "professional_valuation", documentId: null, verificationReference: " " }));
    assert.equal(valuationEvidenceError({ priceType: "professional_valuation", documentId: null, verificationReference: "VAL-22" }), null);
    assert.equal(valuationEvidenceError({ priceType: "owner_expectation", documentId: null, verificationReference: null }), null);
  });
});

describe("property register", () => {
  const now = new Date("2026-10-16T12:00:00Z");

  it("derives the mandate state and never trusts legacy listing fields", () => {
    assert.equal(registerMandateState({ mandateStatus: "approved", mandateExpiry: "2027-06-01", now }), "approved");
    assert.equal(registerMandateState({ mandateStatus: "approved", mandateExpiry: "2026-11-01", now }), "expiring");
    assert.equal(registerMandateState({ mandateStatus: "approved", mandateExpiry: "2026-10-01", now }), "expired");
    assert.equal(registerMandateState({ mandateStatus: "submitted", mandateExpiry: null, now }), "awaiting");
    assert.equal(registerMandateState({ mandateStatus: null, mandateExpiry: null, legacyMandateType: "sole", now }), "legacy_unverified");
    assert.equal(registerMandateState({ mandateStatus: null, mandateExpiry: null, now }), "none");
  });

  it("lists issues for open stock only", () => {
    const issues = registerIssues({ status: "available", approvalStatus: "pending_approval", agentId: null, price: null, photoCount: 0, mandate: "expired" });
    assert.deepEqual(issues, ["pending_approval", "no_agent", "no_price", "no_photos", "mandate_expired"]);
    assert.deepEqual(registerIssues({ status: "sold", approvalStatus: "approved", agentId: null, price: null, photoCount: 0, mandate: "none" }), []);
  });

  it("only links the transaction for people on the deal", () => {
    assert.equal(canOpenRegisterTransaction({ isManager: false, actorId: "a1", listingAgentId: "a2", participantIds: [] }), false);
    assert.equal(canOpenRegisterTransaction({ isManager: false, actorId: "a1", listingAgentId: "a2", participantIds: ["a1"] }), true);
    assert.equal(canOpenRegisterTransaction({ isManager: true, actorId: "a1", listingAgentId: null, participantIds: [] }), true);
  });
});

describe("agency operations switch", () => {
  it("is on unless explicitly switched off", () => {
    assert.equal(reAgencyOperationsEnabled({}), true);
    assert.equal(reAgencyOperationsEnabled({ RE_AGENCY_OPERATIONS: "on" }), true);
    assert.equal(reAgencyOperationsEnabled({ RE_AGENCY_OPERATIONS: "off" }), false);
    assert.equal(reAgencyOperationsEnabled({ RE_AGENCY_OPERATIONS: "FALSE" }), false);
  });
});
