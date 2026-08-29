"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  addDays,
  addMonths,
  addWeeks,
  format,
  parseISO,
  startOfMonth,
} from "date-fns";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { CompanyWorkspaceShell } from "../CompanyWorkspaceShell";
import { CompanyDashboardHeader } from "../CompanyDashboardHeader";
import { Button, useSalesToast } from "@/components/sales/ui";
import { AddEventSheet } from "@/components/sales/calendar/AddEventSheet";
import { EditEventSheet } from "@/components/sales/calendar/EditEventSheet";
import type { CalendarEvent, CalendarEventKind } from "@/lib/sales/calendar/types";
import {
  COMPANY_CALENDAR_KIND_META,
  calendarDateKey,
  companyCalendarRangeKeys,
  matchesCompanyCalendarFilters,
} from "@/lib/sales/company-calendar/format";
import {
  COMPANY_CALENDAR_EVENT_KINDS,
  DEFAULT_COMPANY_CALENDAR_FILTERS,
  type CompanyCalendarEvent,
  type CompanyCalendarEventKind,
  type CompanyCalendarFilters,
  type CompanyCalendarPageData,
  type CompanyCalendarView,
} from "@/lib/sales/company-calendar/types";
import type { UserRole } from "@/types";
import { cn } from "@/lib/ui/cn";
import {
  CompanyAgendaView,
  CompanyMonthView,
} from "./CompanyCalendarViews";
import {
  CompanyTeamDayView,
  CompanyTeamWeekView,
  MobileTeamCalendarAgenda,
} from "./CompanyTeamCalendarViews";
import { CompanyCalendarAgendaRail } from "./CompanyCalendarAgendaRail";
import { CompanyCalendarEventIcon } from "./CompanyCalendarEventIcon";
import {
  CompanyCalendarSummary,
  type CompanyCalendarSummaryAction,
} from "./CompanyCalendarSummary";

const VIEWS: Array<{ id: CompanyCalendarView; label: string }> = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "agenda", label: "Agenda" },
];

function parseView(value: string | null | undefined): CompanyCalendarView | null {
  return value === "day" || value === "week" || value === "month" || value === "agenda"
    ? value
    : null;
}

function legacyKind(kind: CompanyCalendarEventKind): CalendarEventKind {
  if (kind === "call") return "CALL";
  if (kind === "quote_review") return "QUOTE_REVIEW";
  return "FOLLOW_UP";
}

function companyKind(kind: CalendarEventKind): CompanyCalendarEventKind {
  if (kind === "CALL") return "call";
  if (kind === "QUOTE_REVIEW") return "quote_review";
  return "follow_up";
}

function toLegacyEvent(event: CompanyCalendarEvent): CalendarEvent {
  return {
    id: event.id,
    kind: legacyKind(event.kind),
    title: event.title,
    startAt: event.startAt,
    endAt: event.endAt,
    leadId: event.leadId!,
    customerName: event.relatedLabel,
    phone: event.phone,
    location: event.location,
    pipelineStage: event.sourceStatus,
    status: event.sourceStatus,
    source: null,
    notes: event.description,
    quoteNumber: null,
    quoteStatus: null,
    quoteTotal: null,
    projectType: event.description,
    leadScore: null,
    overdue: event.status === "overdue",
    hasTimedCallback: !event.allDay,
  };
}

