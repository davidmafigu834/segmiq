"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import type { CalendarDealOption, CalendarEvent, CalendarEventKind, CalendarViewMode } from "@/lib/sales/calendar/types";
import { SUPPORTED_EVENT_KINDS } from "@/lib/sales/calendar/types";
import {
  eventDateKey,
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
import {
  calendarViewingBounds,
  replaceViewingEvents,
  salesCalendarViewingWindow,
  shouldApplyViewingLoad,
  viewingWindowCovers,
} from "@/lib/real-estate/viewing-calendar";
import { RealEstateCalendar } from "@/components/real-estate/calendar/RealEstateCalendar";
import { salesAppointments } from "@/components/real-estate/calendar/appointments";
import { calendarDateKey } from "@/lib/sales/company-calendar/format";

const DEFAULT_ENABLED = new Set<CalendarEventKind>(SUPPORTED_EVENT_KINDS);

export function SalesCalendarPage({
  initialEvents,
  scheduleableLeads,
  scheduleableDeals = [],
  presetDealId = null,
  presetLeadId = null,
  includeViewings = false,
  viewingsPartial: viewingsPartialInitial = false,
  clientId = null,
  timezone = "UTC",
  viewingWindow = null,
}: {
  initialEvents: CalendarEvent[];
  scheduleableLeads: PriorityLead[];
  scheduleableDeals?: CalendarDealOption[];
  presetDealId?: string | null;
  presetLeadId?: string | null;
  includeViewings?: boolean;
  viewingsPartial?: boolean;
  clientId?: string | null;
  timezone?: string;
  viewingWindow?: { startKey: string; endKeyExclusive: string } | null;
}) {
  const router = useRouter();
  const [events, setEvents] = useState(initialEvents);
  const [viewingsPartial, setViewingsPartial] = useState(viewingsPartialInitial);
  const [loadedWindow, setLoadedWindow] = useState(viewingWindow);
  const viewingRequest = useRef(0);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [enabledKinds, setEnabledKinds] = useState(() => {
    const next = new Set(DEFAULT_ENABLED);
    if (includeViewings) next.add("VIEWING");
    return next;
  });
  const [addOpen, setAddOpen] = useState(() => Boolean(presetDealId || presetLeadId));
  const [editOpen, setEditOpen] = useState(false);
  const [logLeadId, setLogLeadId] = useState<string | null>(null);
  const [dayPopoverKey, setDayPopoverKey] = useState<string | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const isMdUp = useMediaQuery("(min-width: 768px)");

  // Mobile uses TodayAgenda (not Month/Week). Do not force `viewMode` to agenda —
  // that effect raced hydration (useMediaQuery starts false) and replaced Month with Agenda on desktop.

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

  function neededViewingWindow() {
    return salesCalendarViewingWindow(viewMonth);
  }

  async function loadViewingWindow(window: { startKey: string; endKeyExclusive: string }) {
    if (!includeViewings || !clientId) return;
    const bounds = calendarViewingBounds(window.startKey, window.endKeyExclusive, timezone);
    if (!bounds) return;
    const requestId = ++viewingRequest.current;
    try {
      const params = new URLSearchParams({
        from: bounds.fromIso,
        to: bounds.toIsoExclusive,
        surface: "sales",
        timezone,
      });
      const response = await fetch(`/api/clients/${clientId}/calendar/viewings?${params}`);
      const json = (await response.json().catch(() => ({}))) as {
        failed?: boolean;
        incomplete?: boolean;
        events?: CalendarEvent[];
      };
      if (!shouldApplyViewingLoad(requestId, viewingRequest.current)) return;
      if (!response.ok || json.failed) {
        setViewingsPartial(true);
        return;
      }
      setEvents((current) =>
        replaceViewingEvents(current, { ok: true, events: json.events ?? [], incomplete: json.incomplete }).events
      );
      setViewingsPartial(Boolean(json.incomplete));
      setLoadedWindow(window);
    } catch {
      if (!shouldApplyViewingLoad(requestId, viewingRequest.current)) return;
      setViewingsPartial(true);
    }
  }

  useEffect(() => {
    if (!includeViewings) return;
    const key = calendarDateKey(new Date(), timezone);
    const next = parseISO(`${key}T12:00:00`);
    if (!Number.isNaN(next.getTime())) setViewMonth(startOfMonth(next));
    setSelectedDateKey(key);
  }, [includeViewings, timezone]);

  useEffect(() => {
    if (!includeViewings || !clientId) return;
    const needed = neededViewingWindow();
    if (loadedWindow && viewingWindowCovers(loadedWindow, needed)) return;
    void loadViewingWindow(needed);
    // The window is derived from the visible month. Lead and deal events stay in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeViewings, clientId, timezone, viewMonth, loadedWindow]);

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
    setSelectedDateKey(eventDateKey(event));
  }

  function toggleKind(kind: CalendarEventKind) {
    if (!SUPPORTED_EVENT_KINDS.includes(kind) && !(includeViewings && kind === "VIEWING")) return;
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
      const without = prev.filter((event) => {
        if (created.dealId) {
          return event.dealId !== created.dealId && event.leadId !== created.leadId;
        }
        return event.dealId || event.leadId !== created.leadId;
      });
      return [...without, created].sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
      );
    });
    setSelectedEventId(created.id);
    setSelectedDateKey(toDateKey(parseISO(created.startAt)));
    setAddOpen(false);
    if (presetDealId || presetLeadId) router.replace("/sales/calendar");
    router.refresh();
  }

  function closeAdd() {
    setAddOpen(false);
    if (presetDealId || presetLeadId) router.replace("/sales/calendar");
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
      <EventTypeFilters enabled={enabledKinds} onToggle={toggleKind} extraKinds={includeViewings ? ["VIEWING"] : []} />
      <AvailabilityCard />
    </>
  );

  if (includeViewings) {
    const todayKey = calendarDateKey(new Date(), timezone);
    return (
      <div className="space-y-5">
        {viewingsPartial ? (
          <div className="flex min-h-[48px] items-center justify-between gap-3 rounded-[12px] border border-sales-warning/30 bg-sales-warning-soft px-3.5 py-2.5 text-sales-warning-fg">
            <p className="text-[13px] text-sales-warning-fg">
              Viewings could not all be loaded. Follow-ups and other events are still shown.
            </p>
            <button
              type="button"
              className="shrink-0 text-[13px] font-semibold underline-offset-2 hover:underline"
              onClick={() => void loadViewingWindow(neededViewingWindow())}
            >
              Retry
            </button>
          </div>
        ) : null}
        <RealEstateCalendar
          items={salesAppointments(events, timezone)}
          todayKey={todayKey}
          bookHref="/sales/listings/viewing"
          onSelectDate={(key) => {
            setSelectedDateKey(key);
            const next = parseISO(`${key}T12:00:00`);
            if (!Number.isNaN(next.getTime())) setViewMonth(startOfMonth(next));
          }}
        />
        {addOpen ? (
          <AddEventSheet
            leads={scheduleableLeads}
            deals={scheduleableDeals}
            initialDealId={presetDealId}
            initialLeadId={presetLeadId}
            defaultDateKey={selectedDateKey}
            onClose={closeAdd}
            onCreated={onEventCreated}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="calendar-premium space-y-3">
      {viewingsPartial ? (
        <div className="flex min-h-[48px] items-center justify-between gap-3 rounded-[12px] border border-sales-warning/30 bg-sales-warning-soft px-3.5 py-2.5 text-sales-warning-fg">
          <p className="text-[13px] text-sales-warning-fg">
            Viewings could not all be loaded. Follow-ups and other events are still shown.
          </p>
          <button
            type="button"
            className="shrink-0 text-[13px] font-semibold underline-offset-2 hover:underline"
            onClick={() => void loadViewingWindow(neededViewingWindow())}
          >
            Retry
          </button>
        </div>
      ) : null}
      {overdueCount > 0 ? (
        <div className="flex min-h-[48px] items-center gap-3 rounded-[12px] border border-sales-danger/25 bg-sales-danger-soft px-3.5 py-2.5">
          <AlarmClock size={16} strokeWidth={1.8} className="shrink-0 text-sales-danger" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-sales-text-primary">
              {overdueCount} overdue follow-up{overdueCount === 1 ? "" : "s"}
            </p>
            <p className="text-[12px] text-sales-text-secondary">
              Some scheduled follow-ups need attention.
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 text-[13px] font-semibold text-sales-danger underline-offset-2 hover:underline"
            onClick={() => {
              if (isMdUp) setViewMode("agenda");
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
          <div className="inline-flex h-10 min-w-[148px] items-center gap-2 rounded-[9px] border border-sales-border bg-sales-surface px-3">
            <CalendarDays size={16} strokeWidth={1.8} className="text-sales-text-secondary" aria-hidden />
            <span className="text-[14px] font-semibold text-sales-text-primary">
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
            className="inline-flex h-10 w-[72px] items-center justify-center rounded-[9px] border border-sales-border bg-sales-surface text-[12px] font-semibold text-sales-text-primary transition-colors hover:bg-sales-surface-hover"
            aria-label="Go to today"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setOptionsOpen(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-[9px] border border-sales-border bg-sales-surface px-3 text-[12px] font-semibold text-sales-text-primary transition-colors hover:bg-sales-surface-hover 2xl:hidden"
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
            className="inline-flex h-10 items-center gap-1.5 rounded-[9px] bg-sales-brand px-3.5 text-[13px] font-semibold text-sales-brand-text transition-colors hover:bg-sales-brand-hover"
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
          <div className="fixed inset-y-0 left-0 z-50 w-[min(92vw,300px)] overflow-y-auto border-r border-sales-border bg-sales-bg p-3 shadow-[0_8px_32px_rgba(16,24,40,0.12)] layout:left-[232px]">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[14px] font-semibold text-sales-text-primary">Calendar options</p>
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
          deals={scheduleableDeals}
          initialDealId={presetDealId}
          initialLeadId={presetLeadId}
          defaultDateKey={selectedDateKey}
          onClose={closeAdd}
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
