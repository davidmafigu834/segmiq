import { getEventTypeLabel } from "@/lib/sales/calendar/adapters";
import { formatEventTime, toDateKey } from "@/lib/sales/calendar/format";
import { parseISO } from "date-fns";
import type { CalendarEvent } from "@/lib/sales/calendar/types";
import { calendarDateKey, COMPANY_CALENDAR_KIND_META } from "@/lib/sales/company-calendar/format";
import type { CompanyCalendarEvent, CompanyCalendarEventKind } from "@/lib/sales/company-calendar/types";
import { isWhatsAppInboundLead, whatsappInboxHref } from "@/lib/leads/whatsapp-lead-display";
import type { RealEstateAppointment, RealEstateAppointmentKind } from "./RealEstateCalendar";

function kindOf(kind: string): RealEstateAppointmentKind {
  if (kind === "VIEWING" || kind === "viewing") return "viewing";
  if (kind === "CALL" || kind === "call") return "call";
  return "follow-up";
}

function clock(iso: string, timed: boolean, timezone: string | null | undefined) {
  if (!timed) return "All day";
  return formatEventTime(iso, true, timezone) || "All day";
}

function phoneLinks(phone: string | null | undefined) {
  const trimmed = phone?.trim() || null;
  const digits = trimmed?.replace(/\D/g, "") ?? "";
  return {
    phone: trimmed,
    callHref: trimmed ? `tel:${trimmed}` : null,
    whatsappHref: digits.length >= 8 ? `https://wa.me/${digits}` : null,
  };
}

function visitState(status: string | null | undefined): RealEstateAppointment["state"] {
  const value = (status ?? "").toLowerCase();
  if (value === "cancelled" || value === "no_show") return "cancelled";
  if (value === "completed") return "recorded";
  return null;
}

export function salesAppointments(events: CalendarEvent[], timezone: string): RealEstateAppointment[] {
  return events.map((event) => {
    const kind = kindOf(event.kind);
    const links = phoneLinks(event.phone);
    const zone = event.timeZone || (event.calendarDateKey ? timezone : null);
    const leadHref = event.dealId
      ? `/sales/deals/${event.dealId}`
      : event.leadId
        ? isWhatsAppInboundLead(event.source)
          ? whatsappInboxHref(event.leadId)
          : `/sales/leads?lead=${encodeURIComponent(event.leadId)}`
        : null;
    return {
      id: event.id,
      date: event.calendarDateKey && /^\d{4}-\d{2}-\d{2}$/.test(event.calendarDateKey)
        ? event.calendarDateKey
        : zone
          ? calendarDateKey(event.startAt, zone)
          : toDateKey(parseISO(event.startAt)),
      time: clock(event.startAt, event.hasTimedCallback, zone),
      name: event.customerName?.trim() || (kind === "viewing" ? "Viewing" : event.title),
      kind,
      kindLabel: getEventTypeLabel(event.kind),
      place: event.location?.trim() || "",
      overdue: event.overdue && visitState(event.status) == null,
      phone: links.phone,
      state: visitState(event.status),
      note: event.notes,
      openHref: kind === "viewing" ? event.viewingHref || null : leadHref,
      callHref: links.callHref,
      whatsappHref: event.leadId ? whatsappInboxHref(event.leadId) : links.whatsappHref,
    };
  });
}

export function companyAppointments(events: CompanyCalendarEvent[], timezone: string): RealEstateAppointment[] {
  return events.map((event) => {
    const kind = kindOf(event.kind);
    const links = phoneLinks(event.phone);
    const meta = COMPANY_CALENDAR_KIND_META[event.kind as CompanyCalendarEventKind];
    const buyer = kind === "viewing" ? event.relatedSecondary?.trim() || "" : "";
    return {
      id: event.id,
      date: calendarDateKey(event.startAt, timezone),
      time: clock(event.startAt, !event.allDay, timezone),
      name: kind === "viewing" ? buyer || "Viewing" : event.relatedLabel?.trim() || event.title,
      kind,
      kindLabel: meta?.label || event.title,
      place: event.location?.trim() || (kind === "viewing" ? event.relatedLabel?.trim() || "" : ""),
      overdue: event.status === "overdue",
      phone: links.phone,
      owner: event.ownerName?.trim() || null,
      state: event.status === "cancelled" ? "cancelled" : event.status === "completed" ? "recorded" : null,
      note: event.description,
      openHref: event.relatedHref || event.actions?.[0]?.href || null,
      callHref: links.callHref,
      whatsappHref: links.whatsappHref,
    };
  });
}