function FiltersPopover({
  filters,
  owners,
  onChange,
  onClose,
}: {
  filters: CompanyCalendarFilters;
  owners: CompanyCalendarPageData["owners"];
  onChange: (filters: CompanyCalendarFilters) => void;
  onClose: () => void;
}) {
  function toggleKind(kind: CompanyCalendarEventKind) {
    const kinds = filters.kinds.includes(kind)
      ? filters.kinds.filter((value) => value !== kind)
      : [...filters.kinds, kind];
    onChange({ ...filters, kinds });
  }
  return (
    <>
      <button type="button" className="fixed inset-0 z-20 cursor-default" aria-label="Close filters" onClick={onClose} />
      <div className="absolute right-0 top-11 z-30 w-[290px] rounded-[12px] border border-sales-border bg-sales-surface p-3.5 shadow-sales-popover">
        <div className="flex items-center justify-between"><h3 className="text-[13px] font-semibold text-sales-text-primary">Calendar filters</h3><button type="button" className="sd-icon-btn !h-7 !w-7" onClick={onClose} aria-label="Close"><X size={14} /></button></div>
        <label className="mt-3 block text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted" htmlFor="company-calendar-owner">Owner</label>
        <select id="company-calendar-owner" value={filters.ownerId} onChange={(event) => onChange({ ...filters, ownerId: event.target.value })} className="mt-1.5 h-10 w-full rounded-[9px] border border-sales-border bg-sales-surface px-2.5 text-[13px] text-sales-text-primary outline-none focus:border-sales-brand">
          <option value="all">All permitted salespeople</option>
          {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
        </select>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">Activity type</p>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {COMPANY_CALENDAR_EVENT_KINDS.map((kind) => {
            const active = filters.kinds.includes(kind);
            return <button key={kind} type="button" onClick={() => toggleKind(kind)} className={cn("flex min-h-9 items-center gap-2 rounded-[8px] border px-2.5 text-left text-[11px] font-medium", active ? "border-sales-brand-border bg-sales-brand-soft text-sales-text-primary" : "border-sales-border text-sales-text-secondary")}><span className={cn("flex h-4 w-4 items-center justify-center rounded-[4px] border", active ? "border-sales-brand bg-sales-brand text-sales-brand-text" : "border-sales-border")}>{active ? <Check size={10} /> : null}</span>{COMPANY_CALENDAR_KIND_META[kind].shortLabel}</button>;
          })}
        </div>
        <label className="mt-3 block text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted" htmlFor="company-calendar-status">Status</label>
        <select id="company-calendar-status" value={filters.status} onChange={(event) => onChange({ ...filters, status: event.target.value as CompanyCalendarFilters["status"], includeCompleted: true })} className="mt-1.5 h-10 w-full rounded-[9px] border border-sales-border bg-sales-surface px-2.5 text-[13px] text-sales-text-primary outline-none focus:border-sales-brand">
          <option value="all">All statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="overdue">Overdue</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="at_risk">At risk / attention</option>
        </select>
        <label className="mt-3 block text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted" htmlFor="company-calendar-relation">Related record</label>
        <select id="company-calendar-relation" value={filters.relationType} onChange={(event) => onChange({ ...filters, relationType: event.target.value as CompanyCalendarFilters["relationType"] })} className="mt-1.5 h-10 w-full rounded-[9px] border border-sales-border bg-sales-surface px-2.5 text-[13px] text-sales-text-primary outline-none focus:border-sales-brand">
          <option value="all">Leads, Deals and Customers</option>
          <option value="lead">Lead-related</option>
          <option value="deal">Deal-related</option>
          <option value="customer">Customer-related</option>
        </select>
        <div className="mt-3 flex justify-end border-t border-sales-border-subtle pt-3"><button type="button" onClick={() => onChange(DEFAULT_COMPANY_CALENDAR_FILTERS)} className="text-[11px] font-semibold text-sales-text-secondary hover:text-sales-text-primary">Reset filters</button></div>
      </div>
    </>
  );
}

