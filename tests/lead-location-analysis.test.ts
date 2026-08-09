import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateLeadLocations,
  extractLeadLocation,
  normalizeLeadLocation,
  type LocationLeadRow,
} from "../lib/lead-location-analysis";

describe("lead location analysis", () => {
  it("merges capitalization and common city abbreviations", () => {
    assert.equal(normalizeLeadLocation(" harare "), "Harare");
    assert.equal(normalizeLeadLocation("HARARE"), "Harare");
    assert.equal(normalizeLeadLocation("byo"), "Bulawayo");
  });

  it("finds location fields from Facebook form data", () => {
    assert.equal(
      extractLeadLocation({
        "which_city_or_suburb_are_you_in?": "chitungwiza",
      }),
      "Chitungwiza"
    );
  });

  it("aggregates unique leads and pipeline status by location", () => {
    const leads: LocationLeadRow[] = [
      {
        id: "1",
        status: "CONTACTED",
        form_data: { city: "Harare" },
        created_at: "2026-08-01T10:00:00.000Z",
      },
      {
        id: "2",
        status: "WON",
        form_data: { city: "harare" },
        created_at: "2026-08-02T10:00:00.000Z",
      },
      {
        id: "3",
        status: "LOST",
        form_data: { suburb: "BYO" },
        created_at: "2026-08-03T10:00:00.000Z",
      },
    ];

    const result = aggregateLeadLocations(
      leads,
      new Date("2026-08-01T00:00:00.000Z"),
      new Date("2026-08-05T23:59:59.999Z")
    );

    assert.equal(result.totalFacebookLeads, 3);
    assert.equal(result.leadsWithLocation, 3);
    assert.equal(result.uniqueLocations, 2);
    assert.equal(result.topLocations[0]?.location, "Harare");
    assert.equal(result.topLocations[0]?.leads, 2);
    assert.equal(result.topLocations[0]?.open, 1);
    assert.equal(result.topLocations[0]?.won, 1);
    assert.equal(result.topLocations[1]?.location, "Bulawayo");
    assert.equal(result.topLocations[1]?.lost, 1);
  });
});
