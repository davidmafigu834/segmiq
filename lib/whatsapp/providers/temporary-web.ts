import { callWhatsAppGateway } from "../gateway-client";
import { getWhatsAppCapabilities } from "./capabilities";
import type { ProviderSendResult, WhatsAppProvider } from "./types";

export const temporaryWebWhatsAppProvider: WhatsAppProvider = {
  type: "TEMPORARY_WEB",
  capabilities: getWhatsAppCapabilities("TEMPORARY_WEB"),
  async sendText(input): Promise<ProviderSendResult> {
    if (!input.connectionId) {
      return { ok: false, error: "Quick connection is unavailable", errorCode: "NOT_CONNECTED" };
    }
    try {
      return await callWhatsAppGateway<ProviderSendResult>({
        path: `/v1/connections/${encodeURIComponent(input.connectionId)}/messages/text`,
        body: { to: input.to, body: input.body, leadId: input.leadId },
      });
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Quick connection send failed",
        errorCode: "GATEWAY_UNAVAILABLE",
      };
    }
  },
  async sendDocument(input): Promise<ProviderSendResult> {
    if (!input.connectionId) {
      return { ok: false, error: "Quick connection is unavailable", errorCode: "NOT_CONNECTED" };
    }
    try {
      return await callWhatsAppGateway<ProviderSendResult>({
        path: `/v1/connections/${encodeURIComponent(input.connectionId)}/messages/document`,
        body: {
          to: input.to,
          body: input.body,
          leadId: input.leadId,
          filename: input.filename,
          mimeType: input.mimeType,
          url: input.url,
        },
      });
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Quick connection send failed",
        errorCode: "GATEWAY_UNAVAILABLE",
      };
    }
  },
};
