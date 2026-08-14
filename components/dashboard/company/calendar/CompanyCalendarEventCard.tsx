"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import {
  COMPANY_CALENDAR_KIND_META,
  formatCalendarEventRange,
  formatCalendarTime,
} from "@/lib/sales/company-calendar/format";
import type { CompanyCalendarEvent } from "@/lib/sales/company-calendar/types";
import { CompanyCalendarEventIcon } from "./CompanyCalendarEventIcon";

function compactTitle(event: CompanyCalendarEvent): string {
  const raw = event.title.split("·")[0]?.trim() || COMPANY_CALENDAR_KIND_META[event.kind].label;
  const base = raw.toLowerCase() === "callback" ? "Call" : raw;
  if (event.status === "overdue" && !base.toLowerCase().includes("overdue")) {
    return `Overdue ${base}`;
  }
  return base;
}

export function CompanyCalendarEventCard({
  event,
  timezone,
  selected = false,
  variant = "matrix",
  onClick,
}: {
  event: CompanyCalendarEvent;
  timezone: string;
  selected?: boolean;
  variant?: "matrix" | "list" | "month";
  onClick: () => void;
}) {
  const meta = COMPANY_CALENDAR_KIND_META[event.kind];
  const overdue = event.status === "overdue";
  const completed = event.status === "completed";
  const atRisk = Boolean(event.attentionReason) && !overdue;
  const owner = event.ownerName ?? "Unassigned";
  const details = [
    meta.label,
    formatCalendarEventRange(event, timezone),
    `Owner: ${owner}`,
    event.relatedLabel,
    overdue ? event.attentionReason : atRisk ? event.attentionReason : null,
  ].filter(Boolean).join(" · ");

  return (
    <button
      type="button"
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onClick();
      }}
      data-event-kind={event.kind}
      data-event-state={overdue ? "overdue" : completed ? "completed" : atRisk ? "at-risk" : "scheduled"}
      data-course-target="calendar-event"
      title={details}
      aria-label={`Open ${event.title} for ${event.relatedLabel}, owned by ${owner}`}
      className={cn(
        "company-calendar-event group relative w-full overflow-hidden rounded-[8px] border text-left outline-none transition-[border-color,box-shadow,background-color] duration-150 hover:border-sales-border-strong hover:shadow-sales-card-hover focus-visible:ring-2 focus-visible:ring-sales-brand",
        meta.className,
        overdue && "company-calendar-event-overdue",
        completed && "opacity-65",
        event.status === "cancelled" && "opacity-50 line-through",
        selected && "ring-2 ring-sales-brand ring-offset-1 ring-offset-sales-surface",
        variant === "matrix" && "min-h-[52px] px-2.5 py-2",
        variant === "list" && "min-h-[62px] px-3 py-2.5",
        variant === "month" && "min-h-[48px] px-2 py-1.5"
      )}
    >
      <span className="flex items-center justify-between gap-1 text-[10px] font-medium tabular-nums opacity-80">
        <span className="flex min-w-0 items-center gap-1">
          {overdue ? <AlertTriangle size={12} aria-hidden /> : <CompanyCalendarEventIcon kind={event.kind} size={12} />}
          <span className="truncate">
            {event.allDay ? "All day" : formatCalendarTime(event.startAt, timezone)}
          </span>
        </span>
        {completed ? <CheckCircle2 size={12} aria-label="Completed" /> : atRisk ? <AlertTriangle size={12} aria-label="Needs attention" /> : null}
      </span>
      <span className="mt-1 block truncate text-[11px] font-semibold leading-[1.25]">
        {compactTitle(event)}
      </span>
      <span className="mt-0.5 block truncate text-[10px] leading-[1.25] opacity-75">
        {event.relatedLabel}
      </span>
    </button>
  );
}
