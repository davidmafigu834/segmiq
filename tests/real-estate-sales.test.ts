import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { dealSideBadgeLabel } from "../lib/terminology";
import {
  leadStatusForReStage,
  resolveRePipelineStage,
  rePipelineStageLabel,
  suggestedStageAfterViewing,
  isReManualStage,
} from "../lib/real-estate/pipeline";
import {
  appendInterestedListingIds,
  canManageListings,
  contactMatchesListing,
} from "../lib/real-estate/helpers";
import {
  evaluateListingMatch,
  listingMatchesSearch,
} from "../lib/real-estate/matching";
import {
  formatBudgetRange,
  formatRequirementSummary,
  isDemandSide,
  isSupplySide,
  requirementCompleteness,
} from "../lib/real-estate/requirements";
import { derivePriorityItem } from "../lib/real-estate/priority";
import { resolveSalesNavItems, SALES_NAVIGATION } from "../lib/sales/navigation/sales-nav-config";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("real-estate pipeline mapping", () => {
  it("maps shared lead statuses onto the real-estate journey without changing trades enums", () => {
    assert.equal(resolveRePipelineStage({ leadStatus: "NEW" }), "new_inquiry");
    assert.equal(resolveRePipelineStage({ leadStatus: "CONTACTED" }), "contacted");
    assert.equal(resolveRePipelineStage({ leadStatus: "QUALIFIED" }), "qualified");
    assert.equal(
      resolveRePipelineStage({ leadStatus: "QUALIFIED", hasInterestedListing: true }),
      "property_matched"
    );
    assert.equal(
      resolveRePipelineStage({ leadStatus: "QUALIFIED", hasUpcomingViewing: true }),
      "viewing_scheduled"
    );
    assert.equal(
      resolveRePipelineStage({ leadStatus: "QUALIFIED", hasCompletedViewing: true }),
      "viewing_completed"
    );
    assert.equal(
      resolveRePipelineStage({
        leadStatus: "QUALIFIED",
        hasCompletedViewing: true,
        markedInterested: true,
      }),
      "interested"
    );
    assert.equal(resolveRePipelineStage({ leadStatus: "WON" }), "won");
    assert.equal(resolveRePipelineStage({ leadStatus: "LOST" }), "lost");
    assert.equal(resolveRePipelineStage({ leadStatus: "NOT_QUALIFIED" }), "not_qualified");
    assert.equal(leadStatusForReStage("new_inquiry"), "NEW");
    assert.equal(leadStatusForReStage("contacted"), "CONTACTED");
    assert.equal(leadStatusForReStage("qualified"), "QUALIFIED");
    assert.equal(leadStatusForReStage("interested"), "QUALIFIED");
    assert.equal(isReManualStage("viewing_scheduled"), false);
    assert.equal(isReManualStage("contacted"), true);
    assert.equal(rePipelineStageLabel("property_matched"), "Property Matched");
  });

  it("does not auto-advance to Interested from a completed viewing", () => {
    assert.equal(suggestedStageAfterViewing("positive"), "interested");
    assert.equal(suggestedStageAfterViewing("neutral"), null);
    const stage = resolveRePipelineStage({
      leadStatus: "QUALIFIED",
      hasCompletedViewing: true,
    });
    assert.equal(stage, "viewing_completed");
  });
});

describe("inquiry cards — deal side and trades isolation", () => {
  it("renders buy/sell/landlord/tenant labels", () => {
    assert.equal(dealSideBadgeLabel("buy_side"), "BUYER");
    assert.equal(dealSideBadgeLabel("sell_side"), "SELLER");
    assert.equal(dealSideBadgeLabel("landlord_side"), "LANDLORD");
    assert.equal(dealSideBadgeLabel("tenant_side"), "TENANT");
    assert.equal(dealSideBadgeLabel(null), null);
  });

  it("does not rewrite the trades lead-score column", () => {
    const src = read("components/dashboard/company/leads/CompanyLeadsTableCard.tsx");
    assert.ok(src.includes("Lead score"));
    assert.ok(src.includes("isRealEstate"));
    assert.ok(src.includes("ScoreCell"));
  });
});

describe("buyer requirements and completeness", () => {
  it("is ready only when budget, bedrooms and area are present", () => {
    const incomplete = requirementCompleteness({
      buyer_budget_min: 120000,
      buyer_bedrooms_wanted: 3,
    });
    assert.equal(incomplete.ready, false);
    assert.equal(incomplete.statusLabel, "NEEDS MORE INFORMATION");
    const ready = requirementCompleteness({
      buyer_budget_min: 120000,
      buyer_budget_max: 170000,
      buyer_bedrooms_wanted: 3,
      buyer_area_preference: "Burnside",
    });
    assert.equal(ready.ready, true);
    assert.equal(ready.captured, 3);
    assert.equal(formatBudgetRange(120000, 160000), "US$120k – US$160k");
    assert.ok((formatRequirementSummary({
      buyer_bedrooms_wanted: 3,
      buyer_area_preference: "Burnside",
    }) ?? "").includes("Burnside"));
  });

  it("does not force buyer fields onto seller records", () => {
    assert.equal(isDemandSide("buy_side"), true);
    assert.equal(isDemandSide("tenant_side"), true);
    assert.equal(isSupplySide("sell_side"), true);
    assert.equal(isSupplySide("landlord_side"), true);
    assert.equal(isDemandSide("sell_side"), false);
  });
});

