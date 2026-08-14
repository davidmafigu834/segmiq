export function isTemporaryWhatsAppFeatureEnabled(): boolean {
  return process.env.WHATSAPP_TEMPORARY_WEB_ENABLED?.trim().toLowerCase() === "true";
}

export function assertTemporaryWhatsAppRuntimeConfigured(): void {
  if (!process.env.WHATSAPP_GATEWAY_URL?.trim()) {
    throw new Error("WHATSAPP_GATEWAY_URL is not configured");
  }
  if (!process.env.WHATSAPP_GATEWAY_SHARED_SECRET?.trim()) {
    throw new Error("WHATSAPP_GATEWAY_SHARED_SECRET is not configured");
  }
  if (!process.env.WHATSAPP_SESSION_ENCRYPTION_KEY?.trim()) {
    throw new Error("WHATSAPP_SESSION_ENCRYPTION_KEY is not configured");
  }
}
