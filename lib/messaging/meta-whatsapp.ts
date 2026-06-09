import type { CountryCode } from "libphonenumber-js";
import { normalizeToE164 } from "@/lib/phone-validate";
import { getFacebookGraphBase } from "@/lib/facebook/graph";
import { fbLog } from "@/lib/facebook/log";
import { logMessage, type LogMessageParams, type SendResult } from "@/lib/messaging/log";

// ---------------------------------------------------------------------------
// Meta WhatsApp template registry — approved segmiq_* names (hardcoded).
// Body placeholders are 1-indexed; URL buttons use urlButtonParam (suffix only).
//
// URL button bases in Meta Business Manager (production):
//   CRM (segmiq.com):  /l/{{token}}  magic links
//                      /d/{{slug}}   manager dashboard (weekly digest)
//                      /{{path}}     billing → client/billing
//   Cloud:             cloud.segmiq.com/{{slug}}  send-asset templates
// Set NEXT_PUBLIC_SITE_URL=https://segmiq.com so getPublicBaseUrl() matches.
// ---------------------------------------------------------------------------

const TEMPLATE_LANGUAGE = "en_US";

export type TemplateKey =
  | "LEAD_CONFIRMATION_PROSPECT"
  | "MAGIC_LINK"
  | "MAGIC_LINK_RENEWAL"
  | "NEW_LEAD"
  | "SLA_BREACH"
  | "FOLLOW_UP_REMINDER"
  | "DAILY_COACHING"
  | "SALESPERSON_ONBOARDING"
  | "SEND_PORTFOLIO"
  | "SEND_PROJECT"
  | "SEND_PRICING_PACKAGE"
  | "SEND_TESTIMONIALS"
  | "SEND_DOCUMENT"
  | "SEND_CUSTOM_MESSAGE"
  | "WEEKLY_DIGEST"
  | "INVOICE_ISSUED"
  | "PAYMENT_OVERDUE"
  | "PAYMENT_CONFIRMED"
  | "BULK_LEADS_ASSIGNED";

const TEMPLATE_NAMES: Record<TemplateKey, string> = {
  LEAD_CONFIRMATION_PROSPECT: "segmiq_lead_confirmation",
  MAGIC_LINK: "segmiq_magic_link",
  MAGIC_LINK_RENEWAL: "segmiq_magic_link_renewal",
  NEW_LEAD: "segmiq_new_lead",
  SLA_BREACH: "segmiq_sla_breach",
  FOLLOW_UP_REMINDER: "segmiq_follow_up_reminder",
  DAILY_COACHING: "segmiq_daily_coaching",
  SALESPERSON_ONBOARDING: "segmiq_salesperson_onboarding",
  SEND_PORTFOLIO: "segmiq_send_portfolio",
  SEND_PROJECT: "segmiq_send_project",
  SEND_PRICING_PACKAGE: "segmiq_send_pricing",
  SEND_TESTIMONIALS: "segmiq_send_testimonials",
  SEND_DOCUMENT: "segmiq_send_document",
  SEND_CUSTOM_MESSAGE: "segmiq_send_custom",
  WEEKLY_DIGEST: "segmiq_weekly_digest",
  INVOICE_ISSUED: "segmiq_invoice_issued",
  PAYMENT_OVERDUE: "segmiq_payment_overdue",
  PAYMENT_CONFIRMED: "segmiq_payment_confirmed",
  BULK_LEADS_ASSIGNED: "segmiq_leads_assigned",
};

export type SendWhatsAppParams = {
  to: string | null | undefined;
  toOverride?: string | null;
  template: TemplateKey;
  variables: Record<string, string>;
  fallbackBody: string;
  /** Dynamic suffix for a URL button (index 0). Omit when the template has no button. */
  urlButtonParam?: string | null;
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

  const templateName = TEMPLATE_NAMES[params.template];
  const languageCode = TEMPLATE_LANGUAGE;

  const orderedKeys = Object.keys(params.variables).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  const parameters = orderedKeys.map((key) => ({
    type: "text" as const,
    text: params.variables[key] ?? "",
  }));

  const components: Record<string, unknown>[] = [];
  if (parameters.length > 0) {
    components.push({ type: "body", parameters });
  }
  const urlSuffix = params.urlButtonParam?.trim();
  if (urlSuffix) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: urlSuffix }],
    });
  }

  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalized.replace(/^\+/, ""),
    type: "template",
    template: {
      name: templateName,
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
      error?: { code?: number; message?: string; error_subcode?: number; type?: string };
      messages?: { id?: string }[];
    };

    if (!res.ok || data.error) {
      const err = data.error || { code: res.status, message: `HTTP ${res.status}` };
      fbLog("fb.whatsapp.send_failed", {
        template: params.template,
        templateName,
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
      fbLog("fb.whatsapp.sent", { template: params.template, templateName, recipient: normalized, providerId });
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
