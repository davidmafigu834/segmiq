import { createAdminClient } from "@/lib/supabase/admin";

export async function persistOutboundWhatsAppMessage(opts: {
  clientId: string;
  leadId: string;
  phone: string;
  body: string;
  actorId?: string | null;
  providerId?: string | null;
  messageType?: string;
  providerType?: "META_CLOUD" | "TEMPORARY_WEB" | "META_COEXISTENCE";
  connectionId?: string | null;
  senderSource?: "SEGMIQ_USER" | "EXTERNAL_BUSINESS_DEVICE" | "SYSTEM";
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  mediaStorageKey?: string | null;
}): Promise<{ ok: boolean; id?: string }> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .insert({
      client_id: opts.clientId,
      lead_id: opts.leadId,
      direction: "outbound",
      provider_id: opts.providerId ?? null,
      phone: opts.phone,
      body: opts.body,
      message_type: opts.messageType ?? "text",
      actor_id: opts.actorId ?? null,
      status: "sent",
      provider_type: opts.providerType ?? "META_CLOUD",
      connection_id: opts.connectionId ?? null,
      sender_source: opts.senderSource ?? "SEGMIQ_USER",
      media_url: opts.mediaUrl ?? null,
      media_mime_type: opts.mediaMimeType ?? null,
      media_storage_key: opts.mediaStorageKey ?? null,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[whatsapp] persist outbound failed", error.message, opts.leadId);
    return { ok: false };
  }

  if (opts.connectionId && opts.providerId && data?.id) {
    await supabase.from("whatsapp_external_messages").upsert({
      client_id: opts.clientId,
      connection_id: opts.connectionId,
      whatsapp_message_id: data.id,
      provider_type: opts.providerType ?? "TEMPORARY_WEB",
      provider_message_id: opts.providerId,
      sender_source: opts.senderSource ?? "SEGMIQ_USER",
    }, { onConflict: "connection_id,provider_type,provider_message_id" });
  }

  return { ok: true, id: data?.id as string | undefined };
}
