"use client";

import type { CalendarEventKind } from "@/lib/sales/calendar/types";
import { SUPPORTED_EVENT_KINDS } from "@/lib/sales/calendar/types";
import { getEventTypeColor, getEventTypeLabel } from "@/lib/sales/calendar/adapters";

const ALL_FILTER_KINDS: CalendarEventKind[] = [
  "FOLLOW_UP",
  "SITE_VISIT",
  "QUOTE_REVIEW",
  "INSTALLATION_MEETING",
  "CALL",
  "PERSONAL",
];

export function EventTypeFilters({
  enabled,
  onToggle,
}: {
  enabled: Set<CalendarEventKind>;
  onToggle: (kind: CalendarEventKind) => void;
}) {
  return (
    <div className="cal-card border-sales-border bg-sales-surface p-2.5 text-sales-text-primary">
      <p className="mb-1.5 text-[14px] font-semibold text-sales-text-primary">Event types</p>
      <ul>
        {ALL_FILTER_KINDS.map((kind) => {
          const supported = SUPPORTED_EVENT_KINDS.includes(kind);
          const checked = enabled.has(kind);
          return (
            <li key={kind}>
              <label
                className={[
                  "flex h-[34px] cursor-pointer items-center gap-2 rounded-[8px] px-1 transition-colors",
                  supported ? "hover:bg-sales-surface-hover" : "cursor-not-allowed opacity-45",
                ].join(" ")}
                title={
                  supported
                    ? undefined
                    : "Not available yet — SegmiQ does not store this event type"
                }
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: getEventTypeColor(kind) }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-[13px] text-sales-text-primary">
                  {getEventTypeLabel(kind)}
                </span>
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-sales-border-strong accent-[#22C55E]"
                  checked={checked}
                  disabled={!supported}
                  onChange={() => onToggle(kind)}
                  aria-label={`Show ${getEventTypeLabel(kind)} events`}
                />
              </label>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        disabled
        title="Custom event types are not supported yet"
        className="mt-1.5 w-full cursor-not-allowed rounded-[9px] border border-dashed border-sales-border py-1.5 text-[12px] font-medium text-sales-text-muted"
      >
        + Add custom type
      </button>
    </div>
  );
}
