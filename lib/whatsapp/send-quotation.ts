import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicBaseUrl } from "@/lib/constants";
import { sendWhatsApp } from "@/lib/messaging/provider";
import { firstName } from "@/lib/messaging/whatsapp-vars";
import { isWhatsAppSessionOpen } from "@/lib/whatsapp/inbound";
import { sendWhatsAppSessionMessage } from "@/lib/whatsapp/session-message";
import { sendWhatsAppSessionDocument, uploadWhatsAppMedia } from "@/lib/whatsapp/send-document";
import { persistOutboundWhatsAppMessage } from "@/lib/whatsapp/persist-outbound";
import type { SendResult } from "@/lib/messaging/log";

export type SendQuotationWhatsAppResult = SendResult & {
  channel: "whatsapp";
  mode: "session_document" | "session_text" | "template";
};

export async function sendQuotationOnWhatsApp(opts: {
  leadId: string;
  clientId: string;
  phone: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  quoteNumber: string;
  waMessage: string;
  pdfBuffer: Buffer;
  pdfUrl: string | null;
  publicToken: string;
}): Promise<SendQuotationWhatsAppResult> {
  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("name, assigned_to_id")
    .eq("id", opts.leadId)
    .maybeSingle();

  const filename = `quotation-${opts.quoteNumber}.pdf`;
  const publicPdfLink = `${getPublicBaseUrl()}/api/quotes/${opts.publicToken}/pdf`;
  const documentLink = opts.pdfUrl ?? publicPdfLink;
  const sessionOpen = await isWhatsAppSessionOpen(opts.leadId);

  if (sessionOpen) {
    const upload = await uploadWhatsAppMedia({
      clientId: opts.clientId,
      buffer: opts.pdfBuffer,
      mimeType: "application/pdf",
      filename,
    });

    const docResult = await sendWhatsAppSessionDocument({
      to: opts.phone,
      body: opts.waMessage,
      clientId: opts.clientId,
      leadId: opts.leadId,
      actorId: opts.actorId,
      actorName: opts.actorName,
      filename,
      mediaId: upload.ok ? upload.id : null,
      link: upload.ok ? null : documentLink,
    });

    if (docResult.ok) {
      return { ...docResult, mode: "session_document" };
    }

    const textResult = await sendWhatsAppSessionMessage({
      to: opts.phone,
      body: opts.waMessage,
      clientId: opts.clientId,
      leadId: opts.leadId,
      actorId: opts.actorId,
      actorName: opts.actorName,
    });
    return { ...textResult, mode: "session_text" };
  }

  const { data: client } = await supabase.from("clients").select("name").eq("id", opts.clientId).maybeSingle();
  const companyName = (client?.name as string | null) ?? "";
  const prospectFirst = firstName((lead?.name as string | null) ?? null);
  let repLabel = companyName;

  if (lead?.assigned_to_id) {
    const { data: rep } = await supabase
      .from("users")
      .select("name")
      .eq("id", lead.assigned_to_id as string)
      .maybeSingle();
    const repName = (rep?.name as string | null)?.trim();
    if (repName) repLabel = `${firstName(repName)} at ${companyName}`;
  }

  const templateResult = await sendWhatsApp({
    to: opts.phone,
    template: "SEND_CUSTOM_MESSAGE",
    variables: { "1": prospectFirst, "2": repLabel, "3": opts.waMessage },
    fallbackBody: opts.waMessage,
    context: {
      userId: opts.actorId,
      leadId: opts.leadId,
      clientId: opts.clientId,
      notificationType: "DOCUMENT_SENT",
    },
  });

  if (templateResult.ok) {
    await persistOutboundWhatsAppMessage({
      clientId: opts.clientId,
      leadId: opts.leadId,
      phone: opts.phone,
      body: opts.waMessage,
      actorId: opts.actorId,
      providerId: templateResult.providerId ?? null,
      messageType: "text",
    });
  }

  return { ...templateResult, mode: "template" };
}
