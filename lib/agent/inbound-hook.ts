import { background } from "@/lib/background";
import { processWhatsAppQualification } from "@/lib/whatsapp/qualification";
import { handleAgentInboundMessage } from "./runtime";
import { getAgentCompanySettings, isAgentGloballyEnabled } from "./settings";
import type { InboundConversationEvent } from "./types";

/**
 * Inbound integration point. When SegmiQ Agent is enabled for the company it
 * owns the automated conversation; otherwise the legacy scripted
 * qualification flow keeps working unchanged. Agent reasoning always runs in
 * the background so message ingestion acks fast.
 */
export async function dispatchInboundToAgentOrQualification(opts: {
  clientId: string;
  clientName: string;
  leadId: string;
  contactId: string | null;
  ownerId: string | null;
  messageId: string;
  messageType: string;
  body: string;
  phone: string;
  timestamp: string;
  isNewLead: boolean;
}): Promise<void> {
  let agentActive = false;
  if (isAgentGloballyEnabled()) {
    try {
      const settings = await getAgentCompanySettings(opts.clientId);
      agentActive = settings.enabled;
    } catch (err) {
      console.error("[agent] settings load failed; falling back to legacy flow", err);
    }
  }

  if (agentActive) {
    const event: InboundConversationEvent = {
      messageId: opts.messageId,
      clientId: opts.clientId,
      leadId: opts.leadId,
      contactId: opts.contactId,
      channel: "whatsapp",
      messageType: opts.messageType,
      text: opts.body,
      hasAttachment: opts.messageType !== "text",
      timestamp: opts.timestamp,
      ownerId: opts.ownerId,
      conversationType: "SALES",
      isNewLead: opts.isNewLead,
    };
    background("segmiqAgentRun", () => handleAgentInboundMessage(event));
    return;
  }

  await processWhatsAppQualification({
    clientId: opts.clientId,
    clientName: opts.clientName,
    leadId: opts.leadId,
    phone: opts.phone,
    inboundBody: opts.body,
    isNewLead: opts.isNewLead,
  });
}
