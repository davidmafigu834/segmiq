"use client";

import { format, parseISO } from "date-fns";
import { CalendarDays, Plus } from "lucide-react";
import { formatEventTime } from "@/lib/sales/calendar/format";
import {
  getEventTypeColor,
  getEventTypeLabel,
  getEventTypeTint,
} from "@/lib/sales/calendar/adapters";
import type { CalendarEvent } from "@/lib/sales/calendar/types";

function eventTitle(event: CalendarEvent): string {
  if (event.kind === "CALL") return "Callback";
  if (event.kind === "QUOTE_REVIEW") return "Quote review";
  return "Follow-up call";
}

function findNextEventId(events: CalendarEvent[]): string | null {
  const now = Date.now();
  const upcoming = events
    .filter((e) => !e.overdue)
    .map((e) => ({ e, t: new Date(e.startAt).getTime() }))
    .filter(({ t }) => !Number.isNaN(t) && t >= now - 30 * 60 * 1000)
    .sort((a, b) => a.t - b.t);
  return upcoming[0]?.e.id ?? null;
}

export function TodayAgenda({
  dateKey,
  events,
  selectedEventId,
  onSelectEvent,
  onAddEvent,
}: {
  dateKey: string;
  events: CalendarEvent[];
  selectedEventId: string | null;
  onSelectEvent: (event: CalendarEvent) => void;
  onAddEvent: () => void;
}) {
  let header = dateKey;
  try {
    header = format(parseISO(`${dateKey}T12:00:00`), "EEE, d MMM yyyy");
  } catch {
    /* keep key */
  }

  const nextId = findNextEventId(events);

  return (
    <div className="cal-card overflow-hidden bg-sales-surface border-sales-border text-sales-text-primary">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--sales-border-subtle)] px-3.5 py-3">
        <h2 className="text-[14px] font-semibold text-sales-text-primary">Today&apos;s agenda</h2>
        <p className="shrink-0 text-[12px] font-medium text-sales-text-secondary">{header}</p>
      </div>

      {!events.length ? (
        <div className="flex flex-col items-center justify-center px-3 py-8 text-center">
          <CalendarDays size={18} strokeWidth={1.8} className="text-sales-text-muted" aria-hidden />
          <p className="mt-2 text-[13px] font-semibold text-sales-text-primary">No events scheduled</p>
          <p className="mt-0.5 text-[12px] text-sales-text-secondary">Your day is clear.</p>
          <button
            type="button"
            onClick={onAddEvent}
            className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-[9px] bg-sales-brand px-3 text-[12px] font-semibold text-sales-brand-text"
          >
            <Plus size={14} strokeWidth={1.8} aria-hidden />
            Add event
          </button>
        </div>
      ) : (
        <div className="cal-agenda-table" aria-label="Today's agenda">
          <ul className="divide-y divide-[var(--sales-border-subtle)]">
            {events.map((event) => {
              const selected = event.id === selectedEventId;
              const isNext = event.id === nextId;
              const typeColor = getEventTypeColor(event.kind);
              const typeTint = getEventTypeTint(event.kind);

              return (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={() => onSelectEvent(event)}
                    className={[
                      "grid w-full grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-2.5 px-3.5 py-3 text-left transition-colors duration-150",
                      "min-h-[58px]",
                      selected
                        ? "bg-[rgba(212,255,79,0.10)] shadow-[inset_3px_0_0_0_#D4FF4F]"
                        : "hover:bg-sales-surface-hover",
                    ].join(" ")}
                    aria-label={`Open ${event.customerName ?? getEventTypeLabel(event.kind)} ${eventTitle(event)}`}
                    aria-pressed={selected}
                  >
                    <span className="text-[12px] font-semibold tabular-nums leading-none text-sales-text-secondary">
                      {formatEventTime(event.startAt, event.hasTimedCallback)}
                    </span>

                    <span className="flex min-w-0 items-start gap-2">
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                        style={{ background: typeColor }}
                        aria-hidden
                      />
                      <span className="min-w-0">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-[13px] font-semibold leading-tight text-sales-text-primary">
                            {eventTitle(event)}
                          </span>
                          {isNext ? (
                            <span className="shrink-0 rounded-[4px] bg-[rgba(212,255,79,0.4)] px-1 py-px text-[9px] font-bold uppercase tracking-wide text-sales-text-primary">
                              Next
                            </span>
                          ) : null}
                        </span>
                        {event.customerName ? (
                          <span className="mt-0.5 block truncate text-[12px] leading-tight text-sales-text-secondary">
                            {event.customerName}
                          </span>
                        ) : null}
                        {event.overdue ? (
                          <span className="mt-0.5 block text-[11px] font-medium leading-tight text-sales-danger">
                            Overdue
                          </span>
                        ) : null}
                      </span>
                    </span>

                    <span className="shrink-0 self-center">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none"
                        style={{
                          background: typeTint,
                          color: typeColor,
                        }}
                      >
                        {getEventTypeLabel(event.kind)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
