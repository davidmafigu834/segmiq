import { updateConversationAgentState } from "./conversation-state";
import { patchForConversationMode } from "./real-estate/conversation-mode";

/**
 * When a salesperson sends on WhatsApp, the agent must stop competing.
 * Failures are swallowed — CRM send must not depend on agent tables.
 */
export async function markConversationHumanTakeover(opts: {
  clientId: string;
  leadId: string;
}): Promise<void> {
  try {
    const modePatch = patchForConversationMode("AI_COPILOT");
    await updateConversationAgentState(opts.clientId, opts.leadId, {
      ...modePatch,
      lastHumanMessageAt: new Date().toISOString(),
    });
    const { hookHumanTakeover, hookHumanOutbound } = await import("@/lib/agent/proactive");
    void hookHumanTakeover({ clientId: opts.clientId, leadId: opts.leadId, actorType: "HUMAN" });
    void hookHumanOutbound({ clientId: opts.clientId, leadId: opts.leadId, actorType: "HUMAN" });
    const { scheduleConversationLearning } = await import("@/lib/agent/learning/schedule");
    scheduleConversationLearning({
      clientId: opts.clientId,
      conversationId: opts.leadId,
      source: "HUMAN_TAKEOVER",
      immediate: true,
    });
  } catch (err) {
    console.error("[agent] human takeover mark failed", err);
  }
}

export function isHumanWhatsAppActor(opts: {
  actorId: string | null;
  actorRole: string;
}): boolean {
  return Boolean(opts.actorId) && opts.actorRole !== "SYSTEM";
}
