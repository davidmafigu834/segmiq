"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { AlertTriangle, CalendarDays, CheckCircle2, Plus } from "lucide-react";
import { Avatar, GroupAvatars } from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";
import {
  COMPANY_CALENDAR_KIND_META,
  calendarDateKey,
  calendarMinutes,
  formatCalendarTime,
  layoutOverlappingEvents,
} from "@/lib/sales/company-calendar/format";
import type { CompanyCalendarEvent } from "@/lib/sales/company-calendar/types";
import { CompanyCalendarEventIcon } from "./CompanyCalendarEventIcon";

const VISIBLE_START_MINUTE = 8 * 60;
const VISIBLE_END_MINUTE = 18 * 60;
const HOUR_HEIGHT = 64;
const GRID_HEIGHT = ((VISIBLE_END_MINUTE - VISIBLE_START_MINUTE) / 60) * HOUR_HEIGHT;

function parseDateKey(key: string): Date {
  return parseISO(`${key}T12:00:00`);
}

function eventDateKey(event: CompanyCalendarEvent, timezone: string): string {
  return calendarDateKey(event.startAt, timezone);
}

function eventsForDate(
  events: CompanyCalendarEvent[],
  dateKey: string,
  timezone: string
): CompanyCalendarEvent[] {
  return events.filter((event) => eventDateKey(event, timezone) === dateKey);
}

function hourLabel(hour: number): string {
  if (hour === 0) return "12:00 AM";
  if (hour < 12) return `${hour}:00 AM`;
  if (hour === 12) return "12:00 PM";
  return `${hour - 12}:00 PM`;
}

function relationLabel(event: CompanyCalendarEvent): string {
  if (event.relationType === "deal") return "Deal";
  if (event.relationType === "customer") return "Customer";
  return "Lead";
}

export function CalendarEventCard({
  event,
  timezone,
  compact = false,
  selected = false,
  onClick,
  className,
  style,
}: {
  event: CompanyCalendarEvent;
  timezone: string;
  compact?: boolean;
  selected?: boolean;
  onClick: () => void;
  className?: string;
  style?: CSSProperties;
}) {
  const meta = COMPANY_CALENDAR_KIND_META[event.kind];
  return (
    <button
      type="button"
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onClick();
      }}
      data-event-kind={event.kind}
      data-course-target="calendar-event"
      className={cn(
        "company-calendar-event group overflow-hidden rounded-[7px] border text-left transition-[border-color,box-shadow] duration-150 hover:shadow-[0_2px_8px_rgba(16,24,40,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sales-brand",
        meta.className,
        selected && "ring-2 ring-sales-brand ring-offset-1 ring-offset-sales-surface",
        event.status === "completed" && "opacity-65",
        event.status === "cancelled" && "opacity-50 line-through",
        compact ? "px-1.5 py-1" : "px-2 py-1.5",
        className
      )}
      style={style}
      title={`${event.title} · ${event.relatedLabel}`}
      aria-label={`Open ${event.title} for ${event.relatedLabel}`}
    >
      {!event.allDay ? (
        <span className="block truncate text-[9px] font-medium opacity-70">
          {formatCalendarTime(event.startAt, timezone)}
          {event.endAt ? ` – ${formatCalendarTime(event.endAt, timezone)}` : ""}
        </span>
      ) : null}
      <span className="mt-0.5 flex min-w-0 items-center gap-1">
        <CompanyCalendarEventIcon kind={event.kind} size={compact ? 11 : 12} />
        <span className={cn("truncate font-semibold", compact ? "text-[10px]" : "text-[11px]")}>
          {event.title}
        </span>
      </span>
      {!compact ? (
        <span className="mt-0.5 block truncate text-[10px] opacity-70">
          {event.relatedLabel}
        </span>
      ) : null}
    </button>
  );
}

