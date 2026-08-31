import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateMatchReadiness } from "../lib/agent/real-estate/readiness";
import {
  evaluateRealEstateToolPolicy,
  RE_ASSIST_SAFE_TOOLS,
} from "../lib/agent/real-estate/policy";
import { rankListingMatches } from "../lib/agent/real-estate/match-service";
import { REAL_ESTATE_AGENT_SETTINGS_DEFAULTS } from "../lib/agent/real-estate/types";

describe("evaluateMatchReadiness", () => {
  it("requires budget, bedrooms and area for buyers", () => {
    const partial = evaluateMatchReadiness("buy_side", {
      buyer_budget_min: 120000,
      buyer_budget_max: null,
      buyer_bedrooms_wanted: null,
      buyer_area_preference: null,
    });
    assert.equal(partial.readyToMatch, false);
    assert.deepEqual(partial.missing, ["bedrooms", "area"]);

    const ready = evaluateMatchReadiness("buy_side", {
      buyer_budget_min: 120000,
      buyer_budget_max: 180000,
      buyer_bedrooms_wanted: 3,
      buyer_area_preference: "Burnside, Hillside",
    });
    assert.equal(ready.readyToMatch, true);
    assert.equal(ready.statusLabel, "READY TO MATCH");
  });

  it("is not applicable for sell-side leads", () => {
    const result = evaluateMatchReadiness("sell_side", {
      buyer_budget_min: 120000,
      buyer_bedrooms_wanted: 3,
      buyer_area_preference: "Burnside",
    });
    assert.equal(result.readyToMatch, false);
    assert.equal(result.statusLabel, "NOT_APPLICABLE");
  });
});

describe("evaluateRealEstateToolPolicy", () => {
  it("blocks property.match when search is disabled", () => {
    const settings = { ...REAL_ESTATE_AGENT_SETTINGS_DEFAULTS, allowPropertySearch: false };
    const decision = evaluateRealEstateToolPolicy("property.match", settings);
    assert.equal(decision.allowed, false);
  });

  it("blocks listing.send_match when send property info is disabled", () => {
    const settings = { ...REAL_ESTATE_AGENT_SETTINGS_DEFAULTS, allowSendPropertyInfo: false };
    const decision = evaluateRealEstateToolPolicy("listing.send_match", settings);
    assert.equal(decision.allowed, false);
  });

  it("allows read-only RE tools in assist-safe set", () => {
    assert.equal(RE_ASSIST_SAFE_TOOLS.has("property.match"), true);
    assert.equal(RE_ASSIST_SAFE_TOOLS.has("listing.send_match"), false);
  });
});

describe("rankListingMatches", () => {
  it("ranks strong matches ahead of partial matches", () => {
    const ranked = rankListingMatches([
      { strength: "partial", listingId: "l-partial" },
      { strength: "good", listingId: "l-good" },
      { strength: "strong", listingId: "l-strong" },
    ]);
    assert.deepEqual(
      ranked.map((row) => row.listingId),
      ["l-strong", "l-good", "l-partial"]
    );
  });
});
