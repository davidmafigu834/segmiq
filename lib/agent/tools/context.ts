import type { AgentCompanySettings } from "../types";

/**
 * Server-derived execution context for tool calls. The model never chooses
 * these values — tenant scope, conversation and actor identity always come
 * from the runtime, which derived them from the canonical inbound message.
 */
export type ToolExecutionContext = {
  clientId: string;
  leadId: string;
  contactId: string | null;
  /** Conversation owner (assigned salesperson) when one exists. */
  ownerId: string | null;
  ownerName: string | null;
  executionId: string;
  timezone: string;
  settings: AgentCompanySettings;
  /** Test mode: read-only tools run; mutating tools are simulated. */
  testMode: boolean;
  operationalRuleKeys?: string[];
  workingDays?: number[];
  workStartTime?: string;
  workEndTime?: string;
  playbookFieldKeys?: string[];
  playbookRequiredKeys?: string[];
  standalone?: boolean;
};

export type ToolResult = {
  ok: boolean;
  /** Sanitized payload fed back to the model and stored in the audit record. */
  summary: Record<string, unknown>;
  createdRecordType?: string;
  createdRecordId?: string;
  error?: string;
};

export function toolFailure(error: string, extra?: Record<string, unknown>): ToolResult {
  return { ok: false, summary: { error, ...(extra ?? {}) }, error };
}

export function toolSuccess(
  summary: Record<string, unknown>,
  created?: { type: string; id: string }
): ToolResult {
  return {
    ok: true,
    summary,
    ...(created ? { createdRecordType: created.type, createdRecordId: created.id } : {}),
  };
}

export const AGENT_ACTOR = {
  id: null as string | null,
  name: "SegmiQ Agent",
  role: "SYSTEM",
};
