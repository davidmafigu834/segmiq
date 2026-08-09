"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addMonths,
  addWeeks,
  format,
  parseISO,
  startOfMonth,
  subMonths,
  subWeeks,
} from "date-fns";
import { AlarmClock, CalendarDays, ChevronLeft, ChevronRight, Plus, SlidersHorizontal, X } from "lucide-react";
import type { CalendarEvent, CalendarEventKind, CalendarViewMode } from "@/lib/sales/calendar/types";
import { SUPPORTED_EVENT_KINDS } from "@/lib/sales/calendar/types";
import {
  eventsForDateKey,
  filterEventsByKinds,
  formatCalendarMonth,
  toDateKey,
} from "@/lib/sales/calendar/format";
import type { PriorityLead } from "@/lib/sales-priority-lead";
import { MiniCalendar } from "./MiniCalendar";
import { EventTypeFilters } from "./EventTypeFilters";
import { AvailabilityCard } from "./AvailabilityCard";
import { MonthCalendar } from "./MonthCalendar";
import { WeekCalendar } from "./WeekCalendar";
import { AgendaView } from "./AgendaView";
import { TodayAgenda } from "./TodayAgenda";
import { UpcomingReminders } from "./UpcomingReminders";
import { SelectedEventCard } from "./SelectedEventCard";
import { AddEventSheet } from "./AddEventSheet";
import { EditEventSheet } from "./EditEventSheet";
import { QuickLogSheet } from "@/components/sales/QuickLogSheet";
import { SegmentedControl } from "@/components/sales/ui";
import { useRouter } from "next/navigation";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";

const DEFAULT_ENABLED = new Set<CalendarEventKind>(SUPPORTED_EVENT_KINDS);

