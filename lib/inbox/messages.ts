import type { InboxChatMessage } from "./types";
import { isMediaPlaceholderBody } from "./media-placeholders";

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
    message_type?: string | null;
    status?: string | null;
    media_url?: string | null;
    media_mime_type?: string | null;
  }[]
): InboxChatMessage[] {
  return rows
    .filter((r) => r.body?.trim() || r.media_url)
    .map((r) => {
      const body = r.body?.trim() ?? "";
      const text =
        body && !isMediaPlaceholderBody(body, r.message_type) ? body : "";
      return {
        id: r.id,
        direction: r.direction === "inbound" ? "customer" : "rep",
        text,
        createdAt: r.created_at,
        kind: "message" as const,
        messageType: r.message_type ?? null,
        status: (r.status as InboxChatMessage["status"]) ?? null,
        mediaUrl: r.media_url ?? null,
        mediaMimeType: r.media_mime_type ?? null,
      };
    });
}

function mediaLabel(messageType?: string | null, mimeType?: string | null): string {
  if (messageType === "image" || mimeType?.startsWith("image/")) return "Photo";
  if (messageType === "audio" || mimeType?.startsWith("audio/")) return "Voice message";
  if (messageType === "video" || mimeType?.startsWith("video/")) return "Video";
  if (messageType === "document") return "Document";
  if (messageType === "sticker") return "Sticker";
  return "Attachment";
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
