import { calendarDateKey, companyCalendarOwnerKey } from "./format";
import type {
  CompanyCalendarExecutionMetrics,
  CompanyCalendarExecutionSummary,
  CompanyCalendarEventSource,
  CompanyCalendarEventStatus,
} from "./types";

export type CompanyCalendarSummarySignal = {
  ownerId: string | null;
  sourceType: CompanyCalendarEventSource;
  startAt: string;
  completedAt: string | null;
  status: CompanyCalendarEventStatus;
  atRisk: boolean;
};

export type CompanyCalendarSummaryPeriod = {
  nowIso: string;
  todayKey: string;
  nextSevenDaysEndIso: string;
  weekStartIso: string;
  weekEndIso: string;
  timezone: string;
};

function emptyMetrics(
  responseTimeMinutes: number | null,
  responseTimeMinutesPrevious: number | null
): CompanyCalendarExecutionMetrics {
  return {
    upcomingActivities: 0,
    overdueFollowUps: 0,
    todayActivities: 0,
    completedWeek: 0,
    atRiskActivities: 0,
    responseTimeMinutes,
    responseTimeMinutesPrevious,
  };
}

export function buildCompanyCalendarExecutionMetrics(
  signals: CompanyCalendarSummarySignal[],
  period: CompanyCalendarSummaryPeriod,
  responseTimeMinutes: number | null,
  responseTimeMinutesPrevious: number | null
): CompanyCalendarExecutionMetrics {
  const metrics = emptyMetrics(responseTimeMinutes, responseTimeMinutesPrevious);
  const nextSevenEnd = Date.parse(period.nextSevenDaysEndIso);
  const weekStart = Date.parse(period.weekStartIso);
  const weekEnd = Date.parse(period.weekEndIso);

  for (const signal of signals) {
    const start = Date.parse(signal.startAt);
    const isResolved = signal.status === "completed" || signal.status === "cancelled";
    const dateKey = calendarDateKey(signal.startAt, period.timezone);
    if (
      signal.status === "scheduled" &&
      dateKey >= period.todayKey &&
      start < nextSevenEnd
    ) {
      metrics.upcomingActivities += 1;
    }
    if (signal.sourceType === "lead_follow_up" && signal.status === "overdue") {
      metrics.overdueFollowUps += 1;
    }
    if (dateKey === period.todayKey && signal.status !== "cancelled") {
      metrics.todayActivities += 1;
    }
    const completed = Date.parse(signal.completedAt ?? signal.startAt);
    if (signal.status === "completed" && completed >= weekStart && completed < weekEnd) {
      metrics.completedWeek += 1;
    }
    if (signal.atRisk && !isResolved) metrics.atRiskActivities += 1;
  }
  return metrics;
}

export function buildCompanyCalendarExecutionSummary({
  signals,
  ownerIds,
  period,
  responseAll,
  responseByOwner,
}: {
  signals: CompanyCalendarSummarySignal[];
  ownerIds: string[];
  period: CompanyCalendarSummaryPeriod;
  responseAll: { current: number | null; previous: number | null };
  responseByOwner: Record<string, { current: number | null; previous: number | null }>;
}): CompanyCalendarExecutionSummary {
  const byOwner: Record<string, CompanyCalendarExecutionMetrics> = {};
  for (const ownerId of ownerIds) {
    const response = responseByOwner[ownerId] ?? { current: null, previous: null };
    byOwner[ownerId] = buildCompanyCalendarExecutionMetrics(
      signals.filter((signal) => companyCalendarOwnerKey(signal.ownerId) === ownerId),
      period,
      response.current,
      response.previous
    );
  }
  return {
    all: buildCompanyCalendarExecutionMetrics(
      signals,
      period,
      responseAll.current,
      responseAll.previous
    ),
    byOwner,
    definition: {
      upcoming: "Scheduled, unresolved company activities from today through the next 7 days.",
      overdue: "Lead follow-ups whose canonical due date has passed and remain unresolved.",
      today: "Scheduled or completed activities on the current company-local date; cancelled items are excluded.",
      completed: "Canonical follow-up completions and explicitly completed visits recorded in the current company-local week.",
      response: "Average Lead captured to first meaningful salesperson response for Leads captured in the last 30 days.",
      atRisk: "Unresolved overdue follow-ups, passed unresolved visits, or scheduled actions attached to deterministically at-risk Deals.",
    },
  };
}
