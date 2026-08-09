import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMilestones } from "@/lib/sales/goals/milestones";
import { goalPeriodBounds, parseGoalPeriodKey } from "@/lib/sales/goals/period";
import { buildCumulativeSeries, calcProgress } from "@/lib/sales/goals/progress";
import { buildGoalRecommendations } from "@/lib/sales/goals/recommendations";
import { formatTrend } from "@/lib/sales/sales-dashboard-display";

describe("sales goals progress", () => {
  it("calculates remaining and clamps ring at 100 while allowing over-target pct", () => {
    const under = calcProgress(7230, 10000);
    assert.equal(under.remaining, 2770);
    assert.equal(under.progressPct, 72);
    assert.equal(under.ringPct, 72);

    const over = calcProgress(12400, 10000);
    assert.equal(over.remaining, 0);
    assert.equal(over.aboveTarget, 2400);
    assert.equal(over.progressPct, 124);
    assert.equal(over.ringPct, 100);
  });

  it("rejects zero/negative targets safely", () => {
    const z = calcProgress(500, 0);
    assert.equal(z.progressPct, 0);
    assert.equal(z.ringPct, 0);
  });
});

describe("sales goals periods", () => {
  it("parses period keys and bounds", () => {
    assert.equal(parseGoalPeriodKey("2026-08"), "2026-08");
    const b = goalPeriodBounds("2026-08");
    assert.equal(b.periodStartIso, "2026-08-01");
    assert.equal(b.periodEndIso, "2026-08-31");
  });
});

describe("sales goals milestones", () => {
  it("derives 25/50/75/100 and crossing dates from cumulative series", () => {
    const from = new Date(2026, 4, 1);
    const to = new Date(2026, 5, 1);
    const series = buildCumulativeSeries(
      [
        { created_at: "2026-05-05T10:00:00.000Z", deal_value: 2500 },
        { created_at: "2026-05-15T10:00:00.000Z", deal_value: 2500 },
        { created_at: "2026-05-20T10:00:00.000Z", deal_value: 2000 },
      ],
      from,
      to
    );
    const milestones = buildMilestones(10000, 7000, series);
    assert.equal(milestones.length, 4);
    assert.equal(milestones[0]!.status, "achieved");
    assert.equal(milestones[0]!.crossedAt, "2026-05-05");
    assert.equal(milestones[1]!.status, "achieved");
    assert.equal(milestones[1]!.crossedAt, "2026-05-15");
    assert.equal(milestones[2]!.status, "in_progress");
    assert.equal(milestones[3]!.status, "pending");
  });
});

describe("sales goals trends", () => {
  it("avoids infinity when previous is zero", () => {
    const t = formatTrend(5000, 0);
    assert.equal(t.direction, "new");
    const flat = formatTrend(0, 0);
    assert.equal(flat.direction, "none");
  });
});

describe("sales goals recommendations", () => {
  it("surfaces overdue follow-ups when present", () => {
    const tips = buildGoalRecommendations({
      overdueFollowUps: 5,
      pendingQuotes: 0,
      highIntentUncontacted: 0,
      staleHighValue: 0,
      remaining: 2000,
      lifecycle: "active",
      progressPct: 40,
    });
    assert.ok(tips.some((t) => /5 overdue/i.test(t.text)));
  });
});
