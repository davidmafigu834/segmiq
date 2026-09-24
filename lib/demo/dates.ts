/**
 * Relative dates for demo workspaces.
 * Operational timestamps are always derived from "now" in the workspace
 * timezone (Africa/Harare, UTC+2, no DST) so a demo opened months later
 * still reads Today / Yesterday / 2 days ago.
 */

const HARARE_OFFSET_MS = 2 * 60 * 60 * 1000;

function harareShift(now: Date): Date {
  return new Date(now.getTime() + HARARE_OFFSET_MS);
}

/** Midnight at the start of the Harare calendar day containing `now`. */
export function startOfHarareDay(now = new Date()): Date {
  const shifted = harareShift(now);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - HARARE_OFFSET_MS
  );
}

export function startOfHarareMonth(now = new Date()): Date {
  const shifted = harareShift(now);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1) - HARARE_OFFSET_MS
  );
}

/** Monday 00:00 Harare of the week containing `now`. */
export function startOfDemoWeek(now = new Date()): Date {
  const start = startOfHarareDay(now);
  const shifted = harareShift(start);
  const dow = shifted.getUTCDay();
  const mondayDelta = dow === 0 ? 6 : dow - 1;
  return new Date(start.getTime() - mondayDelta * 86_400_000);
}

/** 09:00 on the Harare calendar day of `now`. */
export function demoToday(now = new Date()): Date {
  return new Date(startOfHarareDay(now).getTime() + 9 * 3_600_000);
}

/** 10:00 Harare, `n` calendar days before today. Negative `n` is in the future. */
export function daysAgo(n: number, now = new Date()): Date {
  return new Date(startOfHarareDay(now).getTime() - n * 86_400_000 + 10 * 3_600_000);
}

export function daysFromNow(n: number, now = new Date()): Date {
  return daysAgo(-n, now);
}

export function hoursAgo(n: number, now = new Date()): Date {
  return new Date(now.getTime() - n * 3_600_000);
}

/**
 * A timestamp that stays inside the current Harare month.
 * If `daysBeforeToday` would cross the month boundary, it clamps to the 1st.
 */
export function withinCurrentMonth(daysBeforeToday: number, now = new Date()): Date {
  const start = startOfHarareMonth(now);
  const candidate = daysAgo(daysBeforeToday, now);
  if (candidate.getTime() < start.getTime()) {
    return new Date(start.getTime() + 11 * 3_600_000);
  }
  return candidate;
}

/** A morning on a chosen day of the previous Harare month. */
export function inPreviousMonth(day: number, now = new Date()): Date {
  const start = startOfHarareMonth(now);
  const prevEnd = new Date(start.getTime() - 1);
  const shifted = harareShift(prevEnd);
  const lastDay = shifted.getUTCDate();
  const d = Math.min(Math.max(1, day), lastDay);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), d, 8, 0, 0) - HARARE_OFFSET_MS
  );
}

export function demoIso(date: Date): string {
  return date.toISOString();
}

export function harareDateKey(date: Date): string {
  const shifted = harareShift(date);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
