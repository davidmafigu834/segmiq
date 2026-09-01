import { logLeadEvent } from "@/lib/lead-events";
import { findOpenLeadByPhone } from "@/lib/leads/findOpenLeadByPhone";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhoneForWhatsApp } from "@/lib/whatsapp-opener";
import { handleInboundWhatsAppMessage } from "./inbound";
import { persistOutboundWhatsAppMessage } from "./persist-outbound";
import { markLeadContactedIfNew } from "@/lib/leads/mark-lead-contacted";
import type { NormalizedWhatsAppInbound } from "./providers/types";

export function isSupportedTemporaryChat(remoteChatId: string): boolean {
  const value = remoteChatId.trim().toLowerCase();
  if (!value) return false;
  return !(
    value.endsWith("@g.us") ||
    value.endsWith("@broadcast") ||
    value.endsWith("@newsletter") ||
    value === "status@broadcast" ||
    value.includes("system")
  );
}

export async function ingestNormalizedWhatsAppMessage(message: NormalizedWhatsAppInbound): Promise<void> {
  if (!isSupportedTemporaryChat(message.remoteChatId)) return;
  if (message.direction === "inbound") {
    await handleInboundWhatsAppMessage({
      clientId: message.clientId,
      connectionId: message.connectionId,
      providerType: message.providerType,
      senderSource: message.senderSource,
      contactProfile: { waId: message.from.replace(/\D/g, ""), name: message.profileName ?? null },
      message: {
        id: message.providerMessageId,
        from: message.from,
        timestamp: String(Math.floor(new Date(message.timestamp).getTime() / 1000)),
        type: message.messageType,
        text: message.messageType === "text" ? { body: message.body } : undefined,
        document: message.messageType === "document"
          ? { filename: message.media?.filename ?? undefined, caption: message.media?.caption ?? undefined }
          : undefined,
      },
      mediaAsset: message.media
        ? {
            url: message.media.url,
            mimeType: message.media.mimeType,
            caption: message.media.caption,
            storageKey: message.media.storageKey,
          }
        : null,
    });
    return;
  }

  // Messages sent directly from the linked business phone are mirrored into
  // the existing conversation without attributing them to a SegmiQ user.
  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("dial_code")
    .eq("id", message.clientId)
    .maybeSingle();
  const phone = normalizePhoneForWhatsApp(message.from, (client?.dial_code as string | null) ?? null);
  if (!phone) return;
  const lead = await findOpenLeadByPhone({
    supabase,
    clientId: message.clientId,
    phoneDigits: phone,
  });
  if (!lead) return;

  const result = await persistOutboundWhatsAppMessage({
    clientId: message.clientId,
    leadId: lead.id as string,
    phone: `+${phone}`,
    body: message.body,
    actorId: null,
    providerId: message.providerMessageId,
    providerType: message.providerType,
    connectionId: message.connectionId,
    senderSource: "EXTERNAL_BUSINESS_DEVICE",
    messageType: message.messageType,
  });
  if (!result.ok) return;
  await logLeadEvent({
    leadId: lead.id as string,
    clientId: message.clientId,
    actor: { id: null, name: "Business phone", role: "SYSTEM" },
    eventType: "MESSAGE_SENT",
    eventData: {
      body: message.body,
      provider_id: message.providerMessageId,
      provider_type: message.providerType,
      sender_source: "EXTERNAL_BUSINESS_DEVICE",
    },
    channel: "whatsapp",
  });
  await supabase.from("leads").update({ updated_at: new Date().toISOString() }).eq("id", lead.id as string);
  await markLeadContactedIfNew({
    leadId: lead.id as string,
    clientId: message.clientId,
    actor: {
      id: (lead.assigned_to_id as string | null) ?? null,
      name: "Business phone",
      role: "SALESPERSON",
    },
  });
}
