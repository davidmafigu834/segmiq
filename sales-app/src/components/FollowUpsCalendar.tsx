import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  eachDayInMonthGrid,
  formatMonthYear,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  toDateKey,
} from "../lib/calendar-utils";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

type Props = {
  month: Date;
  onMonthChange: (month: Date) => void;
  countByDateKey: Record<string, number>;
  selectedDateKey: string | null;
  onSelectDate: (dateKey: string | null) => void;
};

export function FollowUpsCalendar({
  month,
  onMonthChange,
  countByDateKey,
  selectedDateKey,
  onSelectDate,
}: Props) {
  const today = startOfDay(new Date());
  const days = useMemo(() => eachDayInMonthGrid(month), [month]);

  function jumpToToday() {
    const now = new Date();
    onMonthChange(startOfMonth(now));
    onSelectDate(toDateKey(now));
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface-card">
      {/* Month navigation — Google Calendar style */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(month, -1))}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-secondary touch-manipulation active:bg-bg-tertiary"
          aria-label="Previous month"
        >
          <ChevronLeft size={22} />
        </button>

        <button
          type="button"
          onClick={jumpToToday}
          className="min-w-0 flex-1 touch-manipulation"
        >
          <p className="truncate text-center font-display text-[18px] leading-tight text-ink-primary">
            {formatMonthYear(month)}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onMonthChange(addMonths(month, 1))}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-secondary touch-manipulation active:bg-bg-tertiary"
          aria-label="Next month"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      {/* Weekday row */}
      <div className="grid grid-cols-7 border-b border-border bg-bg-tertiary/50 px-1">
        {WEEKDAYS.map((day, i) => (
          <div
            key={`${day}-${i}`}
            className="py-2 text-center font-mono text-[10px] font-medium uppercase tracking-wide text-ink-tertiary"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-px bg-border p-px">
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
                "relative flex min-h-[52px] flex-col items-center justify-center gap-1 bg-surface-card touch-manipulation",
                !inMonth ? "opacity-35" : "active:bg-bg-tertiary",
                selected && !todayCell ? "bg-accent-muted" : "",
              ].join(" ")}
              aria-label={
                count > 0
                  ? `${day.toLocaleDateString("en-GB")}, ${count} follow-up${count === 1 ? "" : "s"}`
                  : day.toLocaleDateString("en-GB")
              }
              aria-pressed={selected}
            >
              {/* Today / selected circle — Google Calendar style */}
              <span
                className={[
                  "flex h-8 w-8 items-center justify-center rounded-full font-mono text-[13px] leading-none",
                  todayCell
                    ? selected
                      ? "bg-accent font-bold text-accent-foreground"
                      : "bg-accent font-bold text-accent-foreground"
                    : selected
                      ? "bg-bg-quaternary font-semibold text-ink-primary"
                      : inMonth
                        ? "text-ink-primary"
                        : "text-ink-tertiary",
                ].join(" ")}
              >
                {day.getDate()}
              </span>

              {/* Event dots */}
              {count > 0 ? (
                <span className="flex h-2 items-center justify-center gap-0.5">
                  {count <= 3 ? (
                    Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 w-1.5 rounded-full ${
                          overdue ? "bg-[var(--error)]" : "bg-accent"
                        }`}
                      />
                    ))
                  ) : (
                    <span
                      className={`rounded px-1 font-mono text-[9px] leading-none ${
                        overdue
                          ? "bg-[rgba(255,68,68,0.15)] text-[var(--error)]"
                          : "bg-accent-muted text-accent"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </span>
              ) : (
                <span className="h-2" aria-hidden />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend + today shortcut */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-4 py-2.5">
        <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wide text-ink-tertiary">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Scheduled
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wide text-ink-tertiary">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--error)]" />
          Overdue
        </span>
        {selectedDateKey ? (
          <button
            type="button"
            onClick={() => onSelectDate(null)}
            className="ml-auto font-mono text-[10px] uppercase tracking-wide text-accent touch-manipulation"
          >
            Show all
          </button>
        ) : (
          <button
            type="button"
            onClick={jumpToToday}
            className="ml-auto font-mono text-[10px] uppercase tracking-wide text-accent touch-manipulation"
          >
            Today
          </button>
        )}
      </div>
    </div>
  );
}
