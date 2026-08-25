import { wallTimeToUtc } from "@/lib/agent/dates";
import { localClockInTimezone, timeToMinutes } from "@/lib/sales/intelligence/operating-hours";
import { addDaysToDateOnly } from "@/lib/sales/intelligence/timezone";
import type { ContactWindow, ProactiveContactWindows } from "./types";
import { DEFAULT_CONTACT_WINDOWS } from "./types";

export function isWithinContactWindow(
  now: Date,
  timezone: string,
  windows: ProactiveContactWindows = DEFAULT_CONTACT_WINDOWS
): boolean {
  const clock = localClockInTimezone(now, timezone);
  const window = windows.days[clock.weekday];
  if (!window) return false;
  const minutes = clock.minutesOfDay;
  return minutes >= timeToMinutes(window.start) && minutes < timeToMinutes(window.end);
}

/**
 * If `at` is inside an allowed window, return it. Otherwise the next window start.
 */
export function nextContactInstant(
  at: Date,
  timezone: string,
  windows: ProactiveContactWindows = DEFAULT_CONTACT_WINDOWS
): Date {
  if (isWithinContactWindow(at, timezone, windows)) return at;
  const clock = localClockInTimezone(at, timezone);
  let date = clock.date;
  for (let i = 0; i < 14; i += 1) {
    const weekday =
      i === 0 ? clock.weekday : localClockInTimezone(noonOn(date, timezone), timezone).weekday;
    const window = windows.days[weekday];
    if (window) {
      const start = instantOn(date, window.start, timezone);
      if (start.getTime() >= at.getTime()) return start;
      if (i === 0) {
        const end = instantOn(date, window.end, timezone);
        if (at.getTime() < end.getTime() && at.getTime() >= start.getTime()) return at;
      }
    }
    date = addDaysToDateOnly(date, 1);
  }
  return at;
}

export function windowForWeekday(
  weekday: number,
  windows: ProactiveContactWindows = DEFAULT_CONTACT_WINDOWS
): ContactWindow {
  return windows.days[weekday] ?? null;
}

function noonOn(date: string, timezone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return wallTimeToUtc(timezone, y, m, d, 12, 0);
}

function instantOn(date: string, hhmm: string, timezone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  return wallTimeToUtc(timezone, y, m, d, h, min);
}
