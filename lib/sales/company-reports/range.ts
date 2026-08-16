/**
 * Company Reports date-range helpers.
 *
 * Boundaries: `from` inclusive, `to` exclusive (start of the day after the last
 * included calendar day). Previous period is the immediately preceding window
 * of the same millisecond duration — never an arbitrary calendar month.
 *
 * Timezone: calendar math uses the Node process local timezone, matching
 * Company Dashboard (`startOfLocalDay`). SegmiQ does not yet store a
 * per-company reporting timezone.
 */

import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";

export type CompanyReportPresetId =
  | "today"
  | "last_7"
  | "last_30"
  | "this_month"
  | "last_month"
  | "last_90"
  | "custom";

export type ReportGranularity = "day" | "week" | "month";

export const COMPANY_REPORT_PRESETS: { id: CompanyReportPresetId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "last_7", label: "Last 7 days" },
  { id: "last_30", label: "Last 30 days" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "last_90", label: "Last 90 days" },
  { id: "custom", label: "Custom" },
];

export type ReportDateRange = {
  from: Date;
  to: Date;
  label: string;
  preset: CompanyReportPresetId;
};

export function startOfLocalDay(d: Date): Date {
  return startOfDay(d);
}

export function rangeForCompanyPreset(
  id: Exclude<CompanyReportPresetId, "custom">,
  now = new Date()
): ReportDateRange {
  switch (id) {
    case "today": {
      const from = startOfDay(now);
      const to = addDays(from, 1);
      return { from, to, label: "Today", preset: id };
    }
    case "last_7": {
      const to = addDays(startOfDay(now), 1);
      const from = subDays(to, 7);
      return { from, to, label: "Last 7 days", preset: id };
    }
    case "last_30": {
      const to = addDays(startOfDay(now), 1);
      const from = subDays(to, 30);
      return { from, to, label: "Last 30 days", preset: id };
    }
    case "this_month": {
      const from = startOfMonth(now);
      const to = addMonths(from, 1);
      return { from, to, label: "This month", preset: id };
    }
    case "last_month": {
      const thisM = startOfMonth(now);
      const from = subMonths(thisM, 1);
      return { from, to: thisM, label: "Last month", preset: id };
    }
    case "last_90": {
      const to = addDays(startOfDay(now), 1);
      const from = subDays(to, 90);
      return { from, to, label: "Last 90 days", preset: id };
    }
  }
}

/** Equivalent preceding window: same duration, ending where current begins. */
export function previousEquivalentRange(from: Date, to: Date): { from: Date; to: Date } {
  const ms = Math.max(0, to.getTime() - from.getTime());
  return {
    from: new Date(from.getTime() - ms),
    to: new Date(from.getTime()),
  };
}

export function formatRangeLabel(from: Date, toExclusive: Date): string {
  const lastInclusive = subDays(toExclusive, 1);
  if (format(from, "yyyy") === format(lastInclusive, "yyyy")) {
    return `${format(from, "MMM d")} – ${format(lastInclusive, "MMM d, yyyy")}`;
  }
  return `${format(from, "MMM d, yyyy")} – ${format(lastInclusive, "MMM d, yyyy")}`;
}

export function inclusiveDayCount(from: Date, toExclusive: Date): number {
  return Math.max(1, differenceInCalendarDays(toExclusive, from));
}

export function suggestGranularity(from: Date, to: Date): ReportGranularity {
  const days = inclusiveDayCount(from, to);
  if (days <= 45) return "day";
  if (days <= 180) return "week";
  return "month";
}

export type ReportBucket = {
  key: string;
  label: string;
  from: Date;
  to: Date;
};

export function buildReportBuckets(
  from: Date,
  to: Date,
  granularity: ReportGranularity
): ReportBucket[] {
  if (granularity === "day") {
    const lastInclusive = subDays(to, 1);
    if (lastInclusive.getTime() < from.getTime()) {
      return [{ key: format(from, "yyyy-MM-dd"), label: format(from, "MMM d"), from, to }];
    }
    return eachDayOfInterval({ start: from, end: lastInclusive }).map((day) => {
      const start = startOfDay(day);
      return {
        key: format(start, "yyyy-MM-dd"),
        label: format(start, "MMM d"),
        from: start,
        to: addDays(start, 1),
      };
    });
  }

  if (granularity === "week") {
    const weeks = eachWeekOfInterval({ start: from, end: subDays(to, 1) }, { weekStartsOn: 1 });
    return weeks.map((weekStart) => {
      const start = weekStart.getTime() < from.getTime() ? from : weekStart;
      const weekEnd = addWeeks(startOfWeek(weekStart, { weekStartsOn: 1 }), 1);
      const end = weekEnd.getTime() > to.getTime() ? to : weekEnd;
      return {
        key: format(start, "yyyy-MM-dd"),
        label: format(start, "MMM d"),
        from: start,
        to: end,
      };
    });
  }

  const months = eachMonthOfInterval({ start: from, end: subDays(to, 1) });
  return months.map((monthStart) => {
    const start = monthStart.getTime() < from.getTime() ? from : startOfMonth(monthStart);
    const monthEnd = addMonths(startOfMonth(monthStart), 1);
    const end = monthEnd.getTime() > to.getTime() ? to : monthEnd;
    return {
      key: format(start, "yyyy-MM"),
      label: format(start, "MMM yyyy"),
      from: start,
      to: end,
    };
  });
}

export function inRange(iso: string | null | undefined, from: Date, to: Date): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return t >= from.getTime() && t < to.getTime();
}

export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function defaultCompanyReportRange(now = new Date()): ReportDateRange {
  return rangeForCompanyPreset("last_30", now);
}
