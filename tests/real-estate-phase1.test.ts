import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateMatchReadiness } from "../lib/agent/real-estate/readiness";
import { canParticipateInDeal, canViewDealCommission } from "../lib/real-estate/deal-access";
import {
  legacySearchDivergence,
  omitExistingKeys,
  planContactRoles,
  planLegacyInterests,
  planLegacySearch,
} from "../lib/real-estate/foundation-plan";
import { aggregateOperationsReport } from "../lib/real-estate/operations-report";
import {
  assertManualListingStatusChange,
  decideOfferAcceptance,
  decideReservationRelease,
  decideTransactionCompletion,
} from "../lib/real-estate/listing-availability";
import { canWriteOffer } from "../lib/real-estate/offers";
import { isDemandSide, isSupplySide, isUnclassifiedDealSide } from "../lib/real-estate/requirements";

const contact = {
  clientId: "org-a",
  contactId: "person-1",
  buyerBudgetMin: 100000,
  buyerBudgetMax: 180000,
  buyerBedroomsWanted: 3,
  buyerAreaPreference: "Borrowdale",
  buyerTimeline: "this month",
  interestedListingIds: ["listing-1", "listing-1", "foreign-listing"],
};

describe("listing availability", () => {
  it("puts a listing under offer for one accepted offer", () => {
    const decision = decideOfferAcceptance({
      listingStatus: "available",
      otherReservingOfferCount: 0,
    });
    assert.equal(decision.ok, true);
    if (decision.ok) assert.equal(decision.nextListingStatus, "under_offer");
  });

  it("allows competing submitted offers without reserving the listing twice", () => {
    const decision = decideOfferAcceptance({
      listingStatus: "available",
      otherReservingOfferCount: 0,
    });
    assert.equal(decision.ok, true);
  });

  it("refuses a second accept while another offer reserves the listing", () => {
    const decision = decideOfferAcceptance({
      listingStatus: "under_offer",
      otherReservingOfferCount: 1,
    });
    assert.equal(decision.ok, false);
  });

  it("refuses an accept on sold stock", () => {
    const decision = decideOfferAcceptance({
      listingStatus: "sold",
      otherReservingOfferCount: 0,
    });
    assert.equal(decision.ok, false);
  });

  it("restores an approved listing when a transaction falls through and nothing else holds it", () => {
    const decision = decideReservationRelease({
      listingStatus: "under_offer",
      approvalStatus: "approved",
      remainingReservingOffers: 0,
      remainingActiveTransactions: 0,
      heldFromStatus: "available",
    });
    assert.equal(decision.nextStatus, "available");
  });

  it("keeps the listing under offer when another reservation remains", () => {
    const decision = decideReservationRelease({
      listingStatus: "under_offer",
      approvalStatus: "approved",
      remainingReservingOffers: 1,
      remainingActiveTransactions: 0,
    });
    assert.equal(decision.nextStatus, null);
    assert.equal(decision.reason, "still_reserved");
  });

  it("does not restore sold, let, or unapproved stock to available", () => {
    assert.equal(
      decideReservationRelease({
        listingStatus: "sold",
        approvalStatus: "approved",
        remainingReservingOffers: 0,
        remainingActiveTransactions: 0,
      }).nextStatus,
      null
    );
    assert.equal(
      decideReservationRelease({
        listingStatus: "let",
        approvalStatus: "approved",
        remainingReservingOffers: 0,
        remainingActiveTransactions: 0,
      }).nextStatus,
      null
    );
    assert.equal(
      decideReservationRelease({
        listingStatus: "under_offer",
        approvalStatus: "pending_approval",
        remainingReservingOffers: 0,
        remainingActiveTransactions: 0,
      }).nextStatus,
      "reserved"
    );
  });

  it("completes a sale and a rental onto different statuses", () => {
    const sale = decideTransactionCompletion({
      transactionType: "sale",
      listingStatus: "under_offer",
      otherActiveTransactionCount: 0,
      agreementRecorded: true,
      alreadyCompleted: false,
    });
    const rental = decideTransactionCompletion({
      transactionType: "rental",
      listingStatus: "under_offer",
      otherActiveTransactionCount: 0,
      agreementRecorded: true,
      alreadyCompleted: false,
    });
    assert.equal(sale.ok && sale.nextListingStatus, "sold");
    assert.equal(rental.ok && rental.nextListingStatus, "let");
  });

  it("treats a repeated completion as idempotent and blocks a competing active transaction", () => {
    const repeat = decideTransactionCompletion({
      transactionType: "sale",
      listingStatus: "sold",
      otherActiveTransactionCount: 0,
      agreementRecorded: true,
      alreadyCompleted: true,
    });
    assert.equal(repeat.ok && repeat.idempotent, true);
    const clash = decideTransactionCompletion({
      transactionType: "sale",
      listingStatus: "under_offer",
      otherActiveTransactionCount: 1,
      agreementRecorded: true,
      alreadyCompleted: false,
    });
    assert.equal(clash.ok, false);
  });

  it("refuses completion without an agreement and refuses a manual sold status", () => {
    const missing = decideTransactionCompletion({
      transactionType: "sale",
      listingStatus: "under_offer",
      otherActiveTransactionCount: 0,
      agreementRecorded: false,
      alreadyCompleted: false,
    });
    assert.equal(missing.ok, false);
    const manual = assertManualListingStatusChange({
      nextStatus: "sold",
      reservingOfferCount: 0,
      activeTransactionCount: 0,
      completedTransactionCount: 0,
    });
    assert.equal(manual.ok, false);
  });
});

