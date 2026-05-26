/**
 * @deprecated Segmiq migrated to Meta WhatsApp Cloud API (April 2026).
 * Kept for reference and optional rollback: import `sendWhatsApp` from `@/lib/messaging/provider` instead.
 * Do not use in new code.
 */
import twilio from "twilio";
import type { CountryCode } from "libphonenumber-js";
import { normalizeToE164 } from "@/lib/phone-validate";
import { logMessage, type LogMessageParams, type SendResult } from "@/lib/messaging/log";

export type TemplateKey =
  | "NEW_LEAD_SALESPERSON"
  | "NEW_LEAD_MANAGER"
  | "DEAL_WON"
  | "FOLLOW_UP_REMINDER"
  | "UNCONTACTED_LEAD_ALERT"
  | "MAGIC_LINK_RENEWAL";

const TEMPLATE_ENV_KEYS: Record<TemplateKey, string> = {
  NEW_LEAD_SALESPERSON: "TWILIO_CONTENT_SID_NEW_LEAD_SALESPERSON",
  NEW_LEAD_MANAGER: "TWILIO_CONTENT_SID_NEW_LEAD_MANAGER",
  DEAL_WON: "TWILIO_CONTENT_SID_DEAL_WON",
  FOLLOW_UP_REMINDER: "TWILIO_CONTENT_SID_FOLLOW_UP_REMINDER",
  UNCONTACTED_LEAD_ALERT: "TWILIO_CONTENT_SID_UNCONTACTED_LEAD_ALERT",
  MAGIC_LINK_RENEWAL: "TWILIO_CONTENT_SID_MAGIC_LINK_RENEWAL",
};

type TwilioClient = ReturnType<typeof twilio>;

function getClient(): TwilioClient | null {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

function normalizeWhatsAppFrom(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (t.toLowerCase().startsWith("whatsapp:")) return t;
  if (t.startsWith("+")) return `whatsapp:${t}`;
  return `whatsapp:${t}`;
}

export type SendWhatsAppParams = {
  /** Stored phone (may be local format); normalized with DEFAULT_COUNTRY_CODE */
  to: string | null | undefined;
  /** When set (e.g. client test override), used instead of `to` after normalization */
  toOverride?: string | null;
  template: TemplateKey;
  variables: Record<string, string>;
  fallbackBody: string;
  context: Omit<LogMessageParams, "channel" | "recipient" | "templateKey" | "payloadPreview"> & {
    /** Raw recipient for logs when normalization fails */
    rawRecipientForLog?: string;
  };
};

export async function sendWhatsApp(params: SendWhatsAppParams): Promise<SendResult & { channel: "whatsapp" }> {
  const rawInput = (params.toOverride?.trim() || params.to?.trim() || "") || null;
  const defaultCc = (process.env.DEFAULT_COUNTRY_CODE || "US").toUpperCase() as CountryCode;
  const normalized = normalizeToE164(rawInput, defaultCc);

  const logRecipient = normalized ?? params.context.rawRecipientForLog ?? rawInput ?? "(empty)";
  const baseContext: LogMessageParams = {
    userId: params.context.userId,
    leadId: params.context.leadId,
    clientId: params.context.clientId,
    channel: "whatsapp",
    notificationType: params.context.notificationType,
    recipient: logRecipient,
    templateKey: params.template,
    payloadPreview: params.fallbackBody,
  };

  if (!rawInput) {
    const result: SendResult = {
      ok: false,
      error: "No phone number",
      errorCode: "SKIPPED_NO_PHONE",
    };
    await logMessage(result, baseContext);
    return { ...result, channel: "whatsapp" };
  }

  if (!normalized) {
    const result: SendResult = {
      ok: false,
      error: "Invalid phone number",
      errorCode: "INVALID_PHONE",
    };
    await logMessage(result, { ...baseContext, recipient: rawInput });
    console.warn(
      JSON.stringify({
        ts: new Date().toISOString(),
        event: "notification.whatsapp.skipped_invalid_phone",
        notificationType: params.context.notificationType,
        raw: rawInput,
      })
    );
    return { ...result, channel: "whatsapp" };
  }

  const client = getClient();
  const fromRaw = process.env.TWILIO_WHATSAPP_FROM;
  const from = fromRaw ? normalizeWhatsAppFrom(fromRaw) : null;

  if (!client) {
    const result: SendResult = { ok: false, error: "Twilio not configured", errorCode: "NO_CLIENT" };
    await logMessage(result, { ...baseContext, recipient: normalized });
    return { ...result, channel: "whatsapp" };
  }
  if (!from) {
    const result: SendResult = { ok: false, error: "TWILIO_WHATSAPP_FROM not set", errorCode: "NO_FROM" };
    await logMessage(result, { ...baseContext, recipient: normalized });
    return { ...result, channel: "whatsapp" };
  }

  const envKey = TEMPLATE_ENV_KEYS[params.template];
  const contentSid = (process.env[envKey] || "").trim();

  const toAddr = `whatsapp:${normalized}`;

  const payload: Record<string, unknown> = {
    from,
    to: toAddr,
  };

  if (contentSid) {
    payload.contentSid = contentSid;
    payload.contentVariables = JSON.stringify(params.variables);
  } else {
    console.warn(
      JSON.stringify({
        ts: new Date().toISOString(),
        event: "notification.template.fallback_body",
        template: params.template,
        envKey,
        hint: "Set content SID for production WhatsApp; sandbox may use freeform body.",
      })
    );
    payload.body = params.fallbackBody;
  }

  try {
    const msg = await client.messages.create(payload as never);
    const result: SendResult = { ok: true, providerId: msg.sid };
    await logMessage(result, { ...baseContext, recipient: normalized });
    return { ...result, channel: "whatsapp" };
  } catch (err: unknown) {
    const e = err as { message?: string; code?: number };
    const result: SendResult = {
      ok: false,
      error: e.message || "Twilio send failed",
      errorCode: e.code,
    };
    await logMessage(result, { ...baseContext, recipient: normalized });
    return { ...result, channel: "whatsapp" };
  }
}
