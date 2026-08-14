import type { WhatsAppCapabilities, WhatsAppProviderType } from "./types";

const NONE: WhatsAppCapabilities = {
  manualText: false,
  manualDocument: false,
  templates: false,
  broadcast: false,
  automatedMessages: false,
  deliveryReceipts: false,
  messagingWindow: false,
  limitedHistory: false,
};

const CAPABILITIES: Record<WhatsAppProviderType, WhatsAppCapabilities> = {
  META_CLOUD: {
    manualText: true,
    manualDocument: true,
    templates: true,
    broadcast: true,
    automatedMessages: true,
    deliveryReceipts: true,
    messagingWindow: true,
    limitedHistory: false,
  },
  TEMPORARY_WEB: {
    manualText: true,
    manualDocument: true,
    templates: false,
    broadcast: false,
    automatedMessages: false,
    deliveryReceipts: true,
    messagingWindow: false,
    limitedHistory: true,
  },
  META_COEXISTENCE: {
    manualText: true,
    manualDocument: true,
    templates: true,
    broadcast: true,
    automatedMessages: true,
    deliveryReceipts: true,
    messagingWindow: true,
    limitedHistory: false,
  },
};

export function getWhatsAppCapabilities(
  providerType: WhatsAppProviderType | null | undefined
): WhatsAppCapabilities {
  return providerType ? { ...CAPABILITIES[providerType] } : { ...NONE };
}
