import {
  addDays,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { now } from "@/lib/clock";
import { DATE_PRESETS, type DatePreset } from "./types";

export type ResolvedRange = {
  from: Date;
  to: Date;
  label: string;
  preset: DatePreset;
};

export function resolveDatePreset(preset: DatePreset, at: Date = now()): ResolvedRange {
  const today = startOfDay(at);
  switch (preset) {
    case "today":
      return { from: today, to: addDays(today, 1), label: "Today", preset };
    case "yesterday": {
      const from = subDays(today, 1);
      return { from, to: today, label: "Yesterday", preset };
    }
    case "this_week": {
      const from = startOfWeek(today, { weekStartsOn: 1 });
      return { from, to: addDays(today, 1), label: "This week", preset };
    }
    case "last_week": {
      const thisWeek = startOfWeek(today, { weekStartsOn: 1 });
      return {
        from: subWeeks(thisWeek, 1),
        to: thisWeek,
        label: "Last week",
        preset,
      };
    }
    case "this_month":
      return { from: startOfMonth(today), to: addDays(today, 1), label: "This month", preset };
    case "last_month": {
      const start = startOfMonth(today);
      return { from: subMonths(start, 1), to: start, label: "Last month", preset };
    }
    case "last_30":
      return {
        from: subDays(addDays(today, 1), 30),
        to: addDays(today, 1),
        label: "Last 30 days",
        preset,
      };
    case "this_quarter":
      return {
        from: startOfQuarter(today),
        to: addDays(today, 1),
        label: "This quarter",
        preset,
      };
    case "year_to_date":
      return { from: startOfYear(today), to: addDays(today, 1), label: "Year to date", preset };
  }
}

export function parseDatePresetFromText(text: string): DatePreset | null {
  const t = text.toLowerCase();
  if (/\byesterday\b/.test(t)) return "yesterday";
  if (/\btoday\b/.test(t)) return "today";
  if (/\blast\s+week\b/.test(t)) return "last_week";
  if (/\bthis\s+week\b/.test(t)) return "this_week";
  if (/\blast\s+month\b/.test(t)) return "last_month";
  if (/\bthis\s+month\b/.test(t)) return "this_month";
  if (/\blast\s+30\b|\blast\s+thirty\b/.test(t)) return "last_30";
  if (/\bthis\s+quarter\b|\bq[1-4]\b/.test(t)) return "this_quarter";
  if (/\byear\s+to\s+date\b|\bytd\b/.test(t)) return "year_to_date";
  return null;
}

export function isDatePreset(value: string): value is DatePreset {
  return (DATE_PRESETS as readonly string[]).includes(value);
}

export function previousComparableRange(range: ResolvedRange): ResolvedRange {
  const ms = range.to.getTime() - range.from.getTime();
  const to = range.from;
  const from = new Date(to.getTime() - ms);
  return { from, to, label: "Previous period", preset: range.preset };
}
