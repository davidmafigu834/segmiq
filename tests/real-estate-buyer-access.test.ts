import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canCreateOfferForPrivateBuyer,
  canSendPropertyMatch,
  canViewBuyerInDirectory,
  canViewBuyerOnListing,
  type BuyerAccessActor,
  type BuyerIntroductionAccessFact,
  type BuyerListingAccessFact,
  type BuyerSearchAccessFact,
} from "../lib/real-estate/buyer-contact-access";

const org = "org-a";
const otherOrg = "org-b";
const agentA: BuyerAccessActor = { id: "agent-a", role: "SALESPERSON", clientId: org };
const agentB: BuyerAccessActor = { id: "agent-b", role: "SALESPERSON", clientId: org };
const manager: BuyerAccessActor = { id: "manager-1", role: "CLIENT_MANAGER", clientId: org };
const outsider: BuyerAccessActor = { id: "agent-x", role: "SALESPERSON", clientId: otherOrg };

const liveListing: BuyerListingAccessFact = {
  id: "listing-1",
  clientId: org,
  status: "available",
  approvalStatus: "approved",
};

const soldListing: BuyerListingAccessFact = {
  id: "listing-1",
  clientId: org,
  status: "sold",
  approvalStatus: "approved",
};

function search(overrides: Partial<BuyerSearchAccessFact> = {}): BuyerSearchAccessFact {
  return {
    id: "search-1",
    clientId: org,
    contactId: "contact-1",
    assignedAgentId: "agent-b",
    status: "active",
    pipelineStage: "actively_searching",
    ...overrides,
  };
}

function intro(status: string, overrides: Partial<BuyerIntroductionAccessFact> = {}): BuyerIntroductionAccessFact {
  return {
    clientId: org,
    listingId: "listing-1",
    searchId: "search-1",
    requestingAgentId: "agent-a",
    status,
    ...overrides,
  };
}

describe("private buyer visibility", () => {
  it("hides a private buyer from an unrelated salesperson", () => {
    assert.equal(
      canViewBuyerOnListing({
        actor: agentA,
        recordClientId: org,
        contactId: "contact-1",
        searches: [search()],
        listing: liveListing,
        introductions: [],
      }),
      false
    );
    assert.equal(
      canViewBuyerInDirectory({
        actor: agentA,
        recordClientId: org,
        contactId: "contact-1",
        searches: [search()],
      }),
      false
    );
  });

  it("keeps the buyer visible to the assigned agent and to a manager", () => {
    assert.equal(
      canViewBuyerOnListing({
        actor: agentB,
        recordClientId: org,
        contactId: "contact-1",
        searches: [search()],
        listing: liveListing,
        introductions: [],
      }),
      true
    );
    assert.equal(
      canViewBuyerOnListing({
        actor: manager,
        recordClientId: org,
        contactId: "contact-1",
        searches: [search()],
        listing: liveListing,
        introductions: [],
      }),
      true
    );
  });

  it("does not let the old listing match or the directory reveal another listing's introduction", () => {
    const accepted = intro("accepted");
    assert.equal(
      canViewBuyerOnListing({
        actor: agentA,
        recordClientId: org,
        contactId: "contact-1",
        searches: [search()],
        listing: liveListing,
        introductions: [accepted],
      }),
      true
    );
    assert.equal(
      canViewBuyerOnListing({
        actor: agentA,
        recordClientId: org,
        contactId: "contact-1",
        searches: [search()],
        listing: { ...liveListing, id: "listing-2" },
        introductions: [accepted],
      }),
      false
    );
    assert.equal(
      canViewBuyerInDirectory({
        actor: agentA,
        recordClientId: org,
        contactId: "contact-1",
        searches: [search()],
      }),
      false
    );
  });

  it("does not grant access for a pending or declined introduction", () => {
    for (const status of ["requested", "declined"] as const) {
      assert.equal(
        canViewBuyerOnListing({
          actor: agentA,
          recordClientId: org,
          contactId: "contact-1",
          searches: [search()],
          listing: liveListing,
          introductions: [intro(status)],
        }),
        false
      );
      assert.equal(
        canSendPropertyMatch({
          actor: agentA,
          recordClientId: org,
          contactId: "contact-1",
          searches: [search()],
          listing: liveListing,
          introductions: [intro(status)],
          ownsContactRelationship: false,
        }),
        false
      );
    }
  });

  it("drops an accepted introduction when the listing or search is no longer eligible", () => {
    assert.equal(
      canViewBuyerOnListing({
        actor: agentA,
        recordClientId: org,
        contactId: "contact-1",
        searches: [search()],
        listing: soldListing,
        introductions: [intro("accepted")],
      }),
      false
    );
    assert.equal(
      canSendPropertyMatch({
        actor: agentA,
        recordClientId: org,
        contactId: "contact-1",
        searches: [search({ status: "paused", pipelineStage: "paused" })],
        listing: liveListing,
        introductions: [intro("accepted")],
        ownsContactRelationship: false,
      }),
      false
    );
  });

  it("rejects a salesperson from another organisation", () => {
    assert.equal(
      canViewBuyerOnListing({
        actor: outsider,
        recordClientId: org,
        contactId: "contact-1",
        searches: [search({ assignedAgentId: "agent-x" })],
        listing: liveListing,
        introductions: [],
      }),
      false
    );
    assert.equal(
      canViewBuyerInDirectory({
        actor: outsider,
        recordClientId: org,
        contactId: "contact-1",
        searches: [],
      }),
      false
    );
    assert.equal(
      canSendPropertyMatch({
        actor: outsider,
        recordClientId: org,
        contactId: "contact-1",
        searches: [],
        listing: liveListing,
        introductions: [],
        ownsContactRelationship: true,
      }),
      false
    );
  });
});

