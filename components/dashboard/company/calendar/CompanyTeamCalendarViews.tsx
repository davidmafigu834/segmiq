"use client";

import Link from "next/link";
import {
  addDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  parseISO,
  startOfWeek,
} from "date-fns";
import { CalendarDays, Plus, UsersRound } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import {
  calendarDateKey,
  companyCalendarTeamAttention,
  companyCalendarOwnerKey,
  COMPANY_CALENDAR_UNASSIGNED_OWNER,
  groupCompanyCalendarEventsByOwnerDay,
} from "@/lib/sales/company-calendar/format";
import type {
  CompanyCalendarEvent,
  CompanyCalendarOwnerOption,
} from "@/lib/sales/company-calendar/types";
import { CompanyCalendarEventCard } from "./CompanyCalendarEventCard";

type CalendarOwner = CompanyCalendarOwnerOption | {
  id: typeof COMPANY_CALENDAR_UNASSIGNED_OWNER;
  name: "Unassigned";
  avatarUrl: null;
  roleLabel: "Needs an owner";
};

function parseDateKey(key: string): Date {
  return parseISO(`${key}T12:00:00`);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function OwnerAvatar({ owner, size = "md" }: { owner: CalendarOwner; size?: "sm" | "md" }) {
  const className = size === "sm" ? "h-6 w-6 text-[8px]" : "h-9 w-9 text-[10px]";
  if (owner.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={owner.avatarUrl} alt="" className={cn(className, "shrink-0 rounded-full object-cover")} />
    );
  }
  return (
    <span className={cn(className, "flex shrink-0 items-center justify-center rounded-full bg-sales-brand-soft font-semibold text-sales-text-primary")}>
      {initials(owner.name)}
    </span>
  );
}

function ownerRows(
  owners: CompanyCalendarOwnerOption[],
  events: CompanyCalendarEvent[]
): CalendarOwner[] {
  const rows: CalendarOwner[] = [...owners];
  if (events.some((event) => event.ownerId == null)) {
    rows.push({
      id: COMPANY_CALENDAR_UNASSIGNED_OWNER,
      name: "Unassigned",
      avatarUrl: null,
      roleLabel: "Needs an owner",
    });
  }
  return rows;
}

function TeamIdentity({ owner, events }: { owner: CalendarOwner; events: CompanyCalendarEvent[] }) {
  const attention = companyCalendarTeamAttention(events);
  const dotClass =
    attention.tone === "overdue"
      ? "bg-sales-danger"
      : attention.tone === "attention"
        ? "bg-sales-warning"
        : "bg-sales-success";
  const body = (
    <>
      <OwnerAvatar owner={owner} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[11px] font-semibold text-sales-text-primary">{owner.name}</span>
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClass)} title={attention.label} aria-label={attention.label} />
        </span>
        <span className="mt-0.5 block truncate text-[9px] text-sales-text-muted">{owner.roleLabel}</span>
      </span>
    </>
  );
  if (owner.id === COMPANY_CALENDAR_UNASSIGNED_OWNER) {
    return <div className="flex items-center gap-2.5 px-3">{body}</div>;
  }
  return (
    <Link href={`/client/team?member=${encodeURIComponent(owner.id)}`} className="flex h-full items-center gap-2.5 px-3 hover:bg-sales-surface-hover" title={`Open ${owner.name}'s team profile`}>
      {body}
    </Link>
  );
}

