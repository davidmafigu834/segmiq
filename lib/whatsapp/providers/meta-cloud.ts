import type { CountryCode } from "libphonenumber-js";
import { getFacebookGraphBase } from "@/lib/facebook/graph";
import { fbLog } from "@/lib/facebook/log";
import { normalizeToE164 } from "@/lib/phone-validate";
import { resolveWhatsAppSendConfig } from "../credentials";
import { metaCloudMediaType } from "../outbound-media";
import { getWhatsAppCapabilities } from "./capabilities";
import type { ProviderSendMediaInput, ProviderSendResult, WhatsAppProvider } from "./types";

export const metaCloudWhatsAppProvider: WhatsAppProvider = {
  type: "META_CLOUD",
  capabilities: getWhatsAppCapabilities("META_CLOUD"),
  async sendText(input): Promise<ProviderSendResult> {
    const country = (process.env.DEFAULT_COUNTRY_CODE || "ZW").toUpperCase() as CountryCode;
    const normalized = normalizeToE164(input.to, country);
    if (!normalized) return { ok: false, error: "Invalid phone number", errorCode: "INVALID_PHONE" };
    const config = await resolveWhatsAppSendConfig(input.clientId);
    if (!config) {
      return { ok: false, error: "WhatsApp is not configured for this company", errorCode: "NOT_CONFIGURED" };
    }
    try {
      const response = await fetch(`${getFacebookGraphBase()}/${config.phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: normalized.replace(/^\+/, ""),
          type: "text",
          text: { body: input.body },
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        messages?: Array<{ id?: string }>;
        error?: { code?: number; message?: string };
      };
      if (!response.ok || data.error) {
        const error = data.error ?? { code: response.status, message: `HTTP ${response.status}` };
        fbLog("fb.whatsapp.send_failed", { recipient: normalized, message: error.message });
        return { ok: false, error: error.message ?? "Send failed", errorCode: error.code };
      }
      const providerId = data.messages?.[0]?.id;
      fbLog("fb.whatsapp.sent", { recipient: normalized, providerId });
      return { ok: true, providerId };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "WhatsApp network error",
        errorCode: "NETWORK",
      };
    }
  },
  async sendDocument(input): Promise<ProviderSendResult> {
    return sendMetaCloudMedia({ ...input, messageType: "document" });
  },
  async sendMedia(input): Promise<ProviderSendResult> {
    return sendMetaCloudMedia(input);
  },
};

async function sendMetaCloudMedia(input: ProviderSendMediaInput): Promise<ProviderSendResult> {
  const country = (process.env.DEFAULT_COUNTRY_CODE || "ZW").toUpperCase() as CountryCode;
  const normalized = normalizeToE164(input.to, country);
  if (!normalized) return { ok: false, error: "Invalid phone number", errorCode: "INVALID_PHONE" };
  const config = await resolveWhatsAppSendConfig(input.clientId);
  if (!config) {
    return { ok: false, error: "WhatsApp is not configured for this company", errorCode: "NOT_CONFIGURED" };
  }

  const messageType = metaCloudMediaType(input.mimeType, input.messageType);
  const caption = input.body.trim() || undefined;
  const mediaId = input.mediaId?.trim();
  const media =
    messageType === "image"
      ? mediaId
        ? { id: mediaId, caption }
        : { link: input.url, caption }
      : messageType === "video"
        ? mediaId
          ? { id: mediaId, caption }
          : { link: input.url, caption }
        : mediaId
          ? { id: mediaId, caption, filename: input.filename }
          : { link: input.url, caption, filename: input.filename };

  try {
    const response = await fetch(`${getFacebookGraphBase()}/${config.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: normalized.replace(/^\+/, ""),
        type: messageType,
        [messageType]: media,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
      error?: { code?: number; message?: string };
    };
    if (!response.ok || data.error) {
      const error = data.error ?? { code: response.status, message: `HTTP ${response.status}` };
      fbLog("fb.whatsapp.send_failed", { recipient: normalized, message: error.message, type: messageType });
      return { ok: false, error: error.message ?? "Send failed", errorCode: error.code };
    }
    const providerId = data.messages?.[0]?.id;
    fbLog("fb.whatsapp.sent", { recipient: normalized, providerId, type: messageType });
    return { ok: true, providerId };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "WhatsApp network error",
      errorCode: "NETWORK",
    };
  }
}

// The transport is intentionally shared until Meta's coexistence flow is
// implemented, while preserving a distinct canonical provider identity for
// connection records and future migration.
export const metaCoexistenceWhatsAppProvider: WhatsAppProvider = {
  ...metaCloudWhatsAppProvider,
  type: "META_COEXISTENCE",
  capabilities: getWhatsAppCapabilities("META_COEXISTENCE"),
};