export function SalesCalendarPage({
  initialEvents,
  scheduleableLeads,
}: {
  initialEvents: CalendarEvent[];
  scheduleableLeads: PriorityLead[];
}) {
  const router = useRouter();
  const [events, setEvents] = useState(initialEvents);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [enabledKinds, setEnabledKinds] = useState(() => new Set(DEFAULT_ENABLED));
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [logLeadId, setLogLeadId] = useState<string | null>(null);
  const [dayPopoverKey, setDayPopoverKey] = useState<string | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const isMdUp = useMediaQuery("(min-width: 768px)");

  useEffect(() => {
    if (!isMdUp && viewMode !== "agenda") {
      setViewMode("agenda");
    }
  }, [isMdUp, viewMode]);

  const filtered = useMemo(
    () => filterEventsByKinds(events, enabledKinds),
    [events, enabledKinds]
  );

  const selectedEvent = useMemo(
    () =>
      filtered.find((e) => e.id === selectedEventId) ??
      events.find((e) => e.id === selectedEventId) ??
      null,
    [filtered, events, selectedEventId]
  );

  const selectedDayEvents = useMemo(
    () => eventsForDateKey(filtered, selectedDateKey),
    [filtered, selectedDateKey]
  );

  const overdueCount = useMemo(
    () => filtered.filter((e) => e.overdue).length,
    [filtered]
  );

  function goToday() {
    const today = new Date();
    setViewMonth(startOfMonth(today));
    setSelectedDateKey(toDateKey(today));
    setDayPopoverKey(null);
  }

  function selectDate(dateKey: string) {
    setSelectedDateKey(dateKey);
    setDayPopoverKey(null);
    try {
      const d = parseISO(`${dateKey}T12:00:00`);
      if (!Number.isNaN(d.getTime())) setViewMonth(startOfMonth(d));
    } catch {
      /* ignore */
    }
  }

  function selectEvent(event: CalendarEvent) {
    setSelectedEventId(event.id);
    setSelectedDateKey(toDateKey(parseISO(event.startAt)));
  }

  function toggleKind(kind: CalendarEventKind) {
    if (!SUPPORTED_EVENT_KINDS.includes(kind)) return;
    setEnabledKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  function navigatePeriod(dir: -1 | 1) {
    if (viewMode === "week") {
      const anchor = parseISO(`${selectedDateKey}T12:00:00`);
      const next = dir === 1 ? addWeeks(anchor, 1) : subWeeks(anchor, 1);
      setSelectedDateKey(toDateKey(next));
      setViewMonth(startOfMonth(next));
      return;
    }
    setViewMonth((m) => (dir === 1 ? addMonths(m, 1) : subMonths(m, 1)));
  }

  function onEventUpdated(updated: CalendarEvent) {
    setEvents((prev) =>
      prev
        .map((e) => (e.id === updated.id ? updated : e))
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    );
    setSelectedEventId(updated.id);
    setSelectedDateKey(toDateKey(parseISO(updated.startAt)));
    router.refresh();
  }

  function onEventCreated(created: CalendarEvent) {
    setEvents((prev) => {
      const without = prev.filter((e) => e.leadId !== created.leadId);
      return [...without, created].sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
      );
    });
    setSelectedEventId(created.id);
    setSelectedDateKey(toDateKey(parseISO(created.startAt)));
    setAddOpen(false);
    router.refresh();
  }

  const views: { id: CalendarViewMode; label: string }[] = isMdUp
    ? [
        { id: "month", label: "Month" },
        { id: "week", label: "Week" },
        { id: "agenda", label: "Agenda" },
      ]
    : [{ id: "agenda", label: "Agenda" }];

  const utilityPanels = (
    <>
      <MiniCalendar
        month={viewMonth}
        selectedDateKey={selectedDateKey}
        events={filtered}
        onMonthChange={setViewMonth}
        onSelectDate={selectDate}
        onToday={goToday}
      />
      <EventTypeFilters enabled={enabledKinds} onToggle={toggleKind} />
      <AvailabilityCard />
    </>
  );

  return (
    <div className="calendar-premium space-y-3">
      {overdueCount > 0 ? (
        <div className="flex min-h-[48px] items-center gap-3 rounded-[12px] border border-[#FECACA] bg-[#FFF8F7] px-3.5 py-2.5">
          <AlarmClock size={16} strokeWidth={1.8} className="shrink-0 text-[#B42318]" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-[#101828]">
              {overdueCount} overdue follow-up{overdueCount === 1 ? "" : "s"}
            </p>
            <p className="text-[12px] text-[#667085]">
              Some scheduled follow-ups need attention.
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 text-[13px] font-semibold text-[#B42318] underline-offset-2 hover:underline"
            onClick={() => {
              setViewMode("agenda");
              goToday();
            }}
          >
            Review →
          </button>
        </div>
      ) : null}

      {/* Full-width toolbar so side panels align with the calendar grid, not the controls */}
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className="sd-icon-btn"
            aria-label={viewMode === "week" ? "Previous week" : "Previous month"}
            onClick={() => navigatePeriod(-1)}
          >
            <ChevronLeft size={18} strokeWidth={1.8} />
          </button>
          <div className="inline-flex h-10 min-w-[148px] items-center gap-2 rounded-[9px] border border-[#E4E7EC] bg-white px-3">
            <CalendarDays size={16} strokeWidth={1.8} className="text-[#667085]" aria-hidden />
            <span className="text-[14px] font-semibold text-[#101828]">
              {formatCalendarMonth(viewMonth)}
            </span>
          </div>
          <button
            type="button"
            className="sd-icon-btn"
            aria-label={viewMode === "week" ? "Next week" : "Next month"}
            onClick={() => navigatePeriod(1)}
          >
            <ChevronRight size={18} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="inline-flex h-10 w-[72px] items-center justify-center rounded-[9px] border border-[#E4E7EC] bg-white text-[12px] font-semibold text-[#101828] transition-colors hover:bg-[#F9FAFB]"
            aria-label="Go to today"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setOptionsOpen(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-[9px] border border-[#E4E7EC] bg-white px-3 text-[12px] font-semibold text-[#101828] transition-colors hover:bg-[#F9FAFB] 2xl:hidden"
            aria-label="Calendar options"
          >
            <SlidersHorizontal size={14} strokeWidth={1.8} aria-hidden />
            Options
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {isMdUp ? (
            <SegmentedControl
              aria-label="Calendar view"
              value={viewMode}
              onChange={setViewMode}
              options={views.map((v) => ({ value: v.id, label: v.label }))}
            />
          ) : null}
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-[9px] bg-[#D4FF4F] px-3.5 text-[13px] font-semibold text-[#101828] transition-colors hover:bg-[#c8f244]"
            aria-label="Add event"
          >
            <Plus size={16} strokeWidth={1.8} aria-hidden />
            Add event
          </button>
        </div>
      </div>

      <div className="calendar-premium-layout">
        <aside className="calendar-premium-left">{utilityPanels}</aside>

        <section className="calendar-premium-center flex flex-col gap-3">
          <div className="max-lg:block lg:hidden">
            <MiniCalendar
              month={viewMonth}
              selectedDateKey={selectedDateKey}
              events={filtered}
              onMonthChange={setViewMonth}
              onSelectDate={selectDate}
              onToday={goToday}
              compact
            />
          </div>

          <div className="hidden min-w-0 md:block">
            {viewMode === "month" ? (
              <MonthCalendar
                month={viewMonth}
                selectedDateKey={selectedDateKey}
                events={filtered}
                selectedEventId={selectedEventId}
                dayPopoverKey={dayPopoverKey}
                onSelectDate={selectDate}
                onSelectEvent={selectEvent}
                onOpenMore={setDayPopoverKey}
                onCloseMore={() => setDayPopoverKey(null)}
              />
            ) : null}
            {viewMode === "week" ? (
              <WeekCalendar
                anchor={parseISO(`${selectedDateKey}T12:00:00`)}
                events={filtered}
                selectedEventId={selectedEventId}
                onSelectEvent={selectEvent}
                onSelectDate={selectDate}
              />
            ) : null}
            {viewMode === "agenda" ? (
              <AgendaView
                events={filtered}
                selectedEventId={selectedEventId}
                onSelectEvent={selectEvent}
                onAddEvent={() => setAddOpen(true)}
              />
            ) : null}
          </div>

          <div className="md:hidden space-y-3">
            <TodayAgenda
              dateKey={selectedDateKey}
              events={selectedDayEvents}
              selectedEventId={selectedEventId}
              onSelectEvent={selectEvent}
              onAddEvent={() => setAddOpen(true)}
            />
            <UpcomingReminders events={filtered} />
            <SelectedEventCard
              event={selectedEvent}
              onEdit={() => setEditOpen(true)}
              onLogNote={() => selectedEvent && setLogLeadId(selectedEvent.leadId)}
              onReschedule={() => setEditOpen(true)}
            />
          </div>
        </section>

        <aside className="calendar-premium-right">
          <TodayAgenda
            dateKey={selectedDateKey}
            events={selectedDayEvents}
            selectedEventId={selectedEventId}
            onSelectEvent={selectEvent}
            onAddEvent={() => setAddOpen(true)}
          />
          <UpcomingReminders events={filtered} />
          <SelectedEventCard
            event={selectedEvent}
            onEdit={() => setEditOpen(true)}
            onLogNote={() => selectedEvent && setLogLeadId(selectedEvent.leadId)}
            onReschedule={() => setEditOpen(true)}
          />
        </aside>
      </div>

      {optionsOpen ? (
        <div className="2xl:hidden">
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/30"
            aria-label="Close calendar options"
            onClick={() => setOptionsOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-[min(92vw,300px)] overflow-y-auto border-r border-[#E4E7EC] bg-[#F7F8FA] p-3 shadow-[0_8px_32px_rgba(16,24,40,0.12)] layout:left-[232px]">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[14px] font-semibold text-[#101828]">Calendar options</p>
              <button
                type="button"
                className="sd-icon-btn"
                aria-label="Close"
                onClick={() => setOptionsOpen(false)}
              >
                <X size={18} strokeWidth={1.8} />
              </button>
            </div>
            <div className="space-y-2.5">{utilityPanels}</div>
          </div>
        </div>
      ) : null}

      {addOpen ? (
        <AddEventSheet
          leads={scheduleableLeads}
          defaultDateKey={selectedDateKey}
          onClose={() => setAddOpen(false)}
          onCreated={onEventCreated}
        />
      ) : null}

      {editOpen && selectedEvent ? (
        <EditEventSheet
          event={selectedEvent}
          onClose={() => setEditOpen(false)}
          onUpdated={(e) => {
            onEventUpdated(e);
            setEditOpen(false);
          }}
        />
      ) : null}

      {logLeadId ? (
        <QuickLogSheet
          leads={scheduleableLeads}
          preselectedLeadId={logLeadId}
          onClose={() => setLogLeadId(null)}
          onSuccess={() => {
            setLogLeadId(null);
            router.refresh();
          }}
        />
      ) : null}

      <p className="sr-only">
        Viewing {format(viewMonth, "MMMM yyyy")}, selected {selectedDateKey}, {filtered.length}{" "}
        events.
      </p>
    </div>
  );
}
