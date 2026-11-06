import { addDays } from "date-fns";
import { calendarDateKey } from "@/lib/sales/company-calendar/format";
import { buildCalendarGrid, toDateKey } from "@/lib/sales/calendar/format";
import { planDayBoundsUtc } from "@/lib/sales/intelligence/timezone";
import type { CompanyCalendarEvent } from "@/lib/sales/company-calendar/types";
import type { CalendarEvent } from "@/lib/sales/calendar/types";

/**
 * Booked viewings on the web calendar.
 * The appointment row is the source. Public viewing requests stay inquiries
 * until this record exists. Viewings have no stored duration; the 90-minute
 * overlap warning is a booking check, not an event length.
 */

export type ViewingCalendarSurface = "sales" | "client";

export type ViewingCalendarRecord = {
  id: string;
  scheduledAt: string | null;
  status: string | null;
  confirmationStatus: string | null;
  access: string | null;
  listingId: string | null;
  propertyLabel: string | null;
  /** True only when the authorised viewing read included the address fields. */
  addressAuthorised?: boolean;
  agentId: string | null;
  buyerSearchId: string | null;
  buyerName: string | null;
  buyerPhone: string | null;
  /** Inquiry and other non-bookings never become viewing events. */
  source?: string | null;
};

export type ViewingCalendarLinks = {
  viewingHref: string;
  propertyHref: string | null;
  buyerHref: string | null;
};

export function viewingCalendarEventId(viewingId: string): string {
  return `viewing:${viewingId}`;
}

export function viewingCalendarLinks(
  record: Pick<ViewingCalendarRecord, "id" | "access" | "listingId" | "buyerSearchId">,
  surface: ViewingCalendarSurface,
  permissions: { propertyReadable?: boolean; buyerOpenable?: boolean } = {}
): ViewingCalendarLinks {
  const root = surface === "client" ? "/client" : "/sales";
  const viewingHref =
    surface === "client"
      ? `/client/viewings?viewing=${encodeURIComponent(record.id)}`
      : "/sales/viewings";
  const full = record.access === "full";
  return {
    viewingHref,
    propertyHref:
      permissions.propertyReadable && record.listingId
        ? `${root}/listings/${encodeURIComponent(record.listingId)}`
        : null,
    buyerHref:
      full && permissions.buyerOpenable && record.buyerSearchId
        ? `${root}/buyers/${encodeURIComponent(record.buyerSearchId)}`
        : null,
  };
}

/** Same rule as the buyer search page: manager, or the assigned agent, in that organisation. */
export function buyerRecordIsOpenable(input: {
  actorRole: string | null | undefined;
  actorId: string;
  actorClientId: string | null;
  searchClientId: string | null;
  assignedAgentId: string | null;
}): boolean {
  if (!input.searchClientId) return false;
  if (input.actorRole !== "SUPER_ADMIN" && input.actorClientId !== input.searchClientId) return false;
  if (input.actorRole === "CLIENT_MANAGER" || input.actorRole === "SUPER_ADMIN") return true;
  return input.actorRole === "SALESPERSON" && input.assignedAgentId === input.actorId;
}

export function viewingCalendarLabel(status: string | null, confirmationStatus: string | null): string {
  const confirmation = (confirmationStatus ?? "").toLowerCase();
  if (confirmation === "tentative") return "Tentative";
  if (confirmation === "awaiting_confirmation") return "Pending confirmation";
  const value = (status ?? "").toLowerCase();
  if (value === "completed") return "Completed";
  if (value === "cancelled") return "Cancelled";
  if (value === "no_show") return "No show";
  if (value === "scheduled") return "Scheduled";
  return status?.trim() || "Scheduled";
}

/** Same closed and overdue treatment the company calendar already uses for a visit. */
export function viewingCalendarState(
  status: string | null,
  scheduledAt: string,
  nowMs: number
): "scheduled" | "overdue" | "completed" | "cancelled" {
  const value = (status ?? "").toLowerCase();
  if (value === "completed") return "completed";
  if (value === "cancelled" || value === "no_show") return "cancelled";
  const start = Date.parse(scheduledAt);
  if (Number.isFinite(start) && start < nowMs) return "overdue";
  return "scheduled";
}

