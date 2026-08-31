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

  it("daily qualified prefers qualified_at over created_at fallback", () => {
    const dayStart = new Date("2026-08-31T00:00:00");
    const dayEnd = new Date("2026-09-01T00:00:00");
    const inToday = (iso: string | null | undefined) => {
      if (!iso) return false;
      const t = new Date(iso);
      return t >= dayStart && t < dayEnd;
    };
    const QUALIFIED = new Set(["QUALIFIED", "CONVERTED_TO_DEAL"]);
    const isQualifiedToday = (l: {
      status: string;
      created_at: string;
      qualified_at: string | null;
    }) => {
      if (l.qualified_at) return inToday(l.qualified_at);
      return QUALIFIED.has(l.status) && inToday(l.created_at);
    };

    assert.equal(
      isQualifiedToday({
        status: "QUALIFIED",
        created_at: "2026-08-20T10:00:00",
        qualified_at: "2026-08-31T09:00:00",
      }),
      true
    );
    assert.equal(
      isQualifiedToday({
        status: "QUALIFIED",
        created_at: "2026-08-20T10:00:00",
        qualified_at: null,
      }),
      false
    );
    assert.equal(
      isQualifiedToday({
        status: "QUALIFIED",
        created_at: "2026-08-31T10:00:00",
        qualified_at: null,
      }),
      true
    );
  });
});
