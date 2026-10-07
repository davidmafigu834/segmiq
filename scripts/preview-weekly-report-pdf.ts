import React from "react";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { mergeAiIntoPayload } from "../lib/sales/weekly-team-report/analyse";
import { buildFallbackAi } from "../lib/sales/weekly-team-report/fallback";
import { emptyPeriodFacts, emptyPersonFacts } from "../lib/sales/weekly-team-report/metrics";
import { immediatelyPreviousWeek, weekFromMonday } from "../lib/sales/weekly-team-report/period";
import { DEFAULT_PIPELINE_HEALTH } from "../lib/sales/weekly-team-report/config";
import { renderWeeklyTeamReportPdf } from "../lib/sales/weekly-team-report/pdf";
import type { SnapshotDeal, WeeklyTeamSnapshot } from "../lib/sales/weekly-team-report/types";

function deal(overrides: Partial<SnapshotDeal>): SnapshotDeal {
  return {
    id: "d1",
    originatingLeadId: "l1",
    title: "Tendai",
    ownerId: "sp1",
    ownerName: "Tinotenda Ecolus Energy",
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

async function main() {
  console.log("Building sample weekly report payload...");
  const period = weekFromMonday("2026-09-14", "Africa/Harare");
  const current = emptyPeriodFacts();
  current.newLeads = 20;
  current.contactedLeads = 7;
  current.qualifiedLeads = 1;
  current.quotationsSent = 0;
  current.dealsWon = 1;
  current.revenueWon = 1750;
  current.avgFirstResponseMinutes = 3;
  current.delayedResponses = 19;
  current.onTimeResponses = 1;
  current.followUpsMissed = 4;
  current.leadsByPerson = {
    sp1: {
      ...emptyPersonFacts(),
      leadsAssigned: 12,
      leadsContacted: 4,
      quotationsSent: 0,
      dealsWon: 0,
      staleDeals: 19,
      avgFirstResponseMinutes: 4,
    },
    sp2: {
      ...emptyPersonFacts(),
      leadsAssigned: 8,
      leadsContacted: 3,
      quotationsSent: 0,
      dealsWon: 1,
      revenueWon: 1750,
      staleDeals: 6,
      dealsCreated: 1,
      dealsLost: 0,
      activePipelineValue: 8900,
      avgFirstResponseMinutes: 2,
      followUpsCompleted: 2,
      missedFollowUps: 1,
      overdueActivities: 0,
      conversionRate: 12.5,
    },
  };
  const previous = emptyPeriodFacts();
  previous.newLeads = 12;
  previous.avgFirstResponseMinutes = 19;
  previous.contactedLeads = 9;

  const snap: WeeklyTeamSnapshot = {
    clientId: "org-a",
    organisationName: "Ecolus Energy",
    organisationLogoUrl: null,
    currency: "USD",
    timezone: "Africa/Harare",
    period,
    previousPeriod: immediatelyPreviousWeek(period),
    nowIso: "2026-09-21T06:00:00.000Z",
    health: { ...DEFAULT_PIPELINE_HEALTH, slaResponseHours: 2 },
    salespeople: [
      { id: "sp1", name: "Tinotenda Ecolus Energy", active: true, role: "SALESPERSON" },
      { id: "sp2", name: "Benadette Tatenda Fazilahmed", active: true, role: "SALESPERSON" },
    ],
    current,
    previous,
    activePipeline: [
      deal({
        id: "the-deal",
        title: "THE",
        value: 4200,
        ownerId: "sp2",
        ownerName: "Benadette Tatenda Fazilahmed",
        stage: "NEGOTIATING",
        lastActivityAt: "2026-09-11T08:00:00.000Z",
        nextActionAt: null,
        createdAt: "2026-08-01T08:00:00.000Z",
      }),
      deal({
        id: "healthy-1",
        title: "Mutare clinic",
        value: 4190,
        ownerId: "sp2",
        ownerName: "Benadette Tatenda Fazilahmed",
        stage: "QUALIFIED",
        lastActivityAt: "2026-09-19T10:00:00.000Z",
        nextActionAt: "2026-09-22T08:00:00.000Z",
        createdAt: "2026-09-10T08:00:00.000Z",
      }),
      ...Array.from({ length: 24 }, (_, i) =>
        deal({
          id: `stalled-${i + 1}`,
          title: i === 0 ? "José Moyo" : `Quiet opportunity ${i + 1}`,
          value: i === 0 ? 14120 : 1000,
          ownerId: "sp1",
          ownerName: "Tinotenda Ecolus Energy",
          stage: i % 3 === 0 ? "NEGOTIATING" : "QUALIFIED",
          lastActivityAt: "2026-08-20T08:00:00.000Z",
          nextActionAt: null,
          createdAt: "2026-07-01T08:00:00.000Z",
        })
      ),
    ],
    openQuotes: [],
    lostThisWeek: [],
    lostPreviousWeek: [],
    attentionSeed: [
      {
        id: "wait-the",
        entityKind: "deal",
        entityId: "wait-reply",
        displayName: "Harare East enquiry",
        salespersonId: "sp1",
        salespersonName: "Tinotenda Ecolus Energy",
        value: 6200,
        stage: "CONTACTED",
        stageLabel: "Contacted",
        lastActivityAt: "2026-09-20T16:00:00.000Z",
        daysInactive: 0,
        latestEvent: "Customer replied",
        reason: "Customer replied but the salesperson has not responded.",
        recommendedAction: "Reply today.",
        priorityTag: "Reply Today",
      },
    ],
    conversation: {
      scannedCount: 8,
      truncated: false,
      patterns: [
        { id: "pricing", label: "Pricing concerns", count: 3, sampleIds: ["m1", "m2", "m3"] },
        { id: "financing", label: "Payment plans", count: 1, sampleIds: ["m4"] },
        { id: "delivery", label: "Installation timing", count: 1, sampleIds: ["m5"] },
      ],
    },
    reassignments: [],
    activityVolume: 80,
  };

  const payload = mergeAiIntoPayload(snap, buildFallbackAi(snap));
  console.log("Rendering PDF...");
  const buf = await renderWeeklyTeamReportPdf(payload);
  const outDir = path.join(process.cwd(), "tmp");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "weekly-sales-report-sample.pdf");
  writeFileSync(outPath, buf);
  console.log(`Wrote ${outPath} (${buf.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