export function CompanyTeamWeekView({
  anchorKey,
  showWeekends,
  owners,
  events,
  timezone,
  selectedDateKey,
  selectedEventId,
  canCreate,
  onSelectDate,
  onSelectEvent,
  onCreate,
  onMore,
}: {
  anchorKey: string;
  showWeekends: boolean;
  owners: CompanyCalendarOwnerOption[];
  events: CompanyCalendarEvent[];
  timezone: string;
  selectedDateKey: string;
  selectedEventId: string | null;
  canCreate: boolean;
  onSelectDate: (key: string) => void;
  onSelectEvent: (event: CompanyCalendarEvent) => void;
  onCreate: (ownerId: string | null, dateKey: string) => void;
  onMore: (ownerId: string | null, dateKey: string) => void;
}) {
  const anchor = parseDateKey(anchorKey);
  const allDays = eachDayOfInterval({
    start: startOfWeek(anchor, { weekStartsOn: 0 }),
    end: endOfWeek(anchor, { weekStartsOn: 0 }),
  });
  const days = showWeekends ? allDays : allDays.filter((day) => day.getDay() % 6);
  const todayKey = calendarDateKey(new Date(), timezone);
  const grouped = groupCompanyCalendarEventsByOwnerDay(events, timezone);
  const rows = ownerRows(owners, events);
  const columns = `156px repeat(${days.length}, minmax(108px, 1fr))`;

  if (!rows.length) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
        <UsersRound size={28} className="text-sales-text-muted" />
        <h3 className="mt-3 text-[14px] font-semibold text-sales-text-primary">No team members added yet.</h3>
        <p className="mt-1 max-w-sm text-[11px] text-sales-text-muted">Add your sales team to begin scheduling and managing company activities.</p>
      </div>
    );
  }

  return (
    <div className="max-h-[680px] overflow-auto overscroll-contain" data-course-target="calendar-team-week">
      <div className="min-w-[940px] xl:min-w-0">
        <div className="sticky top-0 z-20 grid border-b border-sales-border-subtle bg-sales-surface" style={{ gridTemplateColumns: columns }}>
          <div className="sticky left-0 z-30 flex items-center border-r border-sales-border-subtle bg-sales-surface px-3 text-[9px] font-semibold uppercase tracking-[0.05em] text-sales-text-muted">Team member</div>
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const today = key === todayKey;
            return (
              <button key={key} type="button" onClick={() => onSelectDate(key)} className={cn("min-h-[60px] border-r border-sales-border-subtle px-2 py-2 text-center last:border-r-0 hover:bg-sales-surface-hover", key === selectedDateKey && "bg-sales-surface-subtle")}>
                <span className={cn("block text-[9px] font-semibold uppercase tracking-[0.06em]", today ? "text-sales-brand-fg" : "text-sales-text-muted")}>{format(day, "EEE")}</span>
                <span className={cn("mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full text-[15px] font-semibold", today ? "bg-sales-brand text-sales-brand-text" : "text-sales-text-primary")}>{format(day, "d")}</span>
              </button>
            );
          })}
        </div>

        {rows.map((owner) => {
          const ownerKey = owner.id;
          const ownerEvents = events.filter((event) => companyCalendarOwnerKey(event.ownerId) === ownerKey);
          const ownerId = owner.id === COMPANY_CALENDAR_UNASSIGNED_OWNER ? null : owner.id;
          return (
            <div key={owner.id} className="group/team grid h-[116px] border-b border-sales-border-subtle last:border-b-0 hover:bg-sales-surface-hover" style={{ gridTemplateColumns: columns }}>
              <div className="sticky left-0 z-10 border-r border-sales-border-subtle bg-sales-surface group-hover/team:bg-sales-surface-hover">
                <TeamIdentity owner={owner} events={ownerEvents} />
              </div>
              {days.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const cellEvents = grouped[ownerKey]?.[key] ?? [];
                const visible = cellEvents.slice(0, 2);
                const remaining = cellEvents.length - visible.length;
                return (
                  <div key={key} className={cn("relative min-w-0 border-r border-sales-border-subtle p-1.5 last:border-r-0", key === selectedDateKey && "bg-sales-brand-soft/30")}>
                    {visible.length ? (
                      <div className="space-y-1">
                        {visible.map((event) => (
                          <CompanyCalendarEventCard key={event.id} event={event} timezone={timezone} selected={selectedEventId === event.id} onClick={() => onSelectEvent(event)} />
                        ))}
                        {remaining > 0 ? (
                          <button type="button" onClick={() => onMore(ownerId, key)} className="block w-full truncate px-1 text-left text-[8px] font-semibold text-sales-brand-fg hover:underline">+ {remaining} more</button>
                        ) : null}
                      </div>
                    ) : canCreate && ownerId ? (
                      <button type="button" onClick={() => onCreate(ownerId, key)} className="flex h-full w-full items-center justify-center rounded-[7px] text-sales-text-disabled opacity-0 transition-opacity hover:bg-sales-surface-subtle hover:text-sales-text-muted group-hover/team:opacity-100 focus-visible:opacity-100" aria-label={`Add activity for ${owner.name} on ${format(day, "MMMM d")}`}><Plus size={14} /></button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TeamAgendaGroup({
  owner,
  events,
  timezone,
  selectedEventId,
  onSelectEvent,
}: {
  owner: CalendarOwner;
  events: CompanyCalendarEvent[];
  timezone: string;
  selectedEventId: string | null;
  onSelectEvent: (event: CompanyCalendarEvent) => void;
}) {
  return (
    <section className="border-b border-sales-border-subtle p-3 last:border-b-0">
      <div className="flex items-center gap-2">
        <OwnerAvatar owner={owner} size="sm" />
        <div className="min-w-0"><h3 className="truncate text-[11px] font-semibold text-sales-text-primary">{owner.name}</h3><p className="text-[9px] text-sales-text-muted">{owner.roleLabel}</p></div>
        <span className="ml-auto text-[9px] text-sales-text-muted">{events.length} {events.length === 1 ? "activity" : "activities"}</span>
      </div>
      {events.length ? <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{events.map((event) => <CompanyCalendarEventCard key={event.id} event={event} timezone={timezone} variant="list" selected={selectedEventId === event.id} onClick={() => onSelectEvent(event)} />)}</div> : <p className="mt-2 rounded-[8px] border border-dashed border-sales-border px-3 py-3 text-[10px] text-sales-text-muted">No activities scheduled.</p>}
    </section>
  );
}

export function CompanyTeamDayView({
  dateKey,
  owners,
  events,
  timezone,
  selectedEventId,
  onSelectEvent,
}: {
  dateKey: string;
  owners: CompanyCalendarOwnerOption[];
  events: CompanyCalendarEvent[];
  timezone: string;
  selectedEventId: string | null;
  onSelectEvent: (event: CompanyCalendarEvent) => void;
}) {
  const dayEvents = events.filter((event) => calendarDateKey(event.startAt, timezone) === dateKey);
  const rows = ownerRows(owners, dayEvents);
  return (
    <div className="max-h-[680px] overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-sales-border-subtle bg-sales-surface px-4 py-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-sales-text-muted">Team day</p><h2 className="mt-0.5 text-[13px] font-semibold text-sales-text-primary">{format(parseDateKey(dateKey), "EEEE, MMMM d")}</h2></div><span className="text-[10px] text-sales-text-muted">{dayEvents.length} activities</span></div>
      {rows.map((owner) => <TeamAgendaGroup key={owner.id} owner={owner} events={dayEvents.filter((event) => companyCalendarOwnerKey(event.ownerId) === owner.id)} timezone={timezone} selectedEventId={selectedEventId} onSelectEvent={onSelectEvent} />)}
    </div>
  );
}

export function MobileTeamCalendarAgenda({
  selectedDateKey,
  owners,
  events,
  timezone,
  selectedEventId,
  onSelectDate,
  onSelectEvent,
}: {
  selectedDateKey: string;
  owners: CompanyCalendarOwnerOption[];
  events: CompanyCalendarEvent[];
  timezone: string;
  selectedEventId: string | null;
  onSelectDate: (key: string) => void;
  onSelectEvent: (event: CompanyCalendarEvent) => void;
}) {
  const selected = parseDateKey(selectedDateKey);
  const dates = Array.from({ length: 7 }, (_, index) => addDays(selected, index - 3));
  const dayEvents = events.filter((event) => calendarDateKey(event.startAt, timezone) === selectedDateKey);
  const rows = ownerRows(owners, dayEvents).filter((owner) => dayEvents.some((event) => companyCalendarOwnerKey(event.ownerId) === owner.id));
  return (
    <div>
      <div className="flex gap-1 overflow-x-auto border-b border-sales-border-subtle p-3">{dates.map((date) => { const key = format(date, "yyyy-MM-dd"); const active = key === selectedDateKey; return <button key={key} type="button" onClick={() => onSelectDate(key)} className={cn("min-w-[48px] rounded-[9px] border px-2 py-2 text-center", active ? "border-sales-brand bg-sales-brand text-sales-brand-text" : "border-sales-border bg-sales-surface")}><span className="block text-[8px] font-semibold uppercase">{format(date, "EEE")}</span><span className="mt-1 block text-[14px] font-semibold">{format(date, "d")}</span></button>; })}</div>
      {!rows.length ? <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center"><CalendarDays size={24} className="text-sales-text-muted" /><p className="mt-2 text-[12px] font-semibold text-sales-text-primary">No team activities for this day.</p><p className="mt-1 text-[10px] text-sales-text-muted">Choose another date or schedule a new activity.</p></div> : rows.map((owner) => <TeamAgendaGroup key={owner.id} owner={owner} events={dayEvents.filter((event) => companyCalendarOwnerKey(event.ownerId) === owner.id)} timezone={timezone} selectedEventId={selectedEventId} onSelectEvent={onSelectEvent} />)}
    </div>
  );
}
