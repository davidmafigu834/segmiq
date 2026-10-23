import type { AiQuotaMetric } from "./types";

export const AI_ALLOWANCES = {
  agentic_business: { conversations: 500, actions: 100 },
  agentic_scale: { conversations: 2000, actions: 500 },
} as const;

export function usageThreshold(percent: number): 0 | 80 | 95 | 100 {
  if (percent >= 100) return 100;
  if (percent >= 95) return 95;
  if (percent >= 80) return 80;
  return 0;
}

export function calculateQuota(
  included: number,
  consumed: number,
  topups = 0,
): AiQuotaMetric {
  const safeIncluded = Math.max(0, Math.trunc(included));
  const safeTopups = Math.max(0, Math.trunc(topups));
  const safeConsumed = Math.max(0, Math.trunc(consumed));
  const availableTotal = safeIncluded + safeTopups;
  const percent =
    availableTotal === 0
      ? safeConsumed > 0
        ? 100
        : 0
      : Math.min(100, Math.floor((safeConsumed * 100) / availableTotal));
  return {
    included: safeIncluded,
    topups: safeTopups,
    consumed: safeConsumed,
    available: Math.max(0, availableTotal - safeConsumed),
    percent,
    threshold: usageThreshold(percent),
  };
}

export function isWithinRollingWindow(
  openedAt: string | Date,
  occurredAt: string | Date,
): boolean {
  const opened = new Date(openedAt).getTime();
  const occurred = new Date(occurredAt).getTime();
  return occurred >= opened && occurred < opened + 24 * 60 * 60 * 1000;
}

const BILLABLE_ACTIONS = new Set([
  "deal_create",
  "task_create_follow_up",
  "calendar_schedule_callback",
  "calendar_reschedule_callback",
  "quotation_prepare_draft",
  "quotation_send",
  "lead_update_qualification",
  "buyer_requirements.update",
  "viewing.schedule",
]);

export function isBillableInternalAction(input: {
  toolName: string;
  status: string;
  testMode: boolean;
  humanApproved?: boolean;
}): boolean {
  return (
    input.status === "EXECUTED" &&
    !input.testMode &&
    !input.humanApproved &&
    BILLABLE_ACTIONS.has(input.toolName)
  );
}
