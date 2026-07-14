import type { CountryCode } from "libphonenumber-js";
import { normalizeToE164 } from "@/lib/phone-validate";
import { getFacebookGraphBase } from "@/lib/facebook/graph";
import { fbLog } from "@/lib/facebook/log";
import { logMessage, type LogMessageParams, type SendResult } from "@/lib/messaging/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { logLeadEvent } from "@/lib/lead-events";
import { resolveWhatsAppSendConfig } from "@/lib/whatsapp/credentials";
import { persistOutboundWhatsAppMessage } from "@/lib/whatsapp/persist-outbound";
import { isValidActorUuid } from "@/lib/whatsapp/qualification-answers";

export type SendSessionMessageParams = {
  to: string;
  body: string;
  clientId: string;
  leadId: string;
  actorId?: string | null;
  actorName: string;
  actorRole?: string;
  phoneNumberId?: string | null;
};

export async function sendWhatsAppSessionMessage(
  params: SendSessionMessageParams
): Promise<SendResult & { channel: "whatsapp" }> {
  const defaultCc = (process.env.DEFAULT_COUNTRY_CODE || "ZW").toUpperCase() as CountryCode;
  const normalized = normalizeToE164(params.to, defaultCc);
  const logRecipient = normalized ?? params.to;
  const actorId = isValidActorUuid(params.actorId) ? params.actorId : null;
  const actorRole = params.actorRole ?? (actorId ? "SALESPERSON" : "SYSTEM");

  const baseContext: LogMessageParams = {
    userId: actorId,
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

  const supabase = createAdminClient();
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

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalized.replace(/^\+/, ""),
    type: "text",
    text: { body: params.body },
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
      fbLog("fb.whatsapp.send_failed", { recipient: normalized, message: err.message });
      const authFailed =
        err.code === 190 ||
        /authentication error|invalid oauth access token|cannot parse access token/i.test(err.message ?? "");
      out = {
        ok: false,
        error: authFailed
          ? "WhatsApp access token is invalid or expired — clear the token in Client Settings → WhatsApp to use the platform token, or paste a fresh token from Meta."
          : err.message || "Send failed",
        errorCode: err.code,
      };
    } else {
      out = { ok: true, providerId: data.messages?.[0]?.id };
      fbLog("fb.whatsapp.sent", { recipient: normalized, providerId: out.providerId });
    }
  } catch (err: unknown) {
    const e = err as { message?: string };
    out = { ok: false, error: e.message || "Network error", errorCode: "NETWORK" };
  }

  await logMessage(out, baseContext);

  if (out.ok) {
    const now = new Date().toISOString();
    await persistOutboundWhatsAppMessage({
      clientId: params.clientId,
      leadId: params.leadId,
      phone: normalized,
      body: params.body,
      actorId,
      providerId: out.providerId ?? null,
    });

    await logLeadEvent({
      leadId: params.leadId,
      clientId: params.clientId,
      actor: { id: actorId, name: params.actorName, role: actorRole },
      eventType: "MESSAGE_SENT",
      eventData: { body: params.body, provider_id: out.providerId ?? null },
      channel: "whatsapp",
    });

    await supabase.from("leads").update({ updated_at: now }).eq("id", params.leadId);
  }

  return { ...out, channel: "whatsapp" };
}
