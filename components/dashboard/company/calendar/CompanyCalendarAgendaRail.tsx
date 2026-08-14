"use client";

import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MapPin,
  Phone,
  Plus,
  UserRound,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { cn } from "@/lib/ui/cn";
import {
  COMPANY_CALENDAR_KIND_META,
  calendarDateKey,
  formatCalendarEventRange,
  formatCalendarTime,
} from "@/lib/sales/company-calendar/format";
import type { CompanyCalendarEvent } from "@/lib/sales/company-calendar/types";
import { Button } from "@/components/sales/ui/Button";
import { CompanyCalendarEventIcon } from "./CompanyCalendarEventIcon";

function relationLabel(event: CompanyCalendarEvent): string {
  if (event.relationType === "deal") return "Deal";
  if (event.relationType === "customer") return "Customer";
  return "Lead";
}

function statusLabel(event: CompanyCalendarEvent): string {
  if (event.status === "overdue") return "Overdue";
  if (event.status === "completed") return "Completed";
  if (event.status === "cancelled") return "Cancelled";
  return "Scheduled";
}

function statusClass(event: CompanyCalendarEvent): string {
  if (event.status === "overdue") return "bg-sales-danger-soft text-sales-danger-fg";
  if (event.status === "completed") return "bg-sales-success-soft text-sales-success-fg";
  if (event.status === "cancelled") return "bg-sales-surface-subtle text-sales-text-muted";
  return "bg-sales-info-soft text-sales-info-fg";
}

