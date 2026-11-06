import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergePropertyRecords,
  presentPropertyRegister,
  propertySurfacesForRole,
  propertyWorkLinks,
  type PropertyDraftRecord,
  type PropertyListingRecord,
  type PropertyRegisterSourceState,
} from "../lib/real-estate/property-register";

const draftHref = (id: string) => `/sales/acquisitions/${id}`;
const listingHref = (id: string) => `/sales/listings/${id}`;

function draft(overrides: Partial<PropertyDraftRecord> = {}): PropertyDraftRecord {
  return {
    id: "draft-1",
    stage: "mandate_negotiation",
    status: "active",
    title: "12 Baker Street",
    sellerLabel: "A. Seller",
    assignedLabel: "Agent A",
    reference: "AQ-1",
    convertedListingId: null,
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

function listing(overrides: Partial<PropertyListingRecord> = {}): PropertyListingRecord {
  return {
    id: "listing-1",
    status: "available",
    approvalStatus: "approved",
    title: "12 Baker Street",
    assignedLabel: "Agent A",
    acquisitionOpportunityId: null,
    updatedAt: "2026-11-02T00:00:00.000Z",
    ...overrides,
  };
}

function source(overrides: Partial<PropertyRegisterSourceState> = {}): PropertyRegisterSourceState {
  return {
    drafts: [],
    listings: [],
    draftsAvailable: true,
    listingsAvailable: true,
    draftsIncomplete: false,
    listingsIncomplete: false,
    ...overrides,
  };
}

describe("property register identity", () => {
  it("keeps an unconverted seller opportunity and a standalone listing apart, even with the same address", () => {
    const entries = mergePropertyRecords({
      drafts: [draft()],
      listings: [listing({ id: "listing-2", title: "12 Baker Street" })],
      draftHref,
      listingHref,
      canApprove: false,
    });
    assert.deepEqual(entries.map((entry) => entry.key), ["listing:listing-2", "draft:draft-1"]);
    assert.equal(entries.find((entry) => entry.kind === "draft")?.stageLabel, "Mandate negotiation");
    assert.equal(entries.find((entry) => entry.kind === "draft")?.nextAction, "Continue the mandate");
    assert.equal(entries.find((entry) => entry.kind === "draft")?.href, "/sales/acquisitions/draft-1");
    assert.equal(entries.find((entry) => entry.kind === "listing")?.stageLabel, "Available");
    assert.equal(entries.find((entry) => entry.kind === "listing")?.historyHref, null);
  });

  it("shows one entry when both explicit links agree and both records are authorised", () => {
    const entries = mergePropertyRecords({
      drafts: [draft({ convertedListingId: "listing-1", updatedAt: "2026-11-03T00:00:00.000Z" })],
      listings: [listing({ acquisitionOpportunityId: "draft-1" })],
      draftHref,
      listingHref,
      canApprove: false,
    });
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.kind, "listing");
    assert.equal(entries[0]?.href, "/sales/listings/listing-1");
    assert.equal(entries[0]?.historyHref, "/sales/acquisitions/draft-1");
  });

  it("does not follow a one-sided, missing or inconsistent link", () => {
    const oneSidedDraft = mergePropertyRecords({
      drafts: [draft({ convertedListingId: "listing-hidden" })],
      listings: [listing({ id: "listing-2" })],
      draftHref,
      listingHref,
      canApprove: false,
    });
    assert.equal(oneSidedDraft.some((entry) => entry.href.includes("listing-hidden")), false);
    assert.equal(oneSidedDraft.find((entry) => entry.kind === "draft")?.historyHref, null);

    const oneSidedListing = mergePropertyRecords({
      drafts: [],
      listings: [listing({ acquisitionOpportunityId: "draft-hidden" })],
      draftHref,
      listingHref,
      canApprove: false,
    });
    assert.equal(oneSidedListing.length, 1);
    assert.equal(oneSidedListing[0]?.historyHref, null);
    assert.equal(oneSidedListing.some((entry) => entry.href.includes("draft-hidden")), false);

    const inconsistent = mergePropertyRecords({
      drafts: [draft({ convertedListingId: "listing-other" })],
      listings: [listing({ acquisitionOpportunityId: "draft-1" })],
      draftHref,
      listingHref,
      canApprove: false,
    });
    assert.equal(inconsistent.length, 2);
    assert.equal(inconsistent.every((entry) => entry.historyHref == null), true);
  });

  it("paginates the merged set and can find a converted opportunity by its reference", () => {
    const result = presentPropertyRegister(
      source({
        drafts: [draft({ convertedListingId: "listing-1", reference: "AQ-99" })],
        listings: [listing({ acquisitionOpportunityId: "draft-1" }), listing({ id: "listing-2", title: "Other road", updatedAt: "2026-10-01T00:00:00.000Z" })],
      }),
      { draftHref, listingHref, canApprove: false, query: "aq-99", page: 1, pageSize: 1 }
    );
    assert.equal(result.total, 1);
    assert.equal(result.entries[0]?.href, "/sales/listings/listing-1");
    assert.equal(result.partial, null);
  });

  it("keeps inactive records behind the inactive grouping and reports a failed source", () => {
    const inactive = presentPropertyRegister(
      source({
        drafts: [draft({ status: "lost" })],
        listings: [listing({ status: "sold" })],
      }),
      { draftHref, listingHref, canApprove: true, group: "inactive" }
    );
    assert.deepEqual(inactive.entries.map((entry) => entry.key).sort(), ["draft:draft-1", "listing:listing-1"]);
    assert.equal(inactive.entries.find((entry) => entry.kind === "listing")?.nextAction, "Open the listing");

    const partial = presentPropertyRegister(
      source({
        draftsAvailable: false,
        draftsIncomplete: true,
        drafts: [draft()],
        listings: [listing({ approvalStatus: "pending_approval" })],
      }),
      { draftHref, listingHref, canApprove: false }
    );
    assert.equal(partial.partial, "drafts");
    assert.equal(partial.entries.length, 1);
    assert.equal(partial.entries[0]?.kind, "listing");
    assert.equal(partial.entries[0]?.nextAction, "Waiting for listing approval");
    assert.equal(partial.entries.some((entry) => entry.href.includes("draft-1")), false);
  });

  it("limits work links to records the caller already holds", () => {
    assert.equal(propertySurfacesForRole("SALESPERSON").includes("client"), false);
    assert.ok(propertySurfacesForRole("CLIENT_MANAGER").includes("sales"));
    const links = propertyWorkLinks({ surface: "sales", listingId: "listing-1", opportunityId: null });
    assert.equal(links.some((link) => link.href.includes("acquisitions/")), false);
    assert.ok(links.some((link) => link.href === "/sales/viewings"));
    assert.ok(links.some((link) => link.href === "/sales/listings/listing-1#property-offers"));
    const withDraft = propertyWorkLinks({ surface: "client", listingId: null, opportunityId: "draft-1" });
    assert.ok(withDraft.some((link) => link.href === "/client/acquisitions/draft-1#acq-mandate"));
    assert.ok(withDraft.some((link) => link.href === "/client/acquisitions/draft-1#acq-inspection"));
    assert.equal(withDraft.some((link) => link.href === "/client/inspections"), false);
  });
});
