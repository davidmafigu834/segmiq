import { createAdminClient } from "@/lib/supabase/admin";
import { logLeadEvent } from "@/lib/lead-events";
import type { SendResult } from "@/lib/messaging/log";
import { sendWhatsApp } from "@/lib/messaging/provider";
import { firstName } from "@/lib/messaging/whatsapp-vars";
import { isWhatsAppSessionOpen } from "./inbound";
import { persistOutboundWhatsAppMessage } from "./persist-outbound";
import { sendWhatsAppSessionMessage } from "./session-message";
import { getSafeWhatsAppConnection } from "./connections";

export type SendWhatsAppTextResult = SendResult & {
  channel: "whatsapp";
  mode: "session" | "template";
};

export async function sendWhatsAppTextToLead(opts: {
  leadId: string;
  text: string;
  actorId: string;
  actorName: string;
  actorRole: string;
}): Promise<SendWhatsAppTextResult> {
  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id, client_id, phone, name, source, assigned_to_id")
    .eq("id", opts.leadId)
    .maybeSingle();

  if (!lead) {
    return { ok: false, error: "Lead not found", errorCode: "NOT_FOUND", channel: "whatsapp", mode: "session" };
  }

  if (lead.source !== "WHATSAPP_INBOUND") {
    return {
      ok: false,
      error: "Not a WhatsApp conversation",
      errorCode: "INVALID_SOURCE",
      channel: "whatsapp",
      mode: "session",
    };
  }

  if (!lead.phone) {
    return {
      ok: false,
      error: "Lead has no phone number",
      errorCode: "NO_PHONE",
      channel: "whatsapp",
      mode: "session",
    };
  }

  const clientId = lead.client_id as string;
  const connection = await getSafeWhatsAppConnection(clientId);
  const sessionOpen = await isWhatsAppSessionOpen(opts.leadId);

  if (sessionOpen || connection.providerType === "TEMPORARY_WEB") {
    const result = await sendWhatsAppSessionMessage({
      to: lead.phone as string,
      body: opts.text,
      clientId,
      leadId: opts.leadId,
      actorId: opts.actorId,
      actorName: opts.actorName,
    });
    return { ...result, mode: "session" };
  }

  const { data: client } = await supabase.from("clients").select("name").eq("id", clientId).maybeSingle();
  const companyName = (client?.name as string | null) ?? "";
  const prospectFirst = firstName(lead.name as string | null);
  let repLabel = companyName;

  if (lead.assigned_to_id) {
    const { data: rep } = await supabase
      .from("users")
      .select("name")
      .eq("id", lead.assigned_to_id as string)
      .maybeSingle();
    const repName = (rep?.name as string | null)?.trim();
    if (repName) repLabel = `${firstName(repName)} at ${companyName}`;
  }

  const result = await sendWhatsApp({
    to: lead.phone as string,
    template: "SEND_CUSTOM_MESSAGE",
    variables: { "1": prospectFirst, "2": repLabel, "3": opts.text },
    fallbackBody: `Hi ${prospectFirst}, a quick note from ${repLabel}: ${opts.text}`,
    context: {
      userId: opts.actorId,
      leadId: opts.leadId,
      clientId,
      notificationType: "DOCUMENT_SENT",
    },
  });

  if (result.ok) {
    await logLeadEvent({
      leadId: opts.leadId,
      clientId,
      actor: { id: opts.actorId, name: opts.actorName, role: opts.actorRole },
      eventType: "DOCUMENT_SENT",
      eventData: {
        document_type: "CUSTOM_MESSAGE",
        document_name: "Custom message",
        custom_message: opts.text,
        url: null,
      },
      channel: "whatsapp",
    });

    await persistOutboundWhatsAppMessage({
      clientId,
      leadId: opts.leadId,
      phone: lead.phone as string,
      body: opts.text,
      actorId: opts.actorId,
      providerId: result.providerId ?? null,
    });

    await supabase.from("leads").update({ updated_at: new Date().toISOString() }).eq("id", opts.leadId);
  }

  return { ...result, mode: "template" };
}
