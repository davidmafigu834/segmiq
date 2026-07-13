import type { CountryCode } from "libphonenumber-js";
import { normalizeToE164 } from "@/lib/phone-validate";
import { getFacebookGraphBase } from "@/lib/facebook/graph";
import { fbLog } from "@/lib/facebook/log";
import { logMessage, type LogMessageParams, type SendResult } from "@/lib/messaging/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { logLeadEvent } from "@/lib/lead-events";
import { resolveWhatsAppSendConfig } from "@/lib/whatsapp/credentials";
import { persistOutboundWhatsAppMessage } from "@/lib/whatsapp/persist-outbound";

export type SendSessionDocumentParams = {
  to: string;
  body: string;
  clientId: string;
  leadId: string;
  actorId: string;
  actorName: string;
  filename: string;
  mediaId?: string | null;
  link?: string | null;
};

export async function uploadWhatsAppMedia(opts: {
  clientId: string;
  buffer: Buffer;
  mimeType: string;
  filename: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const waConfig = await resolveWhatsAppSendConfig(opts.clientId);
  if (!waConfig) {
    return { ok: false, error: "WhatsApp not configured for this client" };
  }

  const { phoneNumberId, accessToken } = waConfig;
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", opts.mimeType);
  form.append("file", new Blob([new Uint8Array(opts.buffer)], { type: opts.mimeType }), opts.filename);

  try {
    const res = await fetch(`${getFacebookGraphBase()}/${phoneNumberId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      error?: { message?: string; code?: number };
    };
    if (!res.ok || !data.id) {
      return {
        ok: false,
        error: data.error?.message || "Failed to upload document to WhatsApp",
      };
    }
    return { ok: true, id: data.id };
  } catch (err: unknown) {
    const e = err as { message?: string };
    return { ok: false, error: e.message || "Failed to upload document to WhatsApp" };
  }
}

export async function sendWhatsAppSessionDocument(
  params: SendSessionDocumentParams
): Promise<SendResult & { channel: "whatsapp" }> {
  const defaultCc = (process.env.DEFAULT_COUNTRY_CODE || "ZW").toUpperCase() as CountryCode;
  const normalized = normalizeToE164(params.to, defaultCc);
  const logRecipient = normalized ?? params.to;

  const baseContext: LogMessageParams = {
    userId: params.actorId,
    leadId: params.leadId,
    clientId: params.clientId,
    channel: "whatsapp",
    notificationType: "WHATSAPP_SESSION",
    recipient: logRecipient,
    templateKey: null,
    payloadPreview: params.body.slice(0, 240),
  };

  if (!normalized) {
    const result: SendResult = { ok: false, error: "Invalid phone number", errorCode: "INVALID_PHONE" };
    await logMessage(result, baseContext);
    return { ...result, channel: "whatsapp" };
  }

  const mediaId = params.mediaId?.trim();
  const link = params.link?.trim();
  if (!mediaId && !link) {
    const result: SendResult = {
      ok: false,
      error: "Document media id or public link is required",
      errorCode: "MISSING_DOCUMENT",
    };
    await logMessage(result, baseContext);
    return { ...result, channel: "whatsapp" };
  }

  const waConfig = await resolveWhatsAppSendConfig(params.clientId);
  if (!waConfig) {
    const result: SendResult = {
      ok: false,
      error: "WhatsApp not configured for this client — add Phone number ID in client settings",
      errorCode: "NOT_CONFIGURED",
    };
    await logMessage(result, baseContext);
    return { ...result, channel: "whatsapp" };
  }

  const { phoneNumberId, accessToken } = waConfig;
  const document = mediaId
    ? { id: mediaId, caption: params.body, filename: params.filename }
    : { link, caption: params.body, filename: params.filename };

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalized.replace(/^\+/, ""),
    type: "document",
    document,
  };

  const url = `${getFacebookGraphBase()}/${phoneNumberId}/messages`;
  let out: SendResult;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: { code?: number; message?: string };
      messages?: { id?: string }[];
    };

    if (!res.ok || data.error) {
      const err = data.error || { code: res.status, message: `HTTP ${res.status}` };
      fbLog("fb.whatsapp.send_failed", { recipient: normalized, message: err.message, type: "document" });
      out = {
        ok: false,
        error: err.message || "Send failed",
        errorCode: err.code,
      };
    } else {
      out = { ok: true, providerId: data.messages?.[0]?.id };
      fbLog("fb.whatsapp.sent", { recipient: normalized, providerId: out.providerId, type: "document" });
    }
  } catch (err: unknown) {
    const e = err as { message?: string };
    out = { ok: false, error: e.message || "Network error", errorCode: "NETWORK" };
  }

  await logMessage(out, baseContext);

  if (out.ok) {
    const supabase = createAdminClient();
    const now = new Date().toISOString();
    await persistOutboundWhatsAppMessage({
      clientId: params.clientId,
      leadId: params.leadId,
      phone: normalized,
      body: params.body,
      actorId: params.actorId,
      providerId: out.providerId ?? null,
      messageType: "document",
    });

    await logLeadEvent({
      leadId: params.leadId,
      clientId: params.clientId,
      actor: { id: params.actorId, name: params.actorName, role: "SALESPERSON" },
      eventType: "MESSAGE_SENT",
      eventData: {
        body: params.body,
        provider_id: out.providerId ?? null,
        message_type: "document",
        filename: params.filename,
      },
      channel: "whatsapp",
    });

    await supabase.from("leads").update({ updated_at: now }).eq("id", params.leadId);
  }

  return { ...out, channel: "whatsapp" };
}
