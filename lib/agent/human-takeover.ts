import { updateConversationAgentState } from "./conversation-state";

/**
 * When a salesperson sends on WhatsApp, the agent must stop competing.
 * Failures are swallowed — CRM send must not depend on agent tables.
 */
export async function markConversationHumanTakeover(opts: {
  clientId: string;
  leadId: string;
}): Promise<void> {
  try {
    await updateConversationAgentState(opts.clientId, opts.leadId, {
      humanTakeover: true,
      status: "HUMAN_HANDLING",
      lastHumanMessageAt: new Date().toISOString(),
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
