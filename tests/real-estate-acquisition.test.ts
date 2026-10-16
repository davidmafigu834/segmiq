import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  acquisitionSummary,
  assertStageChange,
  canAccessAcquisition,
  canReviewMandate,
  conversionDecision,
  duplicateContactCandidates,
  effectiveMandateStatus,
  isMandateCurrentlyValid,
  listingBecomesMatchable,
  quickOpportunityReady,
} from "../lib/real-estate/acquisition-plan";
import { isListingLive } from "../lib/real-estate/listings";
import { resolveSalesNavItems, SALES_NAVIGATION } from "../lib/sales/navigation/sales-nav-config";
import { getCompanyNavigation } from "../lib/sales/navigation/company-nav-config";

const evidence = {
  hasScheduledInspection: false,
  hasCompletedInspection: false,
  hasValidMandate: false,
  hasListing: false,
  listingApproval: null,
};

describe("property acquisition journey", () => {
  it("saves an incomplete opportunity with a suburb and a phone", () => {
    assert.equal(quickOpportunityReady({ ownerPhone: "0772000000", suburb: "Borrowdale" }).ok, true);
    assert.equal(quickOpportunityReady({ ownerName: "Mrs Moyo" }).ok, false);
    assert.equal(quickOpportunityReady({ suburb: "Avondale" }).ok, false);
  });

  it("does not merge a possible duplicate contact", () => {
    const matches = duplicateContactCandidates(
      [{ id: "c1", name: "Mr Moyo", phone: "+263772000000" }],
      "0772000000",
      "Someone else"
    );
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.id, "c1");
  });

  it("keeps three properties on one contact without a second person record", () => {
    const rows = ["Borrowdale", "Avondale", "Greendale"].map((suburb, index) => ({
      status: "active",
      stage: "new_opportunity",
      nextActionAt: null,
      mandateStatus: null,
      mandateExpiry: null,
      inspectionStatus: null,
      inspectionAt: null,
      listingApproval: null,
      suburb,
      contactId: "moyo",
      id: `opp-${index}`,
    }));
    const ids = new Set(rows.map((row) => row.contactId));
    assert.equal(ids.size, 1);
    assert.equal(rows.length, 3);
  });

  it("refuses mandate secured and listing stages without evidence", () => {
    assert.equal(assertStageChange("owner_contacted", evidence).ok, true);
    assert.equal(assertStageChange("mandate_secured", evidence).ok, false);
    assert.equal(assertStageChange("inspection_completed", evidence).ok, false);
    assert.equal(
      assertStageChange("inspection_completed", { ...evidence, hasCompletedInspection: true }).ok,
      true
    );
  });

  it("treats an expired mandate as invalid and a legacy row as unverified", () => {
    assert.equal(
      isMandateCurrentlyValid({ status: "approved", expiryDate: "2020-01-01", now: new Date("2026-10-16") }),
      false
    );
    assert.equal(effectiveMandateStatus({ status: "legacy_unverified", expiryDate: "2027-01-01" }), "legacy_unverified");
    assert.equal(
      effectiveMandateStatus({ status: "approved", expiryDate: "2026-11-01", now: new Date("2026-10-16") }),
      "expiring_soon"
    );
  });

  it("prepares one listing and returns the existing draft on a second conversion", () => {
    assert.equal(conversionDecision({ existingListingId: null, hasValidMandate: false, managerOverride: false }).ok, false);
    const first = conversionDecision({ existingListingId: null, hasValidMandate: true, managerOverride: false });
    assert.equal(first.ok && first.alreadyConverted, false);
    const second = conversionDecision({ existingListingId: "listing-1", hasValidMandate: true, managerOverride: false });
    assert.equal(second.ok && second.alreadyConverted, true);
  });

  it("keeps a draft off the match list until it is approved and available", () => {
    assert.equal(isListingLive({ status: "reserved", approval_status: "draft" }), false);
    assert.equal(isListingLive({ status: "available", approval_status: "pending_approval" }), false);
    assert.equal(listingBecomesMatchable({ approvalStatus: "approved", listingStatus: "reserved" }), true);
    assert.equal(isListingLive({ status: "available", approval_status: "approved" }), true);
  });

  it("preserves sourcing access after reassignment and blocks another organisation", () => {
    assert.equal(
      canAccessAcquisition({
        role: "SALESPERSON",
        userId: "agent-b",
        userClientId: "org-a",
        resourceClientId: "org-a",
        assignedAgentId: "agent-b",
        sourcedByAgentId: "agent-a",
      }),
      true
    );
    assert.equal(
      canAccessAcquisition({
        role: "SALESPERSON",
        userId: "agent-a",
        userClientId: "org-a",
        resourceClientId: "org-a",
        assignedAgentId: "agent-b",
        sourcedByAgentId: "agent-a",
      }),
      true
    );
    assert.equal(
      canAccessAcquisition({
        role: "SALESPERSON",
        userId: "agent-c",
        userClientId: "org-a",
        resourceClientId: "org-a",
        assignedAgentId: "agent-b",
        sourcedByAgentId: "agent-a",
      }),
      false
    );
    assert.equal(
      canAccessAcquisition({
        role: "CLIENT_MANAGER",
        userId: "mgr",
        userClientId: "org-b",
        resourceClientId: "org-a",
      }),
      false
    );
    assert.equal(canReviewMandate({ role: "SALESPERSON", userId: "agent-a", userClientId: "org-a", resourceClientId: "org-a" }), false);
    assert.equal(canReviewMandate({ role: "CLIENT_MANAGER", userId: "mgr", userClientId: "org-a", resourceClientId: "org-a" }), true);
  });

  it("counts overdue follow-ups without counting converted opportunities twice", () => {
    const summary = acquisitionSummary([
      {
        status: "active",
        stage: "owner_contacted",
        nextActionAt: "2020-01-01T00:00:00.000Z",
        mandateStatus: "submitted",
        mandateExpiry: null,
        inspectionStatus: "scheduled",
        inspectionAt: "2026-12-01T00:00:00.000Z",
        listingApproval: "pending_approval",
      },
      {
        status: "converted",
        stage: "submitted_for_approval",
        nextActionAt: "2020-01-01T00:00:00.000Z",
        mandateStatus: "approved",
        mandateExpiry: "2027-01-01",
        inspectionStatus: "completed",
        inspectionAt: "2026-01-01T00:00:00.000Z",
        listingApproval: "approved",
      },
    ], new Date("2026-10-16T00:00:00.000Z"));
    assert.equal(summary.active, 1);
    assert.equal(summary.overdueFollowUps, 1);
    assert.equal(summary.listingsAwaitingApproval, 1);
    assert.equal(summary.mandatesPending, 1);
  });
});

describe("acquisition navigation stays inside real estate", () => {
  it("adds acquisition destinations for real estate and leaves trades unchanged", () => {
    const trades = resolveSalesNavItems(false, "trades");
    assert.deepEqual(
      trades.map((item) => item.id),
      SALES_NAVIGATION.map((item) => item.id).filter((id) => id !== "projects" && id !== "myWork")
    );
    const realEstate = resolveSalesNavItems(false, "real_estate");
    assert.ok(realEstate.some((item) => item.id === "opportunities"));
    assert.equal(trades.some((item) => item.id === "opportunities"), false);
    const company = getCompanyNavigation("real_estate");
    assert.ok(company.some((item) => item.href === "/client/acquisitions"));
    assert.equal(getCompanyNavigation("trades").some((item) => item.id === "opportunities"), false);
  });
});
