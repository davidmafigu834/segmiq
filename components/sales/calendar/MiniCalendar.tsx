"use client";

import { useMemo } from "react";
import { format, startOfMonth } from "date-fns";
import {
  buildCalendarGrid,
  eventsForDateKey,
  formatCalendarMonth,
  isDateInMonth,
  isToday,
  toDateKey,
} from "@/lib/sales/calendar/format";
import type { CalendarEvent } from "@/lib/sales/calendar/types";
import { getEventTypeColor } from "@/lib/sales/calendar/adapters";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function MiniCalendar({
  month,
  selectedDateKey,
  events,
  onMonthChange,
  onSelectDate,
  onToday,
  compact = false,
}: {
  month: Date;
  selectedDateKey: string;
  events: CalendarEvent[];
  onMonthChange: (month: Date) => void;
  onSelectDate: (dateKey: string) => void;
  onToday: () => void;
  compact?: boolean;
}) {
  const days = useMemo(() => buildCalendarGrid(month), [month]);

  if (compact) {
    const selected = days.find((d) => toDateKey(d) === selectedDateKey) ?? new Date();
    const idx = days.findIndex((d) => toDateKey(d) === selectedDateKey);
    const start = Math.max(0, Math.min(idx - 3, days.length - 7));
    const strip = days.slice(start, start + 7);

    return (
      <div className="cal-card border-sales-border bg-sales-surface p-2.5 text-sales-text-primary">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-sales-text-primary">{formatCalendarMonth(month)}</p>
          <button
            type="button"
            onClick={onToday}
            className="text-[12px] font-semibold text-sales-text-primary underline-offset-2 hover:underline"
            aria-label="Go to today"
          >
            Today
          </button>
        </div>
        <div className="flex gap-1 overflow-x-auto scroll-smooth snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {strip.map((day) => {
            const key = toDateKey(day);
            const selectedDay = key === selectedDateKey;
            const today = isToday(day);
            const count = eventsForDateKey(events, key).length;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectDate(key)}
                className={[
                  "flex min-w-[44px] flex-[1_0_44px] snap-center flex-col items-center rounded-[9px] px-1.5 py-1.5 transition-colors duration-150",
                  selectedDay ? "bg-[rgba(212,255,79,0.35)]" : "hover:bg-sales-surface-hover",
                ].join(" ")}
                aria-label={format(day, "EEEE d MMMM")}
                aria-pressed={selectedDay}
              >
                <span className="text-[10px] font-medium uppercase text-sales-text-muted">
                  {format(day, "EEE").slice(0, 2)}
                </span>
                <span
                  className={[
                    "mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold",
                    selectedDay
                      ? "bg-sales-brand text-sales-brand-text"
                      : today
                        ? "ring-1 ring-[rgba(160,210,30,0.55)] text-sales-text-primary"
                        : "text-sales-text-primary",
                  ].join(" ")}
                >
                  {format(day, "d")}
                </span>
                {count > 0 ? (
                  <span className="mt-0.5 h-1 w-1 rounded-full bg-[var(--sales-neutral-500)]" aria-hidden />
                ) : (
                  <span className="mt-0.5 h-1 w-1" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
        <p className="sr-only">Selected {format(selected, "PPP")}</p>
      </div>
    );
  }

  return (
    <div className="cal-card border-sales-border bg-sales-surface p-2.5 text-sales-text-primary">
      <p className="mb-2 text-[14px] font-semibold text-sales-text-primary">
        {formatCalendarMonth(month)}
      </p>
      <div className="mb-0.5 grid grid-cols-7">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="py-0.5 text-center text-[10px] font-medium uppercase tracking-wide text-sales-text-muted"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {days.map((day) => {
          const key = toDateKey(day);
          const inMonth = isDateInMonth(day, month);
          const selected = key === selectedDateKey;
          const today = isToday(day);
          const dayEvents = eventsForDateKey(events, key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                onSelectDate(key);
                if (!inMonth) onMonthChange(startOfMonth(day));
              }}
              className={[
                "relative flex h-8 flex-col items-center justify-center rounded-full text-[12px] transition-colors duration-150",
                selected
                  ? "bg-sales-brand font-semibold text-sales-brand-text"
                  : today
                    ? "font-semibold text-sales-text-primary ring-1 ring-[rgba(160,210,30,0.55)]"
                    : inMonth
                      ? "font-medium text-sales-text-primary hover:bg-[var(--sales-neutral-100)]"
                      : "text-sales-text-muted hover:bg-sales-surface-hover",
              ].join(" ")}
              aria-label={format(day, "EEEE d MMMM yyyy")}
              aria-pressed={selected}
            >
              {format(day, "d")}
              {dayEvents.length > 0 && !selected ? (
                <span
                  className="absolute bottom-0.5 h-1 w-1 rounded-full"
                  style={{ background: getEventTypeColor(dayEvents[0]!.kind) }}
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onToday}
        className="mt-2 h-9 w-full rounded-[9px] border border-sales-border bg-sales-surface-hover text-[12px] font-semibold text-sales-text-primary transition-colors hover:bg-[var(--sales-neutral-100)]"
        aria-label="Go to today"
      >
        Today
      </button>
    </div>
  );
}
