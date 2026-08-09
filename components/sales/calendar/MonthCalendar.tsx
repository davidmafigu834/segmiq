"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import {
  buildCalendarGrid,
  eventsForDateKey,
  formatEventTime,
  isDateInMonth,
  isToday,
  toDateKey,
} from "@/lib/sales/calendar/format";
import { getEventTypeColor, getEventTypeLabel } from "@/lib/sales/calendar/adapters";
import type { CalendarEvent } from "@/lib/sales/calendar/types";
import { CalendarEventChip } from "./CalendarEventChip";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_VISIBLE = 3;

export function MonthCalendar({
  month,
  selectedDateKey,
  events,
  selectedEventId,
  dayPopoverKey,
  onSelectDate,
  onSelectEvent,
  onOpenMore,
  onCloseMore,
}: {
  month: Date;
  selectedDateKey: string;
  events: CalendarEvent[];
  selectedEventId: string | null;
  dayPopoverKey: string | null;
  onSelectDate: (dateKey: string) => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onOpenMore: (dateKey: string) => void;
  onCloseMore: () => void;
}) {
  const days = useMemo(() => buildCalendarGrid(month), [month]);

  return (
    <div className="calendar-premium-month cal-card w-full overflow-hidden rounded-[14px]">
      <div className="grid grid-cols-7 border-b border-[#EAECF0] bg-[#F9FAFB]">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="px-1.5 py-2 text-center text-[11px] font-medium uppercase tracking-[0.06em] text-[#98A2B3]"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 [grid-auto-rows:minmax(100px,1fr)] 2xl:[grid-auto-rows:minmax(118px,1fr)]">
        {days.map((day) => {
          const key = toDateKey(day);
          const inMonth = isDateInMonth(day, month);
          const selected = key === selectedDateKey;
          const today = isToday(day);
          const dayEvents = eventsForDateKey(events, key);
          const visible = dayEvents.slice(0, MAX_VISIBLE);
          const more = dayEvents.length - visible.length;
          const popoverOpen = dayPopoverKey === key;

          return (
            <div
              key={key}
              className={[
                "cal-day-cell relative border-b border-r border-[#EAECF0] p-1.5 transition-colors duration-150",
                selected
                  ? "bg-[rgba(212,255,79,0.04)] shadow-[inset_0_0_0_1px_rgba(160,210,30,0.55)]"
                  : "hover:bg-[#F9FAFB]",
                !inMonth ? "bg-[#FCFCFD]" : "bg-white",
              ].join(" ")}
            >
              <button
                type="button"
                className="mb-1 flex w-full items-start"
                onClick={() => onSelectDate(key)}
                aria-label={format(day, "EEEE d MMMM yyyy")}
              >
                <span
                  className={[
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold",
                    selected && today
                      ? "bg-[#D4FF4F] text-[#101828]"
                      : selected
                        ? "bg-[#D4FF4F] text-[#101828]"
                        : today
                          ? "bg-[rgba(212,255,79,0.35)] text-[#101828] ring-1 ring-[rgba(160,210,30,0.45)]"
                          : inMonth
                            ? "text-[#101828]"
                            : "text-[#B2B8C3]",
                  ].join(" ")}
                >
                  {format(day, "d")}
                </span>
              </button>
              <div className="space-y-0.5">
                {visible.map((event) => (
                  <CalendarEventChip
                    key={event.id}
                    event={event}
                    selected={event.id === selectedEventId}
                    onClick={() => {
                      onSelectDate(key);
                      onSelectEvent(event);
                    }}
                  />
                ))}
                {more > 0 ? (
                  <button
                    type="button"
                    className="w-full rounded px-1 py-0.5 text-left text-[11px] font-medium text-[#667085] transition-colors hover:bg-[#F2F4F7] hover:text-[#101828]"
                    onClick={() => onOpenMore(key)}
                    aria-label={`Show ${more} more events on ${format(day, "d MMMM")}`}
                  >
                    +{more} more
                  </button>
                ) : null}
              </div>

              {popoverOpen ? (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-20 cursor-default"
                    aria-label="Close day agenda"
                    onClick={onCloseMore}
                  />
                  <div className="absolute left-1 right-1 top-8 z-30 max-h-56 overflow-y-auto rounded-[10px] border border-[#E4E7EC] bg-white p-2 shadow-[0_8px_24px_rgba(16,24,40,0.12)]">
                    <p className="mb-1.5 px-1 text-[11px] font-semibold text-[#667085]">
                      {format(day, "EEE, d MMM")}
                    </p>
                    {dayEvents.map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        className="mb-1 flex w-full items-start gap-2 rounded-[8px] border border-[#E4E7EC] px-2 py-1.5 text-left transition-colors hover:border-[#D0D5DD]"
                        onClick={() => {
                          onSelectEvent(event);
                          onCloseMore();
                        }}
                      >
                        <span
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: getEventTypeColor(event.kind) }}
                          aria-hidden
                        />
                        <span className="min-w-0">
                          <span className="block text-[11px] font-semibold text-[#101828]">
                            {formatEventTime(event.startAt, event.hasTimedCallback)}{" "}
                            {getEventTypeLabel(event.kind)}
                          </span>
                          {event.customerName ? (
                            <span className="block truncate text-[11px] text-[#667085]">
                              {event.customerName}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
