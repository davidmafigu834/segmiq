import { STAGE_LABELS } from "@/lib/inbox/scoring";
import { resolveFollowUpDateTime } from "@/lib/call-log-constants";
import { leadCardDisplayName } from "@/lib/leads/whatsapp-lead-display";
import type { CalendarDealOption, CalendarEvent, CalendarEventKind, CalendarLeadRow } from "./types";

const KIND_META: Record<
  CalendarEventKind,
  { label: string; color: string; tint: string }
> = {
  FOLLOW_UP: { label: "Follow-up", color: "#22C55E", tint: "rgba(34,197,94,0.08)" },
  CALL: { label: "Call", color: "#14B8A6", tint: "rgba(20,184,166,0.08)" },
  QUOTE_REVIEW: { label: "Quote review", color: "#F59E0B", tint: "rgba(245,158,11,0.08)" },
  SITE_VISIT: { label: "Site visit", color: "#2684FF", tint: "rgba(38,132,255,0.08)" },
  INSTALLATION_MEETING: {
    label: "Installation meeting",
    color: "#8B5CF6",
    tint: "rgba(139,92,246,0.08)",
  },
  PERSONAL: { label: "Personal", color: "#98A2B3", tint: "rgba(152,162,179,0.10)" },
};

export function getEventTypeLabel(kind: CalendarEventKind): string {
  return KIND_META[kind].label;
}

export function getEventTypeColor(kind: CalendarEventKind): string {
  return KIND_META[kind].color;
}

export function getEventTypeTint(kind: CalendarEventKind): string {
  return KIND_META[kind].tint;
}

function inferKind(lead: CalendarLeadRow, hasTimedCallback: boolean): CalendarEventKind {
  if (hasTimedCallback) return "CALL";
  const quoteStatus = (lead.latestQuoteStatus || "").toLowerCase();
  if (
    lead.status === "PROPOSAL_SENT" ||
    (quoteStatus && quoteStatus !== "draft")
  ) {
    return "QUOTE_REVIEW";
  }
  return "FOLLOW_UP";
}

function titleForKind(kind: CalendarEventKind, name: string): string {
  switch (kind) {
    case "CALL":
      return `Callback · ${name}`;
    case "QUOTE_REVIEW":
      return `Quote review · ${name}`;
    default:
      return `Follow-up · ${name}`;
  }
}

export function adaptLeadToCalendarEvent(
  lead: CalendarLeadRow,
  callbackAt: string | undefined
): CalendarEvent | null {
  const start = resolveFollowUpDateTime(lead.follow_up_date, callbackAt);
  if (!start) return null;

  const hasTimedCallback = Boolean(callbackAt);
  const kind = inferKind(lead, hasTimedCallback);
  const customerName = leadCardDisplayName({
    name: lead.name,
    phone: lead.phone,
    source: lead.source,
    form_data: lead.form_data,
  });
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const overdue = start < startOfToday;

  return {
    id: `lead-followup-${lead.id}`,
    kind,
    title: titleForKind(kind, customerName),
    startAt: start.toISOString(),
    endAt: null,
    leadId: lead.id,
    dealId: null,
    customerName,
    phone: lead.phone,
    location: lead.location?.trim() || null,
    pipelineStage: lead.status
      ? STAGE_LABELS[lead.status] ?? lead.status.replace(/_/g, " ")
      : null,
    status: lead.status,
    source: lead.source,
    notes: null,
    quoteNumber: lead.latestQuoteNumber ?? null,
    quoteStatus: lead.latestQuoteStatus ?? null,
    quoteTotal: lead.latestQuoteTotal ?? null,
    projectType: lead.project_type?.trim() || null,
    leadScore: typeof lead.score === "number" ? lead.score : null,
    overdue,
    hasTimedCallback,
  };
}

/** Compact CRM context line for calendar cards — only real fields. */
export function getEventSalesContext(event: CalendarEvent): string | null {
  const parts: string[] = [];
  if (event.overdue) parts.push("Follow-up overdue");
  if (event.pipelineStage) parts.push(event.pipelineStage);
  if (event.projectType) parts.push(event.projectType);
  if (event.quoteTotal != null && event.quoteTotal > 0) {
    parts.push(`$${event.quoteTotal.toLocaleString()}`);
  } else if (event.quoteStatus && event.quoteStatus.toLowerCase() !== "draft") {
    parts.push(`Quote ${event.quoteStatus.replace(/_/g, " ")}`);
  }
  if (event.leadScore != null && event.leadScore > 0) {
    const heat = event.leadScore >= 70 ? "Hot" : event.leadScore >= 40 ? "Warm" : null;
    parts.push(heat ? `Score ${event.leadScore} · ${heat}` : `Score ${event.leadScore}`);
  }
  if (!parts.length) return null;
  return parts.slice(0, 3).join(" · ");
}

export function adaptLeadsToCalendarEvents(
  leads: CalendarLeadRow[],
  callbackAtByLeadId: Record<string, string>
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const lead of leads) {
    const event = adaptLeadToCalendarEvent(lead, callbackAtByLeadId[lead.id]);
    if (event) events.push(event);
  }
  return events.sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );
}

function kindFromDealLabel(label: string | null | undefined): CalendarEventKind {
  const value = (label ?? "").toLowerCase();
  if (value.includes("call")) return "CALL";
  if (value.includes("quote")) return "QUOTE_REVIEW";
  return "FOLLOW_UP";
}

export function nextActionAtFromDateKey(dateKey: string): string {
  return new Date(`${dateKey}T10:00:00`).toISOString();
}

export function adaptDealToCalendarEvent(deal: CalendarDealOption): CalendarEvent | null {
  if (!deal.nextActionAt) return null;
  const start = new Date(deal.nextActionAt);
  if (!Number.isFinite(start.getTime())) return null;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const overdue = start < startOfToday;
  const title = deal.nextActionLabel?.trim() || `Follow-up · ${deal.name}`;
  return {
    id: `deal-action-${deal.id}`,
    kind: kindFromDealLabel(deal.nextActionLabel),
    title,
    startAt: start.toISOString(),
    endAt: null,
    leadId: deal.originatingLeadId,
    dealId: deal.id,
    customerName: deal.name,
    phone: deal.phone,
    location: null,
    pipelineStage: deal.stage,
    status: deal.stage,
    source: "DEAL",
    notes: null,
    quoteNumber: null,
    quoteStatus: null,
    quoteTotal: null,
    projectType: null,
    leadScore: null,
    overdue,
    hasTimedCallback: start.getHours() !== 0 || start.getMinutes() !== 0,
  };
}
