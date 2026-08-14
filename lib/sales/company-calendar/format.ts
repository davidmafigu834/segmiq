import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type {
  CompanyCalendarEvent,
  CompanyCalendarEventKind,
  CompanyCalendarFilters,
  CompanyCalendarView,
} from "./types";

export const COMPANY_CALENDAR_KIND_META: Record<
  CompanyCalendarEventKind,
  { label: string; shortLabel: string; className: string; dotClassName: string }
> = {
  whatsapp: {
    label: "WhatsApp follow-up",
    shortLabel: "WhatsApp",
    className: "border-emerald-300/70 bg-emerald-50 text-emerald-950 dark:border-emerald-700/60 dark:bg-emerald-950/35 dark:text-emerald-100",
    dotClassName: "bg-[#25D366]",
  },
  call: {
    label: "Call",
    shortLabel: "Call",
    className: "border-orange-300/70 bg-orange-50 text-orange-950 dark:border-orange-700/60 dark:bg-orange-950/35 dark:text-orange-100",
    dotClassName: "bg-orange-500",
  },
  follow_up: {
    label: "Follow-up",
    shortLabel: "Follow-up",
    className: "border-blue-300/70 bg-blue-50 text-blue-950 dark:border-blue-700/60 dark:bg-blue-950/35 dark:text-blue-100",
    dotClassName: "bg-blue-500",
  },
  quote_review: {
    label: "Quote review",
    shortLabel: "Quote",
    className: "border-amber-300/70 bg-amber-50 text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/35 dark:text-amber-100",
    dotClassName: "bg-amber-500",
  },
  deal_action: {
    label: "Deal action",
    shortLabel: "Deal",
    className: "border-teal-300/70 bg-teal-50 text-teal-950 dark:border-teal-700/60 dark:bg-teal-950/35 dark:text-teal-100",
    dotClassName: "bg-teal-500",
  },
  site_visit: {
    label: "Site visit",
    shortLabel: "Visit",
    className: "border-violet-300/70 bg-violet-50 text-violet-950 dark:border-violet-700/60 dark:bg-violet-950/35 dark:text-violet-100",
    dotClassName: "bg-violet-500",
  },
};

