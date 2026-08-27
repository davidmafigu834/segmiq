import { background } from "@/lib/background";
import { processWhatsAppQualification } from "@/lib/whatsapp/qualification";
import { handleAgentInboundMessage } from "./runtime";
import { getAgentCompanySettings, isAgentGloballyEnabled } from "./settings";
import type { InboundConversationEvent } from "./types";
import { isProactiveOptOutMessage } from "@/lib/agent/proactive/opt-out";

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
  /** False on linked personal WhatsApp — agent may run, the old qualifier must not. */
  allowLegacyQualification?: boolean;
}): Promise<void> {
  let agentActive = false;
  let suggestReplies = false;
  if (isAgentGloballyEnabled()) {
    try {
      const settings = await getAgentCompanySettings(opts.clientId);
      agentActive = settings.enabled;
      suggestReplies = settings.suggestReplies;
    } catch (err) {
      console.error("[agent] settings load failed; falling back to legacy flow", err);
    }
  }

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

  background("segmiqLearningInbound", async () => {
    const { scheduleConversationLearning } = await import("@/lib/agent/learning/schedule");
    scheduleConversationLearning({
      clientId: opts.clientId,
      conversationId: opts.leadId,
      source: "CONVERSATION_SEGMENT",
    });
  });

  if (agentActive || suggestReplies) {
    background("segmiqAgentRun", () => handleAgentInboundMessage(event));
    background("segmiqProactiveInbound", async () => {
      const { hookCustomerMessage, hookCustomerOptOut } = await import("@/lib/agent/proactive");
      if (opts.contactId && isProactiveOptOutMessage(opts.body)) {
        await hookCustomerOptOut({
          clientId: opts.clientId,
          contactId: opts.contactId,
          leadId: opts.leadId,
          reason: "Customer requested no further messages",
        });
      }
      await hookCustomerMessage({
        clientId: opts.clientId,
        leadId: opts.leadId,
        text: opts.body,
        contactId: opts.contactId,
        actorId: opts.messageId,
      });
    });
    return;
  }

  // Learning-on / agent-off: humans handle WhatsApp. Do not run scripted qualification replies.
  try {
    const { getLearningSettings } = await import("@/lib/agent/learning/settings");
    const learning = await getLearningSettings(opts.clientId);
    if (learning.enabled) return;
  } catch {
    /* continue to legacy */
  }

  if (opts.allowLegacyQualification === false) return;

  await processWhatsAppQualification({
    clientId: opts.clientId,
    clientName: opts.clientName,
    leadId: opts.leadId,
    phone: opts.phone,
    inboundBody: opts.body,
    isNewLead: opts.isNewLead,
  });
}
