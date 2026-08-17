/**
 * Company / salesperson operating hours — day + time aware work calendar.
 * Weekdays follow JS convention: 0 = Sunday … 6 = Saturday.
 */

import { DEFAULT_SALES_EXECUTION } from "./defaults";
import {
  addDaysToDateOnly,
  countWorkingDaysLeft,
  parseDateOnly,
  planDateInTimezone,
} from "./timezone";

export const WEEKDAY_OPTIONS = [
  { value: 1, short: "Mon", label: "Monday" },
  { value: 2, short: "Tue", label: "Tuesday" },
  { value: 3, short: "Wed", label: "Wednesday" },
  { value: 4, short: "Thu", label: "Thursday" },
  { value: 5, short: "Fri", label: "Friday" },
  { value: 6, short: "Sat", label: "Saturday" },
  { value: 0, short: "Sun", label: "Sunday" },
] as const;

const WEEKDAY_FROM_NAME: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

export type OperatingHours = {
  workingDays: number[];
  workStartTime: string;
  workEndTime: string;
};

export type LocalClock = {
  date: string;
  weekday: number;
  weekdayLabel: string;
  dateLabel: string;
  hour: number;
  minute: number;
  minutesOfDay: number;
};

export type WorkdayState = {
  timezone: string;
  planDate: string;
  weekday: number;
  weekdayLabel: string;
  dateLabel: string;
  isWorkingDay: boolean;
  withinHours: boolean;
  beforeStart: boolean;
  afterEnd: boolean;
  workStartLabel: string;
  workEndLabel: string;
  workingDaysLabel: string;
  minutesLeftInWorkday: number | null;
  hours: OperatingHours;
};

export function normalizeTimeHHmm(raw: string | null | undefined, fallback: string): string {
  const match = String(raw ?? "").trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return fallback;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return fallback;
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = normalizeTimeHHmm(hhmm, "00:00").split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function formatClockLabel(hhmm: string): string {
  const minutes = timeToMinutes(hhmm);
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h24 >= 12 ? "pm" : "am";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

export function normalizeWorkingDays(raw: unknown, fallback: readonly number[]): number[] {
  const source = Array.isArray(raw) ? raw : fallback;
  const unique = [...new Set(source.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))];
  unique.sort((a, b) => {
    const order = (d: number) => (d === 0 ? 7 : d);
    return order(a) - order(b);
  });
  return unique.length > 0 ? unique : [...fallback];
}

export function defaultOperatingHours(): OperatingHours {
  return {
    workingDays: [...DEFAULT_SALES_EXECUTION.workingDays],
    workStartTime: DEFAULT_SALES_EXECUTION.workStartTime,
    workEndTime: DEFAULT_SALES_EXECUTION.workEndTime,
  };
}

export function resolveOperatingHours(partial?: {
  workingDays?: number[] | null;
  workStartTime?: string | null;
  workEndTime?: string | null;
} | null): OperatingHours {
  const fallback = defaultOperatingHours();
  return {
    workingDays: normalizeWorkingDays(partial?.workingDays, fallback.workingDays),
    workStartTime: normalizeTimeHHmm(partial?.workStartTime, fallback.workStartTime),
    workEndTime: normalizeTimeHHmm(partial?.workEndTime, fallback.workEndTime),
  };
}

export function formatWorkingDaysLabel(workingDays: readonly number[]): string {
  const set = new Set(workingDays);
  const ordered = WEEKDAY_OPTIONS.filter((d) => set.has(d.value));
  if (ordered.length === 0) return "No working days";
  if (ordered.length === 7) return "Every day";
  const weekdaySet = [1, 2, 3, 4, 5];
  const isWeekdays = weekdaySet.every((d) => set.has(d)) && ordered.length === 5;
  if (isWeekdays) return "Mon–Fri";
  const isMonSat = [1, 2, 3, 4, 5, 6].every((d) => set.has(d)) && ordered.length === 6;
  if (isMonSat) return "Mon–Sat";
  return ordered.map((d) => d.short).join(", ");
}

export function localClockInTimezone(now: Date, timezone: string): LocalClock {
  const date = planDateInTimezone(now, timezone);
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
    const weekdayLabel = get("weekday") || "Monday";
    const weekday = WEEKDAY_FROM_NAME[weekdayLabel] ?? parseDateOnly(date)?.getUTCDay() ?? 1;
    const hour = Number(get("hour")) || 0;
    const minute = Number(get("minute")) || 0;
    const day = get("day");
    const month = get("month");
    const year = get("year");
    return {
      date,
      weekday,
      weekdayLabel,
      dateLabel: day && month && year ? `${day} ${month} ${year}` : date,
      hour,
      minute,
      minutesOfDay: hour * 60 + minute,
    };
  } catch {
    const fallback = parseDateOnly(date);
    return {
      date,
      weekday: fallback?.getUTCDay() ?? 1,
      weekdayLabel: "Monday",
      dateLabel: date,
      hour: now.getUTCHours(),
      minute: now.getUTCMinutes(),
      minutesOfDay: now.getUTCHours() * 60 + now.getUTCMinutes(),
    };
  }
}

