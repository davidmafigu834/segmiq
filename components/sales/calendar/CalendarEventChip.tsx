"use client";

import { formatEventTime } from "@/lib/sales/calendar/format";
import { getEventTypeColor, getEventTypeLabel } from "@/lib/sales/calendar/adapters";
import type { CalendarEvent } from "@/lib/sales/calendar/types";

export function CalendarEventChip({
  event,
  selected,
  onClick,
}: {
  event: CalendarEvent;
  selected?: boolean;
  onClick: () => void;
}) {
  const time = formatEventTime(event.startAt, event.hasTimedCallback);
  const label = getEventTypeLabel(event.kind);
  const customer = event.customerName;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={[
        "cal-event-chip flex w-full items-start gap-1 rounded-[6px] border bg-sales-surface px-1 py-0.5 text-left transition-[border-color,background-color] duration-150",
        selected
          ? "border-sales-brand/40 bg-sales-brand-soft"
          : "border-sales-border-subtle hover:border-sales-border-strong",
        event.overdue ? "border-sales-danger/40" : "",
      ].join(" ")}
      aria-label={`Open ${customer ?? label} ${label}`}
    >
      <span
        className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: event.overdue ? "#F97066" : getEventTypeColor(event.kind) }}
        aria-hidden
      />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="line-clamp-1 block text-[11px] font-semibold text-sales-text-primary">
          <span className="cal-chip-time text-sales-text-secondary">
            {time !== "All day" ? `${time} ` : ""}
          </span>
          {label}
        </span>
        {customer ? (
          <span className="line-clamp-1 block text-[10px] text-sales-text-secondary">{customer}</span>
        ) : null}
        {event.overdue ? (
          <span className="block text-[9px] font-medium text-sales-danger">Overdue</span>
        ) : null}
      </span>
    </button>
  );
}
