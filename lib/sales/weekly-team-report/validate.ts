import { sanitizePdfText, finiteNumber, finitePct } from "./presentation";
import { conversationReliability } from "./presentation";
import type {
  AttentionItem,
  ComparedMetric,
  ConversationPattern,
  FunnelStageResult,
  PipelineHealthBucket,
  SalespersonNarrative,
  WeeklyReportPayload,
} from "./types";

function walkStrings<T>(value: T): T {
  if (typeof value === "string") return sanitizePdfText(value) as T;
  if (Array.isArray(value)) return value.map((item) => walkStrings(item)) as T;
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      next[key] = walkStrings(entry);
    }
    return next as T;
  }
  return value;
}

function cleanMetric(metric: ComparedMetric): ComparedMetric {
  const current =
    metric.current == null ? null : Number.isFinite(metric.current) ? metric.current : null;
  const previous =
    metric.previous == null ? null : Number.isFinite(metric.previous) ? metric.previous : null;
  const delta = current == null || previous == null ? null : current - previous;
  const pct =
    metric.trend.pct == null || !Number.isFinite(metric.trend.pct) ? null : metric.trend.pct;
  return {
    ...metric,
    label: sanitizePdfText(metric.label, "Metric"),
    current,
    previous,
    delta,
    trend: {
      ...metric.trend,
      pct,
      label: sanitizePdfText(metric.trend.label, "No prior comparison"),
    },
  };
}

function cleanFunnel(stages: FunnelStageResult[]): FunnelStageResult[] {
  const seen = new Set<string>();
  return stages
    .filter((stage) => {
      if (seen.has(stage.id)) return false;
      seen.add(stage.id);
      return true;
    })
    .map((stage) => ({
      ...stage,
      label: sanitizePdfText(stage.label, "Stage"),
      count: Math.max(0, Math.round(finiteNumber(stage.count))),
      conversionPct: finitePct(stage.conversionPct),
      dropOff: Math.max(0, Math.round(finiteNumber(stage.dropOff))),
      sequential: stage.sequential !== false && stage.id !== "won",
      note: stage.note ? sanitizePdfText(stage.note) : null,
      bottleneck: Boolean(stage.bottleneck),
    }));
}