function dateParts(value: Date | string, timezone: string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

export function calendarDateKey(value: Date | string, timezone: string): string {
  const parts = dateParts(value, timezone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function calendarMinutes(value: Date | string, timezone: string): number {
  const parts = dateParts(value, timezone);
  return parts.hour * 60 + parts.minute;
}

export function formatCalendarTime(value: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatCalendarFullDate(dateKey: string): string {
  return format(parseISO(`${dateKey}T12:00:00`), "EEE, MMM d, yyyy");
}

export function formatCalendarEventRange(
  event: CompanyCalendarEvent,
  timezone: string
): string {
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(event.startAt));
  if (event.allDay) return `${date} · All day`;
  const start = formatCalendarTime(event.startAt, timezone);
  const end = event.endAt ? formatCalendarTime(event.endAt, timezone) : null;
  return `${date} · ${start}${end ? ` – ${end}` : ""}`;
}

export function companyCalendarRangeKeys(
  anchorKey: string,
  view: CompanyCalendarView
): { startKey: string; endKey: string; label: string } {
  const anchor = parseISO(`${anchorKey}T12:00:00`);
  if (view === "day") {
    return {
      startKey: format(anchor, "yyyy-MM-dd"),
      endKey: format(addDays(anchor, 1), "yyyy-MM-dd"),
      label: format(anchor, "EEEE, MMMM d, yyyy"),
    };
  }
  if (view === "week") {
    const start = startOfWeek(anchor, { weekStartsOn: 0 });
    const end = addDays(endOfWeek(anchor, { weekStartsOn: 0 }), 1);
    const sameMonth = start.getMonth() === addDays(end, -1).getMonth();
    return {
      startKey: format(start, "yyyy-MM-dd"),
      endKey: format(end, "yyyy-MM-dd"),
      label: sameMonth
        ? `${format(start, "MMM d")} – ${format(addDays(end, -1), "d, yyyy")}`
        : `${format(start, "MMM d")} – ${format(addDays(end, -1), "MMM d, yyyy")}`,
    };
  }
  const monthStart = startOfMonth(anchor);
  const monthEnd = addDays(endOfMonth(anchor), 1);
  return {
    startKey: format(monthStart, "yyyy-MM-dd"),
    endKey: format(monthEnd, "yyyy-MM-dd"),
    label: format(anchor, "MMMM yyyy"),
  };
}

export function companyCalendarQueryRange(anchorKey: string): {
  startKey: string;
  endKey: string;
} {
  const anchor = parseISO(`${anchorKey}T12:00:00`);
  const start = addDays(startOfMonth(anchor), -7);
  const end = addDays(addMonths(startOfMonth(anchor), 2), 14);
  return { startKey: format(start, "yyyy-MM-dd"), endKey: format(end, "yyyy-MM-dd") };
}

export function matchesCompanyCalendarFilters(
  event: CompanyCalendarEvent,
  filters: CompanyCalendarFilters
): boolean {
  if (filters.ownerId !== "all" && event.ownerId !== filters.ownerId) return false;
  if (!filters.kinds.includes(event.kind)) return false;
  if (!filters.includeCompleted && event.status === "completed") return false;
  if (filters.status === "at_risk" && !event.attentionReason) return false;
  if (
    filters.status !== "all" &&
    filters.status !== "at_risk" &&
    event.status !== filters.status
  ) {
    return false;
  }
  if (filters.relationType !== "all" && event.relationType !== filters.relationType) {
    return false;
  }
  return true;
}

export const COMPANY_CALENDAR_UNASSIGNED_OWNER = "unassigned";

export function companyCalendarOwnerKey(ownerId: string | null): string {
  return ownerId ?? COMPANY_CALENDAR_UNASSIGNED_OWNER;
}

export function groupCompanyCalendarEventsByOwnerDay(
  events: CompanyCalendarEvent[],
  timezone: string
): Record<string, Record<string, CompanyCalendarEvent[]>> {
  const grouped: Record<string, Record<string, CompanyCalendarEvent[]>> = {};
  for (const event of events) {
    const ownerKey = companyCalendarOwnerKey(event.ownerId);
    const dayKey = calendarDateKey(event.startAt, timezone);
    grouped[ownerKey] ??= {};
    grouped[ownerKey]![dayKey] ??= [];
    grouped[ownerKey]![dayKey]!.push(event);
  }
  for (const byDay of Object.values(grouped)) {
    for (const dayEvents of Object.values(byDay)) {
      dayEvents.sort((a, b) => a.startAt.localeCompare(b.startAt));
    }
  }
  return grouped;
}

export function companyCalendarTeamAttention(events: CompanyCalendarEvent[]): {
  tone: "clear" | "attention" | "overdue";
  label: string;
} {
  const overdue = events.filter((event) => event.status === "overdue").length;
  const atRisk = events.filter(
    (event) => event.attentionReason && event.status !== "completed" && event.status !== "cancelled"
  ).length;
  if (overdue) {
    return {
      tone: "overdue",
      label: `${overdue} overdue ${overdue === 1 ? "activity" : "activities"}`,
    };
  }
  if (atRisk) {
    return {
      tone: "attention",
      label: `${atRisk} ${atRisk === 1 ? "activity needs" : "activities need"} attention`,
    };
  }
  return { tone: "clear", label: "No urgent issues in this period" };
}

export function canMutateCompanyCalendarLead({
  canManageAny,
  canActAsSalesperson,
  actorId,
  ownerId,
}: {
  canManageAny: boolean;
  canActAsSalesperson: boolean;
  actorId: string;
  ownerId: string | null;
}): boolean {
  return canManageAny || (canActAsSalesperson && ownerId === actorId);
}

export function inferDealCalendarKind(label: string | null | undefined): CompanyCalendarEventKind {
  const normalized = label?.toLowerCase() ?? "";
  if (/whatsapp|message/.test(normalized)) return "whatsapp";
  if (/call|phone/.test(normalized)) return "call";
  if (/quote|proposal/.test(normalized)) return "quote_review";
  if (/visit|site|viewing/.test(normalized)) return "site_visit";
  return "deal_action";
}

export type PositionedCalendarEvent = {
  event: CompanyCalendarEvent;
  startMinute: number;
  endMinute: number;
  column: number;
  columnCount: number;
};

export function layoutOverlappingEvents(
  events: CompanyCalendarEvent[],
  timezone: string,
  visibleStartMinute = 8 * 60,
  visibleEndMinute = 18 * 60
): PositionedCalendarEvent[] {
  const intervals = events
    .filter((event) => !event.allDay)
    .map((event) => {
      const startMinute = calendarMinutes(event.startAt, timezone);
      const explicitEnd = event.endAt ? calendarMinutes(event.endAt, timezone) : startMinute + 60;
      return {
        event,
        startMinute: Math.max(visibleStartMinute, startMinute),
        endMinute: Math.min(visibleEndMinute, Math.max(startMinute + 30, explicitEnd)),
      };
    })
    .filter((item) => item.endMinute > visibleStartMinute && item.startMinute < visibleEndMinute)
    .sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);

  const result: PositionedCalendarEvent[] = [];
  let group: typeof intervals = [];
  let groupEnd = -1;

  const flush = () => {
    if (!group.length) return;
    const columnEnds: number[] = [];
    const placed = group.map((item) => {
      let column = columnEnds.findIndex((end) => end <= item.startMinute);
      if (column === -1) column = columnEnds.length;
      columnEnds[column] = item.endMinute;
      return { ...item, column };
    });
    const columnCount = Math.max(1, columnEnds.length);
    result.push(...placed.map((item) => ({ ...item, columnCount })));
    group = [];
    groupEnd = -1;
  };

  for (const interval of intervals) {
    if (group.length && interval.startMinute >= groupEnd) flush();
    group.push(interval);
    groupEnd = Math.max(groupEnd, interval.endMinute);
  }
  flush();
  return result;
}