describe("deal side classification", () => {
  it("does not treat an unclassified enquiry as buyer demand", () => {
    assert.equal(isDemandSide(null), false);
    assert.equal(isDemandSide(undefined), false);
    assert.equal(isUnclassifiedDealSide(null), true);
    assert.equal(isDemandSide("buy_side"), true);
    assert.equal(isDemandSide("tenant_side"), true);
    assert.equal(isSupplySide("sell_side"), true);
    assert.equal(isSupplySide("landlord_side"), true);
    const unclassified = evaluateMatchReadiness(null, {
      buyer_budget_min: 100000,
      buyer_budget_max: 180000,
      buyer_bedrooms_wanted: 3,
      buyer_area_preference: "Greendale",
    });
    assert.equal(unclassified.readyToMatch, false);
    const seller = evaluateMatchReadiness("sell_side", {
      buyer_budget_min: 100000,
      buyer_budget_max: 180000,
      buyer_bedrooms_wanted: 3,
      buyer_area_preference: "Greendale",
    });
    assert.equal(seller.readyToMatch, false);
    assert.match(seller.guidance, /sellers or landlords/i);
  });
});

describe("joint deal access", () => {
  const base = {
    userClientId: "org-a",
    resourceClientId: "org-a",
  };

  it("lets the buyer agent and the listing agent participate, and keeps agent C out", () => {
    assert.equal(
      canParticipateInDeal({
        ...base,
        role: "SALESPERSON",
        userId: "agent-b",
        buyerAgentId: "agent-b",
        listingAgentId: "agent-a",
      }),
      true
    );
    assert.equal(
      canParticipateInDeal({
        ...base,
        role: "SALESPERSON",
        userId: "agent-a",
        buyerAgentId: "agent-b",
        listingOwnerId: "agent-a",
      }),
      true
    );
    assert.equal(
      canParticipateInDeal({
        ...base,
        role: "SALESPERSON",
        userId: "agent-c",
        buyerAgentId: "agent-b",
        listingAgentId: "agent-a",
        listingOwnerId: "agent-a",
      }),
      false
    );
    assert.equal(
      canWriteOffer({
        role: "SALESPERSON",
        userId: "agent-a",
        userClientId: "org-a",
        offerClientId: "org-a",
        buyerAgentId: "agent-b",
        listingAgentId: "agent-a",
      }),
      true
    );
  });

  it("blocks a user from another organisation even when the record ids match", () => {
    assert.equal(
      canParticipateInDeal({
        role: "CLIENT_MANAGER",
        userId: "mgr",
        userClientId: "org-b",
        resourceClientId: "org-a",
        buyerAgentId: "mgr",
      }),
      false
    );
    assert.equal(canViewDealCommission("SALESPERSON"), false);
    assert.equal(canViewDealCommission("CLIENT_MANAGER"), true);
  });
});

