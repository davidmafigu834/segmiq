import type { AgentConversationState } from "../types";
import type { AgentConversationMode } from "./types";
import { AGENT_CONVERSATION_MODES } from "./types";

export function isAgentConversationMode(value: unknown): value is AgentConversationMode {
  return typeof value === "string" && (AGENT_CONVERSATION_MODES as readonly string[]).includes(value);
}

/**
 * Resolve the effective product mode from persisted state.
 * Falls back to legacy human_takeover / pause flags when column is absent.
 */
export function resolveConversationMode(state: AgentConversationState | null): AgentConversationMode {
  if (state?.conversationMode) return state.conversationMode;
  if (!state) return "AI_HANDLING";
  if (!state.agentEnabled || state.status === "PAUSED") return "HUMAN_ONLY";
  if (state.humanTakeover) return "AI_COPILOT";
  return "AI_HANDLING";
}

/** SegmiQ Agent may send customer-facing WhatsApp replies. */
export function conversationAllowsAutoReply(mode: AgentConversationMode): boolean {
  return mode === "AI_HANDLING";
}

/** Silent extraction / suggest-reply may run while human controls the thread. */
export function conversationAllowsCopilotAssist(mode: AgentConversationMode): boolean {
  return mode === "AI_COPILOT";
}

export function conversationModeToAgentStatus(mode: AgentConversationMode): AgentConversationState["status"] {
  if (mode === "AI_HANDLING") return "AI_HANDLING";
  if (mode === "AI_COPILOT") return "HUMAN_HANDLING";
  return "PAUSED";
}

export function patchForConversationMode(mode: AgentConversationMode): {
  conversationMode: AgentConversationMode;
  humanTakeover: boolean;
  agentEnabled: boolean;
  status: AgentConversationState["status"];
} {
  if (mode === "AI_HANDLING") {
    return {
      conversationMode: mode,
      humanTakeover: false,
      agentEnabled: true,
      status: "AI_HANDLING",
    };
  }
  if (mode === "AI_COPILOT") {
    return {
      conversationMode: mode,
      humanTakeover: true,
      agentEnabled: true,
      status: "HUMAN_HANDLING",
    };
  }
  return {
    conversationMode: mode,
    humanTakeover: true,
    agentEnabled: true,
    status: "PAUSED",
  };
}
