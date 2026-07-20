import type { CountryCode } from "libphonenumber-js";
import { normalizeToE164 } from "@/lib/phone-validate";
import { resolveWhatsAppRecipient } from "@/lib/messaging/recipient";
import { getFacebookGraphBase } from "@/lib/facebook/graph";
import { fbLog } from "@/lib/facebook/log";
import { logMessage, type LogMessageParams, type SendResult } from "@/lib/messaging/log";
import { resolveWhatsAppSendConfig } from "@/lib/whatsapp/credentials";

export type SendCampaignTemplateParams = {
  to: string;
  templateName: string;
  language: string;
  variables: Record<string, string>;
  components?: Record<string, unknown>[];
  fallbackBody: string;
  context: Omit<LogMessageParams, "channel" | "recipient" | "templateKey" | "payloadPreview"> & {
    rawRecipientForLog?: string;
  };
};

/**
 * Send an approved WhatsApp template by name (Marketing Hub campaigns).
 * Unlike sendWhatsAppViaMeta, this accepts dynamic template names per client WABA.
 */
export async function sendCampaignTemplate(
  params: SendCampaignTemplateParams
): Promise<SendResult & { channel: "whatsapp" }> {
  const defaultCc = (process.env.DEFAULT_COUNTRY_CODE || "ZW").toUpperCase() as CountryCode;
  const rawInput = resolveWhatsAppRecipient(params.to, null, defaultCc);
  const normalized = normalizeToE164(rawInput, defaultCc);
  const logRecipient = normalized ?? params.context.rawRecipientForLog ?? rawInput ?? "(empty)";

  const baseContext: LogMessageParams = {
    userId: params.context.userId,
    leadId: params.context.leadId,
    clientId: params.context.clientId,
    channel: "whatsapp",
    notificationType: params.context.notificationType,
    recipient: logRecipient,
    templateKey: params.templateName,
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
    return { ...result, channel: "whatsapp" };
  }

  const waConfig = await resolveWhatsAppSendConfig(params.context.clientId);
  if (!waConfig) {
    const result: SendResult = {
      ok: false,
      error: "WhatsApp not configured for this client",
      errorCode: "NOT_CONFIGURED",
    };
    await logMessage(result, { ...baseContext, recipient: normalized });
    return { ...result, channel: "whatsapp" };
  }

  const { phoneNumberId, accessToken } = waConfig;
  const languageCode = params.language?.trim() || "en";

  const orderedKeys = Object.keys(params.variables).sort(
    (a, b) => parseInt(a, 10) - parseInt(b, 10)
  );
  const bodyParameters = orderedKeys.map((key) => ({
    type: "text" as const,
    text: params.variables[key] ?? "",
  }));

  const components: Record<string, unknown>[] = [...(params.components ?? [])];
  if (bodyParameters.length > 0 && !components.some((c) => c.type === "body")) {
    components.unshift({ type: "body", parameters: bodyParameters });
  }

  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalized.replace(/^\+/, ""),
    type: "template",
    template: {
      name: params.templateName,
      language: { code: languageCode },
      ...(components.length > 0 ? { components } : {}),
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
      error?: { code?: number; message?: string; error_subcode?: number };
      messages?: { id?: string }[];
    };

    if (!res.ok || data.error) {
      const err = data.error || { code: res.status, message: `HTTP ${res.status}` };
      fbLog("fb.whatsapp.send_failed", {
        templateName: params.templateName,
        recipient: normalized,
        code: err.code,
        message: err.message,
      });
      out = {
        ok: false,
        error: err.message || "Meta WhatsApp send failed",
        errorCode: err.code,
      };
    } else {
      const providerId = data.messages?.[0]?.id;
      fbLog("fb.whatsapp.sent", {
        templateName: params.templateName,
        notificationType: "WHATSAPP_CAMPAIGN",
        recipient: normalized,
        providerId,
      });
      out = { ok: true, providerId };
    }
  } catch (err: unknown) {
    const e = err as { name?: string; message?: string };
    const isTimeout = e.name === "AbortError";
    out = {
      ok: false,
      error: isTimeout ? "Request timed out" : e.message || "Network error",
      errorCode: isTimeout ? "TIMEOUT" : "NETWORK",
    };
  }

  await logMessage(out, { ...baseContext, recipient: normalized });
  return { ...out, channel: "whatsapp" };
}