export function CompanyWeekView({
  anchorKey,
  dayMode,
  showWeekends,
  events,
  timezone,
  selectedDateKey,
  selectedEventId,
  onSelectDate,
  onSelectEvent,
}: {
  anchorKey: string;
  dayMode: boolean;
  showWeekends: boolean;
  events: CompanyCalendarEvent[];
  timezone: string;
  selectedDateKey: string;
  selectedEventId: string | null;
  onSelectDate: (key: string) => void;
  onSelectEvent: (event: CompanyCalendarEvent) => void;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const anchor = parseDateKey(anchorKey);
  const allWeekDays = dayMode
    ? [anchor]
    : eachDayOfInterval({
        start: startOfWeek(anchor, { weekStartsOn: 0 }),
        end: endOfWeek(anchor, { weekStartsOn: 0 }),
      });
  const days = showWeekends || dayMode ? allWeekDays : allWeekDays.filter((day) => day.getDay() % 6);
  const todayKey = calendarDateKey(now, timezone);
  const nowMinutes = calendarMinutes(now, timezone);
  const showNow =
    days.some((day) => format(day, "yyyy-MM-dd") === todayKey) &&
    nowMinutes >= VISIBLE_START_MINUTE &&
    nowMinutes <= VISIBLE_END_MINUTE;
  const columns = `64px repeat(${days.length}, minmax(${dayMode ? 240 : 118}px, 1fr))`;
  const hourLines = Array.from({ length: 11 }, (_, index) => 8 + index);

  return (
    <div className="overflow-x-auto overscroll-x-contain">
      <div className="min-w-max xl:min-w-0">
        <div
          className="grid border-b border-sales-border-subtle"
          style={{ gridTemplateColumns: columns }}
        >
          <div className="bg-sales-surface" />
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const isToday = key === todayKey;
            const selected = key === selectedDateKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectDate(key)}
                className={cn(
                  "min-h-[72px] border-l border-sales-border-subtle px-2 py-2 text-center transition-colors hover:bg-sales-surface-hover",
                  selected && !isToday && "bg-sales-surface-hover"
                )}
              >
                <span className={cn("block text-[10px] font-semibold uppercase tracking-[0.06em]", isToday ? "text-sales-brand-fg" : "text-sales-text-muted")}>
                  {format(day, "EEE")}
                </span>
                <span className={cn("mx-auto mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-[16px] font-semibold", isToday ? "bg-sales-brand text-sales-brand-text" : "text-sales-text-primary")}>
                  {format(day, "d")}
                </span>
              </button>
            );
          })}
        </div>

        <div
          className="grid border-b border-sales-border-subtle"
          style={{ gridTemplateColumns: columns }}
        >
          <div className="px-3 py-2.5 text-[10px] font-medium text-sales-text-muted">All day</div>
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const allDay = eventsForDate(events, key, timezone).filter((event) => event.allDay);
            return (
              <div key={key} className="min-h-[48px] space-y-1 border-l border-sales-border-subtle p-1.5">
                {allDay.slice(0, 3).map((event) => (
                  <CalendarEventCard
                    key={event.id}
                    event={event}
                    timezone={timezone}
                    compact
                    selected={selectedEventId === event.id}
                    onClick={() => onSelectEvent(event)}
                  />
                ))}
                {allDay.length > 3 ? (
                  <p className="px-1 text-[9px] font-medium text-sales-text-muted">+{allDay.length - 3} more</p>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="relative grid" style={{ gridTemplateColumns: columns }}>
          <div className="relative border-r border-sales-border-subtle" style={{ height: GRID_HEIGHT }}>
            {hourLines.map((hour, index) => (
              <span
                key={hour}
                className="absolute right-3 -translate-y-1/2 text-[10px] font-medium tabular-nums text-sales-text-muted"
                style={{ top: index * HOUR_HEIGHT }}
              >
                {hourLabel(hour)}
              </span>
            ))}
          </div>

          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const timed = eventsForDate(events, key, timezone).filter((event) => !event.allDay);
            const positioned = layoutOverlappingEvents(
              timed,
              timezone,
              VISIBLE_START_MINUTE,
              VISIBLE_END_MINUTE
            );
            return (
              <button
                type="button"
                key={key}
                onClick={() => onSelectDate(key)}
                aria-label={`Select ${format(day, "EEEE, MMMM d")}`}
                className="company-calendar-day-column relative border-r border-sales-border-subtle text-left"
                style={{
                  height: GRID_HEIGHT,
                  backgroundImage:
                    "repeating-linear-gradient(to bottom, transparent 0, transparent 63px, var(--sales-border-subtle) 63px, var(--sales-border-subtle) 64px)",
                }}
              >
                {positioned.map((item) => {
                  const top = ((item.startMinute - VISIBLE_START_MINUTE) / 60) * HOUR_HEIGHT;
                  const height = Math.max(34, ((item.endMinute - item.startMinute) / 60) * HOUR_HEIGHT - 3);
                  const gap = 2;
                  const width = 100 / item.columnCount;
                  return (
                    <CalendarEventCard
                      key={item.event.id}
                      event={item.event}
                      timezone={timezone}
                      selected={selectedEventId === item.event.id}
                      onClick={() => onSelectEvent(item.event)}
                      className="absolute z-[2]"
                      style={{
                        top,
                        height,
                        left: `calc(${width * item.column}% + ${gap}px)`,
                        width: `calc(${width}% - ${gap * 2}px)`,
                      }}
                    />
                  );
                })}
              </button>
            );
          })}

          {showNow ? (
            <div
              className="pointer-events-none absolute z-[5] h-px bg-[#ef635f]"
              style={{
                left: 64,
                right: 0,
                top: ((nowMinutes - VISIBLE_START_MINUTE) / 60) * HOUR_HEIGHT,
              }}
              aria-hidden
            >
              <span className="absolute -left-[63px] -top-[9px] rounded-[5px] bg-[#c85350] px-1 py-0.5 text-[9px] font-semibold text-white">
                {formatCalendarTime(now.toISOString(), timezone)}
              </span>
              <span className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-[#d85c58]" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function CompanyMonthView({
  anchorKey,
  showWeekends,
  events,
  timezone,
  selectedDateKey,
  onSelectDate,
}: {
  anchorKey: string;
  showWeekends: boolean;
  events: CompanyCalendarEvent[];
  timezone: string;
  selectedDateKey: string;
  onSelectDate: (key: string) => void;
}) {
  const anchor = parseDateKey(anchorKey);
  const monthStart = startOfMonth(anchor);
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(monthStart), { weekStartsOn: 0 }),
  }).filter((day) => showWeekends || day.getDay() % 6);
  const weekdays = showWeekends
    ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    : ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const todayKey = calendarDateKey(new Date(), timezone);

  return (
    <div>
      <div className="grid border-b border-sales-border-subtle bg-sales-surface-subtle" style={{ gridTemplateColumns: `repeat(${weekdays.length}, minmax(0, 1fr))` }}>
        {weekdays.map((weekday) => (
          <div key={weekday} className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
            {weekday}
          </div>
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${weekdays.length}, minmax(0, 1fr))` }}>
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = eventsForDate(events, key, timezone);
          const today = key === todayKey;
          const counts = new Map<string, number>();
          for (const event of dayEvents) {
            const label = COMPANY_CALENDAR_KIND_META[event.kind].shortLabel;
            counts.set(label, (counts.get(label) ?? 0) + 1);
          }
          const summaries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
          const hasAttention = dayEvents.some(
            (event) => event.status === "overdue" || Boolean(event.attentionReason)
          );
          const owners = dayEvents
            .filter((event) => event.ownerName)
            .filter((event, index, rows) => rows.findIndex((row) => row.ownerId === event.ownerId) === index)
            .slice(0, 3);
          return (
            <button type="button" key={key} onClick={() => onSelectDate(key)} className={cn("min-h-[124px] border-b border-r border-sales-border-subtle p-2 text-left transition-colors hover:bg-sales-surface-hover", !isSameMonth(day, monthStart) && "bg-sales-surface-subtle", key === selectedDateKey && "ring-1 ring-inset ring-sales-brand-border")}>
              <span className="mb-2 flex w-full items-center justify-between">
                <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold", today ? "bg-sales-brand text-sales-brand-text" : key === selectedDateKey ? "bg-sales-surface-hover text-sales-text-primary ring-1 ring-sales-border" : "text-sales-text-secondary")}>
                  {format(day, "d")}
                </span>
                {hasAttention ? <AlertTriangle size={11} className="text-sales-warning" aria-label="Contains activities needing attention" /> : null}
              </span>
              {dayEvents.length ? (
                <span className="block space-y-1">
                  {summaries.slice(0, 2).map(([label, count]) => <span key={label} className="flex items-center justify-between rounded-[6px] bg-sales-surface-subtle px-2 py-1 text-[10px] text-sales-text-secondary"><span>{label}</span><span className="font-semibold text-sales-text-primary">{count}</span></span>)}
                  {summaries.length > 2 ? <span className="block px-1 text-[10px] font-semibold text-sales-brand-fg">+ {summaries.slice(2).reduce((sum, [, count]) => sum + count, 0)} more activities</span> : null}
                  {owners.length ? (
                    <GroupAvatars
                      size="2xs"
                      maxVisible={3}
                      className="mt-2"
                      members={owners.map((event) => ({
                        id: event.ownerId ?? event.ownerName ?? event.id,
                        name: event.ownerName ?? "Unassigned",
                        src: event.ownerAvatarUrl,
                      }))}
                    />
                  ) : null}
                </span>
              ) : <span className="text-[11px] text-sales-text-disabled">No activity</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CompanyAgendaView({
  events,
  timezone,
  selectedEventId,
  onSelectEvent,
  onAdd,
  canCreate,
}: {
  events: CompanyCalendarEvent[];
  timezone: string;
  selectedEventId: string | null;
  onSelectEvent: (event: CompanyCalendarEvent) => void;
  onAdd: () => void;
  canCreate: boolean;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, CompanyCalendarEvent[]>();
    for (const event of events) {
      const key = eventDateKey(event, timezone);
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [events, timezone]);

  if (!groups.length) {
    return (
      <div className="flex min-h-[520px] flex-col items-center justify-center px-5 text-center">
        <CalendarDays size={26} className="text-sales-text-muted" aria-hidden />
        <p className="mt-3 text-[14px] font-semibold text-sales-text-primary">No activities in this range</p>
        <p className="mt-1 text-[12px] text-sales-text-muted">Scheduled follow-ups and Deal next actions will appear here.</p>
        {canCreate ? <button type="button" onClick={onAdd} className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-[9px] bg-sales-brand px-3 text-[12px] font-semibold text-sales-brand-text">
          <Plus size={14} /> New Activity
        </button> : null}
      </div>
    );
  }

  return (
    <div className="min-h-[520px] divide-y divide-sales-border-subtle">
      {groups.map(([key, dayEvents]) => (
        <section key={key} className="grid gap-3 px-4 py-4 sm:grid-cols-[130px_minmax(0,1fr)] sm:px-5">
          <div>
            <p className="text-[12px] font-semibold text-sales-text-primary">{format(parseDateKey(key), "EEEE")}</p>
            <p className="mt-0.5 text-[11px] text-sales-text-muted">{format(parseDateKey(key), "MMM d, yyyy")}</p>
          </div>
          <div className="space-y-2">
            {dayEvents.map((event) => (
              <AgendaEventRow key={event.id} event={event} timezone={timezone} selected={selectedEventId === event.id} onClick={() => onSelectEvent(event)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function AgendaEventRow({
  event,
  timezone,
  selected,
  onClick,
}: {
  event: CompanyCalendarEvent;
  timezone: string;
  selected?: boolean;
  onClick: () => void;
}) {
  const meta = COMPANY_CALENDAR_KIND_META[event.kind];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex min-h-[58px] w-full items-center gap-3 rounded-[10px] border px-3 py-2 text-left transition-colors hover:bg-sales-surface-hover", selected ? "border-sales-brand bg-sales-brand-soft" : "border-sales-border")}
    >
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", meta.className)} data-event-kind={event.kind}>
        {event.status === "overdue" ? <AlertTriangle size={14} /> : event.status === "completed" ? <CheckCircle2 size={14} /> : <CompanyCalendarEventIcon kind={event.kind} size={14} />}
      </span>
      <span className="w-[72px] shrink-0 text-[11px] font-medium tabular-nums text-sales-text-secondary">{event.allDay ? "All day" : formatCalendarTime(event.startAt, timezone)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-semibold text-sales-text-primary">{event.title}</span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-sales-text-muted">
          <Avatar name={event.ownerName ?? "Unassigned"} src={event.ownerAvatarUrl} size="2xs" alt="" />
          <span className="truncate">{event.relatedLabel}{event.ownerName ? ` · ${event.ownerName}` : " · Unassigned"}</span>
        </span>
      </span>
      <span className={cn("hidden shrink-0 rounded-[5px] border px-1.5 py-0.5 text-[10px] font-medium sm:inline-flex", event.status === "overdue" ? "border-sales-danger/30 bg-sales-danger-soft text-sales-danger-fg" : "border-sales-border bg-sales-surface-subtle text-sales-text-secondary")}>{event.status === "overdue" ? "Overdue" : relationLabel(event)}</span>
    </button>
  );
}

export function MobileCalendarAgenda({
  selectedDateKey,
  events,
  timezone,
  selectedEventId,
  onSelectDate,
  onSelectEvent,
  onAdd,
  canCreate,
}: {
  selectedDateKey: string;
  events: CompanyCalendarEvent[];
  timezone: string;
  selectedEventId: string | null;
  onSelectDate: (key: string) => void;
  onSelectEvent: (event: CompanyCalendarEvent) => void;
  onAdd: () => void;
  canCreate: boolean;
}) {
  const anchor = parseDateKey(selectedDateKey);
  const days = eachDayOfInterval({
    start: startOfWeek(anchor, { weekStartsOn: 1 }),
    end: endOfWeek(anchor, { weekStartsOn: 1 }),
  });
  const todayKey = calendarDateKey(new Date(), timezone);
  const dayEvents = eventsForDate(events, selectedDateKey, timezone);
  return (
    <div className="p-3">
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-2">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const selected = key === selectedDateKey;
          const today = key === todayKey;
          return (
            <button key={key} type="button" onClick={() => onSelectDate(key)} className={cn("flex min-w-[52px] flex-1 flex-col items-center rounded-[10px] border px-2 py-2", selected ? "border-sales-brand bg-sales-brand-soft" : "border-sales-border bg-sales-surface", today && !selected && "ring-1 ring-sales-brand-border")}>
              <span className="text-[10px] font-semibold uppercase text-sales-text-muted">{format(day, "EEE")}</span>
              <span className="mt-1 text-[14px] font-semibold text-sales-text-primary">{format(day, "d")}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-semibold text-sales-text-primary">{format(anchor, "EEEE, MMMM d")}</h2>
          <p className="text-[11px] text-sales-text-muted">{dayEvents.length} {dayEvents.length === 1 ? "activity" : "activities"}</p>
        </div>
      </div>
      {dayEvents.length ? (
        <div className="mt-3 space-y-2">
          {dayEvents.map((event) => (
            <AgendaEventRow key={event.id} event={event} timezone={timezone} selected={selectedEventId === event.id} onClick={() => onSelectEvent(event)} />
          ))}
        </div>
      ) : (
        <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
          <CalendarDays size={24} className="text-sales-text-muted" />
          <p className="mt-2 text-[13px] font-semibold text-sales-text-primary">No activities scheduled</p>
          <p className="mt-1 text-[11px] text-sales-text-muted">This day is clear.</p>
          {canCreate ? <button type="button" onClick={onAdd} className="mt-3 inline-flex min-h-10 items-center gap-1 rounded-[9px] bg-sales-brand px-3 text-[12px] font-semibold text-sales-brand-text"><Plus size={14} /> New Activity</button> : null}
        </div>
      )}
    </div>
  );
}
