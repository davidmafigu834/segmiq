import { reportTrend, type ReportTrend } from "@/lib/sales/company-reports/metrics";
import type { ComparedMetric, PeriodFacts } from "./types";

export function pctChangeSafe(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

export function comparedMetric(
  id: string,
  label: string,
  current: number | null,
  previous: number | null,
  format: ComparedMetric["format"],
  invertGood = false
): ComparedMetric {
  const trend: ReportTrend =
    current == null || previous == null
      ? { direction: "none", pct: null, label: "No prior comparison" }
      : reportTrend(current, previous);
  return {
    id,
    label,
    current,
    previous,
    delta: current == null || previous == null ? null : current - previous,
    trend,
    format,
    invertGood,
  };
}

export function conversionRate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

export function teamMetrics(current: PeriodFacts, previous: PeriodFacts): ComparedMetric[] {
  return [
    comparedMetric("new_leads", "New leads", current.newLeads, previous.newLeads, "count"),
    comparedMetric("contacted_leads", "Contacted leads", current.contactedLeads, previous.contactedLeads, "count"),
    comparedMetric("qualified_leads", "Qualified leads", current.qualifiedLeads, previous.qualifiedLeads, "count"),
    comparedMetric("deals_created", "Deals created", current.dealsCreated, previous.dealsCreated, "count"),
    comparedMetric("quotations_sent", "Quotations sent", current.quotationsSent, previous.quotationsSent, "count"),
    comparedMetric(
      "quotations_accepted",
      "Quotations accepted",
      current.quotationsAccepted,
      previous.quotationsAccepted,
      "count"
    ),
    comparedMetric("deals_won", "Deals won", current.dealsWon, previous.dealsWon, "count"),
    comparedMetric("deals_lost", "Deals lost", current.dealsLost, previous.dealsLost, "count", true),
    comparedMetric("revenue_won", "Revenue won", current.revenueWon, previous.revenueWon, "money"),
    comparedMetric("pipeline_value", "Active pipeline value", current.pipelineValue, null, "money"),
    comparedMetric(
      "avg_first_response",
      "Average first response",
      current.avgFirstResponseMinutes,
      previous.avgFirstResponseMinutes,
      "minutes",
      true
    ),
    comparedMetric(
      "follow_ups_completed",
      "Follow-ups completed",
      current.followUpsCompleted,
      previous.followUpsCompleted,
      "count"
    ),
    comparedMetric(
      "follow_ups_missed",
      "Follow-ups missed",
      current.followUpsMissed,
      previous.followUpsMissed,
      "count",
      true
    ),
    comparedMetric("overdue_tasks", "Overdue tasks", current.overdueTasks, previous.overdueTasks, "count", true),
    comparedMetric("appointments", "Appointments", current.appointments, previous.appointments, "count"),
    comparedMetric(
      "conversion_rate",
      "Lead-to-win conversion",
      current.conversionRate,
      previous.conversionRate,
      "percent"
    ),
    comparedMetric(
      "quote_to_win",
      "Quotation-to-win rate",
      current.quotationToWinRate,
      previous.quotationToWinRate,
      "percent"
    ),
  ];
}

export function emptyPersonFacts(): PeriodFacts["leadsByPerson"][string] {
  return {
    leadsAssigned: 0,
    leadsContacted: 0,
    dealsCreated: 0,
    quotationsSent: 0,
    dealsWon: 0,
    dealsLost: 0,
    revenueWon: 0,
    activePipelineValue: 0,
    avgFirstResponseMinutes: null,
    followUpsCompleted: 0,
    missedFollowUps: 0,
    overdueActivities: 0,
    staleDeals: 0,
    conversionRate: null,
  };
}

export function emptyPeriodFacts(): PeriodFacts {
  return {
    newLeads: 0,
    contactedLeads: 0,
    qualifiedLeads: 0,
    dealsCreated: 0,
    quotationsSent: 0,
    quotationsAccepted: 0,
    dealsWon: 0,
    dealsLost: 0,
    revenueWon: 0,
    pipelineValue: 0,
    avgFirstResponseMinutes: null,
    delayedResponses: 0,
    onTimeResponses: 0,
    delayedByHour: {},
    followUpsCompleted: 0,
    followUpsMissed: 0,
    overdueTasks: 0,
    appointments: 0,
    dealsProgressed: 0,
    inboundMessages: 0,
    outboundMessages: 0,
    conversionRate: null,
    quotationToWinRate: null,
    leadsByPerson: {},
  };
}
