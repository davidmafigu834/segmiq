import { planDayBoundsUtc } from "@/lib/sales/intelligence/timezone";

export type Ymd = { year: number; month: number; day: number };

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function localYmd(instant: Date, timeZone: string): Ymd {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  return { year, month, day };
}

export function addDays(ymd: Ymd, days: number): Ymd {
  const utc = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day + days));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

export function weekdayOf(ymd: Ymd): number {
  return new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day)).getUTCDay();
}

export function ymdKey(ymd: Ymd): string {
  const m = String(ymd.month).padStart(2, "0");
  const d = String(ymd.day).padStart(2, "0");
  return `${ymd.year}-${m}-${d}`;
}

export function atLocalHour(ymd: Ymd, hour: number, minute: number, timeZone: string): string {
  const { startIso } = planDayBoundsUtc(ymdKey(ymd), timeZone);
  return new Date(new Date(startIso).getTime() + (hour * 60 + minute) * 60_000).toISOString();
}

export function existingLocalDay(value: string, timeZone: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return ymdKey(localYmd(parsed, timeZone));
}

export function formatLocalWhen(
  value: string,
  timeZone: string,
  hourSuggested: boolean
): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const noon = atLocalHour({ year, month, day }, 12, 0, timeZone);
    const date = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "long",
      day: "numeric",
      month: "short",
    }).format(new Date(noon));
    return date;
  }
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return value;
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(instant);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(instant);
  return hourSuggested ? `${date} (suggested time ${time})` : `${date} at ${time}`;
}

export type ResolvedWhen = {
  at: string;
  hourSuggested: boolean;
  dayLabel: string;
  ymd: string;
};

function parseExplicitTime(text: string): { hour: number; minute: number } | null {
  const ampm = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (ampm) {
    let hour = Number(ampm[1]);
    const minute = Number(ampm[2] ?? 0);
    const ap = ampm[3].toLowerCase();
    if (ap === "pm" && hour < 12) hour += 12;
    if (ap === "am" && hour === 12) hour = 0;
    if (hour > 23 || minute > 59) return null;
    return { hour, minute };
  }
  const h24 = text.match(/\bat\s+(\d{1,2}):(\d{2})\b/);
  if (h24) {
    const hour = Number(h24[1]);
    const minute = Number(h24[2]);
    if (hour > 23 || minute > 59) return null;
    return { hour, minute };
  }
  if (/\bmorning\b/i.test(text)) return { hour: 9, minute: 0 };
  if (/\bnoon\b/i.test(text)) return { hour: 12, minute: 0 };
  if (/\bafternoon\b/i.test(text)) return { hour: 14, minute: 0 };
  if (/\bevening\b/i.test(text)) return { hour: 17, minute: 0 };
  return null;
}

/**
 * Resolve a relative day from the message's own timestamp in the company timezone.
 * A later job run must not move "tomorrow".
 */
export function resolveCommitmentWhen(
  text: string,
  messageAt: Date,
  timeZone: string,
  defaultHour: number
): ResolvedWhen | null {
  const lower = text.toLowerCase();
  const base = localYmd(messageAt, timeZone);
  let ymd: Ymd | null = null;
  let dayLabel = "";

  const inDays = lower.match(/\bin (\d+) days?\b/);
  const nextWeekday = lower.match(
    /\bnext (sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/
  );
  const weekday = lower.match(
    /\b(?:on |this )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/
  );

  if (/\btomorrow\b/.test(lower)) {
    ymd = addDays(base, 1);
    dayLabel = "tomorrow";
  } else if (/\btoday\b/.test(lower)) {
    ymd = base;
    dayLabel = "today";
  } else if (/\bnext week\b/.test(lower)) {
    ymd = addDays(base, 7);
    dayLabel = "next week";
  } else if (inDays) {
    const n = Number(inDays[1]);
    if (!Number.isFinite(n) || n < 0 || n > 90) return null;
    ymd = addDays(base, n);
    dayLabel = n === 1 ? "tomorrow" : `in ${n} days`;
  } else if (nextWeekday) {
    const target = WEEKDAYS.indexOf(nextWeekday[1]);
    const current = weekdayOf(base);
    let upcoming = (target - current + 7) % 7;
    if (upcoming === 0) upcoming = 7;
    ymd = addDays(base, upcoming + 7);
    dayLabel = `next ${nextWeekday[1]}`;
  } else if (weekday) {
    const target = WEEKDAYS.indexOf(weekday[1]);
    const current = weekdayOf(base);
    const delta = (target - current + 7) % 7;
    ymd = addDays(base, delta);
    dayLabel = weekday[1];
  } else {
    return null;
  }

  const explicit = parseExplicitTime(text);
  const hour = explicit?.hour ?? defaultHour;
  const minute = explicit?.minute ?? 0;
  return {
    at: atLocalHour(ymd, hour, minute, timeZone),
    hourSuggested: !explicit,
    dayLabel,
    ymd: ymdKey(ymd),
  };
}
