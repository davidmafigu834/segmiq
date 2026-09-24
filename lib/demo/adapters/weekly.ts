import { buildFallbackAi } from "@/lib/sales/weekly-team-report/fallback";
import { mergeAiIntoPayload } from "@/lib/sales/weekly-team-report/analyse";
import { DEFAULT_PIPELINE_HEALTH } from "@/lib/sales/weekly-team-report/config";
import { previousCompletedWeek } from "@/lib/sales/weekly-team-report/period";
import type {
  PeriodFacts,
  WeeklyReportDetail,
  WeeklyReportListItem,
  WeeklyTeamSnapshot,
} from "@/lib/sales/weekly-team-report/types";
import { demoId } from "@/lib/demo/ids";
import { summariseDemo } from "@/lib/demo/totals";
import type { DemoDataset } from "@/lib/demo/types";

const TZ = "Africa/Harare";

function emptyFacts(partial: Partial<PeriodFacts> = {}): PeriodFacts {
  return {
    newLeads: 11,
    contactedLeads: 9,
    qualifiedLeads: 8,
    dealsCreated: 4,
    quotationsSent: 9,
    quotationsAccepted: 2,
    dealsWon: 2,
    dealsLost: 1,
    revenueWon: 0,
    pipelineValue: 0,
    avgFirstResponseMinutes: 18,
    delayedResponses: 2,
    onTimeResponses: 9,
    delayedByHour: {},
    followUpsCompleted: 6,
    followUpsMissed: 4,
    overdueTasks: 3,
    appointments: 2,
    dealsProgressed: 5,
    inboundMessages: 14,
    outboundMessages: 16,
    conversionRate: 0.31,
    quotationToWinRate: 0.22,
    leadsByPerson: {},
    ...partial,
  };
}

export function demoWeeklyReportId(now = new Date()): string {
  const period = previousCompletedWeek(now, TZ);
  return demoId(`rossi:weekly:${period.startDate}`);
}

export function buildDemoWeeklyDetail(dataset: DemoDataset, now = new Date()): WeeklyReportDetail {
  const summary = summariseDemo(dataset, now);
  const period = previousCompletedWeek(now, TZ);
  const previous = previousCompletedWeek(new Date(period.startIso), TZ);
  const salespeople = Object.values(dataset.actors).filter((actor) => actor.role === "SALESPERSON");
  const lost = summary.lost.slice(0, 3).map((deal) => ({
    id: deal.id,
    displayName: dataset.leads.find((lead) => lead.id === deal.originating_lead_id)?.name ?? deal.name,
    salespersonId: deal.owner_id,
    salespersonName: salespeople.find((actor) => actor.id === deal.owner_id)?.name ?? null,
    value: deal.estimated_value,
    stageAtLoss: "Negotiation",
    reason: deal.lost_reason ?? "Reason not recorded",
  }));

  const snapshot: WeeklyTeamSnapshot = {
    clientId: dataset.clientId,
    organisationName: dataset.organisationName,
    organisationLogoUrl: null,
    currency: "USD",
    timezone: TZ,
    period,
    previousPeriod: previous,
    nowIso: now.toISOString(),
    health: DEFAULT_PIPELINE_HEALTH,
    salespeople: salespeople.map((actor) => ({
      id: actor.id,
      name: actor.name,
      active: true,
      role: "SALESPERSON",
    })),
    current: emptyFacts({
      pipelineValue: summary.pipelineValue,
      revenueWon: Math.round(summary.wonValue / 4),
      quotationsSent: summary.awaitingQuotes,
    }),
    previous: emptyFacts({ newLeads: 8, quotationsSent: 6, revenueWon: Math.round(summary.wonValue / 5) }),
    activePipeline: dataset.deals
      .filter((deal) => ["QUALIFIED", "SCOPING", "PROPOSAL_SENT", "NEGOTIATING"].includes(deal.stage))
      .map((deal) => ({
        id: deal.id,
        originatingLeadId: deal.originating_lead_id,
        title: deal.name,
        ownerId: deal.owner_id,
        ownerName: salespeople.find((actor) => actor.id === deal.owner_id)?.name ?? null,
        stage: deal.stage,
        value: deal.estimated_value,
        lastActivityAt: deal.last_meaningful_activity_at,
        nextActionAt: deal.next_action_at,
        nextActionLabel: deal.next_action_label,
        expectedDecisionAt: deal.expected_decision_at,
        createdAt: deal.created_at,
        hasOpenQuote: dataset.quotations.some((quote) => quote.deal_id === deal.id && (quote.status === "sent" || quote.status === "viewed")),
        quoteSentAt: dataset.quotations.find((quote) => quote.deal_id === deal.id)?.sent_at ?? null,
        quoteFollowedUp: false,
        customerWaiting: deal.stage === "PROPOSAL_SENT",
      })),
    openQuotes: dataset.quotations
      .filter((quote) => quote.status === "sent" || quote.status === "viewed")
      .map((quote) => ({
        id: quote.id,
        dealId: quote.deal_id ?? null,
        leadId: quote.lead_id,
        preparedById: quote.prepared_by_id,
        status: quote.status,
        total: quote.total,
        sentAt: quote.sent_at,
      })),
    lostThisWeek: lost,
    lostPreviousWeek: [],
    attentionSeed: [],
    conversation: { scannedCount: dataset.messages.length, truncated: false, patterns: [] },
    reassignments: [],
    activityVolume: dataset.activities.length,
  };

  const ai = buildFallbackAi(snapshot);
  ai.executiveSummary =
    "The team performed strongly in new enquiry response times this week, but several quotations remain without follow-up. " +
    `${summary.awaitingQuotes} quotations are currently awaiting customer responses, representing significant open pipeline value. ` +
    "Tinashe generated the highest number of qualified retail opportunities, while Tanaka managed the largest B2B opportunity. " +
    "The primary improvement area is quotation follow-up between 24 and 72 hours after sending.";
  ai.lossAnalysisNarrative =
    "Lost opportunities this period include competitor pricing, no response, postponed purchases, and a size that was not in stock. Simba Transport went with a competitor on a 12-tyre commercial quote.";
  const payload = mergeAiIntoPayload(snapshot, ai);
  const id = demoId(`rossi:weekly:${period.startDate}`);
  const list: WeeklyReportListItem = {
    id,
    periodStartDate: period.startDate,
    periodEndDate: period.endDate,
    periodLabel: payload.cover.periodLabel,
    generatedAt: now.toISOString(),
    status: "ready",
    headline: "Quotation follow-up is the main gap",
    findingCount: payload.insights.length,
    hasPdf: false,
    currency: "USD",
    lowData: false,
    newLeads: snapshot.current.newLeads,
    dealsWon: summary.wonCount,
    revenueWon: summary.wonValue,
    keyIssue: "Quotations awaiting follow-up",
  };
  return {
    ...list,
    timezone: TZ,
    reportVersion: 1,
    aiStatus: "demo",
    pdfStatus: "not_requested",
    generationError: null,
    payload,
  };
}

export function buildDemoWeeklyList(dataset: DemoDataset, now = new Date()): WeeklyReportListItem[] {
  const detail = buildDemoWeeklyDetail(dataset, now);
  const { payload: _payload, timezone: _tz, reportVersion: _v, aiStatus: _a, pdfStatus: _p, generationError: _e, ...item } = detail;
  return [item];
}