export function CompanyCalendarPage({
  data,
  initialDateKey,
  initialView,
  initialEventId,
  initialOwnerId,
  canCreateActivities,
  unreadNotifications,
  notificationRole,
  userName,
  avatarUrl,
  companyLogoUrl,
  whatsappBadge = 0,
}: {
  data: CompanyCalendarPageData;
  initialDateKey: string;
  initialView?: string;
  initialEventId: string | null;
  initialOwnerId: string;
  canCreateActivities: boolean;
  unreadNotifications: number;
  notificationRole: UserRole;
  userName: string;
  avatarUrl?: string | null;
  companyLogoUrl?: string | null;
  whatsappBadge?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useSalesToast();
  const [isNavigating, startTransition] = useTransition();
  const [events, setEvents] = useState(data.events);
  const [selectedDateKey, setSelectedDateKey] = useState(initialDateKey);
  const [view, setView] = useState<CompanyCalendarView>(() => parseView(initialView) ?? "week");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(initialEventId);
  const [miniMonth, setMiniMonth] = useState(() => startOfMonth(parseISO(`${initialDateKey}T12:00:00`)));
  const [filters, setFilters] = useState<CompanyCalendarFilters>(() => ({
    ...DEFAULT_COMPANY_CALENDAR_FILTERS,
    ownerId: data.owners.some((owner) => owner.id === initialOwnerId) ? initialOwnerId : "all",
  }));
  const [summaryAction, setSummaryAction] = useState<CompanyCalendarSummaryAction | null>(null);
  const [showWeekends, setShowWeekends] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addDefaultOwnerId, setAddDefaultOwnerId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => setEvents(data.events), [data.events]);
  useEffect(() => {
    setSelectedDateKey(initialDateKey);
    setMiniMonth(startOfMonth(parseISO(`${initialDateKey}T12:00:00`)));
  }, [initialDateKey]);
  useEffect(() => {
    const next = parseView(initialView);
    if (next) setView(next);
  }, [initialView]);
  useEffect(() => {
    const eventId = searchParams.get("event");
    setSelectedEventId(eventId);
  }, [searchParams]);
  useEffect(() => {
    const ownerId = data.owners.some((owner) => owner.id === initialOwnerId)
      ? initialOwnerId
      : "all";
    setFilters((current) => ({ ...current, ownerId }));
  }, [data.owners, initialOwnerId]);
  useEffect(() => {
    if (parseView(initialView)) return;
    const stored = parseView(window.localStorage.getItem("segmiq-company-calendar-view"));
    if (stored) setView(stored);
    const weekends = window.localStorage.getItem("segmiq-company-calendar-weekends");
    if (weekends != null) setShowWeekends(weekends !== "false");
  }, [initialView]);

  const todayKey = calendarDateKey(new Date(), data.timezone);
  const upcomingEndKey = format(addDays(parseISO(`${todayKey}T12:00:00`), 7), "yyyy-MM-dd");
  const filteredEvents = useMemo(() => {
    const base = events.filter((event) => matchesCompanyCalendarFilters(event, filters));
    if (!summaryAction || summaryAction === "today") return base;
    return base.filter((event) => {
      const eventKey = calendarDateKey(event.startAt, data.timezone);
      if (summaryAction === "upcoming") {
        return event.status === "scheduled" && eventKey >= todayKey && eventKey < upcomingEndKey;
      }
      if (summaryAction === "overdue") {
        return event.sourceType === "lead_follow_up" && event.status === "overdue";
      }
      if (summaryAction === "completed") return event.status === "completed";
      return Boolean(event.attentionReason) && event.status !== "completed" && event.status !== "cancelled";
    });
  }, [data.timezone, events, filters, summaryAction, todayKey, upcomingEndKey]);
  useEffect(() => {
    if (
      selectedEventId &&
      !filteredEvents.some((event) => event.id === selectedEventId)
    ) {
      setSelectedEventId(null);
    }
  }, [filteredEvents, selectedEventId]);
  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId]
  );
  const selectedDayEvents = useMemo(
    () => filteredEvents.filter((event) => calendarDateKey(event.startAt, data.timezone) === selectedDateKey),
    [filteredEvents, selectedDateKey, data.timezone]
  );
  const upcomingEvents = useMemo(() => {
    const baseline = selectedDateKey > todayKey ? selectedDateKey : todayKey;
    return filteredEvents
      .filter((event) => event.status !== "completed" && event.status !== "cancelled")
      .filter((event) => calendarDateKey(event.startAt, data.timezone) > baseline)
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
  }, [filteredEvents, selectedDateKey, data.timezone, todayKey]);
  const range = companyCalendarRangeKeys(selectedDateKey, view);
  const agendaEvents = summaryAction
    ? filteredEvents
    : filteredEvents.filter((event) => {
        const eventKey = calendarDateKey(event.startAt, data.timezone);
        return eventKey >= range.startKey && eventKey < range.endKey;
      });
  const visibleOwners = filters.ownerId === "all"
    ? data.owners
    : data.owners.filter((owner) => owner.id === filters.ownerId);
  const metrics = filters.ownerId === "all"
    ? data.summary.all
    : data.summary.byOwner[filters.ownerId] ?? {
        upcomingActivities: 0,
        overdueFollowUps: 0,
        todayActivities: 0,
        completedWeek: 0,
        atRiskActivities: 0,
        responseTimeMinutes: null,
        responseTimeMinutesPrevious: null,
      };
  const metricScopeLabel = filters.ownerId === "all"
    ? "All team"
    : data.owners.find((owner) => owner.id === filters.ownerId)?.name ?? "Selected owner";
  const activeFilterCount =
    (filters.ownerId !== "all" ? 1 : 0) +
    (filters.kinds.length !== COMPANY_CALENDAR_EVENT_KINDS.length ? 1 : 0) +
    (filters.status !== "all" ? 1 : 0) +
    (filters.relationType !== "all" ? 1 : 0) +
    (summaryAction ? 1 : 0);

  function updateUrl(opts: { date?: string; view?: CompanyCalendarView; event?: string | null; owner?: string; push?: boolean }) {
    const params = new URLSearchParams(searchParams.toString());
    if (opts.date) params.set("date", opts.date);
    if (opts.view) params.set("view", opts.view);
    if (opts.event === null) params.delete("event");
    else if (opts.event) params.set("event", opts.event);
    if (opts.owner === "all") params.delete("owner");
    else if (opts.owner) params.set("owner", opts.owner);
    if (notificationRole === "SUPER_ADMIN") params.set("clientId", data.clientId);
    const href = `${pathname}?${params.toString()}`;
    startTransition(() => {
      if (opts.push) router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    });
  }

  function selectDate(key: string) {
    setSelectedDateKey(key);
    setMiniMonth(startOfMonth(parseISO(`${key}T12:00:00`)));
    setSelectedEventId(null);
    updateUrl({ date: key, event: null });
  }

  function selectEvent(event: CompanyCalendarEvent) {
    const key = calendarDateKey(event.startAt, data.timezone);
    setSelectedDateKey(key);
    setSelectedEventId(event.id);
    setAgendaOpen(true);
    updateUrl({ date: key, event: event.id, push: true });
  }

  function closeEvent() {
    setSelectedEventId(null);
    setEditOpen(false);
    updateUrl({ event: null });
  }

  function changeView(next: CompanyCalendarView) {
    setView(next);
    window.localStorage.setItem("segmiq-company-calendar-view", next);
    updateUrl({ view: next });
  }

  function navigate(direction: -1 | 1) {
    const anchor = parseISO(`${selectedDateKey}T12:00:00`);
    const next =
      view === "day"
        ? addDays(anchor, direction)
        : view === "week"
          ? addWeeks(anchor, direction)
          : addMonths(anchor, direction);
    selectDate(format(next, "yyyy-MM-dd"));
  }

  function goToday() {
    selectDate(calendarDateKey(new Date(), data.timezone));
  }

  function changeOwner(ownerId: string) {
    setFilters((current) => ({ ...current, ownerId }));
    updateUrl({ owner: ownerId });
  }

  function handleSummaryAction(action: CompanyCalendarSummaryAction) {
    const next = summaryAction === action ? null : action;
    setSummaryAction(next);
    setFilters((current) => ({
      ...current,
      kinds: [...COMPANY_CALENDAR_EVENT_KINDS],
      status: "all",
      relationType: "all",
      includeCompleted: true,
    }));
    if (next === "today") {
      goToday();
      changeView("day");
    }
    if (next === "upcoming" || next === "overdue" || next === "at_risk") changeView("agenda");
    if (next === "completed") {
      goToday();
      changeView("week");
    }
  }

  function openAdd(ownerId: string | null = null, dateKey?: string) {
    if (!canCreateActivities) {
      toast({ title: "This Calendar is view-only for your account.", tone: "info" });
      return;
    }
    if (dateKey) selectDate(dateKey);
    setAddDefaultOwnerId(ownerId);
    setAddOpen(true);
  }

  function fromLegacy(
    event: CalendarEvent,
    previous?: CompanyCalendarEvent,
    ownerIdOverride?: string | null
  ): CompanyCalendarEvent {
    const lead = data.scheduleableLeads.find((item) => item.id === event.leadId);
    const savedOwner = data.leadOwners[event.leadId];
    const owner = ownerIdOverride !== undefined
      ? data.owners.find((item) => item.id === ownerIdOverride) ?? null
      : savedOwner;
    return {
      id: event.id,
      sourceType: "lead_follow_up",
      sourceId: event.leadId,
      kind: companyKind(event.kind),
      title: event.title,
      startAt: event.startAt,
      endAt: event.endAt ?? null,
      allDay: !event.hasTimedCallback,
      status: event.overdue ? "overdue" : "scheduled",
      sourceStatus: event.status ? String(event.status) : lead?.status ?? previous?.sourceStatus ?? null,
      ownerId: owner?.id ?? previous?.ownerId ?? null,
      ownerName: owner?.name ?? previous?.ownerName ?? null,
      ownerAvatarUrl: owner?.avatarUrl ?? previous?.ownerAvatarUrl ?? null,
      ownerRoleLabel: owner?.roleLabel ?? previous?.ownerRoleLabel ?? null,
      relationType: "lead",
      relatedId: event.leadId,
      relatedLabel: event.customerName || lead?.name || "Lead",
      relatedSecondary: event.pipelineStage,
      relatedHref: `/client/leads?lead=${encodeURIComponent(event.leadId)}`,
      leadId: event.leadId,
      dealId: null,
      customerId: previous?.customerId ?? null,
      phone: event.phone,
      location: event.location,
      description: event.notes || event.projectType,
      attentionReason: null,
      canEdit: true,
      canComplete: true,
    };
  }

  async function updateCompanyActivity(input: {
    leadId: string;
    followUpDate: string | null;
    ownerId?: string | null;
  }) {
    const response = await fetch("/api/client/calendar/activities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: input.leadId,
        followUpDate: input.followUpDate,
        ...(input.ownerId ? { ownerId: input.ownerId } : {}),
      }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) throw new Error(body.error || "Could not update activity");
  }

  async function completeEvent() {
    if (!selectedEvent?.canComplete || !selectedEvent.leadId) return;
    setBusy(true);
    try {
      await updateCompanyActivity({
        leadId: selectedEvent.leadId,
        followUpDate: null,
      });
      setEvents((current) => current.map((event) => event.id === selectedEvent.id ? {
        ...event,
        status: "completed" as const,
        startAt: new Date().toISOString(),
        allDay: false,
        attentionReason: null,
        canEdit: false,
        canComplete: false,
      } : event).sort((a, b) => a.startAt.localeCompare(b.startAt)));
      closeEvent();
      toast({ title: "Activity completed", tone: "success" });
      router.refresh();
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Could not complete activity", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  const agendaRail = (
    <CompanyCalendarAgendaRail
      miniMonth={miniMonth}
      selectedDateKey={selectedDateKey}
      selectedEvent={selectedEvent}
      selectedDayEvents={selectedDayEvents}
      upcomingEvents={upcomingEvents}
      allEvents={filteredEvents}
      timezone={data.timezone}
      canCreate={canCreateActivities}
      busy={busy}
      onMiniMonthChange={setMiniMonth}
      onSelectDate={selectDate}
      onSelectEvent={selectEvent}
      onBack={closeEvent}
      onViewAll={() => changeView("agenda")}
      onAdd={() => openAdd()}
      onEdit={() => setEditOpen(true)}
      onComplete={() => void completeEvent()}
    />
  );

  return (
    <CompanyWorkspaceShell companyName={data.clientName} companyLogoUrl={companyLogoUrl} userName={userName} avatarUrl={avatarUrl} unreadNotifications={unreadNotifications} notificationRole={notificationRole} whatsappBadge={whatsappBadge}>
      <CompanyDashboardHeader unreadNotifications={unreadNotifications} notificationRole={notificationRole} userName={userName} avatarUrl={avatarUrl} canAddLead={false} breadcrumb="Company / Calendar" title="Company Calendar" description="Team activities, follow-ups, meetings and tasks in one place." primaryAction={<Button variant="primary" size="md" disabled={!canCreateActivities} leftIcon={<Plus size={16} />} rightIcon={<ChevronDown size={14} />} onClick={() => openAdd()} data-course-target="calendar-new-activity">New Activity</Button>} />

      <CompanyCalendarSummary metrics={metrics} activeAction={summaryAction} scopeLabel={metricScopeLabel} onAction={handleSummaryAction} />

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]" data-course-target="company-calendar">
        <section className="min-w-0 overflow-hidden workspace-card rounded-[14px] border border-sales-border bg-sales-surface shadow-sales-card">
          <div className="flex flex-col gap-3 border-b border-sales-border-subtle px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between" data-course-target="calendar-view-switcher">
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => navigate(-1)} className="sd-icon-btn" aria-label={`Previous ${view}`}><ChevronLeft size={17} /></button>
              <button type="button" onClick={() => navigate(1)} className="sd-icon-btn" aria-label={`Next ${view}`}><ChevronRight size={17} /></button>
              <button type="button" onClick={goToday} className="inline-flex h-10 items-center rounded-[9px] border border-sales-border bg-sales-surface px-3 text-[12px] font-semibold text-sales-text-primary hover:bg-sales-surface-hover">Today</button>
              <span className={cn("ml-1 text-[13px] font-semibold text-sales-text-primary sm:text-[14px]", isNavigating && "opacity-60")}>{range.label}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex h-10 items-center rounded-[9px] border border-sales-border bg-sales-surface p-0.5">
                {VIEWS.map((item) => <button key={item.id} type="button" onClick={() => changeView(item.id)} aria-pressed={view === item.id} className={cn("h-8 rounded-[7px] px-3 text-[12px] font-medium text-sales-text-secondary transition-colors", view === item.id && "bg-sales-brand text-sales-brand-text shadow-sm")}>{item.label}</button>)}
              </div>
              <div className="relative">
                <button type="button" onClick={() => setFiltersOpen((open) => !open)} className={cn("inline-flex h-10 items-center gap-1.5 rounded-[9px] border px-3 text-[12px] font-semibold", filtersOpen || activeFilterCount ? "border-sales-brand-border bg-sales-brand-soft text-sales-text-primary" : "border-sales-border bg-sales-surface text-sales-text-primary hover:bg-sales-surface-hover")}><SlidersHorizontal size={14} />Filters{activeFilterCount ? <span className="rounded-full bg-sales-brand px-1.5 py-0.5 text-[10px] text-sales-brand-text">{activeFilterCount}</span> : null}</button>
                {filtersOpen ? <FiltersPopover filters={filters} owners={data.owners} onChange={(next) => {
                  if (next.ownerId !== filters.ownerId) updateUrl({ owner: next.ownerId });
                  setSummaryAction(null);
                  setFilters(next);
                }} onClose={() => setFiltersOpen(false)} /> : null}
              </div>
              <button type="button" onClick={() => setAgendaOpen(true)} className="inline-flex h-10 items-center gap-1.5 rounded-[9px] border border-sales-border px-3 text-[12px] font-semibold text-sales-text-primary xl:hidden"><Filter size={14} />Agenda</button>
            </div>
          </div>

          <div className="flex min-h-[48px] flex-wrap items-center justify-between gap-2 border-b border-sales-border-subtle px-3 py-2 sm:px-4" data-course-target="calendar-team-filter">
            <div className="flex items-center gap-2">
              <label htmlFor="company-calendar-team" className="sr-only">Team member</label>
              <select id="company-calendar-team" value={filters.ownerId} onChange={(event) => changeOwner(event.target.value)} className="h-9 min-w-[154px] rounded-[8px] border border-sales-border bg-sales-surface px-2.5 text-[12px] font-medium text-sales-text-primary outline-none focus:border-sales-brand">
                <option value="all">Team (All)</option>
                {data.owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
              </select>
              {filters.ownerId !== "all" ? <span className="hidden text-[11px] text-sales-text-muted sm:inline">Activity KPIs and Calendar are filtered to this salesperson.</span> : null}
            </div>
            {summaryAction ? <button type="button" onClick={() => setSummaryAction(null)} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-sales-brand-border bg-sales-brand-soft px-2.5 text-[11px] font-semibold text-sales-text-primary"><X size={12} />Clear {summaryAction.replace("_", " ")} filter</button> : null}
          </div>

          <div className="md:hidden">
            <MobileTeamCalendarAgenda selectedDateKey={selectedDateKey} owners={visibleOwners} events={filteredEvents} timezone={data.timezone} selectedEventId={selectedEventId} onSelectDate={selectDate} onSelectEvent={selectEvent} />
          </div>
          <div className="hidden md:block">
            {view === "week" ? <CompanyTeamWeekView anchorKey={selectedDateKey} showWeekends={showWeekends} owners={visibleOwners} events={filteredEvents} timezone={data.timezone} selectedDateKey={selectedDateKey} selectedEventId={selectedEventId} canCreate={canCreateActivities} onSelectDate={selectDate} onSelectEvent={selectEvent} onCreate={(ownerId, dateKey) => openAdd(ownerId, dateKey)} onMore={(ownerId, dateKey) => { changeOwner(ownerId ?? "all"); selectDate(dateKey); setAgendaOpen(true); }} /> : null}
            {view === "day" ? <CompanyTeamDayView dateKey={selectedDateKey} owners={visibleOwners} events={filteredEvents} timezone={data.timezone} selectedEventId={selectedEventId} onSelectEvent={selectEvent} /> : null}
            {view === "month" ? <CompanyMonthView anchorKey={selectedDateKey} showWeekends={showWeekends} events={filteredEvents} timezone={data.timezone} selectedDateKey={selectedDateKey} onSelectDate={selectDate} /> : null}
            {view === "agenda" ? <CompanyAgendaView events={agendaEvents} timezone={data.timezone} selectedEventId={selectedEventId} onSelectEvent={selectEvent} onAdd={() => openAdd()} canCreate={canCreateActivities} /> : null}
          </div>

          <div className="hidden min-h-[52px] items-center justify-between gap-3 border-t border-sales-border-subtle px-4 py-2.5 md:flex">
            <div className="flex flex-wrap items-center gap-2" aria-label="Activity Types">
              <span className="mr-1 text-[12px] font-semibold text-sales-text-primary">Activity Types</span>
              {COMPANY_CALENDAR_EVENT_KINDS.map((kind) => {
                const active = filters.kinds.includes(kind);
                return <button key={kind} type="button" onClick={() => { setSummaryAction(null); setFilters((current) => ({ ...current, kinds: active ? current.kinds.filter((value) => value !== kind) : [...current.kinds, kind] })); }} aria-pressed={active} className={cn("inline-flex h-8 items-center gap-1.5 rounded-[7px] border px-2 text-[10px] font-medium transition-opacity", active ? "border-sales-border bg-sales-surface-subtle text-sales-text-secondary" : "border-sales-border opacity-40")}><CompanyCalendarEventIcon kind={kind} size={12} />{COMPANY_CALENDAR_KIND_META[kind].shortLabel}</button>;
              })}
            </div>
            <label className="flex shrink-0 cursor-pointer items-center gap-2 text-[11px] font-medium text-sales-text-secondary"><input type="checkbox" checked={showWeekends} onChange={(event) => { setShowWeekends(event.target.checked); window.localStorage.setItem("segmiq-company-calendar-weekends", String(event.target.checked)); }} className="h-4 w-4 accent-[var(--sales-brand)]" />Show weekends</label>
          </div>
        </section>

        <div className="hidden min-w-0 xl:block">{agendaRail}</div>
      </div>

      {agendaOpen ? <div className="fixed inset-0 z-[70] xl:hidden"><button type="button" className="absolute inset-0 bg-black/35" aria-label="Close agenda" onClick={() => setAgendaOpen(false)} /><div className="absolute inset-y-0 right-0 w-full overflow-y-auto bg-sales-bg p-3 shadow-sales-popover sm:w-[min(92vw,420px)]"><button type="button" className="sd-icon-btn absolute right-5 top-5 z-10" onClick={() => setAgendaOpen(false)} aria-label="Close agenda"><X size={17} /></button>{agendaRail}</div></div> : null}

      {addOpen ? <AddEventSheet
        leads={data.scheduleableLeads}
        ownerOptions={data.owners}
        leadOwnerIds={Object.fromEntries(Object.entries(data.leadOwners).map(([leadId, owner]) => [leadId, owner?.id ?? null]))}
        defaultOwnerId={addDefaultOwnerId ?? (filters.ownerId !== "all" ? filters.ownerId : null)}
        defaultDateKey={selectedDateKey}
        scheduleActivity={({ leadId, date, ownerId }) => updateCompanyActivity({ leadId, followUpDate: date, ownerId })}
        onClose={() => { setAddOpen(false); setAddDefaultOwnerId(null); }}
        onCreated={(created, context) => {
          const mapped = fromLegacy(created, undefined, context?.ownerId);
          setEvents((current) => [...current.filter((event) => event.sourceId !== mapped.sourceId || event.sourceType !== "lead_follow_up"), mapped].sort((a, b) => a.startAt.localeCompare(b.startAt)));
          setAddOpen(false);
          setAddDefaultOwnerId(null);
          selectEvent(mapped);
          toast({ title: "Activity scheduled", tone: "success" });
          router.refresh();
        }}
      /> : null}
      {editOpen && selectedEvent?.canEdit && selectedEvent.leadId ? <EditEventSheet
        event={toLegacyEvent(selectedEvent)}
        saveDate={(date) => updateCompanyActivity({ leadId: selectedEvent.leadId!, followUpDate: date })}
        onClose={() => setEditOpen(false)}
        onUpdated={(updated) => {
          const mapped = fromLegacy(updated, selectedEvent);
          setEvents((current) => current.map((event) => event.id === selectedEvent.id ? mapped : event).sort((a, b) => a.startAt.localeCompare(b.startAt)));
          setEditOpen(false);
          selectEvent(mapped);
          toast({ title: "Activity rescheduled", tone: "success" });
          router.refresh();
        }}
      /> : null}
    </CompanyWorkspaceShell>
  );
}
