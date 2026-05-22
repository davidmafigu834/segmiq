import type { CountryCode } from "libphonenumber-js";
import { normalizeToE164 } from "@/lib/phone-validate";
import { getFacebookGraphBase } from "@/lib/facebook/graph";
import { fbLog } from "@/lib/facebook/log";
import { logMessage, type LogMessageParams, type SendResult } from "@/lib/messaging/log";

export type TemplateKey =
  | "NEW_LEAD_SALESPERSON"
  | "NEW_LEAD_MANAGER"
  | "DEAL_WON"
  | "FOLLOW_UP_REMINDER"
  | "UNCONTACTED_LEAD_ALERT"
  | "MAGIC_LINK_RENEWAL";

const TEMPLATE_ENV_KEYS: Record<TemplateKey, string> = {
  NEW_LEAD_SALESPERSON: "META_TEMPLATE_NEW_LEAD_SALESPERSON",
  NEW_LEAD_MANAGER: "META_TEMPLATE_NEW_LEAD_MANAGER",
  DEAL_WON: "META_TEMPLATE_DEAL_WON",
  FOLLOW_UP_REMINDER: "META_TEMPLATE_FOLLOW_UP_REMINDER",
  UNCONTACTED_LEAD_ALERT: "META_TEMPLATE_UNCONTACTED_LEAD_ALERT",
  MAGIC_LINK_RENEWAL: "META_TEMPLATE_MAGIC_LINK_RENEWAL",
};

export type SendWhatsAppParams = {
  to: string | null | undefined;
  toOverride?: string | null;
  template: TemplateKey;
  variables: Record<string, string>;
  fallbackBody: string;
  context: Omit<LogMessageParams, "channel" | "recipient" | "templateKey" | "payloadPreview"> & {
    rawRecipientForLog?: string;
  };
};

/**
 * Outbound WhatsApp via Meta Cloud API (Graph `/PHONE_NUMBER_ID/messages`).
 * Uses approved message templates; `fallbackBody` is for logs / debugging only.
 */
export async function sendWhatsAppViaMeta(
  params: SendWhatsAppParams
): Promise<SendResult & { channel: "whatsapp" }> {
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

  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim();
  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN?.trim();
  if (!phoneNumberId || !accessToken) {
    const result: SendResult = {
      ok: false,
      error: "Meta WhatsApp not configured",
      errorCode: "NOT_CONFIGURED",
    };
    await logMessage(result, { ...baseContext, recipient: normalized });
    return { ...result, channel: "whatsapp" };
  }

  const envKey = TEMPLATE_ENV_KEYS[params.template];
  const templateName = (process.env[envKey] || "").trim();
  const languageCode = (process.env.META_TEMPLATE_LANGUAGE || "en_US").trim();

  if (!templateName) {
    const result: SendResult = {
      ok: false,
      error: `Meta template name not set for ${envKey}`,
      errorCode: "NO_TEMPLATE",
    };
    await logMessage(result, { ...baseContext, recipient: normalized });
    fbLog("fb.whatsapp.send_failed", { template: params.template, error: "missing template name env" });
    return { ...result, channel: "whatsapp" };
  }

  const orderedKeys = Object.keys(params.variables).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  const parameters = orderedKeys.map((key) => ({
    type: "text" as const,
    text: params.variables[key] ?? "",
  }));

  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalized.replace(/^\+/, ""),
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(parameters.length > 0
        ? { components: [{ type: "body" as const, parameters }] }
        : {}),
    },
  };

  const url = `${getFacebookGraphBase()}/${phoneNumberId}/messages`;

  let out: SendResult;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = (await res.json().catch(() => ({}))) as {
      error?: { code?: number; message?: string; error_subcode?: number; type?: string };
      messages?: { id?: string }[];
    };

    if (!res.ok || data.error) {
      const err = data.error || { code: res.status, message: `HTTP ${res.status}` };
      fbLog("fb.whatsapp.send_failed", {
        template: params.template,
        recipient: normalized,
        code: err.code,
        subcode: err.error_subcode,
        message: err.message,
      });
      out = {
        ok: false,
        error: err.message || "Meta WhatsApp send failed",
        errorCode: err.code,
      };
    } else {
      const providerId = data.messages?.[0]?.id;
      fbLog("fb.whatsapp.sent", { template: params.template, recipient: normalized, providerId });
      out = { ok: true, providerId };
    }
  } catch (err: unknown) {
    const e = err as { name?: string; message?: string };
    const isTimeout = e.name === "AbortError";
    fbLog("fb.whatsapp.send_exception", {
      template: params.template,
      recipient: normalized,
      error: e.message,
      isTimeout,
    });
    out = {
      ok: false,
      error: isTimeout ? "Request timed out" : e.message || "Network error",
      errorCode: isTimeout ? "TIMEOUT" : "NETWORK",
    };
  }

  await logMessage(out, { ...baseContext, recipient: normalized });
  return { ...out, channel: "whatsapp" };
}
