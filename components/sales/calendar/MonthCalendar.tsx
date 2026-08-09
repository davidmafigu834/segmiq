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
    <div className="calendar-premium-month cal-card w-full overflow-hidden rounded-[14px] border-sales-border bg-sales-surface text-sales-text-primary">
      <div className="grid grid-cols-7 border-b border-[var(--sales-border-subtle)] bg-sales-surface-hover">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="px-1.5 py-2 text-center text-[11px] font-medium uppercase tracking-[0.06em] text-sales-text-muted"
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
                "cal-day-cell relative border-b border-r border-[var(--sales-border-subtle)] p-1.5 transition-colors duration-150",
                selected
                  ? "bg-[rgba(212,255,79,0.04)] shadow-[inset_0_0_0_1px_rgba(160,210,30,0.55)]"
                  : "hover:bg-sales-surface-hover",
                !inMonth ? "bg-sales-surface-subtle" : "bg-sales-surface",
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
                      ? "bg-sales-brand text-sales-brand-text"
                      : selected
                        ? "bg-sales-brand text-sales-brand-text"
                        : today
                          ? "bg-[rgba(212,255,79,0.35)] text-sales-text-primary ring-1 ring-[rgba(160,210,30,0.45)]"
                          : inMonth
                            ? "text-sales-text-primary"
                            : "text-sales-text-disabled",
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
                    className="w-full rounded px-1 py-0.5 text-left text-[11px] font-medium text-sales-text-secondary transition-colors hover:bg-[var(--sales-neutral-100)] hover:text-sales-text-primary"
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
                  <div className="absolute left-1 right-1 top-8 z-30 max-h-56 overflow-y-auto rounded-[10px] border border-sales-border bg-sales-surface p-2 shadow-[0_8px_24px_rgba(16,24,40,0.12)]">
                    <p className="mb-1.5 px-1 text-[11px] font-semibold text-sales-text-secondary">
                      {format(day, "EEE, d MMM")}
                    </p>
                    {dayEvents.map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        className="mb-1 flex w-full items-start gap-2 rounded-[8px] border border-sales-border px-2 py-1.5 text-left transition-colors hover:border-sales-border-strong"
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
                          <span className="block text-[11px] font-semibold text-sales-text-primary">
                            {formatEventTime(event.startAt, event.hasTimedCallback)}{" "}
                            {getEventTypeLabel(event.kind)}
                          </span>
                          {event.customerName ? (
                            <span className="block truncate text-[11px] text-sales-text-secondary">
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
