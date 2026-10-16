import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  agentPriorities,
  buyerRailMode,
  canLinkEnquiry,
  canSeeBuyerContact,
  coarseStatusForStage,
  demandGaps,
  explainSearchListing,
  isDuplicateViewing,
  listingFingerprint,
  matchListingsForSearch,
  newMatchNotifications,
  nextDepositStatus,
  scoreMatch,
  searchAfterAcceptedOffer,
  searchAfterOfferOutcome,
  searchFieldChanges,
  viewingOverlapWarning,
  type MatchListing,
  type MatchSearch,
} from "../lib/real-estate/buyer-match";
import { getCompanyNavigation } from "../lib/sales/navigation/company-nav-config";
import { resolveSalesNavItems, SALES_NAVIGATION } from "../lib/sales/navigation/sales-nav-config";

function search(overrides: Partial<MatchSearch> = {}): MatchSearch {
  return {
    id: "search-1",
    clientId: "org-a",
    contactId: "contact-1",
    intent: "purchase",
    status: "active",
    pipelineStage: "actively_searching",
    propertyType: null,
    budgetMin: null,
    budgetMax: 130000,
    locations: ["Greendale"],
    bedrooms: 3,
    bathrooms: null,
    allowAboveBudget: false,
    allowAlternateLocations: true,
    ...overrides,
  };
}

function listing(overrides: Partial<MatchListing> = {}): MatchListing {
  return {
    id: "listing-1",
    clientId: "org-a",
    transactionType: "sale",
    status: "available",
    approvalStatus: "approved",
    price: 125000,
    suburb: "Greendale",
    bedrooms: 3,
    bathrooms: 2,
    sizeSqm: null,
    propertyType: null,
    ...overrides,
  };
}

describe("buyer search lifecycle", () => {
  it("keeps a rejected offer from closing the search", () => {
    const result = searchAfterOfferOutcome("actively_searching");
    assert.equal(result.stage, "actively_searching");
    assert.equal(result.closeSearch, false);
  });

  it("does not complete a search when an offer is accepted", () => {
    const result = searchAfterAcceptedOffer("decision_pending");
    assert.equal(result.closeSearch, false);
  });

  it("maps stages onto the coarse status used by matching", () => {
    assert.equal(coarseStatusForStage("viewings_in_progress"), "active");
    assert.equal(coarseStatusForStage("paused"), "paused");
    assert.equal(coarseStatusForStage("completed"), "completed");
  });

  it("records independent changes for two searches", () => {
    const house = searchFieldChanges(
      { budgetMin: null, budgetMax: 130000, locations: ["Greendale"], propertyType: "house", timeframe: null, pipelineStage: "actively_searching", assignedAgentId: "a" },
      { budgetMin: null, budgetMax: 140000, locations: ["Greendale"], propertyType: "house", timeframe: null, pipelineStage: "actively_searching", assignedAgentId: "a" }
    );
    const stand = searchFieldChanges(
      { budgetMin: null, budgetMax: 35000, locations: ["Ruwa"], propertyType: "stand", timeframe: null, pipelineStage: "new_enquiry", assignedAgentId: "a" },
      { budgetMin: null, budgetMax: 35000, locations: ["Ruwa"], propertyType: "stand", timeframe: null, pipelineStage: "new_enquiry", assignedAgentId: "a" }
    );
    assert.equal(house.length, 1);
    assert.equal(house[0]?.field, "budget_max");
    assert.equal(stand.length, 0);
  });
});

