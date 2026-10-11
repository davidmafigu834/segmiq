import { formatScheduleWhen } from "@/lib/sales/tasks/format";

export type RecentUpdateKind = "reply" | "assignment" | "arrangement" | "quotation";

export type RecentUpdateInput = {
  id: string;
  at: string;
  kind: RecentUpdateKind;
  leadId: string;
  leadName: string;
  href: string;
  linkLabel: string;
  /** Short event line shown under the customer name. */
  detail: string;
  summary: string;
};

export type RecentUpdate = RecentUpdateInput;

const NOISE = new Set([
  "LEARNING_OBSERVED",
  "NOTE_ADDED",
  "CALL_LOGGED",
  "MESSAGE_SENT",
  "STATUS_CHANGED",
  "CONVERSATION_TYPE_CHANGED",
]);

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function snippet(body: string): string {
  const clean = body.replace(/\s+/g, " ").trim();
  if (clean.length <= 80) return clean;
  return `${clean.slice(0, 77)}…`;
}

export function mapLeadEvent(row: {
  id: string;
  eventType: string;
  at: string;
  leadId: string;
  leadName: string;
  userId: string;
  data: Record<string, unknown>;
  timeZone: string;
  now?: Date;
}): RecentUpdateInput | null {
  if (NOISE.has(row.eventType)) return null;
  const name = row.leadName.trim() || "A customer";
  const chat = `/sales/inbox?lead=${row.leadId}`;

  if (row.eventType === "MESSAGE_RECEIVED") {
    const body = text(row.data.body);
    return {
      id: row.id,
      at: row.at,
      kind: "reply",
      leadId: row.leadId,
      leadName: name,
      href: chat,
      linkLabel: "View chat",
      detail: body ? `Replied: “${snippet(body)}”` : "Replied",
      summary: body ? `${name} replied: “${snippet(body)}”` : `${name} replied.`,
    };
  }

  if (row.eventType === "LEAD_ASSIGNED" || row.eventType === "LEAD_REASSIGNED") {
    const assignee = text(row.data.assigned_to_id) ?? text(row.data.to_id);
    if (assignee !== row.userId) return null;
    return {
      id: row.id,
      at: row.at,
      kind: "assignment",
      leadId: row.leadId,
      leadName: name,
      href: `/sales/leads?lead=${row.leadId}`,
      linkLabel: "View lead",
      detail: "Assigned to you",
      summary: `${name} was assigned to you.`,
    };
  }

  if (row.eventType === "FOLLOW_UP_SET") {
    if (row.data.completed === true) return null;
    const when = text(row.data.follow_up_date);
    if (!when) return null;
    const label = /^\d{4}-\d{2}-\d{2}$/.test(when)
      ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
          new Date(`${when}T00:00:00.000Z`)
        )
      : formatScheduleWhen(when, row.timeZone, row.now);
    return {
      id: row.id,
      at: row.at,
      kind: "arrangement",
      leadId: row.leadId,
      leadName: name,
      href: "/sales/tasks",
      linkLabel: "View task",
      detail: `Follow-up set for ${label}`,
      summary: `The follow-up for ${name} changed to ${label}.`,
    };
  }

  return null;
}

export function mapQuotationEvent(row: {
  id: string;
  eventType: string;
  at: string;
  leadId: string;
  leadName: string;
  quotationId: string;
}): RecentUpdateInput | null {
  const name = row.leadName.trim() || "A customer";
  if (row.eventType === "APPROVED") {
    return {
      id: row.id,
      at: row.at,
      kind: "quotation",
      leadId: row.leadId,
      leadName: name,
      href: `/sales/quotes/${row.quotationId}`,
      linkLabel: "View quotation",
      detail: "Quotation approved",
      summary: `A quotation for ${name} was approved.`,
    };
  }
  if (row.eventType === "ACCEPTED") {
    return {
      id: row.id,
      at: row.at,
      kind: "quotation",
      leadId: row.leadId,
      leadName: name,
      href: `/sales/quotes/${row.quotationId}`,
      linkLabel: "View quotation",
      detail: "Quotation accepted",
      summary: `A quotation for ${name} was accepted.`,
    };
  }
  return null;
}

export function selectRecentUpdates(events: RecentUpdateInput[], limit = 3): RecentUpdate[] {
  const sorted = [...events].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const seen = new Set<string>();
  const picked: RecentUpdate[] = [];
  for (const event of sorted) {
    if (!event.summary.trim()) continue;
    const key = event.kind === "quotation" ? `${event.kind}:${event.href}` : `${event.kind}:${event.leadId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(event);
    if (picked.length >= limit) break;
  }
  return picked;
}
