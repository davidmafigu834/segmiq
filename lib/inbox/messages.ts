import type { InboxChatMessage } from "./types";
import { isMediaMessageType, isMediaPlaceholderBody } from "./media-placeholders";
import { resolveWhatsAppMediaUrl } from "@/lib/whatsapp/media";

export function isWhatsAppRowVisibleInChat(row: {
  body: string | null;
  media_url?: string | null;
  message_type?: string | null;
  media_storage_key?: string | null;
}): boolean {
  return Boolean(
    row.body?.trim() ||
      row.media_url ||
      row.media_storage_key ||
      isMediaMessageType(row.message_type)
  );
}

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
    media_storage_key?: string | null;
  }[]
): InboxChatMessage[] {
  return rows
    .filter((r) => isWhatsAppRowVisibleInChat(r))
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
        mediaUrl: resolveWhatsAppMediaUrl(r.id, r.media_url, r.media_storage_key),
        mediaMimeType: r.media_mime_type ?? null,
      };
    });
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

  if (event.event_type === "NOTE_ADDED") {
    const note = String(d.note ?? "").trim();
    if (!note) return null;
    if (d.agent === true) {
      return {
        id: event.id,
        direction: "rep",
        text: note.replace(/^Qualification updated by SegmiQ Agent:\s*/i, "Qualified ").replace(/^SegmiQ Agent requested human help — /i, ""),
        createdAt: event.created_at,
        kind: "system",
        systemTitle: "SegmiQ Agent",
        actorName: event.actor_name || null,
      };
    }
    const isInternal = d.internal === true || d.visibility === "internal";
    if (isInternal) {
      return {
        id: event.id,
        direction: "rep",
        text: note,
        createdAt: event.created_at,
        kind: "internal",
        actorName: event.actor_name || null,
      };
    }
    return {
      id: event.id,
      direction: event.actor_role === "SALESPERSON" ? "rep" : "customer",
      text: note,
      createdAt: event.created_at,
      kind: "message",
      actorName: event.actor_name || null,
    };
  }

  if (event.event_type === "STATUS_CHANGED") {
    const from = String(d.from_status ?? "").replace(/_/g, " ");
    const to = String(d.to_status ?? "").replace(/_/g, " ");
    if (!to) return null;
    return {
      id: event.id,
      direction: "rep",
      text: from ? `Stage changed: ${from} → ${to}` : `Stage set to ${to}`,
      createdAt: event.created_at,
      kind: "system",
    };
  }

  if (event.event_type === "LEAD_ASSIGNED") {
    const toName = String(d.to_name ?? d.assigned_to_name ?? "a teammate");
    return {
      id: event.id,
      direction: "rep",
      text: `Lead assigned to ${toName}`,
      createdAt: event.created_at,
      kind: "system",
    };
  }

  if (event.event_type === "LEAD_REASSIGNED") {
    const fromName = String(d.from_name ?? "Unassigned");
    const toName = String(d.to_name ?? "Unassigned");
    const notes = d.handover_notes ? ` — ${String(d.handover_notes)}` : "";
    return {
      id: event.id,
      direction: "rep",
      text: `${fromName} → ${toName}${notes}`,
      createdAt: event.created_at,
      kind: "system",
      systemTitle: "Conversation transferred",
      actorName: event.actor_name || null,
    };
  }

  if (event.event_type === "CONVERSATION_TRANSFERRED_TO_SUPPORT") {
    const toName = String(d.to_name ?? "Support Team");
    const reason = d.reason ? String(d.reason) : "";
    return {
      id: event.id,
      direction: "rep",
      text: [event.actor_name ? `${event.actor_name} → ${toName}` : toName, reason]
        .filter(Boolean)
        .join(" · "),
      createdAt: event.created_at,
      kind: "system",
      systemTitle: "Transferred to Support",
      actorName: event.actor_name || null,
    };
  }

  if (event.event_type === "SUPPORT_CASE_OPENED") {
    return {
      id: event.id,
      direction: "rep",
      text: String(d.reason ?? d.reason_category ?? "Support case opened"),
      createdAt: event.created_at,
      kind: "system",
      systemTitle: "Support case opened",
      actorName: event.actor_name || null,
    };
  }

  if (event.event_type === "FOLLOW_UP_SET") {
    const date = String(d.follow_up_date ?? d.date ?? "").trim();
    return {
      id: event.id,
      direction: "rep",
      text: date ? `Follow-up scheduled for ${date}` : "Follow-up scheduled",
      createdAt: event.created_at,
      kind: "system",
    };
  }

  if (event.event_type === "DOCUMENT_SENT") {
    const docName = String(d.document_name ?? d.document_type ?? "document");
    const docType = String(d.document_type ?? "");
    if (docType === "QUOTATION") {
      return {
        id: event.id,
        direction: "rep",
        text: [docName, event.actor_name].filter(Boolean).join(" · "),
        createdAt: event.created_at,
        kind: "system",
        systemTitle: "Quote sent",
        actorName: event.actor_name || null,
      };
    }
    const text =
      docType === "CUSTOM_MESSAGE"
        ? String(d.custom_message ?? d.message ?? `Message sent`)
        : `Sent ${docName}`;
    return {
      id: event.id,
      direction: "rep",
      text,
      createdAt: event.created_at,
      kind: docType === "CUSTOM_MESSAGE" ? "message" : "system",
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
      systemTitle: channel === "whatsapp" ? "WhatsApp contact" : "Call logged",
      actorName: event.actor_name || null,
    };
  }

  if (event.event_type === "DEAL_CREATED") {
    const dealName = String(d.deal_name ?? d.name ?? "Deal").trim();
    return {
      id: event.id,
      direction: "rep",
      text: dealName,
      createdAt: event.created_at,
      kind: "system",
      systemTitle: event.actor_name === "SegmiQ Agent" ? "SegmiQ Agent created Deal" : "Deal created",
      actorName: event.actor_name || null,
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

export function messageLogsToChatMessages(
  rows: {
    id: string;
    payload_preview: string | null;
    created_at: string;
    provider_id?: string | null;
    status?: string | null;
  }[]
): InboxChatMessage[] {
  return rows
    .filter((r) => r.payload_preview?.trim())
    .map((r) => ({
      id: `log-${r.id}`,
      direction: "rep" as const,
      text: r.payload_preview!.trim(),
      createdAt: r.created_at,
      kind: "message" as const,
      status: (r.status as InboxChatMessage["status"]) ?? "sent",
    }));
}

export function snippetFromEvents(events: TimelineEvent[], formFallback?: string | null): string {
  const chat = eventsToChatMessages(events);
  if (chat.length) return chat[chat.length - 1].text;
  if (formFallback?.trim()) return formFallback.trim();
  return "No messages yet";
}
