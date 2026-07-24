import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateFacebookQualification,
  type FbQualificationRules,
} from "../lib/facebook/qualification";
import { classifyLeadLane } from "../lib/lead-lanes";

const solarRules: FbQualificationRules = {
  thresholds: { hot: 70, warm: 45 },
  rules: [
    {
      field_key: "budget",
      label: "Budget",
      enabled: true,
      options: [
        { value: "Under 1000", points: 5, force_tier: null },
        { value: "2000-5000", points: 40, force_tier: null },
        { value: "5000+", points: 45, force_tier: "hot" },
      ],
    },
    {
      field_key: "zesa",
      label: "ZESA",
      enabled: true,
      options: [
        { value: "Yes", points: 30, force_tier: null },
        { value: "No", points: 0, force_tier: null },
      ],
    },
    {
      field_key: "intent",
      label: "Intent",
      enabled: true,
      options: [
        { value: "Ready to buy", points: 20, force_tier: "hot" },
        { value: "Just exploring", points: 0, force_tier: "cold" },
      ],
    },
  ],
};

describe("evaluateFacebookQualification", () => {
  it("scores high-intent solar answers as hot", () => {
    const result = evaluateFacebookQualification(
      {
        budget: "2000-5000",
        zesa: "Yes",
        intent: "Ready to buy",
      },
      solarRules
    );
    assert.ok(result.score >= 70);
    assert.equal(result.tier, "hot");
    assert.ok(result.reasons.length > 0);
  });

  it("forces cold for just exploring even with good budget", () => {
    const result = evaluateFacebookQualification(
      {
        budget: "2000-5000",
        zesa: "Yes",
        intent: "Just exploring",
      },
      solarRules
    );
    assert.equal(result.tier, "cold");
    assert.ok(result.score < 45);
  });
});

describe("classifyLeadLane with fb qual tier", () => {
  it("sends forced-cold uncontacted leads to nurture", () => {
    const assignment = classifyLeadLane({
      status: "NEW",
      created_at: new Date().toISOString(),
      follow_up_date: null,
      score: 20,
      form_data: { _fbQualTier: "cold", _fbQualScore: 20 },
    });
    assert.equal(assignment.lane, "nurture");
    assert.equal(assignment.tier, "cold");
  });
});
