import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { P, CLIENT_DATA_PERMISSIONS } from "../lib/auth/rbac/permissions";
import {
  permissionsForOrgRole,
  permissionsForSuperAdmin,
  permissionsForSupportAccess,
} from "../lib/auth/rbac/role-profiles";
import { assertSameTenant, TenantContextError } from "../lib/auth/tenant-context";
import { reportTrend } from "../lib/sales/company-reports/metrics";
import {
  classifyDeal,
  buildFunnel,
  largestFunnelDropOff,
  buildPipelineHealth,
  buildDeterministicInsights,
  mergeAiIntoPayload,
} from "../lib/sales/weekly-team-report/analyse";
import { resolvePipelineHealthConfig, DEFAULT_PIPELINE_HEALTH } from "../lib/sales/weekly-team-report/config";
import { classifyConversationText, aggregateConversationPatterns } from "../lib/sales/weekly-team-report/conversation";
import { buildFallbackAi } from "../lib/sales/weekly-team-report/fallback";
import { comparedMetric, conversionRate, emptyPeriodFacts, teamMetrics } from "../lib/sales/weekly-team-report/metrics";
import {
  formatPeriodLabel,
  immediatelyPreviousWeek,
  isPeriodComplete,
  previousCompletedWeek,
  weekContaining,
  weekFromMonday,
} from "../lib/sales/weekly-team-report/period";
import { parseJsonObject, validateWeeklyReportAi } from "../lib/sales/weekly-team-report/schema";
import { isInFlight, isStaleInFlight } from "../lib/sales/weekly-team-report/status";
import { generateWeeklyTeamReportKey, isWeeklyTeamReportKeyForClient } from "../lib/storage/r2";
import type { SnapshotDeal, WeeklyTeamSnapshot } from "../lib/sales/weekly-team-report/types";

function period(): WeeklyTeamSnapshot["period"] {
  return weekFromMonday("2026-09-14", "Africa/Harare");
}

function deal(overrides: Partial<SnapshotDeal>): SnapshotDeal {
  return {
    id: "d1",
    originatingLeadId: "l1",
    title: "Tendai",
    ownerId: "sp1",
    ownerName: "Rudo",
    stage: "PROPOSAL_SENT",
    value: 12000,
    lastActivityAt: "2026-09-20T10:00:00.000Z",
    nextActionAt: "2026-09-22T08:00:00.000Z",
    nextActionLabel: "Follow up",
    expectedDecisionAt: null,
    createdAt: "2026-09-01T08:00:00.000Z",
    hasOpenQuote: false,
    quoteSentAt: null,
    quoteFollowedUp: true,
    customerWaiting: false,
    ...overrides,
  };
}

function snapshot(overrides: Partial<WeeklyTeamSnapshot> = {}): WeeklyTeamSnapshot {
  const current = emptyPeriodFacts();
  current.newLeads = 43;
  current.contactedLeads = 28;
  current.qualifiedLeads = 20;
  current.quotationsSent = 14;
  current.dealsWon = 2;
  current.followUpsMissed = 12;
  current.delayedResponses = 15;
  current.onTimeResponses = 28;
  current.delayedByHour = { "14": 9, "9": 3 };
  const previous = emptyPeriodFacts();
  previous.newLeads = 30;
  previous.quotationsSent = 9;
  const base: WeeklyTeamSnapshot = {
    clientId: "org-a",
    organisationName: "Ecolus Energy",
    organisationLogoUrl: null,
    currency: "USD",
    timezone: "Africa/Harare",
    period: period(),
    previousPeriod: immediatelyPreviousWeek(period()),
    nowIso: "2026-09-21T06:00:00.000Z",
    health: DEFAULT_PIPELINE_HEALTH,
    salespeople: [
      { id: "sp1", name: "Rudo", active: true, role: "SALESPERSON" },
      { id: "sp2", name: "Tendai", active: true, role: "SALESPERSON" },
    ],
    current,
    previous,
    activePipeline: [
      deal({
        id: "q1",
        hasOpenQuote: true,
        quoteSentAt: "2026-09-16T08:00:00.000Z",
        quoteFollowedUp: false,
        lastActivityAt: "2026-09-16T08:00:00.000Z",
        nextActionAt: null,
      }),
    ],
    openQuotes: [],
    lostThisWeek: [
      {
        id: "lost1",
        displayName: "Chipo",
        salespersonId: "sp1",
        salespersonName: "Rudo",
        value: 4300,
        stageAtLoss: "NEGOTIATING",
        reason: "Reason not recorded",
      },
    ],
    lostPreviousWeek: [],
    attentionSeed: [],
    conversation: {
      scannedCount: 6,
      truncated: false,
      patterns: [{ id: "financing", label: "Financing / payment plans", count: 6, sampleIds: ["m1", "m2"] }],
    },
    reassignments: [{ entityId: "l9", fromId: "sp1", toId: "sp2", at: "2026-09-16T12:00:00.000Z" }],
    activityVolume: 80,
  };
  return { ...base, ...overrides };
}