describe("property match send and offers", () => {
  it("lets the owner send on a live listing and refuses an unassigned private buyer", () => {
    assert.equal(
      canSendPropertyMatch({
        actor: agentB,
        recordClientId: org,
        contactId: "contact-1",
        searches: [search()],
        listing: liveListing,
        introductions: [],
        ownsContactRelationship: true,
      }),
      true
    );
    assert.equal(
      canSendPropertyMatch({
        actor: agentA,
        recordClientId: org,
        contactId: "contact-1",
        searches: [search({ assignedAgentId: null })],
        listing: liveListing,
        introductions: [],
        ownsContactRelationship: false,
      }),
      false
    );
    assert.equal(
      canSendPropertyMatch({
        actor: agentB,
        recordClientId: org,
        contactId: "contact-1",
        searches: [search()],
        listing: soldListing,
        introductions: [],
        ownsContactRelationship: true,
      }),
      false
    );
  });

  it("does not let offer creation bypass a private buyer owned by someone else", () => {
    assert.equal(
      canCreateOfferForPrivateBuyer({
        actor: agentA,
        recordClientId: org,
        contactId: "contact-1",
        leadAssignedToId: null,
        searches: [search()],
      }),
      false
    );
    assert.equal(
      canCreateOfferForPrivateBuyer({
        actor: agentA,
        recordClientId: org,
        contactId: "contact-1",
        leadAssignedToId: null,
        searches: [search({ assignedAgentId: null })],
      }),
      false
    );
    assert.equal(
      canCreateOfferForPrivateBuyer({
        actor: agentB,
        recordClientId: org,
        contactId: "contact-1",
        leadAssignedToId: null,
        searches: [search()],
      }),
      true
    );
    assert.equal(
      canCreateOfferForPrivateBuyer({
        actor: manager,
        recordClientId: org,
        contactId: "contact-1",
        leadAssignedToId: null,
        searches: [search()],
      }),
      true
    );
  });

  it("leaves walk-ins and non-real-estate contacts on the existing offer and directory rules", () => {
    assert.equal(
      canViewBuyerInDirectory({
        actor: agentA,
        recordClientId: org,
        contactId: "walk-in",
        searches: [],
      }),
      true
    );
    assert.equal(
      canCreateOfferForPrivateBuyer({
        actor: agentA,
        recordClientId: org,
        contactId: "walk-in",
        leadAssignedToId: null,
        searches: [],
      }),
      true
    );
    assert.equal(
      canCreateOfferForPrivateBuyer({
        actor: agentA,
        recordClientId: org,
        contactId: "walk-in",
        leadAssignedToId: "agent-b",
        searches: [],
      }),
      false
    );
    assert.equal(
      canSendPropertyMatch({
        actor: agentA,
        recordClientId: org,
        contactId: "solar-customer",
        searches: [],
        listing: liveListing,
        introductions: [],
        ownsContactRelationship: true,
      }),
      true
    );
    assert.equal(
      canSendPropertyMatch({
        actor: agentA,
        recordClientId: org,
        contactId: "solar-customer",
        searches: [],
        listing: liveListing,
        introductions: [],
        ownsContactRelationship: false,
      }),
      false
    );
  });
});
