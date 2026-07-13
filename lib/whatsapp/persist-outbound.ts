import { createAdminClient } from "@/lib/supabase/admin";

export async function persistOutboundWhatsAppMessage(opts: {
  clientId: string;
  leadId: string;
  phone: string;
  body: string;
  actorId?: string | null;
  providerId?: string | null;
  messageType?: string;
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
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[whatsapp] persist outbound failed", error.message, opts.leadId);
    return { ok: false };
  }

  return { ok: true, id: data?.id as string | undefined };
}