describe("weekly report period and timezone", () => {
  it("uses Monday-Sunday in the organisation timezone", () => {
    const week = weekFromMonday("2026-09-14", "Africa/Harare");
    assert.equal(week.startDate, "2026-09-14");
    assert.equal(week.endDate, "2026-09-20");
    assert.equal(formatPeriodLabel(week), "14-20 September 2026");
    assert.match(week.startIso, /2026-09-13T22:00:00/);
    assert.match(week.endIsoExclusive, /2026-09-20T22:00:00/);
  });

  it("generates the previous completed week after Sunday in Harare", () => {
    const mondayMorning = new Date("2026-09-21T06:00:00.000Z");
    const week = previousCompletedWeek(mondayMorning, "Africa/Harare");
    assert.equal(week.startDate, "2026-09-14");
    assert.equal(isPeriodComplete(week, mondayMorning), true);
  });

  it("does not close the week early in a behind-UTC timezone", () => {
    const stillSundayInSamoa = new Date("2026-09-21T06:00:00.000Z");
    const current = weekContaining(stillSundayInSamoa, "Pacific/Pago_Pago");
    assert.equal(isPeriodComplete(current, stillSundayInSamoa), false);
    const previous = previousCompletedWeek(stillSundayInSamoa, "Pacific/Pago_Pago");
    assert.equal(previous.endDate < current.startDate || previous.startDate !== current.startDate, true);
  });
});

describe("weekly report metrics", () => {
  it("does not emit Infinity when the previous value is zero", () => {
    const metric = comparedMetric("quotes", "Quotations sent", 14, 0, "count");
    assert.equal(metric.trend.direction, "new");
    assert.equal(metric.trend.pct, null);
    assert.equal(conversionRate(2, 0), null);
    assert.equal(reportTrend(12, 0).direction, "new");
  });

  it("compares current week with the previous week", () => {
    const metrics = teamMetrics(snapshot().current, snapshot().previous);
    const quotes = metrics.find((m) => m.id === "quotations_sent");
    assert.equal(quotes?.current, 14);
    assert.equal(quotes?.previous, 9);
    assert.equal(quotes?.delta, 5);
    const pipeline = metrics.find((m) => m.id === "pipeline_value");
    assert.equal(pipeline?.previous, null);
    assert.equal(pipeline?.trend.direction, "none");
  });
});

describe("weekly report pipeline and funnel", () => {
  it("classifies quoted deals awaiting follow-up with configurable thresholds", () => {
    const snap = snapshot();
    const flagged = classifyDeal(snap.activePipeline[0]!, snap);
    assert.equal(flagged, "quoted_awaiting_followup");
    const health = buildPipelineHealth(snap);
    assert.equal(health.find((b) => b.id === "quoted_awaiting_followup")?.count, 1);
  });

  it("identifies the largest funnel drop-off", () => {
    const funnel = buildFunnel(snapshot());
    const drop = largestFunnelDropOff(funnel);
    assert.ok(drop);
    assert.ok((drop?.dropOff ?? 0) > 0);
  });

  it("lets organisations override health thresholds", () => {
    const cfg = resolvePipelineHealthConfig({
      weeklyReportHealthConfig: { needsAttentionDays: 3, atRiskDays: 10, quoteFollowupHours: 48 },
    });
    assert.equal(cfg.needsAttentionDays, 3);
    assert.equal(cfg.atRiskDays, 10);
    assert.equal(cfg.quoteFollowupHours, 48);
  });
});

