/** Cap cool-down resumes so a persistent 429 becomes a human escalation, not a loop. */
export const MAX_STALE_FAILURES = 4;

/** Shared with the conversation lock TTL — a live run is treated as dead after this. */
export const STALE_RESUME_AFTER_MS = 3 * 60 * 1000;

export type StaleResumeCandidate = {
  status: string;
  agentEnabled: boolean;
  humanTakeover: boolean;
  lastCustomerMessageAt: string | null;
  lastAgentMessageAt: string | null;
  lockAcquiredAt: string | null;
  updatedAt: string;
};

/** True when AI started a turn, never finished, and the lock is old enough to steal. */
export function conversationNeedsStaleResume(
  row: StaleResumeCandidate,
  at: Date,
  staleAfterMs: number = STALE_RESUME_AFTER_MS
): boolean {
  if (!row.agentEnabled || row.humanTakeover) return false;
  if (row.status !== "AI_HANDLING") return false;
  if (!row.lastCustomerMessageAt) return false;
  const customerAt = new Date(row.lastCustomerMessageAt).getTime();
  const agentAt = row.lastAgentMessageAt ? new Date(row.lastAgentMessageAt).getTime() : 0;
  if (agentAt >= customerAt) return false;
  const markedAt = new Date(row.lockAcquiredAt ?? row.updatedAt).getTime();
  return at.getTime() - markedAt >= staleAfterMs;
}
