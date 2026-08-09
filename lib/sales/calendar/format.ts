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

export function formatEventTime(iso: string, hasTimedCallback: boolean): string {
  try {
    const d = parseISO(iso);
    if (!hasTimedCallback) return "All day";
    return format(d, "HH:mm");
  } catch {
    return "";
  }
}

export function formatEventRange(event: CalendarEvent): string {
  try {
    const start = parseISO(event.startAt);
    const datePart = format(start, "EEE, d MMM yyyy");
    if (!event.hasTimedCallback) return `${datePart} · All day`;
    const time = format(start, "HH:mm");
    if (event.endAt) {
      try {
        return `${datePart} · ${time}–${format(parseISO(event.endAt), "HH:mm")}`;
      } catch {
        /* fall through */
      }
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
  return events.filter((e) => toDateKey(parseISO(e.startAt)) === dateKey);
}

export function groupEventsByDate(
  events: CalendarEvent[]
): Array<{ dateKey: string; label: string; events: CalendarEvent[] }> {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = toDateKey(parseISO(event.startAt));
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