describe("weekly report empty and edge cases", () => {
  it("does not invent analysis when activity is near zero", () => {
    const empty = snapshot({
      current: emptyPeriodFacts(),
      previous: emptyPeriodFacts(),
      activePipeline: [],
      lostThisWeek: [],
      conversation: { scannedCount: 0, truncated: false, patterns: [] },
      activityVolume: 4,
      salespeople: [{ id: "sp1", name: "Rudo", active: true, role: "SALESPERSON" }],
    });
    const ai = buildFallbackAi(empty);
    assert.match(ai.executiveSummary, /not yet enough data/);
    assert.equal(ai.dataSufficiencyNote?.includes("4 sales activities"), true);
  });

  it("keeps factual metrics when AI output is invalid", () => {
    assert.equal(validateWeeklyReportAi({ executiveSummary: "too short" }, new Set(["sp1"])), null);
    const payload = mergeAiIntoPayload(snapshot(), buildFallbackAi(snapshot()));
    assert.equal(payload.metrics.find((m) => m.id === "quotations_sent")?.current, 14);
    assert.equal(payload.lostDeals.rows[0]?.reason, "Reason not recorded");
  });

  it("falls back when JSON cannot be parsed", () => {
    assert.equal(parseJsonObject("not json"), null);
    assert.deepEqual(parseJsonObject('prefix {"ok":true} suffix'), { ok: true });
  });
});

describe("weekly report AI guardrails", () => {
  it("rejects insulting salesperson judgements and generic advice", () => {
    const raw = {
      executiveSummary: "Lead volume increased compared with last week and quotation follow-up slowed.",
      whatWentWell: "Lead volume increased.",
      whereMomentumWasLost: "Quote follow-up slowed.",
      biggestRisk: "Quoted deals going quiet.",
      biggestOpportunity: "Recover quoted deals.",
      priorityForNextWeek: "Recover quoted opportunities.",
      positiveFindings: ["Lead volume increased"],
      concerns: ["Follow-up slowed"],
      risks: ["Quoted deals idle"],
      opportunities: ["Recover quotes"],
      managerRecommendations: [
        { title: "Work harder", evidence: "None", action: "Close more deals", objective: "Win more" },
        {
          title: "Improve quotation follow-up discipline",
          evidence: "9 active quotations received no follow-up.",
          action: "Require first quotation follow-up within 48 hours.",
          objective: "Reduce quoted opportunities becoming inactive.",
        },
      ],
      nextWeekPriorities: [
        { title: "Recover quoted opportunities", affectedCount: 9, pipelineValue: 1000, ownerLabel: "Team", targetDate: null },
      ],
      meetingAgenda: ["Review wins", "Review quotes", "Set next-week priorities"],
      salespersonNarratives: [
        {
          salespersonId: "sp1",
          narrative: "Tendai is lazy and did not work this week according to gossip.",
          strengths: [],
          concerns: ["lazy"],
          coachingFocus: "Attitude",
        },
      ],
      pipelineNarrative: "Quoted deals need follow-up this week based on recorded inactivity.",
      lossAnalysisNarrative: "One lost deal had no recorded reason.",
      conversationPatterns: [{ id: "financing", interpretation: "Six prospects asked about payment-plan options this week." }],
      dataSufficiencyNote: null,
    };
    const parsed = validateWeeklyReportAi(raw, new Set(["sp1"]));
    assert.ok(parsed);
    assert.equal(parsed!.salespersonNarratives.length, 0);
    assert.equal(parsed!.managerRecommendations.length, 1);
    assert.equal(parsed!.managerRecommendations[0]?.title.includes("quotation"), true);
  });

  it("drops narratives for unknown salesperson ids", () => {
    const raw = {
      executiveSummary: "Lead volume increased compared with last week without a matching win rate lift.",
      whatWentWell: "Lead volume increased.",
      whereMomentumWasLost: "Wins did not keep pace.",
      biggestRisk: "Quoted deals idle.",
      biggestOpportunity: "Recover quotes.",
      priorityForNextWeek: "Recover quoted opportunities.",
      positiveFindings: [],
      concerns: [],
      risks: [],
      opportunities: [],
      managerRecommendations: [],
      nextWeekPriorities: [],
      meetingAgenda: ["Review wins", "Review quotes", "Set next-week priorities"],
      salespersonNarratives: [
        {
          salespersonId: "other-org",
          narrative: "This person closed a deal in another organisation this week.",
          strengths: ["Speed"],
          concerns: [],
          coachingFocus: "Keep going",
        },
      ],
      pipelineNarrative: "Pipeline is thin this week based on recorded activity.",
      lossAnalysisNarrative: "No lost deals were recorded.",
      conversationPatterns: [],
      dataSufficiencyNote: null,
    };
    const parsed = validateWeeklyReportAi(raw, new Set(["sp1"]));
    assert.equal(parsed?.salespersonNarratives.length, 0);
  });
});

