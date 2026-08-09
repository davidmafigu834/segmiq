"use client";

import { format, parseISO } from "date-fns";
import {
  buildWeekDays,
  eventsForDateKey,
  formatEventTime,
  isToday,
  toDateKey,
} from "@/lib/sales/calendar/format";
import { getEventTypeColor, getEventTypeLabel } from "@/lib/sales/calendar/adapters";
import type { CalendarEvent } from "@/lib/sales/calendar/types";

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

export function WeekCalendar({
  anchor,
  events,
  selectedEventId,
  onSelectEvent,
  onSelectDate,
}: {
  anchor: Date;
  events: CalendarEvent[];
  selectedEventId: string | null;
  onSelectEvent: (event: CalendarEvent) => void;
  onSelectDate: (dateKey: string) => void;
}) {
  const days = buildWeekDays(anchor);
  const now = new Date();
  const showNow =
    days.some((d) => isToday(d)) &&
    now.getHours() >= 8 &&
    now.getHours() <= 17;

  return (
    <div className="overflow-hidden rounded-[14px] border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] border-b border-[#E4E7EC] bg-[#F9FAFB]">
        <div />
        {days.map((day) => {
          const key = toDateKey(day);
          const today = isToday(day);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(key)}
              className="px-1 py-2.5 text-center transition-colors hover:bg-white"
            >
              <span className="block text-[10px] font-medium uppercase text-[#98A2B3]">
                {format(day, "EEE")}
              </span>
              <span
                className={[
                  "mx-auto mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold",
                  today ? "bg-[#D4FF4F] text-[#101828]" : "text-[#101828]",
                ].join(" ")}
              >
                {format(day, "d")}
              </span>
            </button>
          );
        })}
      </div>

      {/* All-day row */}
      <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] border-b border-[#E4E7EC]">
        <div className="px-1 py-2 text-[10px] font-medium text-[#98A2B3]">All day</div>
        {days.map((day) => {
          const key = toDateKey(day);
          const dayEvents = eventsForDateKey(events, key).filter((e) => !e.hasTimedCallback);
          return (
            <div key={key} className="min-h-[44px] space-y-0.5 border-l border-[#E4E7EC] p-1">
              {dayEvents.slice(0, 3).map((event) => (
                <WeekEventBlock
                  key={event.id}
                  event={event}
                  selected={event.id === selectedEventId}
                  onClick={() => onSelectEvent(event)}
                />
              ))}
            </div>
          );
        })}
      </div>

      <div className="relative max-h-[420px] overflow-y-auto">
        {showNow ? (
          <div
            className="pointer-events-none absolute left-0 right-0 z-10 border-t border-[#EF4444]/70"
            style={{
              top: `${((now.getHours() - 8) * 60 + now.getMinutes()) / (10 * 60) * 100}%`,
            }}
            aria-hidden
          />
        ) : null}
        {HOURS.map((hour) => (
          <div
            key={hour}
            className="grid min-h-[56px] grid-cols-[52px_repeat(7,minmax(0,1fr))] border-b border-[#F2F4F7]"
          >
            <div className="px-1 py-1 text-[10px] font-medium text-[#98A2B3]">
              {String(hour).padStart(2, "0")}:00
            </div>
            {days.map((day) => {
              const key = toDateKey(day);
              const hourEvents = eventsForDateKey(events, key).filter((e) => {
                if (!e.hasTimedCallback) return false;
                try {
                  return parseISO(e.startAt).getHours() === hour;
                } catch {
                  return false;
                }
              });
              return (
                <div key={key} className="space-y-0.5 border-l border-[#F2F4F7] p-0.5">
                  {hourEvents.map((event) => (
                    <WeekEventBlock
                      key={event.id}
                      event={event}
                      selected={event.id === selectedEventId}
                      onClick={() => onSelectEvent(event)}
                      showTime
                    />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekEventBlock({
  event,
  selected,
  onClick,
  showTime,
}: {
  event: CalendarEvent;
  selected: boolean;
  onClick: () => void;
  showTime?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full rounded-[6px] border px-1.5 py-1 text-left transition-colors duration-150",
        selected
          ? "border-[rgba(160,210,30,0.55)] bg-[rgba(212,255,79,0.14)]"
          : "border-[#E4E7EC] bg-white hover:border-[#D0D5DD]",
        event.overdue ? "border-l-2 border-l-[#EF4444]" : "",
      ].join(" ")}
      aria-label={`Open ${event.customerName ?? getEventTypeLabel(event.kind)}`}
    >
      <span className="flex items-center gap-1">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: getEventTypeColor(event.kind) }}
          aria-hidden
        />
        <span className="truncate text-[10px] font-semibold text-[#101828]">
          {showTime
            ? `${formatEventTime(event.startAt, true)} · ${getEventTypeLabel(event.kind)}`
            : getEventTypeLabel(event.kind)}
        </span>
      </span>
      {event.customerName ? (
        <span className="mt-0.5 block truncate pl-2.5 text-[10px] text-[#667085]">
          {event.customerName}
        </span>
      ) : null}
    </button>
  );
}
