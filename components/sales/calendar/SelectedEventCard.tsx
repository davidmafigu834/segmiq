"use client";

import Link from "next/link";
import {
  CalendarClock,
  FileText,
  MousePointerClick,
  NotebookPen,
  Phone,
  Pencil,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import {
  isWhatsAppInboundLead,
  whatsappInboxHref,
} from "@/lib/leads/whatsapp-lead-display";
import { formatEventRange } from "@/lib/sales/calendar/format";
import {
  getEventSalesContext,
  getEventTypeColor,
  getEventTypeLabel,
} from "@/lib/sales/calendar/adapters";
import type { CalendarEvent } from "@/lib/sales/calendar/types";

export function SelectedEventCard({
  event,
  onEdit,
  onLogNote,
  onReschedule,
}: {
  event: CalendarEvent | null;
  onEdit: () => void;
  onLogNote: () => void;
  onReschedule: () => void;
}) {
  if (!event) {
    return (
      <div className="cal-card p-3">
        <h2 className="mb-2 text-[14px] font-semibold text-[#101828]">Selected event</h2>
        <div className="flex flex-col items-center rounded-[10px] bg-[#F9FAFB] px-3 py-5 text-center">
          <MousePointerClick size={18} strokeWidth={1.8} className="text-[#98A2B3]" aria-hidden />
          <p className="mt-2 text-[13px] font-semibold text-[#101828]">Select an event</p>
          <p className="mt-0.5 max-w-[220px] text-[12px] text-[#667085]">
            Customer details and quick actions will appear here.
          </p>
        </div>
      </div>
    );
  }

  const leadHref = isWhatsAppInboundLead(event.source)
    ? whatsappInboxHref(event.leadId)
    : `/sales/leads?lead=${event.leadId}`;
  const whatsappHref = whatsappInboxHref(event.leadId);
  const customerLabel = event.customerName ?? "Customer";
  const salesContext = getEventSalesContext(event);
  const title =
    event.kind === "CALL"
      ? "Callback"
      : event.kind === "QUOTE_REVIEW"
        ? "Quote review"
        : "Follow-up call";

  return (
    <div className="cal-card p-3">
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: getEventTypeColor(event.kind) }}
            aria-hidden
          />
          <h2 className="truncate text-[14px] font-semibold text-[#101828]">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 rounded-[8px] px-2 py-1 text-[12px] font-semibold text-[#667085] transition-colors hover:bg-[#F9FAFB] hover:text-[#101828]"
          aria-label="Edit event"
        >
          <Pencil size={13} strokeWidth={1.8} aria-hidden />
          Edit
        </button>
      </div>

      {salesContext ? (
        <p className="mb-2.5 rounded-[8px] bg-[#F9FAFB] px-2.5 py-1.5 text-[12px] font-medium text-[#667085]">
          {salesContext}
        </p>
      ) : null}

      <dl className="space-y-2">
        {event.customerName ? (
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-[#98A2B3]">
              Customer
            </dt>
            <dd>
              <Link
                href={leadHref}
                className="text-[13px] font-semibold text-[#101828] underline-offset-2 hover:underline"
              >
                {event.customerName}
              </Link>
            </dd>
          </div>
        ) : null}

        {event.pipelineStage ? (
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-[#98A2B3]">
              Pipeline
            </dt>
            <dd>
              <span className="inline-flex rounded-md bg-[#F2F4F7] px-2 py-0.5 text-[12px] font-medium text-[#101828]">
                {event.pipelineStage}
              </span>
            </dd>
          </div>
        ) : null}

        {event.phone ? (
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-[#98A2B3]">
              Phone
            </dt>
            <dd>
              <a
                href={`tel:${event.phone}`}
                className="font-mono text-[13px] text-[#2684FF] underline-offset-2 hover:underline"
              >
                {event.phone}
              </a>
            </dd>
          </div>
        ) : null}

        {event.location ? (
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-[#98A2B3]">
              Location
            </dt>
            <dd className="text-[13px] text-[#101828]">{event.location}</dd>
          </div>
        ) : null}

        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-[#98A2B3]">
            Time
          </dt>
          <dd className="text-[13px] text-[#101828]">{formatEventRange(event)}</dd>
        </div>

        {event.notes ? (
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-[#98A2B3]">
              Notes
            </dt>
            <dd className="text-[13px] text-[#101828]">{event.notes}</dd>
          </div>
        ) : null}
      </dl>

      {(event.pipelineStage || event.quoteStatus) && !event.overdue ? (
        <div className="mt-3 rounded-[8px] border border-[#E4E7EC] bg-[#FCFCFD] px-2.5 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">
            Prepare for this event
          </p>
          <ul className="mt-1 space-y-0.5 text-[12px] text-[#667085]">
            {event.pipelineStage ? <li>Pipeline: {event.pipelineStage}</li> : null}
            {event.quoteNumber ? (
              <li>
                Quote: {event.quoteNumber}
                {event.quoteStatus ? ` · ${event.quoteStatus.replace(/_/g, " ")}` : ""}
              </li>
            ) : null}
          </ul>
          <Link
            href={`/sales/leads?lead=${event.leadId}`}
            className="mt-1.5 inline-block text-[12px] font-semibold text-[#2684FF] underline-offset-2 hover:underline"
          >
            Open lead
          </Link>
        </div>
      ) : null}

      {event.quoteNumber ? (
        <Link
          href={`/sales/leads?lead=${event.leadId}&tab=quote`}
          className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#2684FF] underline-offset-2 hover:underline"
        >
          <FileText size={13} strokeWidth={1.8} aria-hidden />
          View quote
        </Link>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link
          href={whatsappHref}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[9px] border border-[#E4E7EC] bg-white text-[12px] font-semibold text-[#101828] transition-colors hover:bg-[#F9FAFB]"
          aria-label={`WhatsApp ${customerLabel}`}
        >
          <SiWhatsapp size={14} color="#25D366" aria-hidden />
          WhatsApp
        </Link>
        {event.phone ? (
          <a
            href={`tel:${event.phone}`}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[9px] border border-[#E4E7EC] bg-white text-[12px] font-semibold text-[#101828] transition-colors hover:bg-[#F9FAFB]"
            aria-label={`Call ${customerLabel}`}
          >
            <Phone size={14} strokeWidth={1.8} aria-hidden />
            Call
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex h-10 cursor-not-allowed items-center justify-center gap-1.5 rounded-[9px] border border-[#E4E7EC] text-[12px] font-semibold text-[#98A2B3]"
            title="No phone number on this lead"
          >
            <Phone size={14} strokeWidth={1.8} aria-hidden />
            Call
          </button>
        )}
        <button
          type="button"
          onClick={onReschedule}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[9px] border border-[#E4E7EC] bg-white text-[12px] font-semibold text-[#101828] transition-colors hover:bg-[#F9FAFB]"
          aria-label="Reschedule event"
        >
          <CalendarClock size={14} strokeWidth={1.8} aria-hidden />
          Reschedule
        </button>
        <button
          type="button"
          onClick={onLogNote}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[9px] border border-[#E4E7EC] bg-white text-[12px] font-semibold text-[#101828] transition-colors hover:bg-[#F9FAFB]"
          aria-label="Log note"
        >
          <NotebookPen size={14} strokeWidth={1.8} aria-hidden />
          Log note
        </button>
      </div>
      <p className="sr-only">{getEventTypeLabel(event.kind)}</p>
    </div>
  );
}
