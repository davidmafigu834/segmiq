import {
  addDays,
  addMonths,
  addWeeks,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";

export type ReportPresetId = "this_week" | "this_month" | "last_month" | "last_90" | "custom";

export const REPORT_PRESETS: { id: ReportPresetId; label: string }[] = [
  { id: "this_week", label: "This Week" },
  { id: "this_month", label: "This Month" },
  { id: "last_month", label: "Last Month" },
  { id: "last_90", label: "Last 90 Days" },
  { id: "custom", label: "Custom" },
];

export function rangeForPreset(id: Exclude<ReportPresetId, "custom">): { from: Date; to: Date; label: string } {
  const now = new Date();
  switch (id) {
    case "this_week": {
      const from = startOfWeek(now, { weekStartsOn: 1 });
      const to = addWeeks(from, 1);
      return { from, to, label: "This Week" };
    }
    case "this_month": {
      const from = startOfMonth(now);
      const to = addMonths(from, 1);
      return { from, to, label: "This Month" };
    }
    case "last_month": {
      const thisM = startOfMonth(now);
      const from = subMonths(thisM, 1);
      const to = thisM;
      return { from, to, label: "Last Month" };
    }
    case "last_90": {
      const to = addDays(startOfDay(now), 1);
      const from = subDays(to, 90);
      return { from, to, label: "Last 90 Days" };
    }
  }
}

export function buildReportSearchParams(
  from: Date,
  to: Date,
  label: string,
  clientIds: string[],
  source: string
): URLSearchParams {
  const p = new URLSearchParams();
  p.set("from", from.toISOString());
  p.set("to", to.toISOString());
  p.set("label", label);
  for (const id of clientIds) {
    p.append("clientId", id);
  }
  if (source && source !== "ALL") {
    p.set("source", source);
  }
  return p;
}

/** Effective query string for report APIs — falls back to this month when URL params are missing. */
export function effectiveReportQueryString(searchParams: URLSearchParams): string {
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (from && to) return searchParams.toString();
  const { from: f, to: t, label } = rangeForPreset("this_month");
  return buildReportSearchParams(f, t, label, [], "ALL").toString();
}

export function hasReportRange(searchParams: URLSearchParams): boolean {
  return Boolean(searchParams.get("from") && searchParams.get("to"));
}
