import type { CountryCode } from "libphonenumber-js";
import { logLeadEvent } from "@/lib/lead-events";
import { logMessage, type LogMessageParams, type SendResult } from "@/lib/messaging/log";
import { normalizeToE164 } from "@/lib/phone-validate";
import { createAdminClient } from "@/lib/supabase/admin";
import { persistOutboundWhatsAppMessage } from "./persist-outbound";
import { resolveWhatsAppProvider } from "./providers/resolver";

async function resolveCanonicalLeadRecipient(input: {
  clientId: string;
  leadId: string;
}): Promise<
  | { ok: true; normalized: string }
  | { ok: false; error: string; errorCode: "NOT_FOUND" | "INVALID_PHONE" }
> {
  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id, phone")
    .eq("id", input.leadId)
    .eq("client_id", input.clientId)
    .maybeSingle();

  if (!lead?.phone) {
    return { ok: false, error: "Conversation not found", errorCode: "NOT_FOUND" };
  }

  const normalized = normalizeToE164(
    lead.phone as string,
    (process.env.DEFAULT_COUNTRY_CODE || "ZW").toUpperCase() as CountryCode
  );
  if (!normalized) {
    return { ok: false, error: "The conversation has an invalid phone number", errorCode: "INVALID_PHONE" };
  }

  return { ok: true, normalized };
}

export async function sendCanonicalWhatsAppText(input: {
  clientId: string;
  leadId: string;
  /**
   * Retained temporarily for callers that still provide it. The send target is
   * always derived from the authorized Lead record, never from this value.
   */
  to: string;
  body: string;
  actorId: string | null;
  actorName: string;
  actorRole: string;
}): Promise<SendResult & { channel: "whatsapp"; providerType?: string }> {
  const recipient = await resolveCanonicalLeadRecipient(input);
  const context: LogMessageParams = {
    userId: input.actorId,
    leadId: input.leadId,
    clientId: input.clientId,
    channel: "whatsapp",
    notificationType: "WHATSAPP_SESSION",
    recipient: recipient.ok ? recipient.normalized : "(authorized lead recipient unavailable)",
    templateKey: null,
    payloadPreview: input.body.slice(0, 240),
  };
  if (!recipient.ok) {
    const result = { ok: false, error: recipient.error, errorCode: recipient.errorCode } as const;
    await logMessage(result, context);
    return { ...result, channel: "whatsapp" };
  }

  const supabase = createAdminClient();

  const { provider, connection } = await resolveWhatsAppProvider(input.clientId);
  if (
    connection &&
    provider.type === "TEMPORARY_WEB" &&
    !["CONNECTED", "DEGRADED"].includes(connection.status)
  ) {
    const result = {
      ok: false,
      error: "WhatsApp quick connection is offline. Ask a company manager to reconnect it in Settings.",
      errorCode: "CONNECTION_UNAVAILABLE",
    } as const;
    await logMessage(result, context);
    return { ...result, channel: "whatsapp", providerType: provider.type };
  }
  if (!provider.capabilities.manualText) {
    const result = { ok: false, error: "This provider cannot send manual messages", errorCode: "UNSUPPORTED" } as const;
    await logMessage(result, context);
    return { ...result, channel: "whatsapp", providerType: provider.type };
  }

  const result = await provider.sendText({
    connectionId: connection?.id ?? null,
    clientId: input.clientId,
    leadId: input.leadId,
    to: recipient.normalized,
    body: input.body,
  });
  await logMessage(result, context);

  if (result.ok) {
    await persistOutboundWhatsAppMessage({
      clientId: input.clientId,
      leadId: input.leadId,
      phone: recipient.normalized,
      body: input.body,
      actorId: input.actorId,
      providerId: result.providerId ?? null,
      providerType: provider.type,
      connectionId: connection?.id ?? null,
      senderSource: "SEGMIQ_USER",
    });
    await logLeadEvent({
      leadId: input.leadId,
      clientId: input.clientId,
      actor: { id: input.actorId, name: input.actorName, role: input.actorRole },
      eventType: "MESSAGE_SENT",
      eventData: {
        body: input.body,
        provider_id: result.providerId ?? null,
        provider_type: provider.type,
      },
      channel: "whatsapp",
    });
    await supabase.from("leads").update({ updated_at: new Date().toISOString() }).eq("id", input.leadId);
  }
  return { ...result, channel: "whatsapp", providerType: provider.type };
}

export async function sendCanonicalWhatsAppDocument(input: {
  clientId: string;
  leadId: string;
  to: string;
  body: string;
  filename: string;
  mimeType: string;
  url: string;
  actorId: string;
  actorName: string;
  actorRole: string;
}): Promise<SendResult & { channel: "whatsapp"; providerType?: string }> {
  const recipient = await resolveCanonicalLeadRecipient(input);
  const context: LogMessageParams = {
    userId: input.actorId,
    leadId: input.leadId,
    clientId: input.clientId,
    channel: "whatsapp",
    notificationType: "DOCUMENT_SENT",
    recipient: recipient.ok ? recipient.normalized : "(authorized lead recipient unavailable)",
    templateKey: null,
    payloadPreview: input.body.slice(0, 240),
  };
  if (!recipient.ok) {
    const result = { ok: false, error: recipient.error, errorCode: recipient.errorCode } as const;
    await logMessage(result, context);
    return { ...result, channel: "whatsapp" };
  }
  const { provider, connection } = await resolveWhatsAppProvider(input.clientId);
  if (!connection || !["CONNECTED", "DEGRADED"].includes(connection.status)) {
    const result = { ok: false, error: "WhatsApp connection is offline", errorCode: "CONNECTION_UNAVAILABLE" } as const;
    await logMessage(result, context);
    return { ...result, channel: "whatsapp", providerType: provider.type };
  }
  if (!provider.capabilities.manualDocument || !provider.sendDocument) {
    const result = { ok: false, error: "This WhatsApp connection doesn't support this messaging feature.", errorCode: "UNSUPPORTED" } as const;
    await logMessage(result, context);
    return { ...result, channel: "whatsapp", providerType: provider.type };
  }
  const result = await provider.sendDocument({
    connectionId: connection.id,
    clientId: input.clientId,
    leadId: input.leadId,
    to: recipient.normalized,
    body: input.body,
    filename: input.filename,
    mimeType: input.mimeType,
    url: input.url,
  });
  await logMessage(result, context);
  if (result.ok) {
    await persistOutboundWhatsAppMessage({
      clientId: input.clientId,
      leadId: input.leadId,
      phone: recipient.normalized,
      body: input.body,
      actorId: input.actorId,
      providerId: result.providerId ?? null,
      providerType: provider.type,
      connectionId: connection.id,
      senderSource: "SEGMIQ_USER",
      messageType: "document",
    });
    await logLeadEvent({
      leadId: input.leadId,
      clientId: input.clientId,
      actor: { id: input.actorId, name: input.actorName, role: input.actorRole },
      eventType: "MESSAGE_SENT",
      eventData: { body: input.body, filename: input.filename, provider_id: result.providerId ?? null, provider_type: provider.type, message_type: "document" },
      channel: "whatsapp",
    });
  }
  return { ...result, channel: "whatsapp", providerType: provider.type };
}
