import type { SendResult } from "@/lib/messaging/log";
import { isValidActorUuid } from "@/lib/whatsapp/qualification-answers";
import { sendCanonicalWhatsAppText } from "@/lib/whatsapp/message-service";

export type SendSessionMessageParams = {
  to: string;
  body: string;
  clientId: string;
  leadId: string;
  actorId?: string | null;
  actorName: string;
  actorRole?: string;
  phoneNumberId?: string | null;
};

export async function sendWhatsAppSessionMessage(
  params: SendSessionMessageParams
): Promise<SendResult & { channel: "whatsapp" }> {
  const actorId = isValidActorUuid(params.actorId) ? params.actorId : null;
  const actorRole = params.actorRole ?? (actorId ? "SALESPERSON" : "SYSTEM");
  return sendCanonicalWhatsAppText({
    clientId: params.clientId,
    leadId: params.leadId,
    to: params.to,
    body: params.body,
    actorId,
    actorName: params.actorName,
    actorRole,
  });
}