describe("explainable property matching", () => {
  it("returns a strong match for a Greendale house inside budget and bedrooms", () => {
    const result = explainSearchListing(search(), listing(), new Set());
    assert.equal(result?.strength, "strong");
    assert.ok(result?.reasons.some((reason) => reason.includes("Greendale")));
    assert.ok(result?.reasons.some((reason) => reason.includes("budget")));
  });

  it("keeps an alternate suburb as an alternative instead of hiding it", () => {
    const result = explainSearchListing(search(), listing({ id: "listing-2", suburb: "Msasa Park", price: 118000 }), new Set());
    assert.equal(result?.strength, "alternative");
  });

  it("excludes a property above the stated maximum unless the customer allowed it", () => {
    assert.equal(explainSearchListing(search(), listing({ price: 150000 }), new Set()), null);
    const allowed = explainSearchListing(search({ allowAboveBudget: true }), listing({ price: 150000 }), new Set());
    assert.ok(allowed);
  });

  it("excludes sold, unapproved, withdrawn and other-company stock", () => {
    assert.equal(explainSearchListing(search(), listing({ status: "sold" }), new Set()), null);
    assert.equal(explainSearchListing(search(), listing({ status: "let" }), new Set()), null);
    assert.equal(explainSearchListing(search(), listing({ approvalStatus: "pending_approval" }), new Set()), null);
    assert.equal(explainSearchListing(search(), listing({ status: "reserved" }), new Set()), null);
    assert.equal(explainSearchListing(search(), listing({ clientId: "org-b" }), new Set()), null);
  });

  it("does not match a sale listing to a rental search", () => {
    assert.equal(explainSearchListing(search({ intent: "rental", budgetMax: 650 }), listing(), new Set()), null);
    const rental = explainSearchListing(
      search({ intent: "rental", budgetMax: 650, locations: ["Avondale"] }),
      listing({ transactionType: "rental", price: 600, suburb: "Avondale" }),
      new Set()
    );
    assert.equal(rental?.strength, "strong");
  });

  it("does not match paused, closed or needs-review searches", () => {
    assert.equal(explainSearchListing(search({ status: "paused", pipelineStage: "paused" }), listing(), new Set()), null);
    assert.equal(explainSearchListing(search({ status: "needs_review", pipelineStage: null }), listing(), new Set()), null);
  });

  it("remembers a rejected property", () => {
    assert.equal(explainSearchListing(search(), listing(), new Set(["listing-1"])), null);
    const other = matchListingsForSearch(search(), [listing(), listing({ id: "listing-2", suburb: "Msasa Park" })], ["listing-1"]);
    assert.deepEqual(other.map((row) => row.listingId), ["listing-2"]);
  });

  it("documents the score as weighted reasons, not a probability", () => {
    assert.equal(scoreMatch({
      locationMet: true,
      hasLocationPreference: true,
      budgetMet: true,
      bedroomsMet: true,
      hasBedroomPreference: true,
      bathroomsMet: false,
      hasBathroomPreference: false,
      typeMet: false,
      hasTypePreference: false,
    }), 85);
  });
});

describe("match notifications and collaboration", () => {
  it("notifies an agent once for the same listing, search and fingerprint", () => {
    const fingerprint = listingFingerprint({ price: 125000, suburb: "Greendale", status: "available" });
    const pair = { listingId: "listing-1", searchId: "search-1", agentId: "agent-1", fingerprint };
    const first = newMatchNotifications([pair, pair], new Set());
    assert.equal(first.length, 1);
    const second = newMatchNotifications([pair], new Set([`${pair.listingId}:${pair.searchId}:${fingerprint}`]));
    assert.equal(second.length, 0);
  });

  it("hides a buyer phone from another agent until an introduction is accepted", () => {
    assert.equal(canSeeBuyerContact({ requesterId: "agent-b", ownerAgentId: "agent-a", role: "SALESPERSON", introductionAccepted: false }), false);
    assert.equal(canSeeBuyerContact({ requesterId: "agent-a", ownerAgentId: "agent-a", role: "SALESPERSON", introductionAccepted: false }), true);
    assert.equal(canSeeBuyerContact({ requesterId: "agent-b", ownerAgentId: "agent-a", role: "CLIENT_MANAGER", introductionAccepted: false }), true);
    assert.equal(canSeeBuyerContact({ requesterId: "agent-b", ownerAgentId: "agent-a", role: "SALESPERSON", introductionAccepted: true }), true);
  });
});

