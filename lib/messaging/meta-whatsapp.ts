import type { CountryCode } from "libphonenumber-js";
import { normalizeToE164 } from "@/lib/phone-validate";
import { getFacebookGraphBase } from "@/lib/facebook/graph";
import { fbLog } from "@/lib/facebook/log";
import { logMessage, type LogMessageParams, type SendResult } from "@/lib/messaging/log";

// ---------------------------------------------------------------------------
// Template registry
// ---------------------------------------------------------------------------
// IMPORTANT: All templates must be submitted to Meta Business Manager for
// approval before they will work in production.
//
// Template name: segmiq_lead_confirmation
// Category:      UTILITY
// Language:      English (en_US)
// Body:
//   Hi {{1}}, thank you for reaching out to {{2}}.
//
//   We have received your inquiry about {{3}} and our team will be in touch
//   with you within {{4}} hours.
//
//   While you wait, you can view our completed projects and client testimonials here:
//   {{5}}
//
//   We look forward to speaking with you.
//
// Variables:
//   {{1}} — lead first name
//   {{2}} — company name
//   {{3}} — service or project type they enquired about
//   {{4}} — response time in hours from client SLA settings
//   {{5}} — company portfolio URL
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Send-asset templates — UTILITY category, English (en_US)
// Submit all to Meta Business Manager for approval before use in production.
//
// segmiq_send_portfolio:
//   Hi {{1}}, here are some of our completed projects from {{2}}. You can browse our full portfolio here:
//   {{3}}
//   Let us know if you have any questions.
//
// segmiq_send_project:
//   Hi {{1}}, {{2}} wanted to share a project with you that may be relevant to what you are looking for.
//   {{3}}
//   {{4}}
//   Take a look and let us know your thoughts.
//
// segmiq_send_pricing:
//   Hi {{1}}, here are the pricing details for the {{3}} package from {{2}}:
//   Price: {{4}}
//   What is included:
//   {{5}}
//   You can view our full portfolio here: {{6}}
//   Let us know if you have any questions.
//
// segmiq_send_testimonials:
//   Hi {{1}}, {{2}} wanted to share what some of our clients have said about working with us:
//   {{3}}
//   We look forward to speaking with you.
//
// segmiq_send_document:
//   Hi {{1}}, {{2}} has shared the following document with you:
//   {{3}}
//   {{4}}
//   Let us know if you need anything else.
//
// segmiq_send_custom:
//   Hi {{1}}, a message from {{2}}:
//   {{3}}
//
// Billing templates (UTILITY) — see docs/meta-whatsapp-billing-templates.md
// Gate sends with META_TEMPLATE_INVOICE_ISSUED / PAYMENT_OVERDUE / PAYMENT_CONFIRMED.
//
// segmiq_invoice_issued — body {{1}} invoice #, {{2}} amount, {{3}} due date; URL button → client/billing
// segmiq_payment_overdue — body {{1}} invoice #, {{2}} amount, {{3}} days until suspension; URL button
// segmiq_payment_confirmed — body {{1}} invoice #, {{2}} amount, {{3}} next renewal; URL button
// ---------------------------------------------------------------------------

export type TemplateKey =
  | "NEW_LEAD_SALESPERSON"
  | "NEW_LEAD_MANAGER"
  | "DEAL_WON"
  | "FOLLOW_UP_REMINDER"
  | "UNCONTACTED_LEAD_ALERT"
  | "MAGIC_LINK_RENEWAL"
  | "LEAD_CONFIRMATION_PROSPECT"
  | "BULK_LEADS_ASSIGNED"
  | "SEND_PORTFOLIO"
  | "SEND_PROJECT"
  | "SEND_PRICING_PACKAGE"
  | "SEND_TESTIMONIALS"
  | "SEND_DOCUMENT"
  | "SEND_CUSTOM_MESSAGE"
  | "DAILY_COACHING"
  | "SALESPERSON_ONBOARDING"
  | "INVOICE_ISSUED"
  | "PAYMENT_OVERDUE"
  | "PAYMENT_CONFIRMED";

const TEMPLATE_NAMES: Record<TemplateKey, string> = {
  NEW_LEAD_SALESPERSON: "new_lead_salesperson",
  NEW_LEAD_MANAGER: "new_lead_manager",
  DEAL_WON: "deal_won",
  FOLLOW_UP_REMINDER: "follow_up_reminder",
  UNCONTACTED_LEAD_ALERT: "uncontacted_lead_alert",
  MAGIC_LINK_RENEWAL: "magic_link_renewal",
  LEAD_CONFIRMATION_PROSPECT: "segmiq_lead_confirmation",
  BULK_LEADS_ASSIGNED: "segmiq_leads_assigned",
  SEND_PORTFOLIO: "segmiq_send_portfolio",
  SEND_PROJECT: "segmiq_send_project",
  SEND_PRICING_PACKAGE: "segmiq_send_pricing",
  SEND_TESTIMONIALS: "segmiq_send_testimonials",
  SEND_DOCUMENT: "segmiq_send_document",
  SEND_CUSTOM_MESSAGE: "segmiq_send_custom",
  DAILY_COACHING: "segmiq_daily_coaching",
  SALESPERSON_ONBOARDING: "segmiq_salesperson_onboarding",
  INVOICE_ISSUED: "segmiq_invoice_issued",
  PAYMENT_OVERDUE: "segmiq_payment_overdue",
  PAYMENT_CONFIRMED: "segmiq_payment_confirmed",
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
  const languageCode = (process.env.META_TEMPLATE_LANGUAGE || "en_US").trim();


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
