import { createAdminClient } from "@/lib/supabase/admin";
import { generateWhatsAppOutboundKey, getPublicUrl, isR2Configured, putObject } from "@/lib/storage/r2";
import type { SendResult } from "@/lib/messaging/log";
import { getSafeWhatsAppConnection } from "./connections";
import { isWhatsAppSessionOpen } from "./inbound";
import { sendCanonicalWhatsAppMedia } from "./message-service";
import {
  placeholderBodyForMedia,
  validateWhatsAppOutboundMedia,
  type WhatsAppOutboundMediaType,
} from "./outbound-media";
import { uploadWhatsAppMedia } from "./send-document";

export type SendWhatsAppMediaResult = SendResult & {
  channel: "whatsapp";
  messageType?: WhatsAppOutboundMediaType;
};

export async function sendWhatsAppMediaToLead(opts: {
  leadId: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  filename: string;
  mimeType?: string | null;
  size: number;
  caption?: string | null;
  buffer?: Buffer;
  storageKey?: string;
}): Promise<SendWhatsAppMediaResult> {
  const validated = validateWhatsAppOutboundMedia({
    filename: opts.filename,
    mimeType: opts.mimeType,
    size: opts.size,
  });
  if (!validated.ok) {
    return { ok: false, error: validated.error, errorCode: "INVALID_MEDIA", channel: "whatsapp" };
  }

  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id, client_id, phone, source")
    .eq("id", opts.leadId)
    .maybeSingle();

  if (!lead) {
    return { ok: false, error: "Lead not found", errorCode: "NOT_FOUND", channel: "whatsapp" };
  }
  if (lead.source !== "WHATSAPP_INBOUND") {
    return {
      ok: false,
      error: "Not a WhatsApp conversation",
      errorCode: "INVALID_SOURCE",
      channel: "whatsapp",
    };
  }
  if (!lead.phone) {
    return { ok: false, error: "Lead has no phone number", errorCode: "NO_PHONE", channel: "whatsapp" };
  }

  const clientId = lead.client_id as string;
  const connection = await getSafeWhatsAppConnection(clientId);
  if (!connection.connected) {
    return {
      ok: false,
      error: "WhatsApp connection is offline",
      errorCode: "CONNECTION_UNAVAILABLE",
      channel: "whatsapp",
    };
  }

  if (connection.capabilities.messagingWindow && !(await isWhatsAppSessionOpen(opts.leadId))) {
    return {
      ok: false,
      error: "Photos, videos, and files can only be sent while the customer conversation is open (24 hours).",
      errorCode: "SESSION_CLOSED",
      channel: "whatsapp",
    };
  }

  let storageKey = opts.storageKey?.trim() || "";
  let publicUrl = "";

  if (opts.buffer) {
    if (!isR2Configured()) {
      if (connection.providerType === "TEMPORARY_WEB") {
        return {
          ok: false,
          error: "File storage is not configured, so attachments cannot be sent.",
          errorCode: "STORAGE_UNAVAILABLE",
          channel: "whatsapp",
        };
      }
    } else {
      storageKey = generateWhatsAppOutboundKey(clientId, opts.leadId, validated.filename);
      await putObject(storageKey, opts.buffer, validated.mimeType);
      publicUrl = getPublicUrl(storageKey);
    }
  } else if (storageKey) {
    if (!isR2Configured()) {
      return {
        ok: false,
        error: "File storage is not configured, so attachments cannot be sent.",
        errorCode: "STORAGE_UNAVAILABLE",
        channel: "whatsapp",
      };
    }
    publicUrl = getPublicUrl(storageKey);
  } else {
    return { ok: false, error: "File is required", errorCode: "MISSING_FILE", channel: "whatsapp" };
  }

  let mediaId: string | null = null;
  if (opts.buffer && connection.providerType !== "TEMPORARY_WEB") {
    const upload = await uploadWhatsAppMedia({
      clientId,
      buffer: opts.buffer,
      mimeType: validated.mimeType,
      filename: validated.filename,
    });
    if (upload.ok) mediaId = upload.id;
  }

  if (!publicUrl && !mediaId) {
    return {
      ok: false,
      error: "Could not store the file for WhatsApp. Check file storage settings.",
      errorCode: "STORAGE_UNAVAILABLE",
      channel: "whatsapp",
    };
  }

  const body = placeholderBodyForMedia(validated.messageType, validated.filename, opts.caption);
  const result = await sendCanonicalWhatsAppMedia({
    clientId,
    leadId: opts.leadId,
    to: lead.phone as string,
    body,
    filename: validated.filename,
    mimeType: validated.mimeType,
    url: publicUrl || mediaId || "",
    messageType: validated.messageType,
    actorId: opts.actorId,
    actorName: opts.actorName,
    actorRole: opts.actorRole,
    mediaId,
    mediaStorageKey: storageKey || null,
  });

  return { ...result, messageType: validated.messageType };
}
