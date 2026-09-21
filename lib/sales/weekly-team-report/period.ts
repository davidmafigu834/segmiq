import {
  addDaysToDateOnly,
  parseDateOnly,
  planDateInTimezone,
  planDayBoundsUtc,
} from "@/lib/sales/intelligence/timezone";
import type { WeekPeriod } from "./types";

function mondayOf(dateOnly: string): string {
  const d = parseDateOnly(dateOnly);
  if (!d) return dateOnly;
  const dow = d.getUTCDay();
  const back = dow === 0 ? 6 : dow - 1;
  return addDaysToDateOnly(dateOnly, -back);
}

export function weekFromMonday(mondayDate: string, timezone: string): WeekPeriod {
  const sunday = addDaysToDateOnly(mondayDate, 6);
  const nextMonday = addDaysToDateOnly(mondayDate, 7);
  const start = planDayBoundsUtc(mondayDate, timezone);
  const end = planDayBoundsUtc(nextMonday, timezone);
  return {
    startDate: mondayDate,
    endDate: sunday,
    startIso: start.startIso,
    endIsoExclusive: end.startIso,
    timezone,
  };
}

/** Calendar week containing `now` in the organisation timezone (Mon-Sun). */
export function weekContaining(now: Date, timezone: string): WeekPeriod {
  const today = planDateInTimezone(now, timezone);
  return weekFromMonday(mondayOf(today), timezone);
}

/** Most recently completed Mon-Sun week in the organisation timezone. */
export function previousCompletedWeek(now: Date, timezone: string): WeekPeriod {
  const current = weekContaining(now, timezone);
  if (now.getTime() >= new Date(current.endIsoExclusive).getTime()) {
    return current;
  }
  return weekFromMonday(addDaysToDateOnly(current.startDate, -7), timezone);
}

export function immediatelyPreviousWeek(period: WeekPeriod): WeekPeriod {
  return weekFromMonday(addDaysToDateOnly(period.startDate, -7), period.timezone);
}

export function isPeriodComplete(period: WeekPeriod, now: Date): boolean {
  return now.getTime() >= new Date(period.endIsoExclusive).getTime();
}

export function formatPeriodLabel(period: Pick<WeekPeriod, "startDate" | "endDate">): string {
  const start = parseDateOnly(period.startDate);
  const end = parseDateOnly(period.endDate);
  if (!start || !end) return `${period.startDate} - ${period.endDate}`;
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const startMonth = start.toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
  const endMonth = end.toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
  const year = end.getUTCFullYear();
  if (startMonth === endMonth) {
    return `${startDay}-${endDay} ${endMonth} ${year}`;
  }
  return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${year}`;
}

export function hourInTimezone(iso: string, timezone: string): number | null {
  try {
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        hour: "2-digit",
        hour12: false,
      }).format(new Date(iso))
    );
    return Number.isFinite(hour) ? hour : null;
  } catch {
    return null;
  }
}

export function dayPartLabel(hour: number): string {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

export function isoInRange(iso: string | null | undefined, startIso: string, endIsoExclusive: string): boolean {
  if (!iso) return false;
  return iso >= startIso && iso < endIsoExclusive;
}