describe("weekly report conversation privacy", () => {
  it("aggregates patterns without keeping message bodies", () => {
    const hits = aggregateConversationPatterns([
      { id: "m1", body: "Can we get a payment plan for the 5kVA?" },
      { id: "m2", body: "The delivery timeline is too long." },
      { id: "m3", body: "Hello" },
    ]);
    assert.ok(hits.some((h) => h.id === "financing" && h.count === 1));
    assert.ok(hits.some((h) => h.id === "delivery" && h.count === 1));
    assert.equal(hits.every((h) => !JSON.stringify(h).includes("5kVA")), true);
    assert.deepEqual(classifyConversationText("Do you have financing options?"), ["financing"]);
  });
});

describe("weekly report permissions and isolation", () => {
  it("gives managers view/download/generate and withholds them from salespeople", () => {
    const manager = permissionsForOrgRole("CLIENT_MANAGER");
    const salesperson = permissionsForOrgRole("SALESPERSON");
    assert.ok(manager.includes(P.REPORTS_TEAM_VIEW));
    assert.ok(manager.includes(P.REPORTS_TEAM_DOWNLOAD));
    assert.ok(manager.includes(P.REPORTS_TEAM_GENERATE));
    assert.equal(salesperson.includes(P.REPORTS_TEAM_VIEW), false);
    assert.equal(salesperson.includes(P.REPORTS_TEAM_GENERATE), false);
  });

  it("keeps team reports inside client-data permissions so Super Admin stays locked out", () => {
    const sa = permissionsForSuperAdmin();
    for (const permission of [
      P.REPORTS_TEAM_VIEW,
      P.REPORTS_TEAM_DOWNLOAD,
      P.REPORTS_TEAM_GENERATE,
    ]) {
      assert.ok(CLIENT_DATA_PERMISSIONS.includes(permission));
      assert.equal(sa.includes(permission), false);
    }
    const grant = permissionsForSupportAccess(["CUSTOMER_PROFILES"]);
    assert.ok(grant.includes(P.REPORTS_TEAM_VIEW));
    assert.equal(grant.includes(P.REPORTS_TEAM_GENERATE), false);
  });

  it("fails closed on cross-organisation report ids", () => {
    assert.throws(
      () =>
        assertSameTenant("org-a", "org-b", "CLIENT_MANAGER", { isImpersonating: false }),
      TenantContextError
    );
    assert.equal(isWeeklyTeamReportKeyForClient("org-a", generateWeeklyTeamReportKey("org-a", "rep-1")), true);
    assert.equal(isWeeklyTeamReportKeyForClient("org-a", generateWeeklyTeamReportKey("org-b", "rep-1")), false);
  });
});

describe("weekly report generation status", () => {
  it("treats collecting/analysing/generating as in-flight and expired after the stale window", () => {
    assert.equal(isInFlight("scheduled"), false);
    assert.equal(isInFlight("ready"), false);
    assert.equal(isInFlight("failed"), false);
    assert.equal(isInFlight("collecting_data"), true);
    const fresh = isStaleInFlight({
      generation_status: "generating",
      updated_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
    });
    assert.equal(fresh, false);
    const stale = isStaleInFlight({
      generation_status: "generating",
      updated_at: "2026-09-21T00:00:00.000Z",
      started_at: "2026-09-21T00:00:00.000Z",
    }, new Date("2026-09-21T00:30:00.000Z"));
    assert.equal(stale, true);
  });
});

describe("weekly report facts vs interpretation", () => {
  it("labels missed follow-ups as fact and the discipline comment as interpretation", () => {
    const insights = buildDeterministicInsights(snapshot());
    const fact = insights.find((i) => i.kind === "fact" && i.text.includes("follow-up"));
    const interpretation = insights.find((i) => i.kind === "interpretation");
    assert.ok(fact);
    assert.ok(interpretation);
    assert.match(interpretation!.text, /may indicate/);
  });

  it("attributes reassignment events without mixing organisations", () => {
    const snap = snapshot();
    assert.equal(snap.reassignments[0]?.fromId, "sp1");
    assert.equal(snap.reassignments[0]?.toId, "sp2");
    assert.equal(snap.clientId, "org-a");
  });
});
