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
        "cal-event-chip flex w-full items-start gap-1 rounded-[6px] border bg-white px-1 py-0.5 text-left transition-[border-color,box-shadow] duration-150",
        selected
          ? "border-[rgba(160,210,30,0.55)] bg-[rgba(212,255,79,0.1)]"
          : "border-[#E4E7EC] hover:border-[#D0D5DD] hover:shadow-[0_1px_2px_rgba(16,24,40,0.05)]",
        event.overdue ? "border-l-2 !border-l-[#F97066]" : "",
      ].join(" ")}
      style={
        event.overdue
          ? undefined
          : { borderLeftWidth: 2, borderLeftColor: getEventTypeColor(event.kind) }
      }
      aria-label={`Open ${customer ?? label} ${label}`}
    >
      <span
        className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: event.overdue ? "#F97066" : getEventTypeColor(event.kind) }}
        aria-hidden
      />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="line-clamp-1 block text-[11px] font-semibold text-[#101828]">
          <span className="cal-chip-time text-[#667085]">
            {time !== "All day" ? `${time} ` : ""}
          </span>
          {label}
        </span>
        {customer ? (
          <span className="line-clamp-1 block text-[10px] text-[#667085]">{customer}</span>
        ) : null}
        {event.overdue ? (
          <span className="block text-[9px] font-medium text-[#B42318]">Overdue</span>
        ) : null}
      </span>
    </button>
  );
}