describe("viewings, rentals and whatsapp context", () => {
  it("warns on an agent clash and blocks an accidental duplicate click", () => {
    const warning = viewingOverlapWarning(
      [{ agentId: "agent-1", scheduledAt: "2026-10-20T10:00:00.000Z" }],
      { agentId: "agent-1", scheduledAt: "2026-10-20T10:30:00.000Z" }
    );
    assert.match(warning ?? "", /90 minutes/);
    assert.equal(
      isDuplicateViewing(
        [{ contactId: "c", listingId: "l", scheduledAt: "2026-10-20T10:00:00.000Z" }],
        { contactId: "c", listingId: "l", scheduledAt: "2026-10-20T10:00:20.000Z" }
      ),
      true
    );
  });

  it("does not treat a reported deposit as verified", () => {
    assert.deepEqual(nextDepositStatus({ action: "report", role: "SALESPERSON" }), { ok: true, status: "reported" });
    const denied = nextDepositStatus({ action: "verify", role: "SALESPERSON" });
    assert.equal(denied.ok, false);
    assert.deepEqual(nextDepositStatus({ action: "verify", role: "CLIENT_MANAGER" }), { ok: true, status: "verified" });
  });

  it("keeps unclassified conversations from being treated as buyers", () => {
    assert.equal(buyerRailMode(null), "unclassified");
    assert.equal(buyerRailMode("buy_side"), "buyer");
    assert.equal(buyerRailMode("sell_side"), "seller");
  });

  it("links an enquiry only when it is the same customer in the same organisation", () => {
    assert.equal(canLinkEnquiry({ leadClientId: "org-a", searchClientId: "org-a", leadContactId: "c1", searchContactId: "c1" }), true);
    assert.equal(canLinkEnquiry({ leadClientId: "org-a", searchClientId: "org-b", leadContactId: "c1", searchContactId: "c1" }), false);
    assert.equal(canLinkEnquiry({ leadClientId: "org-a", searchClientId: "org-a", leadContactId: "c2", searchContactId: "c1" }), false);
  });
});

describe("demand and priorities use recorded rows only", () => {
  it("counts searches and people separately and flags unmet demand", () => {
    const gaps = demandGaps(
      [
        search({ id: "s1", contactId: "c1", locations: ["Mount Pleasant"], budgetMax: 180000 }),
        search({ id: "s2", contactId: "c2", locations: ["Mount Pleasant"], budgetMax: 190000 }),
        search({ id: "s3", contactId: "c1", locations: ["Mount Pleasant"], budgetMax: 160000, intent: "rental" }),
      ],
      [listing({ suburb: "Mount Pleasant", price: 170000 })]
    );
    const houses = gaps.find((gap) => gap.intent === "purchase" && gap.location === "Mount Pleasant");
    assert.equal(houses?.searchCount, 2);
    assert.equal(houses?.contactCount, 2);
    assert.equal(houses?.eligibleListingCount, 1);
    const rental = gaps.find((gap) => gap.intent === "rental");
    assert.equal(rental?.unmatchedSearchCount, 1);
  });

  it("builds priorities only from the rows it is given", () => {
    const items = agentPriorities({
      now: new Date("2026-10-16T08:00:00.000Z"),
      searches: [{ id: "s1", contactName: "Mr Moyo", stage: "actively_searching", nextActionAt: "2026-10-15T08:00:00.000Z", status: "active" }],
      viewingsToday: [],
      offersWaiting: [],
      freshMatches: [],
    });
    assert.equal(items.length, 1);
    assert.equal(items[0]?.title, "Mr Moyo");
  });
});

describe("phase 3 stays inside real estate navigation and services", () => {
  it("adds buyer sales destinations without changing trades navigation", () => {
    const trades = resolveSalesNavItems(false, "trades");
    assert.deepEqual(
      trades.map((item) => item.id),
      SALES_NAVIGATION.map((item) => item.id).filter((id) => id !== "projects" && id !== "myWork")
    );
    const realEstate = resolveSalesNavItems(false, "real_estate");
    for (const id of ["buyers", "matching", "viewings", "offers"]) {
      assert.equal(realEstate.some((item) => item.id === id), true);
      assert.equal(trades.some((item) => item.id === id && id !== "offers"), false);
    }
    const company = getCompanyNavigation("real_estate");
    assert.ok(company.some((item) => item.href === "/client/buyers"));
    assert.equal(getCompanyNavigation("trades").some((item) => item.id === "buyers"), false);
  });

  it("scopes buyer queries by organisation and does not send match WhatsApp", () => {
    const service = readFileSync("lib/real-estate/buyer-sales-service.ts", "utf8");
    assert.match(service, /\.eq\("client_id", input\.clientId\)/);
    assert.equal(service.includes("notifyPropertyMatch"), false);
    const route = readFileSync("app/api/clients/[clientId]/listings/[listingId]/route.ts", "utf8");
    assert.match(route, /discoverMatchesForListing/);
    const migration = readFileSync("supabase/migrations/20261016120000_real_estate_phase3_buyer_sales.sql", "utf8");
    assert.match(migration, /buyer_search_id/);
    assert.match(migration, /REVOKE ALL/);
  });
});
