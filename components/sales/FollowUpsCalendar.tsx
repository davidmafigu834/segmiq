"use client";

import { useMemo } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type FollowUpsCalendarProps = {
  month: Date;
  onMonthChange: (month: Date) => void;
  countByDateKey: Record<string, number>;
  selectedDateKey: string | null;
  onSelectDate: (dateKey: string | null) => void;
};

function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function FollowUpsCalendar({
  month,
  onMonthChange,
  countByDateKey,
  selectedDateKey,
  onSelectDate,
}: FollowUpsCalendarProps) {
  const today = startOfDay(new Date());

  const days = useMemo(() => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [month]);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-3 sm:px-4">
        <button
          type="button"
          onClick={() => onMonthChange(subMonths(month, 1))}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--surface-card-alt)] hover:text-[var(--text-primary)]"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 text-center">
          <p className="font-display text-base sm:text-lg tracking-tight text-[var(--text-primary)]">
            {format(month, "MMMM yyyy")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(month, 1))}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--surface-card-alt)] hover:text-[var(--text-primary)]"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface-card-alt)]">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="py-2 text-center font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--text-tertiary)] sm:text-[10px]"
          >
            <span className="sm:hidden">{day.charAt(0)}</span>
            <span className="hidden sm:inline">{day}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-[var(--border)] p-px">
        {days.map((day) => {
          const dateKey = toDateKey(day);
          const count = countByDateKey[dateKey] ?? 0;
          const inMonth = isSameMonth(day, month);
          const selected = selectedDateKey === dateKey;
          const todayCell = isToday(day);
          const overdue = count > 0 && day < today;

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelectDate(selected ? null : dateKey)}
              className={[
                "relative flex min-h-[40px] flex-col items-center justify-center gap-0.5 bg-[var(--surface-card)] px-0.5 py-1.5 transition-colors sm:min-h-[48px] sm:py-2",
                inMonth ? "hover:bg-[var(--surface-card-alt)]" : "opacity-40",
                selected ? "bg-[var(--accent-muted)] ring-1 ring-inset ring-[var(--accent-border)]" : "",
                todayCell && !selected ? "ring-1 ring-inset ring-[var(--border-hover)]" : "",
              ].join(" ")}
              aria-label={
                count > 0
                  ? `${format(day, "d MMMM yyyy")}, ${count} follow-up${count === 1 ? "" : "s"}`
                  : format(day, "d MMMM yyyy")
              }
              aria-pressed={selected}
            >
              <span
                className={[
                  "font-mono text-[11px] leading-none sm:text-[12px]",
                  selected
                    ? "font-semibold text-[var(--accent)]"
                    : todayCell
                      ? "font-semibold text-[var(--text-primary)]"
                      : inMonth
                        ? "text-[var(--text-secondary)]"
                        : "text-[var(--text-disabled)]",
                ].join(" ")}
              >
                {format(day, "d")}
              </span>
              {count > 0 ? (
                <span className="flex items-center gap-0.5">
                  {count <= 3 ? (
                    Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                      <span
                        key={i}
                        className={[
                          "h-1 w-1 rounded-full sm:h-1.5 sm:w-1.5",
                          overdue ? "bg-[var(--danger)]" : "bg-[var(--accent)]",
                        ].join(" ")}
                      />
                    ))
                  ) : (
                    <span
                      className={[
                        "rounded px-1 font-mono text-[8px] leading-none sm:text-[9px]",
                        overdue
                          ? "bg-[var(--danger-bg)] text-[var(--danger-fg)]"
                          : "bg-[var(--accent-muted)] text-[var(--accent)]",
                      ].join(" ")}
                    >
                      {count}
                    </span>
                  )}
                </span>
              ) : (
                <span className="h-1.5 sm:h-2" aria-hidden />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--border)] px-3 py-2.5 sm:px-4">
        <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--text-tertiary)] sm:text-[10px]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          Scheduled
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--text-tertiary)] sm:text-[10px]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--danger)]" />
          Overdue
        </span>
        {selectedDateKey ? (
          <button
            type="button"
            onClick={() => onSelectDate(null)}
            className="ml-auto font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--accent)] hover:underline sm:text-[10px]"
          >
            Clear selection
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function isDateKeyToday(dateKey: string): boolean {
  return isSameDay(new Date(`${dateKey}T12:00:00`), new Date());
}