describe("foundation backfill plans", () => {
  it("does not activate a search when the person was never classified as a buyer", () => {
    const planned = planLegacySearch(contact, [{ dealSide: null }]);
    assert.ok(planned);
    assert.equal(planned?.status, "needs_review");
    const buyer = planLegacySearch(contact, [{ dealSide: "buy_side" }]);
    assert.equal(buyer?.status, "active");
    assert.equal(buyer?.intent, "purchase");
    const tenant = planLegacySearch(contact, [{ dealSide: "tenant_side" }]);
    assert.equal(tenant?.intent, "rental");
  });

  it("is idempotent and skips listing ids outside the organisation", () => {
    const first = planLegacySearch(contact, [{ dealSide: "buy_side" }]);
    assert.ok(first);
    const secondPass = omitExistingKeys([first!], new Set([contact.contactId]), (row) => row.contactId);
    assert.equal(secondPass.length, 0);
    const interests = planLegacyInterests(contact, new Set(["listing-1"]), true);
    assert.equal(interests.interests.length, 1);
    assert.deepEqual(interests.reviewListingIds, ["foreign-listing"]);
    const roles = planContactRoles("person-1", "org-a", [
      { dealSide: "buy_side" },
      { dealSide: "landlord_side" },
      { dealSide: null },
    ]);
    assert.deepEqual(
      roles.map((role) => role.role).sort(),
      ["buyer", "landlord"]
    );
  });

  it("flags a legacy search that no longer matches the contact columns", () => {
    const drifted = legacySearchDivergence(contact, {
      budgetMin: 100000,
      budgetMax: 90000,
      bedrooms: 3,
      timeframe: "this month",
      locations: ["Borrowdale"],
    });
    assert.match(drifted ?? "", /budget max/);
    assert.equal(
      legacySearchDivergence(contact, {
        budgetMin: 100000,
        budgetMax: 180000,
        bedrooms: 3,
        timeframe: "this month",
        locations: ["Borrowdale"],
      }),
      null
    );
  });
});

describe("operations report windows", () => {
  const range = { from: "2026-01-01", to: "2026-02-01" };
  const fromMs = new Date("2026-01-01T00:00:00.000Z").getTime();
  const toMs = new Date("2026-02-01T00:00:00.000Z").getTime();

  it("keeps stock as a snapshot and ignores activity outside the period", () => {
    const report = aggregateOperationsReport({
      range,
      fromMs,
      toMs,
      truncated: false,
      listings: [
        { id: "l1", transaction_type: "sale", status: "available", approval_status: "approved" },
        { id: "l2", transaction_type: "rental", status: "under_offer", approval_status: "approved" },
      ],
      leads: [],
      viewings: [],
      offers: [{ id: "o-old", listing_id: "l1", submitted_at: "2025-12-01T00:00:00.000Z" }],
      transactions: [
        {
          id: "t-old",
          status: "completed",
          agreed_price: 100,
          completed_at: "2025-11-01T00:00:00.000Z",
          listing_agent_commission_amount: 5000,
          selling_agent_commission_amount: 5000,
        },
      ],
    });
    assert.equal(report.stock.available, 1);
    assert.equal(report.stock.underOffer, 1);
    assert.equal(report.enquiries.total, 0);
    assert.equal(report.transactions.completed, 0);
    assert.equal(report.sales.commissionTotal, 0);
    assert.equal(report.conversions.enquiryToWon, null);
    assert.match(report.definitions.commission, /not cash received/i);
  });

  it("counts one completed transaction once when a customer has several enquiries", () => {
    const report = aggregateOperationsReport({
      range,
      fromMs,
      toMs,
      truncated: false,
      listings: [{ id: "l1", transaction_type: "sale", status: "sold" }],
      leads: [
        { id: "lead-1", contact_id: "person", linked_listing_id: "l1", status: "WON", source: "website" },
        { id: "lead-2", contact_id: "person", linked_listing_id: "l1", status: "NEW", source: "website" },
      ],
      viewings: [
        { id: "v1", listing_id: "l1", contact_id: "person", status: "completed" },
      ],
      offers: [{ id: "o1", listing_id: "l1", submitted_at: "2026-01-10T00:00:00.000Z" }],
      transactions: [
        {
          id: "t1",
          status: "completed",
          lead_id: "lead-1",
          agreed_price: 200000,
          completed_at: "2026-01-20T00:00:00.000Z",
          listing_agent_commission_amount: 4000,
          selling_agent_commission_amount: null,
        },
      ],
    });
    assert.equal(report.enquiries.total, 2);
    assert.equal(report.transactions.completed, 1);
    assert.equal(report.sales.commissionTotal, 4000);
    assert.equal(report.conversions.enquiryToViewing, 50);
    assert.equal(report.conversions.enquiryToWon, 50);
  });

  it("caps popular properties and surfaces truncation", () => {
    const listings = Array.from({ length: 20 }, (_, i) => ({
      id: `l${i}`,
      transaction_type: "sale",
      status: "available",
    }));
    const leads = listings.map((listing, i) => ({
      id: `lead-${i}`,
      linked_listing_id: listing.id,
      status: "NEW",
      source: "website",
    }));
    const report = aggregateOperationsReport({
      range,
      fromMs,
      toMs,
      truncated: true,
      listings,
      leads,
      viewings: [],
      offers: [],
      transactions: [],
    });
    assert.equal(report.popularProperties.length, 12);
    assert.equal(report.truncated, true);
    assert.equal(report.enquiries.total, 20);
  });
});