export function isWorkingDate(dateOnly: string, workingDays: readonly number[]): boolean {
  const d = parseDateOnly(dateOnly);
  if (!d) return false;
  return workingDays.includes(d.getUTCDay());
}

export function previousWorkingDate(dateOnly: string, workingDays: readonly number[]): string | null {
  let cursor = dateOnly;
  for (let i = 0; i < 14; i += 1) {
    cursor = addDaysToDateOnly(cursor, -1);
    if (isWorkingDate(cursor, workingDays)) return cursor;
  }
  return null;
}

export function nextWorkingDate(dateOnly: string, workingDays: readonly number[]): string | null {
  let cursor = dateOnly;
  for (let i = 0; i < 14; i += 1) {
    cursor = addDaysToDateOnly(cursor, 1);
    if (isWorkingDate(cursor, workingDays)) return cursor;
  }
  return null;
}

export function resolveWorkdayState(
  now: Date,
  timezone: string,
  hours: OperatingHours
): WorkdayState {
  const clock = localClockInTimezone(now, timezone);
  const startMin = timeToMinutes(hours.workStartTime);
  const endMin = timeToMinutes(hours.workEndTime);
  const isWorkingDay = hours.workingDays.includes(clock.weekday);
  const beforeStart = isWorkingDay && clock.minutesOfDay < startMin;
  const afterEnd = isWorkingDay && clock.minutesOfDay >= endMin;
  const withinHours = isWorkingDay && !beforeStart && !afterEnd;
  let minutesLeftInWorkday: number | null = null;
  if (isWorkingDay) {
    if (beforeStart) minutesLeftInWorkday = Math.max(0, endMin - startMin);
    else if (withinHours) minutesLeftInWorkday = Math.max(0, endMin - clock.minutesOfDay);
    else minutesLeftInWorkday = 0;
  }

  return {
    timezone,
    planDate: clock.date,
    weekday: clock.weekday,
    weekdayLabel: clock.weekdayLabel,
    dateLabel: clock.dateLabel,
    isWorkingDay,
    withinHours,
    beforeStart,
    afterEnd,
    workStartLabel: formatClockLabel(hours.workStartTime),
    workEndLabel: formatClockLabel(hours.workEndTime),
    workingDaysLabel: formatWorkingDaysLabel(hours.workingDays),
    minutesLeftInWorkday,
    hours,
  };
}

export function formatHoursLeftLabel(minutes: number | null): string | null {
  if (minutes == null) return null;
  if (minutes <= 0) return "Workday ended";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m} minute${m === 1 ? "" : "s"} left today`;
  if (m === 0) return `${h} hour${h === 1 ? "" : "s"} left today`;
  return `${h}h ${m}m left today`;
}

export function formatDaysLeftLabel(days: number | null): string | null {
  if (days == null) return null;
  if (days <= 0) return "Last working day";
  return `${days} day${days === 1 ? "" : "s"} left`;
}

export function countGoalWorkingDaysLeft(opts: {
  schedule: WorkdayState;
  periodEndInclusive: string;
}): number {
  const includeToday = opts.schedule.isWorkingDay && !opts.schedule.afterEnd;
  return countWorkingDaysLeft(
    opts.schedule.planDate,
    opts.periodEndInclusive,
    opts.schedule.hours.workingDays,
    includeToday
  );
}

export function scheduleSummaryLine(schedule: WorkdayState): string {
  const window = `${schedule.workStartLabel}–${schedule.workEndLabel}`;
  if (!schedule.isWorkingDay) {
    const next = nextWorkingDate(schedule.planDate, schedule.hours.workingDays);
    return `${schedule.weekdayLabel} ${schedule.dateLabel} is a rest day. Work resumes ${next ? `on the next ${schedule.workingDaysLabel} day` : "on the next working day"} ${window}.`;
  }
  if (schedule.beforeStart) {
    return `${schedule.weekdayLabel} ${schedule.dateLabel}. Work starts at ${schedule.workStartLabel} (${window}).`;
  }
  if (schedule.afterEnd) {
    return `${schedule.weekdayLabel} ${schedule.dateLabel}. Work ended at ${schedule.workEndLabel}.`;
  }
  const left = formatHoursLeftLabel(schedule.minutesLeftInWorkday);
  return `${schedule.weekdayLabel} ${schedule.dateLabel} · ${window}${left ? ` · ${left}` : ""}`;
}
