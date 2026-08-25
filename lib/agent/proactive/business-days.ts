import { wallTimeToUtc } from "@/lib/agent/dates";
import { localClockInTimezone } from "@/lib/sales/intelligence/operating-hours";
import { addDaysToDateOnly, planDateInTimezone } from "@/lib/sales/intelligence/timezone";

const FALLBACK_WORKING_DAYS = [1, 2, 3, 4, 5];

/**
 * Add N company business days, keeping the original local wall-clock time.
 * Friday 10:00 + 2 business days → Tuesday 10:00 (not Sunday).
 */
export function addBusinessDays(opts: {
  from: Date;
  days: number;
  timezone: string;
  workingDays?: readonly number[];
}): Date {
  const workingDays = opts.workingDays?.length ? opts.workingDays : FALLBACK_WORKING_DAYS;
  const clock = localClockInTimezone(opts.from, opts.timezone);
  let cursor = clock.date;
  const step = opts.days < 0 ? -1 : 1;
  let remaining = Math.abs(Math.floor(opts.days));
  let guard = 0;
  while (remaining > 0 && guard < 400) {
    cursor = addDaysToDateOnly(cursor, step);
    const probe = wallTimeToUtc(opts.timezone, ...dateParts(cursor), 12, 0);
    const weekday = localClockInTimezone(probe, opts.timezone).weekday;
    if (workingDays.includes(weekday)) remaining -= 1;
    guard += 1;
  }
  return wallTimeToUtc(
    opts.timezone,
    ...dateParts(cursor),
    clock.hour,
    clock.minute
  );
}

export function businessDaysBetween(opts: {
  from: Date;
  to: Date;
  timezone: string;
  workingDays?: readonly number[];
}): number {
  const workingDays = opts.workingDays?.length ? opts.workingDays : FALLBACK_WORKING_DAYS;
  if (opts.to.getTime() <= opts.from.getTime()) return 0;
  let count = 0;
  let cursor = planDateInTimezone(opts.from, opts.timezone);
  const end = planDateInTimezone(opts.to, opts.timezone);
  let guard = 0;
  while (cursor < end && guard < 400) {
    cursor = addDaysToDateOnly(cursor, 1);
    const probe = wallTimeToUtc(opts.timezone, ...dateParts(cursor), 12, 0);
    const weekday = localClockInTimezone(probe, opts.timezone).weekday;
    if (workingDays.includes(weekday)) count += 1;
    guard += 1;
  }
  return count;
}

function dateParts(isoDate: string): [number, number, number] {
  const [y, m, d] = isoDate.split("-").map(Number);
  return [y, m, d];
}