describe("matching and listing search", () => {
  const contact = {
    id: "c1",
    name: "Tendai Moyo",
    phone: null,
    email: null,
    buyer_budget_min: 120000,
    buyer_budget_max: 170000,
    buyer_bedrooms_wanted: 3,
    buyer_area_preference: "Burnside",
  };

  it("matches current-client listings against buyer requirements", () => {
    const listing = {
      id: "l1",
      price: 155000,
      bedrooms: 4,
      suburb: "Burnside",
    };
    const result = evaluateListingMatch(contact, listing);
    assert.ok(result);
    assert.equal(result.strength, "strong");
    assert.ok(result.reasons.every((r) => r.met));
    assert.equal(contactMatchesListing(contact, { price: 200000, bedrooms: 4, suburb: "Burnside" }), false);
  });

  it("filters available listings by search values", () => {
    const listing = {
      address: "12 Burnside Road",
      suburb: "Burnside",
      description: "House",
      external_reference: null,
      transaction_type: "sale" as const,
      status: "available",
      price: 155000,
      bedrooms: 4,
    };
    assert.equal(
      listingMatchesSearch(listing, { q: "burnside", status: "available", bedrooms: 3, maxPrice: 170000 }),
      true
    );
    assert.equal(listingMatchesSearch(listing, { status: "sold" }), false);
    assert.equal(listingMatchesSearch(listing, { suburb: "Hillside" }), false);
  });

  it("appends interested listing ids without destroying existing ones", () => {
    assert.deepEqual(appendInterestedListingIds(["a"], "b"), ["a", "b"]);
    assert.deepEqual(appendInterestedListingIds(["a"], "a"), ["a"]);
  });
});

describe("agent dashboard priority and permissions", () => {
  it("queues new uncontacted inquiries and qualified buyers without matches", () => {
    const now = new Date("2026-08-29T08:00:00");
    const fresh = derivePriorityItem({
      id: "1",
      name: "Tendai Moyo",
      dealSide: "buy_side",
      stage: "new_inquiry",
      assignedToId: "agent-1",
      createdAt: now.toISOString(),
      followUpAt: null,
      lastActivityAt: now.toISOString(),
    }, now);
    assert.equal(fresh?.reasonId, "new_uncontacted");
    const noMatch = derivePriorityItem({
      id: "2",
      name: "Nyasha Dube",
      dealSide: "buy_side",
      stage: "qualified",
      assignedToId: "agent-1",
      createdAt: now.toISOString(),
      followUpAt: null,
      lastActivityAt: now.toISOString(),
      hasPropertyMatch: false,
    }, now);
    assert.equal(noMatch?.reasonId, "qualified_no_match");
  });

  it("scopes the agent dashboard query to assigned_to_id", () => {
    const src = read("lib/sales/get-agent-real-estate-dashboard.ts");
    assert.ok(src.includes('.eq("assigned_to_id", opts.userId)'));
  });

  it("lets managers access team-level pipeline data", () => {
    const src = read("lib/sales/get-real-estate-pipeline-data.ts");
    assert.ok(src.includes("assignedToId"));
    assert.ok(src.includes("activeInquiries"));
    const page = read("app/client/leads/pipeline/page.tsx");
    assert.ok(page.includes("getRealEstatePipelineData({ clientId })"));
  });

  it("restricts listing create/edit to managers", () => {
    assert.equal(canManageListings("SALESPERSON"), false);
    assert.equal(canManageListings("CLIENT_MANAGER"), true);
    assert.equal(canManageListings("SUPER_ADMIN"), true);
    const src = read("app/api/clients/[clientId]/listings/route.ts");
    assert.ok(src.includes("canManageListings"));
  });
});

describe("viewing and listing tenant isolation", () => {
  it("creates viewings only after contact and listing belong to the client", () => {
    const src = read("app/api/clients/[clientId]/viewings/route.ts");
    assert.ok(src.includes('.eq("client_id", params.clientId)'));
    assert.ok(src.includes("Contact not found"));
    assert.ok(src.includes("Listing not found"));
    assert.ok(src.includes("completed"));
    assert.ok(src.includes("feedback_sentiment"));
  });

  it("rejects listing attach from another client on the inquiry PATCH", () => {
    const src = read("app/api/clients/[clientId]/leads/[leadId]/real-estate/route.ts");
    assert.ok(src.includes('.eq("client_id", params.clientId)'));
    assert.ok(src.includes("Listing not found"));
  });
});

describe("sales navigation — trades unchanged", () => {
  it("keeps quotations for trades and adds listings for real estate", () => {
    const trades = resolveSalesNavItems(false, "trades");
    assert.deepEqual(
      trades.map((i) => i.id),
      SALES_NAVIGATION.map((i) => (i.id === "dashboard" ? "dashboard" : i.id))
    );
    assert.ok(trades.some((i) => i.id === "quotes"));
    const re = resolveSalesNavItems(false, "real_estate");
    assert.equal(re.some((i) => i.id === "quotes"), false);
    assert.ok(re.some((i) => i.id === "listings"));
    assert.ok(re.some((i) => i.id === "offers"));
    assert.equal(re.find((i) => i.id === "leads")?.label, "Inquiries");
  });
});
