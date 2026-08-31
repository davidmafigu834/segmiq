import { callWhatsAppGateway, isMissingGatewayRoute } from "../gateway-client";
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
    return sendTemporaryDocument(input);
  },
  async sendMedia(input): Promise<ProviderSendResult> {
    if (input.messageType === "document") {
      return sendTemporaryDocument(input);
    }
    return sendTemporaryMedia(input);
  },
};

async function sendTemporaryDocument(input: {
  connectionId: string | null;
  to: string;
  body: string;
  leadId: string;
  filename: string;
  mimeType: string;
  url: string;
  messageType?: "image" | "video" | "document";
}): Promise<ProviderSendResult> {
  if (!input.connectionId) {
    return { ok: false, error: "Quick connection is unavailable", errorCode: "NOT_CONNECTED" };
  }
  try {
    return await callWhatsAppGateway<ProviderSendResult>({
      path: `/v1/connections/${encodeURIComponent(input.connectionId)}/messages/document`,
      timeoutMs: input.messageType && input.messageType !== "document" ? 45_000 : undefined,
      body: {
        to: input.to,
        body: input.body,
        leadId: input.leadId,
        filename: input.filename,
        mimeType: input.mimeType,
        url: input.url,
        messageType: input.messageType,
      },
    });
  } catch (error) {
    return gatewaySendFailure(error);
  }
}

async function sendTemporaryMedia(input: {
  connectionId: string | null;
  to: string;
  body: string;
  leadId: string;
  filename: string;
  mimeType: string;
  url: string;
  messageType: "image" | "video" | "document";
}): Promise<ProviderSendResult> {
  if (!input.connectionId) {
    return { ok: false, error: "Quick connection is unavailable", errorCode: "NOT_CONNECTED" };
  }
  try {
    return await callWhatsAppGateway<ProviderSendResult>({
      path: `/v1/connections/${encodeURIComponent(input.connectionId)}/messages/media`,
      timeoutMs: 45_000,
      body: {
        to: input.to,
        body: input.body,
        leadId: input.leadId,
        filename: input.filename,
        mimeType: input.mimeType,
        url: input.url,
        messageType: input.messageType,
      },
    });
  } catch (error) {
    // Render auto-deploy is off, so production often still has the older
    // gateway that only knows /messages/document. Send the file there so
    // the salesperson is not stuck with a raw "Not found" error.
    if (isMissingGatewayRoute(error)) {
      return sendTemporaryDocument(input);
    }
    return gatewaySendFailure(error);
  }
}

function gatewaySendFailure(error: unknown): ProviderSendResult {
  if (isMissingGatewayRoute(error)) {
    return {
      ok: false,
      error: "The WhatsApp service needs an update before photos can be sent. Ask a company manager to redeploy the WhatsApp gateway.",
      errorCode: "GATEWAY_OUTDATED",
    };
  }
  const message = error instanceof Error ? error.message : "Quick connection send failed";
  if (/invalid media|media host is not allowed/i.test(message)) {
    return {
      ok: false,
      error: "Could not send this file on the quick WhatsApp connection. Try again in a moment or ask your manager to check the gateway media settings.",
      errorCode: "INVALID_MEDIA_HOST",
    };
  }
  return {
    ok: false,
    error: message,
    errorCode: "GATEWAY_UNAVAILABLE",
  };
}
