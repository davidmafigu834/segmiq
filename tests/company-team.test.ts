import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  companyTeamAvgGoalProgress,
  companyTeamComposition,
  companyTeamGoalCoverage,
  companyTeamRoleColumn,
  companyTeamWinRate,
  deriveCompanyTeamAttention,
  matchesCompanyTeamFilters,
  matchesCompanyTeamSearch,
  matchesCompanyTeamTab,
} from "../lib/sales/company-team-metrics";

describe("company team metric definitions", () => {
  it("win rate is Won / (Won + Lost) and null when nothing is closed", () => {
    assert.equal(companyTeamWinRate(3, 1), 75);
    assert.equal(companyTeamWinRate(0, 0), null);
    assert.equal(companyTeamWinRate(2, 0), 100);
  });

  it("does not mark at-risk solely because Goal is below 50%", () => {
    const early = deriveCompanyTeamAttention({
      overdueFollowUps: 0,
      dealsAtRisk: 0,
      hotAwaitingContact: 0,
      noNextAction: 0,
      hasGoal: true,
      goalProgressPct: 40,
      dayOfMonth: 5,
      daysInMonth: 30,
    });
    assert.equal(early.attention, "on_track");
  });

  it("uses overdue follow-ups and at-risk Deals as coaching signals", () => {
    const watch = deriveCompanyTeamAttention({
      overdueFollowUps: 1,
      dealsAtRisk: 0,
      hotAwaitingContact: 0,
      noNextAction: 0,
      hasGoal: false,
      goalProgressPct: null,
      dayOfMonth: 12,
      daysInMonth: 30,
    });
    assert.equal(watch.attention, "watch");

    const needs = deriveCompanyTeamAttention({
      overdueFollowUps: 3,
      dealsAtRisk: 2,
      hotAwaitingContact: 0,
      noNextAction: 0,
      hasGoal: true,
      goalProgressPct: 20,
      dayOfMonth: 20,
      daysInMonth: 30,
    });
    assert.equal(needs.attention, "needs_attention");
  });

  it("role column stays simple and does not invent Support", () => {
    assert.equal(companyTeamRoleColumn("SALESPERSON", false), "Salesperson");
    assert.equal(companyTeamRoleColumn("CLIENT_MANAGER", true), "Sales Manager");
    assert.equal(companyTeamRoleColumn("CLIENT_MANAGER", false), "Manager");
  });

  it("composition omits empty Support slice", () => {
    const { slices, total } = companyTeamComposition([
      { roleGroup: "salesperson", isActive: true },
      { roleGroup: "salesperson", isActive: true },
      { roleGroup: "manager", isActive: true },
      { roleGroup: "salesperson", isActive: false },
    ]);
    assert.equal(total, 3);
    assert.equal(slices.some((s) => s.id === "support"), false);
    assert.equal(slices.find((s) => s.id === "salesperson")?.count, 2);
  });

  it("goal coverage never treats missing Goal as 0%", () => {
    const buckets = companyTeamGoalCoverage([
      { hasGoal: true, goalProgressPct: 90, isActive: true },
      { hasGoal: false, goalProgressPct: null, isActive: true },
      { hasGoal: true, goalProgressPct: 40, isActive: true },
    ]);
    assert.equal(buckets.find((b) => b.id === "no_goal")?.count, 1);
    assert.equal(buckets.find((b) => b.id === "below_50")?.count, 1);
    assert.equal(companyTeamAvgGoalProgress([
      { hasGoal: true, goalProgressPct: 90, isActive: true },
      { hasGoal: false, goalProgressPct: null, isActive: true },
      { hasGoal: true, goalProgressPct: 40, isActive: true },
    ]), 65);
    assert.equal(
      companyTeamAvgGoalProgress([{ hasGoal: false, goalProgressPct: null, isActive: true }]),
      null
    );
  });

  it("tabs and search filter without mixing inactive into All team", () => {
    const activeSp = {
      isActive: true,
      roleGroup: "salesperson" as const,
      name: "Ada",
      email: "ada@x.com",
      roleColumn: "Salesperson",
      titleLabel: "Sales Executive",
    };
    const inactive = { ...activeSp, isActive: false, name: "Bea" };
    assert.equal(matchesCompanyTeamTab("all", activeSp), true);
    assert.equal(matchesCompanyTeamTab("all", inactive), false);
    assert.equal(matchesCompanyTeamTab("inactive", inactive), true);
    assert.equal(matchesCompanyTeamSearch("ada", activeSp), true);
    assert.equal(matchesCompanyTeamSearch("zzz", activeSp), false);
  });

  it("filters can require follow-ups due without inventing extra dimensions", () => {
    const row = {
      attention: "watch" as const,
      hasGoal: true,
      followUpsDue: 2,
      dealsAtRisk: 0,
    };
    assert.equal(
      matchesCompanyTeamFilters(
        { attention: "all", goal: "all", followUpsDue: true, dealsAtRisk: false },
        row
      ),
      true
    );
    assert.equal(
      matchesCompanyTeamFilters(
        { attention: "all", goal: "all", followUpsDue: false, dealsAtRisk: true },
        row
      ),
      false
    );
  });
});