export function viewingFallsOnDate(scheduledAt: string, timezone: string, dateKey: string): boolean {
  const start = Date.parse(scheduledAt);
  if (!Number.isFinite(start)) return false;
  return calendarDateKey(scheduledAt, timezone) === dateKey;
}

/** Appointments in [start, end). An instant exactly at the end stays outside. */
export function viewingInHalfOpenWindow(scheduledAt: string, startIso: string, endIsoExclusive: string): boolean {
  const start = Date.parse(scheduledAt);
  const from = Date.parse(startIso);
  const end = Date.parse(endIsoExclusive);
  if (![start, from, end].every((value) => Number.isFinite(value))) return false;
  return start >= from && start < end;
}

/** Convert each civil date in the page timezone on its own. End is exclusive. */
export function calendarViewingBounds(
  startKey: string,
  endKeyExclusive: string,
  timezone: string
): { fromIso: string; toIsoExclusive: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startKey) || !/^\d{4}-\d{2}-\d{2}$/.test(endKeyExclusive)) return null;
  if (endKeyExclusive <= startKey) return null;
  const fromIso = planDayBoundsUtc(startKey, timezone).startIso;
  const toIsoExclusive = planDayBoundsUtc(endKeyExclusive, timezone).startIso;
  if (!(Date.parse(toIsoExclusive) > Date.parse(fromIso))) return null;
  return { fromIso, toIsoExclusive };
}

/** Month grid used by the agent calendar, including the adjacent days that grid paints. */
export function salesCalendarViewingWindow(monthAnchor: Date): { startKey: string; endKeyExclusive: string } {
  const days = buildCalendarGrid(monthAnchor);
  const startKey = toDateKey(days[0]!);
  const endKeyExclusive = toDateKey(addDays(days[days.length - 1]!, 1));
  return { startKey, endKeyExclusive };
}

export function viewingWindowCovers(
  loaded: { startKey: string; endKeyExclusive: string },
  needed: { startKey: string; endKeyExclusive: string }
): boolean {
  return loaded.startKey <= needed.startKey && loaded.endKeyExclusive >= needed.endKeyExclusive;
}

export function shouldApplyViewingLoad(requestId: number, latestRequestId: number): boolean {
  return requestId === latestRequestId;
}

/** An unreadable property file shows an address only when the viewing read supplied it. */
export function calendarPropertyPresentation(
  record: Pick<ViewingCalendarRecord, "listingId" | "propertyLabel" | "addressAuthorised">,
  propertyReadable: boolean
): { label: string; propertyHrefAllowed: boolean } {
  const authorisedAddress = record.addressAuthorised ? record.propertyLabel?.trim() || null : null;
  if (propertyReadable) {
    return {
      label: authorisedAddress || (record.listingId ? "Property" : "Viewing"),
      propertyHrefAllowed: Boolean(record.listingId),
    };
  }
  return { label: authorisedAddress || "Property viewing", propertyHrefAllowed: false };
}

