import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { CalendarEvent, CalendarEventKind } from "./types";
import { getEventTypeLabel } from "./adapters";

export function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function parseDateKey(dateKey: string): Date {
  return parseISO(`${dateKey}T12:00:00`);
}

export function formatCalendarMonth(date: Date): string {
  return format(date, "MMMM yyyy");
}

export function formatCalendarDate(date: Date): string {
  return format(date, "EEE, d MMM yyyy");
}

export function formatEventTime(iso: string, hasTimedCallback: boolean, timeZone?: string | null): string {
  try {
    if (!hasTimedCallback) return "All day";
    if (timeZone) {
      return new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(iso));
    }
    return format(parseISO(iso), "HH:mm");
  } catch {
    return "";
  }
}

export function eventDateKey(event: CalendarEvent): string {
  if (event.calendarDateKey && /^\d{4}-\d{2}-\d{2}$/.test(event.calendarDateKey)) return event.calendarDateKey;
  return toDateKey(parseISO(event.startAt));
}

export function eventHour(event: CalendarEvent): number {
  if (event.timeZone) {
    const hour = new Intl.DateTimeFormat("en-GB", {
      timeZone: event.timeZone,
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(event.startAt))
      .find((part) => part.type === "hour")?.value;
    const parsed = Number(hour);
    if (Number.isFinite(parsed)) return parsed;
  }
  return parseISO(event.startAt).getHours();
}

export function formatEventRange(event: CalendarEvent): string {
  try {
    const start = parseISO(event.startAt);
    const datePart = event.timeZone
      ? new Intl.DateTimeFormat("en-GB", {
          timeZone: event.timeZone,
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(start)
      : format(start, "EEE, d MMM yyyy");
    if (!event.hasTimedCallback) return `${datePart} · All day`;
    const time = formatEventTime(event.startAt, true, event.timeZone);
    if (event.endAt) {
      const end = formatEventTime(event.endAt, true, event.timeZone);
      if (end) return `${datePart} · ${time}–${end}`;
    }
    return `${datePart} · ${time}`;
  } catch {
    return "";
  }
}

export function formatRelativeEventDate(iso: string): string {
  try {
    const d = parseISO(iso);
    const days = differenceInCalendarDays(startOfDay(d), startOfDay(new Date()));
    if (days === 0) return `Today, ${format(d, "HH:mm")}`;
    if (days === 1) return `Tomorrow, ${format(d, "HH:mm")}`;
    if (days === -1) return `Yesterday, ${format(d, "HH:mm")}`;
    return format(d, "EEE, d MMM, HH:mm");
  } catch {
    return "";
  }
}

export function isOverdueEvent(event: CalendarEvent): boolean {
  return event.overdue;
}

export function buildCalendarGrid(month: Date): Date[] {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  return eachDayOfInterval({ start: gridStart, end: gridEnd });
}

export function buildWeekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end: addDays(start, 6) });
}

export function eventsForDateKey(
  events: CalendarEvent[],
  dateKey: string
): CalendarEvent[] {
  return events.filter((e) => eventDateKey(e) === dateKey);
}

export function groupEventsByDate(
  events: CalendarEvent[]
): Array<{ dateKey: string; label: string; events: CalendarEvent[] }> {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = eventDateKey(event);
    const list = map.get(key) ?? [];
    list.push(event);
    map.set(key, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, dayEvents]) => {
      const d = parseDateKey(dateKey);
      let label = format(d, "EEEE, d MMMM");
      if (isToday(d)) label = "Today";
      else if (isSameDay(d, addDays(startOfDay(new Date()), 1))) label = "Tomorrow";
      return { dateKey, label, events: dayEvents };
    });
}

export function filterEventsByKinds(
  events: CalendarEvent[],
  enabled: Set<CalendarEventKind>
): CalendarEvent[] {
  return events.filter((e) => enabled.has(e.kind));
}

export function getEventMeta(event: CalendarEvent): string {
  const parts = [
    getEventTypeLabel(event.kind),
    event.pipelineStage,
    event.location,
  ].filter(Boolean);
  return parts.join(" · ");
}

export function isDateInMonth(date: Date, month: Date): boolean {
  return isSameMonth(date, month);
}

export { isToday, isSameDay, startOfMonth, startOfDay, addDays };
