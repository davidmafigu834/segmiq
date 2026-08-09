"use client";

import Link from "next/link";
import { parseISO, startOfDay } from "date-fns";
import { Phone, Plus } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import {
  formatEventTime,
  formatRelativeEventDate,
  groupEventsByDate,
} from "@/lib/sales/calendar/format";
import {
  getEventSalesContext,
  getEventTypeColor,
  getEventTypeLabel,
} from "@/lib/sales/calendar/adapters";
import { whatsappInboxHref } from "@/lib/leads/whatsapp-lead-display";
import type { CalendarEvent } from "@/lib/sales/calendar/types";

export function AgendaView({
  events,
  selectedEventId,
  onSelectEvent,
  onAddEvent,
}: {
  events: CalendarEvent[];
  selectedEventId: string | null;
  onSelectEvent: (event: CalendarEvent) => void;
  onAddEvent: () => void;
}) {
  const now = startOfDay(new Date());
  const overdue = events
    .filter((e) => e.overdue)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const upcoming = events.filter((e) => {
    try {
      return parseISO(e.startAt) >= now && !e.overdue;
    } catch {
      return false;
    }
  });
  const groups = groupEventsByDate(upcoming);

  if (!events.length) {
    return (
      <div className="cal-card border-sales-border bg-sales-surface px-6 py-10 text-center text-sales-text-primary">
        <p className="text-[15px] font-semibold text-sales-text-primary">
          No scheduled sales activities yet
        </p>
        <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-sales-text-secondary">
          Follow-ups, calls, site visits and meetings will appear here as you schedule them.
        </p>
        <button
          type="button"
          onClick={onAddEvent}
          className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-[9px] bg-sales-brand px-4 text-[13px] font-semibold text-sales-brand-text"
        >
          <Plus size={16} strokeWidth={1.8} aria-hidden />
          Add event
        </button>
      </div>
    );
  }

  return (
    <div className="cal-card space-y-4 border-sales-border bg-sales-surface p-4 text-sales-text-primary">
      {overdue.length > 0 ? (
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-sales-danger">
            Overdue
          </h3>
          <ul className="space-y-1.5">
            {overdue.map((event) => (
              <AgendaRow
                key={event.id}
                event={event}
                selected={event.id === selectedEventId}
                onSelect={() => onSelectEvent(event)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {groups.map((group) => (
        <section key={group.dateKey}>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-sales-text-secondary">
            {group.label}
          </h3>
          <ul className="space-y-1.5">
            {group.events.map((event) => (
              <AgendaRow
                key={event.id}
                event={event}
                selected={event.id === selectedEventId}
                onSelect={() => onSelectEvent(event)}
              />
            ))}
          </ul>
        </section>
      ))}

      {!overdue.length && !groups.length ? (
        <p className="py-8 text-center text-[13px] text-sales-text-secondary">
          No upcoming activities in range.
        </p>
      ) : null}
    </div>
  );
}

function AgendaRow({
  event,
  selected,
  onSelect,
}: {
  event: CalendarEvent;
  selected: boolean;
  onSelect: () => void;
}) {
  const context = getEventSalesContext(event);

  return (
    <li>
      <div
        className={[
          "flex w-full flex-col gap-2 rounded-[10px] border px-3 py-2.5 transition-colors duration-150 sm:flex-row sm:items-start",
          selected
            ? "border-[rgba(160,210,30,0.55)] bg-[rgba(212,255,79,0.08)]"
            : "border-sales-border hover:border-sales-border-strong hover:bg-sales-surface-hover",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
          aria-label={`Open ${event.customerName ?? getEventTypeLabel(event.kind)}`}
        >
          <span className="w-12 shrink-0 pt-0.5 text-[12px] font-semibold tabular-nums text-sales-text-secondary">
            {formatEventTime(event.startAt, event.hasTimedCallback)}
          </span>
          <span
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
            style={{ background: getEventTypeColor(event.kind) }}
            aria-hidden
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-sales-text-primary">
              {getEventTypeLabel(event.kind)}
              {event.kind === "FOLLOW_UP" ? " call" : ""}
              {event.overdue ? (
                <span className="ml-2 text-[11px] font-medium text-sales-danger">Overdue</span>
              ) : null}
            </span>
            {event.customerName ? (
              <span className="mt-0.5 block truncate text-[12px] text-sales-text-secondary">
                {event.customerName}
              </span>
            ) : null}
            {context ? (
              <span className="mt-0.5 block truncate text-[11px] text-sales-text-muted">{context}</span>
            ) : null}
            {event.location ? (
              <span className="mt-0.5 block truncate text-[11px] text-sales-text-muted">
                {event.location}
              </span>
            ) : null}
            {event.overdue ? (
              <span className="mt-0.5 block text-[11px] text-sales-text-muted">
                {formatRelativeEventDate(event.startAt)}
              </span>
            ) : null}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1.5 sm:pt-0.5">
          <Link
            href={whatsappInboxHref(event.leadId)}
            className="inline-flex h-8 items-center gap-1 rounded-[8px] border border-sales-border bg-sales-surface px-2 text-[11px] font-semibold text-sales-text-primary hover:bg-sales-surface-hover"
            aria-label={`WhatsApp ${event.customerName ?? "lead"}`}
          >
            <SiWhatsapp size={12} color="#25D366" aria-hidden />
            WhatsApp
          </Link>
          {event.phone ? (
            <a
              href={`tel:${event.phone}`}
              className="inline-flex h-8 items-center gap-1 rounded-[8px] border border-sales-border bg-sales-surface px-2 text-[11px] font-semibold text-sales-text-primary hover:bg-sales-surface-hover"
              aria-label={`Call ${event.customerName ?? "lead"}`}
            >
              <Phone size={12} strokeWidth={1.8} aria-hidden />
              Call
            </a>
          ) : null}
        </div>
      </div>
    </li>
  );
}
