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
      <div className="cal-card p-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-[#101828]">{formatCalendarMonth(month)}</p>
          <button
            type="button"
            onClick={onToday}
            className="text-[12px] font-semibold text-[#101828] underline-offset-2 hover:underline"
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
                  selectedDay ? "bg-[rgba(212,255,79,0.35)]" : "hover:bg-[#F9FAFB]",
                ].join(" ")}
                aria-label={format(day, "EEEE d MMMM")}
                aria-pressed={selectedDay}
              >
                <span className="text-[10px] font-medium uppercase text-[#98A2B3]">
                  {format(day, "EEE").slice(0, 2)}
                </span>
                <span
                  className={[
                    "mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold",
                    selectedDay
                      ? "bg-[#D4FF4F] text-[#101828]"
                      : today
                        ? "ring-1 ring-[rgba(160,210,30,0.55)] text-[#101828]"
                        : "text-[#101828]",
                  ].join(" ")}
                >
                  {format(day, "d")}
                </span>
                {count > 0 ? (
                  <span className="mt-0.5 h-1 w-1 rounded-full bg-[#667085]" aria-hidden />
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
    <div className="cal-card p-2.5">
      <p className="mb-2 text-[14px] font-semibold text-[#101828]">
        {formatCalendarMonth(month)}
      </p>
      <div className="mb-0.5 grid grid-cols-7">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="py-0.5 text-center text-[10px] font-medium uppercase tracking-wide text-[#98A2B3]"
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
                  ? "bg-[#D4FF4F] font-semibold text-[#101828]"
                  : today
                    ? "font-semibold text-[#101828] ring-1 ring-[rgba(160,210,30,0.55)]"
                    : inMonth
                      ? "font-medium text-[#101828] hover:bg-[#F2F4F7]"
                      : "text-[#98A2B3] hover:bg-[#F9FAFB]",
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
        className="mt-2 h-9 w-full rounded-[9px] border border-[#E4E7EC] bg-[#F9FAFB] text-[12px] font-semibold text-[#101828] transition-colors hover:bg-[#F2F4F7]"
        aria-label="Go to today"
      >
        Today
      </button>
    </div>
  );
}
