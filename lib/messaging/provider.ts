import { sendWhatsAppViaMeta, type SendWhatsAppParams } from "./meta-whatsapp";
import type { SendResult } from "@/lib/messaging/log";
import { resolveWhatsAppProvider } from "@/lib/whatsapp/providers/resolver";

export type { SendWhatsAppParams, TemplateKey } from "./meta-whatsapp";
export type { SendResult } from "@/lib/messaging/log";

/**
 * True when either Meta Cloud API (primary) or legacy Twilio is fully set for env checks.
 * Actual sends use `sendWhatsApp` → Meta only; flip `provider.ts` to Twilio to roll back.
 */
export function isWhatsAppDeliveryConfigured(): boolean {
  const meta =
    Boolean(process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim()) &&
    Boolean(process.env.META_WHATSAPP_ACCESS_TOKEN?.trim());
  if (meta) return true;
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

/**
 * Canonical WhatsApp send.
 * **Rollback to Twilio:** `import { sendWhatsApp as sendWhatsAppTwilio } from './twilio'` and `return sendWhatsAppTwilio(params)`.
 */
export async function sendWhatsApp(
  params: SendWhatsAppParams
): Promise<SendResult & { channel: "whatsapp" }> {
  // This entry point is used by template, campaign, reminder, and notification
  // workflows. A selected Quick connection is intentionally manual-only, so
  // never let those workflows silently fall through to legacy Meta credentials.
  const clientId = params.context.clientId;
  // Some platform-level notifications have no company transport scope.
  if (!clientId) return sendWhatsAppViaMeta(params);
  const { connection } = await resolveWhatsAppProvider(clientId);
  if (connection?.providerType === "TEMPORARY_WEB") {
    return {
      ok: false,
      error: "This WhatsApp connection doesn't support automated or broadcast messaging.",
      errorCode: "UNSUPPORTED",
      channel: "whatsapp",
    };
  }
  return sendWhatsAppViaMeta(params);
}
