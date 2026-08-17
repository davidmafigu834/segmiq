/**
 * Daily focus completion: missed yesterday + consecutive working days without completing.
 */

import { formatGoalDate } from "@/lib/sales/goals/period";
import {
  isWorkingDate,
  previousWorkingDate,
  type WorkdayState,
} from "./operating-hours";
import { addDaysToDateOnly, parseDateOnly } from "./timezone";

export type DailyFocusLog = {
  planDate: string;
  planComplete: boolean;
};

export type DailyFocusStatus = {
  yesterdayMissed: boolean;
  yesterdayLabel: string | null;
  missedStreak: number;
  headline: string | null;
  supporting: string | null;
};

function dateKey(value: string): string {
  return String(value).slice(0, 10);
}

function isOnOrAfter(a: string, b: string): boolean {
  return a >= b;
}

/**
 * Consecutive incomplete working days ending at the last finished workday
 * (yesterday, or today once operating hours have ended).
 * Days before trackingStart are ignored so a newly set goal does not invent history.
 */
export function buildDailyFocusStatus(opts: {
  schedule: WorkdayState;
  logs: DailyFocusLog[];
  todayComplete: boolean;
  trackingStartDate: string;
}): DailyFocusStatus {
  const { schedule, todayComplete } = opts;
  const trackingStart = dateKey(opts.trackingStartDate);
  const logMap = new Map(opts.logs.map((l) => [dateKey(l.planDate), l.planComplete]));

  const includeToday = schedule.isWorkingDay && schedule.afterEnd;
  const cursorStart = includeToday
    ? schedule.planDate
    : previousWorkingDate(schedule.planDate, schedule.hours.workingDays);

  const empty: DailyFocusStatus = {
    yesterdayMissed: false,
    yesterdayLabel: null,
    missedStreak: 0,
    headline: null,
    supporting: null,
  };
  if (!cursorStart) return empty;

  const yesterday = previousWorkingDate(schedule.planDate, schedule.hours.workingDays);
  const yesterdayCounts =
    yesterday != null && isOnOrAfter(yesterday, trackingStart) && isWorkingDate(yesterday, schedule.hours.workingDays);
  const yesterdayComplete = yesterday ? logMap.get(yesterday) === true : false;
  const yesterdayMissed = Boolean(yesterdayCounts && !yesterdayComplete);
  const firstLogDate = opts.logs.reduce<string | null>((min, row) => {
    const key = dateKey(row.planDate);
    if (!min || key < min) return key;
    return min;
  }, null);

  const dayIsComplete = (date: string): boolean => {
    if (date === schedule.planDate) return todayComplete || logMap.get(date) === true;
    return logMap.get(date) === true;
  };

  const dayIsTrackedMiss = (date: string): boolean | "unknown" => {
    if (dayIsComplete(date)) return false;
    if (logMap.has(date)) return true;
    if (date === schedule.planDate && includeToday) return true;
    if (date === yesterday) return true;
    if (firstLogDate && date >= firstLogDate) return true;
    return "unknown";
  };

  let missedStreak = 0;
  let cursor: string | null = cursorStart;
  for (let i = 0; i < 31 && cursor; i += 1) {
    if (!isOnOrAfter(cursor, trackingStart)) break;
    if (!isWorkingDate(cursor, schedule.hours.workingDays)) {
      cursor = previousWorkingDate(cursor, schedule.hours.workingDays);
      continue;
    }
    const miss = dayIsTrackedMiss(cursor);
    if (miss === "unknown" || miss === false) break;
    missedStreak += 1;
    cursor = previousWorkingDate(cursor, schedule.hours.workingDays);
  }

  const yesterdayLabel = yesterdayMissed && yesterday ? formatGoalDate(yesterday) : null;

  let headline: string | null = null;
  if (missedStreak >= 2) {
    headline = `You have ${missedStreak} days without completing your daily focus`;
  } else if (yesterdayMissed) {
    headline = "Yesterday you didn’t complete your daily focus";
  } else if (includeToday && !todayComplete) {
    headline = "You didn’t complete today’s daily focus";
  }

  return {
    yesterdayMissed,
    yesterdayLabel,
    missedStreak,
    headline,
    supporting: yesterdayLabel && missedStreak >= 2 ? `Last missed working day: ${yesterdayLabel}` : null,
  };
}

export function trackingStartDate(opts: {
  periodStart: string;
  goalCreatedAt?: string | null;
  planDate: string;
}): string {
  const period = dateKey(opts.periodStart);
  let created = period;
  if (opts.goalCreatedAt) {
    const parsed = parseDateOnly(dateKey(opts.goalCreatedAt));
    if (parsed) created = dateKey(opts.goalCreatedAt);
  }
  const start = created > period ? created : period;
  return start > opts.planDate ? opts.planDate : start;
}

export function lookbackStartDate(planDate: string, days = 40): string {
  return addDaysToDateOnly(planDate, -days);
}