function cleanAttention(items: AttentionItem[]): AttentionItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.entityKind}:${item.entityId}`;
    if (!item.entityId || seen.has(key)) return false;
    seen.add(key);
    return Boolean(sanitizePdfText(item.displayName) || sanitizePdfText(item.reason));
  }).map((item) => ({
    ...item,
    displayName: sanitizePdfText(item.displayName, "Unnamed opportunity"),
    salespersonName: sanitizePdfText(item.salespersonName, "Unassigned"),
    stageLabel: sanitizePdfText(item.stageLabel, "Stage not recorded"),
    latestEvent: sanitizePdfText(item.latestEvent, "No recent event"),
    reason: sanitizePdfText(item.reason, "Opportunity needs a review."),
    recommendedAction: sanitizePdfText(item.recommendedAction, "Confirm the next action and owner."),
    value: item.value == null || !Number.isFinite(item.value) ? null : item.value,
    daysInactive: item.daysInactive == null || !Number.isFinite(item.daysInactive) ? null : item.daysInactive,
    priorityTag: item.priorityTag ?? null,
  }));
}

function cleanPeople(people: SalespersonNarrative[]): SalespersonNarrative[] {
  return people
    .filter((person) => person.salespersonId)
    .map((person) => ({
      ...person,
      name: sanitizePdfText(person.name, "Unnamed salesperson"),
      narrative: sanitizePdfText(person.narrative),
      coachingFocus: sanitizePdfText(person.coachingFocus),
      metrics: person.metrics.map(cleanMetric),
      strengths: person.strengths.map((row) => sanitizePdfText(row)).filter(Boolean),
      concerns: person.concerns.map((row) => sanitizePdfText(row)).filter(Boolean),
    }));
}

function cleanConversation(rows: ConversationPattern[]): ConversationPattern[] {
  const seen = new Set<string>();
  return rows
    .filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    })
    .map((row) => ({
      ...row,
      label: sanitizePdfText(row.label, "Theme"),
      count: Math.max(0, Math.round(finiteNumber(row.count))),
      interpretation: sanitizePdfText(row.interpretation),
      reliability: row.reliability ?? conversationReliability(row.count),
    }));
}

function cleanBuckets(buckets: PipelineHealthBucket[]): PipelineHealthBucket[] {
  return buckets.map((bucket) => ({
    ...bucket,
    label: sanitizePdfText(bucket.label, bucket.id),
    count: Math.max(0, Math.round(finiteNumber(bucket.count))),
    value: Math.max(0, finiteNumber(bucket.value)),
    pct: finitePct(bucket.pct),
    causes: bucket.causes.map((cause) => sanitizePdfText(cause)).filter(Boolean),
  }));
}

function validCurrency(code: string): string {
  const cleaned = sanitizePdfText(code).toUpperCase();
  return /^[A-Z]{3}$/.test(cleaned) ? cleaned : "USD";
}

/**
 * Repair a payload so the PDF never prints NaN, broken names, or empty required labels.
 * Missing intelligence is compressed, not invented.
 */
export function preparePayloadForPdf(payload: WeeklyReportPayload): WeeklyReportPayload {
  const walked = walkStrings(payload);
  const cover = {
    ...walked.cover,
    organisationName: sanitizePdfText(walked.cover.organisationName, "Organisation"),
    title: sanitizePdfText(walked.cover.title, "Weekly Sales Performance Report"),
    periodLabel: sanitizePdfText(walked.cover.periodLabel, "Reporting period unavailable"),
    generatedAtLabel: sanitizePdfText(walked.cover.generatedAtLabel, "Date unavailable"),
    preparedBy: sanitizePdfText(walked.cover.preparedBy, "Prepared by SegmiQ Intelligence"),
    timezone: sanitizePdfText(walked.cover.timezone, ""),
    currency: validCurrency(walked.cover.currency),
    organisationLogoUrl: walked.cover.organisationLogoUrl,
  };

  const ai = {
    ...walked.ai,
    executiveSummary: sanitizePdfText(walked.ai.executiveSummary),
    whatWentWell: sanitizePdfText(walked.ai.whatWentWell),
    whereMomentumWasLost: sanitizePdfText(walked.ai.whereMomentumWasLost),
    biggestRisk: sanitizePdfText(walked.ai.biggestRisk),
    biggestOpportunity: sanitizePdfText(walked.ai.biggestOpportunity),
    priorityForNextWeek: sanitizePdfText(walked.ai.priorityForNextWeek),
    managerRecommendations: walked.ai.managerRecommendations
      .filter((row) => sanitizePdfText(row.title) && sanitizePdfText(row.action))
      .slice(0, 6)
      .map((row) => ({
        title: sanitizePdfText(row.title),
        evidence: sanitizePdfText(row.evidence),
        action: sanitizePdfText(row.action),
        objective: sanitizePdfText(row.objective),
      })),
    nextWeekPriorities: walked.ai.nextWeekPriorities
      .filter((row) => sanitizePdfText(row.title))
      .slice(0, 6)
      .map((row) => ({
        ...row,
        title: sanitizePdfText(row.title),
        ownerLabel: sanitizePdfText(row.ownerLabel, "Sales team"),
        affectedCount: Math.max(0, Math.round(finiteNumber(row.affectedCount))),
        pipelineValue:
          row.pipelineValue == null || !Number.isFinite(row.pipelineValue) ? null : row.pipelineValue,
        summary: row.summary ? sanitizePdfText(row.summary) : null,
      })),
    meetingAgenda: walked.ai.meetingAgenda.map((item) => sanitizePdfText(item)).filter(Boolean),
    pipelineNarrative: sanitizePdfText(walked.ai.pipelineNarrative),
    lossAnalysisNarrative: sanitizePdfText(walked.ai.lossAnalysisNarrative),
    dataSufficiencyNote: walked.ai.dataSufficiencyNote
      ? sanitizePdfText(walked.ai.dataSufficiencyNote)
      : null,
  };

  const responseCoverage = walked.responseCoverage ?? {
    contactedAverageMinutes: null,
    newLeads: 0,
    contactedLeads: 0,
    onTime: 0,
    missedSla: 0,
    slaHours: 2,
  };

  return {
    ...walked,
    cover,
    ai,
    metrics: walked.metrics.map(cleanMetric),
    funnel: cleanFunnel(walked.funnel),
    funnelExplanation: walked.funnelExplanation
      .map((row) => ({ ...row, text: sanitizePdfText(row.text) }))
      .filter((row) => row.text),
    pipelineHealth: cleanBuckets(walked.pipelineHealth),
    pipelineHealthNarrative: sanitizePdfText(walked.pipelineHealthNarrative),
    attention: cleanAttention(walked.attention),
    salespeople: cleanPeople(walked.salespeople),
    conversation: cleanConversation(walked.conversation),
    lostDeals: {
      ...walked.lostDeals,
      count: Math.max(0, Math.round(finiteNumber(walked.lostDeals.count))),
      previousCount: Math.max(0, Math.round(finiteNumber(walked.lostDeals.previousCount))),
      value: Math.max(0, finiteNumber(walked.lostDeals.value)),
      previousValue: Math.max(0, finiteNumber(walked.lostDeals.previousValue)),
      narrative: sanitizePdfText(walked.lostDeals.narrative),
      rows: walked.lostDeals.rows.map((row) => ({
        ...row,
        displayName: sanitizePdfText(row.displayName, "Unnamed opportunity"),
        salespersonName: sanitizePdfText(row.salespersonName, "Unassigned"),
        reason: sanitizePdfText(row.reason, "Reason not recorded"),
        value: row.value == null || !Number.isFinite(row.value) ? null : row.value,
      })),
      reasonCounts: walked.lostDeals.reasonCounts.map((row) => ({
        reason: sanitizePdfText(row.reason, "Reason not recorded"),
        count: Math.max(0, Math.round(finiteNumber(row.count))),
      })),
    },
    insights: walked.insights
      .map((row) => ({ ...row, text: sanitizePdfText(row.text) }))
      .filter((row) => row.text),
    responseCoverage: {
      contactedAverageMinutes:
        responseCoverage.contactedAverageMinutes == null ||
        !Number.isFinite(responseCoverage.contactedAverageMinutes)
          ? null
          : responseCoverage.contactedAverageMinutes,
      newLeads: Math.max(0, Math.round(finiteNumber(responseCoverage.newLeads))),
      contactedLeads: Math.max(0, Math.round(finiteNumber(responseCoverage.contactedLeads))),
      onTime: Math.max(0, Math.round(finiteNumber(responseCoverage.onTime))),
      missedSla: Math.max(0, Math.round(finiteNumber(responseCoverage.missedSla))),
      slaHours: Math.max(0, finiteNumber(responseCoverage.slaHours, 2)),
    },
  };
}
