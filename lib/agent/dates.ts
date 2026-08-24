import * as chrono from "chrono-node";

/**
 * Deterministic natural-language date/time resolution for the agent.
 *
 * The LLM extracts the raw phrase (e.g. "next Thursday at 10"); this module —
 * not the model — resolves it to a timezone-aware timestamp. Ambiguity is
 * reported, never guessed: "Thursday" without a time yields timeKnown=false
 * so the agent must ask, per policy.
 */

export type ResolvedDateTime = {
  /** UTC instant when the time is known; date at 09:00 local otherwise (do not book on it). */
  iso: string;
  /** Local wall-clock date in the company/customer timezone (YYYY-MM-DD). */
  localDate: string;
  /** Local wall-clock time (HH:mm) when explicitly given. */
  localTime: string | null;
  /** True when the customer stated an explicit clock time. */
  timeKnown: boolean;
  /** Daypart mentioned without exact time ("morning", "afternoon", "evening"). */
  daypart: "morning" | "afternoon" | "evening" | null;
  timezone: string;
};

const DAYPART_PATTERNS: Array<{ daypart: "morning" | "afternoon" | "evening"; re: RegExp }> = [
  { daypart: "morning", re: /\bmorning\b/i },
  { daypart: "afternoon", re: /\b(afternoon|after\s+lunch)\b/i },
  { daypart: "evening", re: /\b(evening|tonight|after\s+work)\b/i },
];

/** Offset of a timezone (ms east of UTC) at a given instant. */
function tzOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(instant)) parts[p.type] = p.value;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === "24" ? "0" : parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - instant.getTime();
}

/** Convert wall-clock components in a timezone to a UTC Date. */
export function wallTimeToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offset1 = tzOffsetMs(guess, timeZone);
  const adjusted = new Date(guess.getTime() - offset1);
  const offset2 = tzOffsetMs(adjusted, timeZone);
  return offset1 === offset2 ? adjusted : new Date(guess.getTime() - offset2);
}

/** Current wall-clock components of `instant` in a timezone. */
function wallClockOf(instant: Date, timeZone: string) {
  const shifted = new Date(instant.getTime() + tzOffsetMs(instant, timeZone));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Resolve a natural-language date/time phrase to a timezone-aware result.
 * Returns null when the phrase does not contain a recognizable date.
 */
export function resolveNaturalDateTime(
  phrase: string,
  opts: { timezone: string; now?: Date }
): ResolvedDateTime | null {
  const text = phrase.trim();
  if (!text) return null;
  const now = opts.now ?? new Date();
  const timezone = opts.timezone || "Africa/Harare";

  // chrono reasons in a fixed reference frame; give it the company wall clock.
  const wall = wallClockOf(now, timezone);
  const reference = new Date(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute
  );

  const results = chrono.parse(text, reference, { forwardDate: true });
  if (!results.length) return null;
  const parsed = results[0];
  const start = parsed.start;

  const year = start.get("year") ?? wall.year;
  const month = start.get("month") ?? wall.month;
  const day = start.get("day") ?? wall.day;
  const timeKnown = start.isCertain("hour");
  const hour = timeKnown ? (start.get("hour") ?? 9) : 9;
  const minute = timeKnown ? (start.get("minute") ?? 0) : 0;

  let daypart: ResolvedDateTime["daypart"] = null;
  if (!timeKnown) {
    for (const { daypart: dp, re } of DAYPART_PATTERNS) {
      if (re.test(text)) {
        daypart = dp;
        break;
      }
    }
  }

  const utc = wallTimeToUtc(timezone, year, month, day, hour, minute);
  return {
    iso: utc.toISOString(),
    localDate: `${year}-${pad(month)}-${pad(day)}`,
    localTime: timeKnown ? `${pad(hour)}:${pad(minute)}` : null,
    timeKnown,
    daypart,
    timezone,
  };
}

/** Human label for confirmations, in the company timezone. */
export function formatLocalDateTime(iso: string, timezone: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatLocalDate(localDate: string): string {
  const [y, m, d] = localDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}
