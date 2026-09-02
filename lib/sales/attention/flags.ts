/**
 * Feature flags for Sales Attention Engine.
 * Defaults favour visibility of deterministic focus (no auto-send).
 */

import type { AttentionFlags } from "./types";

export function isSalesAttentionGloballyEnabled(): boolean {
  return process.env.SEGMIQ_SALES_ATTENTION_DISABLED !== "1";
}

export function salesAttentionFlags(overrides?: Partial<AttentionFlags>): AttentionFlags {
  const on = isSalesAttentionGloballyEnabled();
  const base: AttentionFlags = {
    enabled: on,
    dashboard: on,
    commandCenter: on,
    nextBestAction: on,
    whatsappSummary: on,
    /** Phase 1: drafts allowed; auto-send remains off elsewhere. */
    draftFollowup: on,
    callBrief: on,
    proactiveIntegration: on,
  };
  return { ...base, ...overrides, enabled: on && (overrides?.enabled ?? true) };
}

/** Flag keys for settings / docs (agent.salesAttention.*). */
export const SALES_ATTENTION_FLAG_KEYS = [
  "agent.salesAttention.enabled",
  "agent.salesAttention.dashboard",
  "agent.salesAttention.commandCenter",
  "agent.salesAttention.nextBestAction",
  "agent.salesAttention.whatsappSummary",
  "agent.salesAttention.draftFollowup",
  "agent.salesAttention.callBrief",
  "agent.salesAttention.proactiveIntegration",
] as const;
