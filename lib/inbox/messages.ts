import type { InboxChatMessage } from "./types";

type TimelineEvent = {
  id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  actor_name: string;
  actor_role: string;
  channel?: string | null;
  created_at: string;
};

export function whatsappRowsToChatMessages(
  rows: {
    id: string;
    direction: string;
    body: string | null;
    created_at: string;
  }[]
): InboxChatMessage[] {
  return rows
    .filter((r) => r.body?.trim())
    .map((r) => ({
      id: r.id,
      direction: r.direction === "inbound" ? "customer" : "rep",
      text: r.body!.trim(),
      createdAt: r.created_at,
      kind: "message" as const,
    }));
}

export function eventsToChatMessages(events: TimelineEvent[]): InboxChatMessage[] {
  const messages: InboxChatMessage[] = [];

  for (const event of events) {
    const mapped = mapEventToMessage(event);
    if (mapped) messages.push(mapped);
  }

  return messages;
}

function mapEventToMessage(event: TimelineEvent): InboxChatMessage | null {
  const d = event.event_data ?? {};

  if (event.event_type === "DOCUMENT_SENT") {
    const docName = String(d.document_name ?? d.document_type ?? "document");
    const docType = String(d.document_type ?? "");
    const text =
      docType === "CUSTOM_MESSAGE"
        ? String(d.custom_message ?? d.message ?? `Message sent`)
        : `Sent ${docName}`;
    return {
      id: event.id,
      direction: "rep",
      text,
      createdAt: event.created_at,
      kind: "message",
    };
  }

  if (event.event_type === "NOTE_ADDED") {
    const note = String(d.note ?? "").trim();
    if (!note) return null;
    return {
      id: event.id,
      direction: event.actor_role === "SALESPERSON" ? "rep" : "customer",
      text: note,
      createdAt: event.created_at,
      kind: "message",
    };
  }

  if (event.event_type === "CALL_LOGGED") {
    const channel = (event.channel as string | undefined) ?? (d.channel as string | undefined) ?? "call";
    const outcome = String(d.outcome ?? d.reach_outcome ?? "").replace(/_/g, " ");
    const notes = d.notes ? ` — ${String(d.notes)}` : "";
    const prefix = channel === "whatsapp" ? "WhatsApp contact" : "Call logged";
    return {
      id: event.id,
      direction: "rep",
      text: `${prefix}: ${outcome}${notes}`.trim(),
      createdAt: event.created_at,
      kind: "system",
    };
  }

  if (event.event_type === "LEAD_CREATED") {
    const summary = String(d.form_data_summary ?? d.first_message ?? "").trim();
    if (summary) {
      return {
        id: event.id,
        direction: "customer",
        text: summary,
        createdAt: event.created_at,
        kind: "message",
      };
    }
  }

  if (event.event_type === "MESSAGE_RECEIVED") {
    const body = String(d.body ?? "").trim();
    if (body) {
      return {
        id: event.id,
        direction: "customer",
        text: body,
        createdAt: event.created_at,
        kind: "message",
      };
    }
  }

  if (event.event_type === "MESSAGE_SENT") {
    const body = String(d.body ?? "").trim();
    if (body) {
      return {
        id: event.id,
        direction: "rep",
        text: body,
        createdAt: event.created_at,
        kind: "message",
      };
    }
  }

  return null;
}

export function snippetFromEvents(events: TimelineEvent[], formFallback?: string | null): string {
  const chat = eventsToChatMessages(events);
  if (chat.length) return chat[chat.length - 1].text;
  if (formFallback?.trim()) return formFallback.trim();
  return "No messages yet";
}
