export const WHATSAPP_PROVIDER_TYPES = [
  "META_CLOUD",
  "TEMPORARY_WEB",
  "META_COEXISTENCE",
] as const;

export type WhatsAppProviderType = (typeof WHATSAPP_PROVIDER_TYPES)[number];

export const WHATSAPP_CONNECTION_STATES = [
  "DISCONNECTED",
  "INITIALIZING",
  "AWAITING_QR",
  "CONNECTING",
  "CONNECTED",
  "DEGRADED",
  "RECONNECTING",
  "RECONNECT_REQUIRED",
  "DISCONNECTING",
  "ERROR",
] as const;

export type WhatsAppConnectionState = (typeof WHATSAPP_CONNECTION_STATES)[number];

export type WhatsAppSenderSource =
  | "CUSTOMER"
  | "SEGMIQ_USER"
  | "EXTERNAL_BUSINESS_DEVICE"
  | "SYSTEM";

export type WhatsAppCapabilities = {
  manualText: boolean;
  manualDocument: boolean;
  templates: boolean;
  broadcast: boolean;
  automatedMessages: boolean;
  deliveryReceipts: boolean;
  messagingWindow: boolean;
  limitedHistory: boolean;
};

export type WhatsAppConnectionRecord = {
  id: string;
  clientId: string;
  providerType: WhatsAppProviderType;
  status: WhatsAppConnectionState;
  isPrimary: boolean;
  displayName: string | null;
  phoneNumber: string | null;
  providerAccountId: string | null;
  connectedAt: string | null;
  lastSeenAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
};

export type SafeWhatsAppConnection = {
  configured: boolean;
  connectionId: string | null;
  providerType: WhatsAppProviderType | null;
  providerLabel: string;
  status: WhatsAppConnectionState;
  connected: boolean;
  displayName: string | null;
  phoneNumber: string | null;
  connectedAt: string | null;
  lastSeenAt: string | null;
  error: { code: string | null; message: string } | null;
  capabilities: WhatsAppCapabilities;
  temporaryBetaEligible: boolean;
  temporaryFeatureEnabled: boolean;
};

export type ProviderSendTextInput = {
  connectionId: string | null;
  clientId: string;
  leadId: string;
  to: string;
  body: string;
};

export type ProviderSendDocumentInput = ProviderSendTextInput & {
  filename: string;
  mimeType: string;
  url: string;
};

export type ProviderSendMediaInput = ProviderSendDocumentInput & {
  messageType: "image" | "video" | "document";
  mediaId?: string | null;
};

export type ProviderSendResult = {
  ok: boolean;
  providerId?: string;
  error?: string;
  errorCode?: string | number;
};

export type NormalizedWhatsAppInbound = {
  connectionId: string;
  clientId: string;
  providerType: WhatsAppProviderType;
  providerMessageId: string;
  remoteChatId: string;
  from: string;
  timestamp: string;
  messageType: "text" | "image" | "audio" | "video" | "document" | "sticker" | "location";
  body: string;
  profileName?: string | null;
  media?: {
    url: string | null;
    mimeType: string | null;
    caption: string | null;
    storageKey: string | null;
    filename?: string | null;
  } | null;
  direction: "inbound" | "outbound";
  senderSource: WhatsAppSenderSource;
};

export interface WhatsAppProvider {
  readonly type: WhatsAppProviderType;
  readonly capabilities: WhatsAppCapabilities;
  sendText(input: ProviderSendTextInput): Promise<ProviderSendResult>;
  sendDocument?(input: ProviderSendDocumentInput): Promise<ProviderSendResult>;
  sendMedia?(input: ProviderSendMediaInput): Promise<ProviderSendResult>;
}
