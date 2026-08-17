/**
 * Timezone helpers for daily plans.
 * Prefer agency/client timezone; fall back to Africa/Harare (existing CRM convention).
 */

import { DEFAULT_SALES_EXECUTION } from "./defaults";

export function resolveSalesTimezone(preferred?: string | null): string {
  const tz = preferred?.trim();
  if (tz) return tz;
  const env = process.env.DEFAULT_TIMEZONE?.trim();
  if (env) return env;
  return DEFAULT_SALES_EXECUTION.timezoneFallback;
}

/** Calendar date YYYY-MM-DD in the given IANA timezone. */
export function planDateInTimezone(now: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // invalid timezone — fall through
  }
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Start/end of plan date as UTC ISO bounds approximated via timezone offset formatting. */
export function planDayBoundsUtc(
  planDate: string,
  timezone: string
): { startIso: string; endIsoExclusive: string } {
  // Use noon probe to find offset, then construct local midnight.
  const [y, m, d] = planDate.split("-").map(Number);
  if (!y || !m || !d) {
    const now = new Date();
    return { startIso: now.toISOString(), endIsoExclusive: now.toISOString() };
  }

  const utcGuess = Date.UTC(y, m - 1, d, 12, 0, 0);
  const offsetMinutes = timezoneOffsetMinutes(new Date(utcGuess), timezone);
  const startMs = Date.UTC(y, m - 1, d, 0, 0, 0) - offsetMinutes * 60_000;
  const endMs = startMs + 24 * 60 * 60 * 1000;
  return {
    startIso: new Date(startMs).toISOString(),
    endIsoExclusive: new Date(endMs).toISOString(),
  };
}

function timezoneOffsetMinutes(date: Date, timezone: string): number {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(date);
    const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
    // e.g. GMT+2, GMT+02:00, GMT-5
    const match = tzName.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
    if (!match) return 0;
    const sign = match[1] === "-" ? -1 : 1;
    const hours = Number(match[2] ?? 0);
    const mins = Number(match[3] ?? 0);
    return sign * (hours * 60 + mins);
  } catch {
    return 0;
  }
}

/** Count remaining working days (inclusive of fromDate when it is a working day). */
export function countWorkingDaysLeft(
  fromPlanDate: string,
  periodEndInclusive: string,
  workingDays: readonly number[] = DEFAULT_SALES_EXECUTION.workingDays,
  includeFromDate = true
): number {
  const start = parseDateOnly(fromPlanDate);
  const end = parseDateOnly(periodEndInclusive);
  if (!start || !end || end < start) return 0;
  const cursor = new Date(start);
  if (!includeFromDate) cursor.setUTCDate(cursor.getUTCDate() + 1);
  if (cursor > end) return 0;
  let count = 0;
  while (cursor <= end) {
    if (workingDays.includes(cursor.getUTCDay())) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

export function parseDateOnly(isoDate: string): Date | null {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatDateOnlyUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysToDateOnly(isoDate: string, days: number): string {
  const start = parseDateOnly(isoDate);
  if (!start) return isoDate;
  start.setUTCDate(start.getUTCDate() + days);
  return formatDateOnlyUtc(start);
}

export function buildIdempotencyKey(parts: {
  salespersonId: string;
  planDate: string;
  actionType: string;
  sourceEntityId: string | null;
  reasonCode: string;
}): string {
  return [
    parts.salespersonId,
    parts.planDate,
    parts.actionType,
    parts.sourceEntityId ?? "none",
    parts.reasonCode,
  ].join("|");
}
