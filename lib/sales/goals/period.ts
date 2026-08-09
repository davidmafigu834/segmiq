import {
  addMonths,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";

/** Parse `yyyy-MM` or default to current month. */
export function parseGoalPeriodKey(raw: string | null | undefined, now = new Date()): string {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split("-").map(Number);
    if (y && m && m >= 1 && m <= 12) return `${y}-${String(m).padStart(2, "0")}`;
  }
  return format(now, "yyyy-MM");
}

export function goalPeriodBounds(periodKey: string): {
  periodStart: Date;
  periodEnd: Date;
  from: Date;
  toExclusive: Date;
  label: string;
  periodStartIso: string;
  periodEndIso: string;
} {
  const [y, m] = periodKey.split("-").map(Number);
  const start = startOfMonth(new Date(y!, m! - 1, 1));
  const end = endOfMonth(start);
  const toExclusive = startOfMonth(addMonths(start, 1));
  return {
    periodStart: start,
    periodEnd: end,
    from: start,
    toExclusive,
    label: format(start, "MMMM yyyy"),
    periodStartIso: format(start, "yyyy-MM-dd"),
    periodEndIso: format(end, "yyyy-MM-dd"),
  };
}

export function previousPeriodKey(periodKey: string): string {
  const [y, m] = periodKey.split("-").map(Number);
  return format(subMonths(new Date(y!, m! - 1, 1), 1), "yyyy-MM");
}

export function nextPeriodKey(periodKey: string): string {
  const [y, m] = periodKey.split("-").map(Number);
  return format(addMonths(new Date(y!, m! - 1, 1), 1), "yyyy-MM");
}

export function isPeriodInFuture(periodKey: string, now = new Date()): boolean {
  const { from } = goalPeriodBounds(periodKey);
  return isAfter(from, endOfMonth(now));
}

export function isPeriodEnded(periodKey: string, now = new Date()): boolean {
  const { toExclusive } = goalPeriodBounds(periodKey);
  return !isBefore(now, toExclusive) && !isSameMonthKey(periodKey, now);
}

function isSameMonthKey(periodKey: string, now: Date): boolean {
  return periodKey === format(now, "yyyy-MM");
}

export function isPeriodCurrent(periodKey: string, now = new Date()): boolean {
  return isSameMonthKey(periodKey, now);
}

export function goalTypeLabel(type: string): string {
  if (type === "REVENUE_WON") return "Revenue won";
  if (type === "DEALS_WON") return "Deals won";
  if (type === "LEADS_CONVERTED") return "Leads converted";
  return type;
}

export function periodTypeLabel(type: string): string {
  if (type === "MONTHLY") return "Monthly";
  return type;
}

/** Inclusive calendar date string for display. */
export function formatGoalDate(isoDate: string): string {
  try {
    return format(parseISO(isoDate), "d MMM yyyy");
  } catch {
    return isoDate;
  }
}