function MiniMonth({
  month,
  selectedDateKey,
  events,
  timezone,
  onMonthChange,
  onSelectDate,
}: {
  month: Date;
  selectedDateKey: string;
  events: CompanyCalendarEvent[];
  timezone: string;
  onMonthChange: (month: Date) => void;
  onSelectDate: (key: string) => void;
}) {
  const monthStart = startOfMonth(month);
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(monthStart), { weekStartsOn: 0 }),
  });
  const todayKey = calendarDateKey(new Date(), timezone);
  const activityDates = new Set(events.map((event) => calendarDateKey(event.startAt, timezone)));
  return (
    <section className="border-b border-sales-border-subtle p-4" data-course-target="calendar-date-navigation">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-semibold text-sales-text-primary">{format(monthStart, "MMMM yyyy")}</h2>
        <div className="flex gap-1">
          <button type="button" className="sd-icon-btn !h-8 !w-8" aria-label="Previous month" onClick={() => onMonthChange(addMonths(monthStart, -1))}><ChevronLeft size={15} /></button>
          <button type="button" className="sd-icon-btn !h-8 !w-8" aria-label="Next month" onClick={() => onMonthChange(addMonths(monthStart, 1))}><ChevronRight size={15} /></button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-y-1 text-center">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((label) => <span key={label} className="text-[10px] font-semibold text-sales-text-muted">{label}</span>)}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const today = key === todayKey;
          const selected = key === selectedDateKey;
          const hasEvent = activityDates.has(key);
          return (
            <button key={key} type="button" onClick={() => onSelectDate(key)} aria-label={format(day, "EEEE, MMMM d, yyyy")} className={cn("relative mx-auto flex h-8 w-8 items-center justify-center rounded-[8px] text-[11px] font-medium transition-colors hover:bg-sales-surface-hover", today ? "rounded-full bg-sales-brand text-sales-brand-text" : selected ? "bg-sales-surface-hover text-sales-text-primary ring-1 ring-sales-border" : isSameMonth(day, monthStart) ? "text-sales-text-secondary" : "text-sales-text-disabled")}>
              {format(day, "d")}
              {hasEvent ? <span className={cn("absolute bottom-0.5 h-1 w-1 rounded-full", today ? "bg-sales-brand-text" : "bg-sales-brand-fg")} /> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function AgendaRow({ event, timezone, onSelect }: { event: CompanyCalendarEvent; timezone: string; onSelect: () => void }) {
  const meta = COMPANY_CALENDAR_KIND_META[event.kind];
  const initials = event.ownerName?.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "?";
  return (
    <button type="button" onClick={onSelect} className="flex w-full items-center gap-2.5 border-b border-sales-border-subtle py-2.5 text-left last:border-0 hover:bg-sales-surface-hover" aria-label={`Open ${event.title}`}>
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", meta.className)} data-event-kind={event.kind}><CompanyCalendarEventIcon kind={event.kind} size={14} /></span>
      <span className="w-[58px] shrink-0 text-[11px] font-medium tabular-nums text-sales-text-secondary">{event.allDay ? "All day" : formatCalendarTime(event.startAt, timezone)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-semibold text-sales-text-primary">{event.title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-sales-text-muted">{event.relatedLabel}</span>
        <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] text-sales-text-muted">
          {event.ownerAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.ownerAvatarUrl} alt="" className="h-4 w-4 shrink-0 rounded-full object-cover" />
          ) : <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sales-brand-soft text-[6px] font-semibold text-sales-text-primary">{initials}</span>}
          <span className="truncate">{event.ownerName ?? "Unassigned"}</span>
        </span>
      </span>
      <span className="shrink-0 rounded-[5px] border border-sales-border bg-sales-surface-subtle px-1.5 py-0.5 text-[10px] font-medium text-sales-text-secondary">{relationLabel(event)}</span>
    </button>
  );
}

function DefaultAgenda({
  selectedDateKey,
  selectedDayEvents,
  upcomingEvents,
  timezone,
  onSelectEvent,
  onViewAll,
  onAdd,
  canCreate,
}: {
  selectedDateKey: string;
  selectedDayEvents: CompanyCalendarEvent[];
  upcomingEvents: CompanyCalendarEvent[];
  timezone: string;
  onSelectEvent: (event: CompanyCalendarEvent) => void;
  onViewAll: () => void;
  onAdd: () => void;
  canCreate: boolean;
}) {
  const selectedDate = parseISO(`${selectedDateKey}T12:00:00`);
  return (
    <>
      <section className="border-b border-sales-border-subtle p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-[13px] font-semibold text-sales-text-primary">{format(selectedDate, "EEE, MMM d, yyyy")}</h2>
            <p className="mt-0.5 text-[11px] text-sales-text-muted">Selected day</p>
          </div>
          <span className="text-[11px] font-medium text-sales-text-muted">{selectedDayEvents.length} {selectedDayEvents.length === 1 ? "activity" : "activities"}</span>
        </div>
        {selectedDayEvents.length ? (
          <div className="mt-2">
            {selectedDayEvents.map((event) => <AgendaRow key={event.id} event={event} timezone={timezone} onSelect={() => onSelectEvent(event)} />)}
          </div>
        ) : (
          <div className="flex min-h-[118px] flex-col items-center justify-center text-center">
            <CalendarDays size={20} className="text-sales-text-muted" />
            <p className="mt-2 text-[12px] font-medium text-sales-text-primary">No activities scheduled for this day.</p>
            {canCreate ? <button type="button" onClick={onAdd} className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-sales-brand-fg hover:underline"><Plus size={13} /> New Activity</button> : null}
          </div>
        )}
      </section>
      <section className="p-4" data-course-target="calendar-upcoming">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h2 className="text-[13px] font-semibold text-sales-text-primary">Upcoming</h2>
            {upcomingEvents.length ? <span className="rounded-full bg-sales-surface-subtle px-1.5 py-0.5 text-[10px] text-sales-text-muted">{upcomingEvents.length}</span> : null}
          </div>
          <button type="button" onClick={onViewAll} className="text-[11px] font-semibold text-sales-brand-fg hover:underline">View all</button>
        </div>
        {upcomingEvents.length ? (
          <div className="mt-2 space-y-1">
            {upcomingEvents.slice(0, 4).map((event) => (
              <button key={event.id} type="button" onClick={() => onSelectEvent(event)} className="grid w-full grid-cols-[54px_minmax(0,1fr)_auto] items-start gap-2 border-b border-sales-border-subtle py-2.5 text-left last:border-0 hover:bg-sales-surface-hover">
                <span className="text-[10px] font-medium text-sales-text-muted">{new Intl.DateTimeFormat("en-US", { timeZone: timezone, month: "short", day: "numeric" }).format(new Date(event.startAt))}<span className="mt-0.5 block">{event.allDay ? "All day" : formatCalendarTime(event.startAt, timezone)}</span></span>
                <span className="min-w-0"><span className="block truncate text-[12px] font-semibold text-sales-text-primary">{event.title}</span><span className="mt-0.5 block truncate text-[11px] text-sales-text-muted">{event.relatedLabel}</span><span className="mt-0.5 block truncate text-[10px] text-sales-text-muted">{event.ownerName ?? "Unassigned"}</span></span>
                <span className="rounded-[5px] border border-sales-border px-1 py-0.5 text-[10px] font-medium text-sales-text-secondary">{COMPANY_CALENDAR_KIND_META[event.kind].shortLabel}</span>
              </button>
            ))}
          </div>
        ) : <p className="py-8 text-center text-[12px] text-sales-text-muted">Nothing else scheduled.</p>}
      </section>
    </>
  );
}

function EventDetail({
  event,
  timezone,
  busy,
  onBack,
  onEdit,
  onComplete,
}: {
  event: CompanyCalendarEvent;
  timezone: string;
  busy: boolean;
  onBack: () => void;
  onEdit: () => void;
  onComplete: () => void;
}) {
  const meta = COMPANY_CALENDAR_KIND_META[event.kind];
  const initials = event.ownerName?.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "?";
  return (
    <div className="p-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[12px] font-semibold text-sales-text-secondary hover:text-sales-text-primary"><ArrowLeft size={14} /> Back to agenda</button>
      <div className="mt-4 flex items-start gap-3 border-b border-sales-border-subtle pb-4">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]", meta.className)} data-event-kind={event.kind}><CompanyCalendarEventIcon kind={event.kind} size={17} /></span>
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold leading-snug text-sales-text-primary">{event.title}</h2>
          <div className="mt-1.5 flex flex-wrap gap-1.5"><span className="rounded-[5px] border border-sales-border px-1.5 py-0.5 text-[10px] font-medium text-sales-text-secondary">{meta.label}</span><span className={cn("rounded-[5px] px-1.5 py-0.5 text-[10px] font-medium", statusClass(event))}>{statusLabel(event)}</span></div>
        </div>
      </div>
      <div className="divide-y divide-sales-border-subtle">
        <div className="flex gap-3 py-3.5"><CalendarDays size={15} className="mt-0.5 shrink-0 text-sales-text-muted" /><div><p className="text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">Date and time</p><p className="mt-1 text-[12px] text-sales-text-primary">{formatCalendarEventRange(event, timezone)}</p><p className="mt-0.5 text-[10px] text-sales-text-muted">{timezone}</p></div></div>
        <div className="py-3.5"><p className="text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">Related {relationLabel(event)}</p><Link href={event.relatedHref} className="mt-2 flex items-center justify-between rounded-[9px] border border-sales-border bg-sales-surface-subtle px-3 py-2.5 hover:border-sales-border-strong"><span className="min-w-0"><span className="block truncate text-[12px] font-semibold text-sales-text-primary">{event.relatedLabel}</span>{event.relatedSecondary ? <span className="mt-0.5 block truncate text-[11px] text-sales-text-muted">{event.relatedSecondary}</span> : null}</span><ExternalLink size={13} className="shrink-0 text-sales-text-muted" /></Link></div>
        <div className="flex gap-3 py-3.5"><UserRound size={15} className="mt-0.5 shrink-0 text-sales-text-muted" /><div><p className="text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">Owner</p><div className="mt-1.5 flex items-center gap-2">{event.ownerAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.ownerAvatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sales-surface-subtle text-[9px] font-semibold text-sales-text-primary">{initials}</span>}<span><span className="block text-[12px] text-sales-text-primary">{event.ownerName ?? "Unassigned"}</span>{event.ownerRoleLabel ? <span className="mt-0.5 block text-[10px] text-sales-text-muted">{event.ownerRoleLabel}</span> : null}</span></div></div></div>
        {event.attentionReason ? <div className="rounded-[9px] border border-sales-warning/25 bg-sales-warning-soft px-3 py-2.5 text-[11px] leading-relaxed text-sales-warning-fg"><span className="font-semibold">Needs attention:</span> {event.attentionReason}</div> : null}
        {event.location ? <div className="flex gap-3 py-3.5"><MapPin size={15} className="mt-0.5 shrink-0 text-sales-text-muted" /><div><p className="text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">Location</p><p className="mt-1 text-[12px] text-sales-text-primary">{event.location}</p></div></div> : null}
        {event.description ? <div className="py-3.5"><p className="text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">Description</p><p className="mt-1.5 text-[12px] leading-relaxed text-sales-text-secondary">{event.description}</p></div> : null}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {event.phone ? <a href={`tel:${event.phone}`} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[9px] border border-sales-border text-[12px] font-semibold text-sales-text-primary hover:bg-sales-surface-hover"><Phone size={13} /> Call</a> : null}
        {event.leadId ? <Link href={`/client/inbox?lead=${encodeURIComponent(event.leadId)}`} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[9px] border border-sales-border text-[12px] font-semibold text-sales-text-primary hover:bg-sales-surface-hover"><SiWhatsapp size={13} color="#25D366" /> WhatsApp</Link> : null}
        <Link href={event.relatedHref} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[9px] border border-sales-border text-[12px] font-semibold text-sales-text-primary hover:bg-sales-surface-hover"><ExternalLink size={13} /> Open {relationLabel(event)}</Link>
        {event.canComplete ? <button type="button" disabled={busy} onClick={onComplete} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[9px] border border-sales-border text-[12px] font-semibold text-sales-text-primary hover:bg-sales-surface-hover disabled:opacity-50"><Check size={13} /> Mark complete</button> : null}
      </div>
      {event.canEdit ? <Button variant="primary" className="mt-3 w-full" onClick={onEdit}>Edit / reschedule</Button> : null}
    </div>
  );
}

export function CompanyCalendarAgendaRail({
  miniMonth,
  selectedDateKey,
  selectedEvent,
  selectedDayEvents,
  upcomingEvents,
  allEvents,
  timezone,
  canCreate,
  busy,
  onMiniMonthChange,
  onSelectDate,
  onSelectEvent,
  onBack,
  onViewAll,
  onAdd,
  onEdit,
  onComplete,
}: {
  miniMonth: Date;
  selectedDateKey: string;
  selectedEvent: CompanyCalendarEvent | null;
  selectedDayEvents: CompanyCalendarEvent[];
  upcomingEvents: CompanyCalendarEvent[];
  allEvents: CompanyCalendarEvent[];
  timezone: string;
  canCreate: boolean;
  busy: boolean;
  onMiniMonthChange: (month: Date) => void;
  onSelectDate: (key: string) => void;
  onSelectEvent: (event: CompanyCalendarEvent) => void;
  onBack: () => void;
  onViewAll: () => void;
  onAdd: () => void;
  onEdit: () => void;
  onComplete: () => void;
}) {
  return (
    <aside className="h-full min-h-[760px] overflow-hidden rounded-[14px] border border-sales-border bg-sales-surface shadow-sales-card" data-course-target="calendar-right-agenda">
      {selectedEvent ? (
        <EventDetail event={selectedEvent} timezone={timezone} busy={busy} onBack={onBack} onEdit={onEdit} onComplete={onComplete} />
      ) : (
        <>
          <MiniMonth month={miniMonth} selectedDateKey={selectedDateKey} events={allEvents} timezone={timezone} onMonthChange={onMiniMonthChange} onSelectDate={onSelectDate} />
          <DefaultAgenda selectedDateKey={selectedDateKey} selectedDayEvents={selectedDayEvents} upcomingEvents={upcomingEvents} timezone={timezone} onSelectEvent={onSelectEvent} onViewAll={onViewAll} onAdd={onAdd} canCreate={canCreate} />
        </>
      )}
    </aside>
  );
}