export function presentViewingOnCalendar(
  record: ViewingCalendarRecord,
  input: {
    surface: ViewingCalendarSurface;
    timezone: string;
    nowMs?: number;
    propertyReadable?: boolean;
    buyerOpenable?: boolean;
  }
): { sales: CalendarEvent; company: CompanyCalendarEvent } | null {
  if (record.source === "inquiry" || !record.id || !record.scheduledAt) return null;
  const start = Date.parse(record.scheduledAt);
  if (!Number.isFinite(start)) return null;
  const nowMs = input.nowMs ?? Date.now();
  const state = viewingCalendarState(record.status, record.scheduledAt, nowMs);
  const label = viewingCalendarLabel(record.status, record.confirmationStatus);
  const full = record.access === "full";
  const propertyView = calendarPropertyPresentation(record, Boolean(input.propertyReadable));
  const links = viewingCalendarLinks(record, input.surface, {
    propertyReadable: input.propertyReadable && propertyView.propertyHrefAllowed,
    buyerOpenable: input.buyerOpenable,
  });
  const property = propertyView.label;
  const buyerName = full ? record.buyerName?.trim() || null : null;
  const buyerPhone = full ? record.buyerPhone?.trim() || null : null;
  const dateKey = calendarDateKey(record.scheduledAt, input.timezone);
  const actions = [
    { label: "Open viewing", href: links.viewingHref },
    ...(links.propertyHref ? [{ label: "Open property file", href: links.propertyHref }] : []),
    ...(links.buyerHref ? [{ label: buyerName ? `Open buyer · ${buyerName}` : "Open buyer", href: links.buyerHref }] : []),
  ];

  const sales: CalendarEvent = {
    id: viewingCalendarEventId(record.id),
    kind: "VIEWING",
    title: "Viewing",
    startAt: new Date(start).toISOString(),
    endAt: null,
    leadId: "",
    dealId: null,
    customerName: buyerName,
    phone: buyerPhone,
    location: property,
    pipelineStage: label,
    status: (record.status ?? "scheduled").toLowerCase(),
    source: "VIEWING",
    notes: null,
    quoteNumber: null,
    quoteStatus: null,
    quoteTotal: null,
    projectType: null,
    leadScore: null,
    overdue: state === "overdue",
    hasTimedCallback: true,
    calendarDateKey: dateKey,
    timeZone: input.timezone,
    viewingHref: links.viewingHref,
    propertyHref: links.propertyHref,
    buyerHref: links.buyerHref,
  };

  const company: CompanyCalendarEvent = {
    id: viewingCalendarEventId(record.id),
    sourceType: "viewing",
    sourceId: record.id,
    kind: "viewing",
    title: "Viewing",
    startAt: sales.startAt,
    endAt: null,
    allDay: false,
    status: state,
    sourceStatus: ["tentative", "awaiting_confirmation"].includes((record.confirmationStatus ?? "").toLowerCase())
      ? (record.confirmationStatus ?? "").toLowerCase()
      : (record.status ?? "scheduled").toLowerCase(),
    ownerId: record.agentId,
    ownerName: null,
    ownerAvatarUrl: null,
    ownerRoleLabel: null,
    relationType: "customer",
    relatedId: record.listingId ?? record.id,
    relatedLabel: property,
    relatedSecondary: buyerName,
    relatedHref: links.viewingHref,
    leadId: null,
    dealId: null,
    customerId: full ? record.buyerSearchId : null,
    phone: buyerPhone,
    location: property,
    description: null,
    attentionReason: state === "overdue" ? "The scheduled viewing time has passed." : null,
    canEdit: false,
    canComplete: false,
    actions,
  };

  return { sales, company };
}

export function uniqueCalendarEntries<T extends { id: string }>(events: T[]): T[] {
  return [...new Map(events.map((event) => [event.id, event])).values()];
}

export function appendViewingEvents<T extends { id: string }>(
  existing: T[],
  viewings: { ok: false } | { ok: true; events: T[]; incomplete?: boolean }
): { events: T[]; partial: boolean } {
  if (!viewings.ok) return { events: existing, partial: true };
  return {
    events: uniqueCalendarEntries([...existing, ...viewings.events]).sort((a, b) => {
      const left = "startAt" in a ? String((a as { startAt?: string }).startAt ?? "") : "";
      const right = "startAt" in b ? String((b as { startAt?: string }).startAt ?? "") : "";
      return left.localeCompare(right);
    }),
    partial: Boolean(viewings.incomplete),
  };
}

/** Retry keeps the current events. A successful read replaces only viewing rows. */
export function replaceViewingEvents<T extends { id: string; kind?: string }>(
  current: T[],
  viewings: { ok: false } | { ok: true; events: T[]; incomplete?: boolean }
): { events: T[]; partial: boolean } {
  if (!viewings.ok) return { events: current, partial: true };
  return appendViewingEvents(
    current.filter((event) => event.kind !== "VIEWING"),
    viewings
  );
}
