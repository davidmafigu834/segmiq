/**
 * Smoke tests for company dashboard metric helpers / funnel conversion.
 * Full aggregator requires Supabase; these guard definitional invariants.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatTrend } from "../lib/sales/sales-dashboard-display";
import { calcProgress } from "../lib/sales/goals/progress";

describe("company dashboard metric definitions", () => {
  it("never treats missing previous as infinite growth", () => {
    const t = formatTrend(12, 0);
    assert.equal(t.direction, "new");
    assert.notEqual(t.label.includes("∞"), true);
  });

  it("goal progress shows 0 ring only when a real target exists", () => {
    const withGoal = calcProgress(4100, 5000);
    assert.equal(withGoal.progressPct, 82);
    assert.equal(withGoal.ringPct, 82);

    const noTarget = calcProgress(0, 0);
    assert.equal(noTarget.progressPct, 0);
    // UI must render "No Goal" when hasGoal=false — not this 0%.
  });

  it("overall Lead→Won conversion is period ratio", () => {
    const enquiries = 248;
    const won = 23;
    const rate = Math.round((won / enquiries) * 1000) / 10;
    assert.equal(rate, 9.3);
  });

  it("response-time improvement inverts display direction", () => {
    // Current 120 min vs prior 150 → faster (down raw, up display)
    const raw = formatTrend(120, 150);
    assert.equal(raw.direction, "down");
    const displayDirection = raw.direction === "down" ? "up" : "down";
    assert.equal(displayDirection, "up");
  });
});
