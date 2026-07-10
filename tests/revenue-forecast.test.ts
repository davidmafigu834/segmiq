import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bucketExpectedClose,
  computeLiveForecast,
  probabilityTier,
  stageCloseProbability,
  type ForecastableLead,
} from "../lib/revenue-forecast";

describe("stageCloseProbability", () => {
  it("maps known open stages", () => {
    assert.equal(stageCloseProbability("PROPOSAL_SENT"), 0.25);
    assert.equal(stageCloseProbability("NEGOTIATING"), 0.5);
    assert.equal(stageCloseProbability("CONTACTED"), 0.15);
    assert.equal(stageCloseProbability("NEW"), 0.05);
  });

  it("returns 0 for unknown / terminal", () => {
    assert.equal(stageCloseProbability("WON"), 0);
    assert.equal(stageCloseProbability("LOST"), 0);
  });
});

describe("probabilityTier", () => {
  it("bands by thresholds", () => {
    assert.equal(probabilityTier(0.8), "committed");
    assert.equal(probabilityTier(0.5), "best_case");
    assert.equal(probabilityTier(0.25), "pipeline");
  });
});

describe("bucketExpectedClose", () => {
  // Fixed "now": mid-July 2026 → month Jul, quarter Q3 (Jul–Sep)
  const now = new Date(2026, 6, 10);

  it("buckets into month / quarter / later / undated", () => {
    assert.equal(bucketExpectedClose("2026-07-20", now), "month");
    assert.equal(bucketExpectedClose("2026-08-15", now), "quarter");
    assert.equal(bucketExpectedClose("2026-11-01", now), "later");
    assert.equal(bucketExpectedClose(null, now), "undated");
  });
});

describe("computeLiveForecast", () => {
  const now = new Date(2026, 6, 10);

  const leads: ForecastableLead[] = [
    {
      id: "1",
      status: "PROPOSAL_SENT",
      deal_value: 100_000,
      budget: null,
      expected_close_date: "2026-07-25",
    },
    {
      id: "2",
      status: "NEGOTIATING",
      deal_value: 80_000,
      budget: null,
      expected_close_date: "2026-08-10",
    },
    {
      id: "3",
      status: "CONTACTED",
      deal_value: 50_000,
      budget: null,
      expected_close_date: null,
    },
    {
      id: "4",
      status: "WON",
      deal_value: 200_000,
      budget: null,
      expected_close_date: "2026-07-01",
    },
  ];

  it("weights dated deals and excludes undated from forecast totals", () => {
    const live = computeLiveForecast(leads, now);

    // Month: only deal 1 → 100k × 0.25 = 25k (pipeline tier)
    assert.equal(live.month.forecastedValue, 25_000);
    assert.equal(live.month.pipeline, 25_000);
    assert.equal(live.month.bestCase, 0);
    assert.equal(live.month.dealCount, 1);

    // Quarter: deal 1 + deal 2 → 25k + (80k × 0.5 = 40k) = 65k
    assert.equal(live.quarter.forecastedValue, 65_000);
    assert.equal(live.quarter.pipeline, 25_000);
    assert.equal(live.quarter.bestCase, 40_000);
    assert.equal(live.quarter.dealCount, 2);

    // Undated visible but not in forecast
    assert.equal(live.undated.count, 1);
    assert.equal(live.undated.pipelineValue, 50_000);

    assert.equal(live.methodology, "stage");
  });
});
