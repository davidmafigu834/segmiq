/**
 * Mandatory follow-up helpers for real-estate active inquiries.
 */

export const RE_ACTIVE_LEAD_STATUSES = new Set([
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "NEGOTIATING",
  "PROPOSAL_SENT",
]);

export const RE_CLOSED_LEAD_STATUSES = new Set(["WON", "LOST", "NOT_QUALIFIED", "DISQUALIFIED"]);

export function isActiveReLeadStatus(status: string | null | undefined): boolean {
  const s = String(status ?? "").toUpperCase();
  if (RE_CLOSED_LEAD_STATUSES.has(s)) return false;
  if (RE_ACTIVE_LEAD_STATUSES.has(s)) return true;
  return Boolean(s) && !["ARCHIVED", "DELETED"].includes(s);
}

export type FollowUpRequirement = {
  followUpDate: string | null | undefined;
  nextAction?: string | null | undefined;
};

/** Soft message — used when validating mutations that clear or omit follow-ups. */
export function missingFollowUpMessage(): string {
  return "Every active inquiry needs a follow-up date and next action.";
}

export function hasRequiredFollowUp(req: FollowUpRequirement): boolean {
  const date = typeof req.followUpDate === "string" ? req.followUpDate.trim() : "";
  return Boolean(date);
}

export const FOLLOW_UP_UNCHANGED = Symbol("follow_up_unchanged");

/**
 * Enforce follow-up discipline for RE without blocking unrelated lead patches.
 *
 * - Clearing follow_up_date on an active lead → reject
 * - Explicitly setting follow_up_date to empty on an active lead → reject
 * - Unrelated patches (follow_up unchanged) → allow (dashboard flags missing dates)
 * - When requireIfMissing is true (e.g. viewing completed) → reject if still missing
 */
export function validateActiveLeadFollowUp(opts: {
  businessType: string | null | undefined;
  previousStatus: string | null | undefined;
  nextStatus?: string | null | undefined;
  previousFollowUpDate: string | null | undefined;
  nextFollowUpDate: string | null | undefined | typeof FOLLOW_UP_UNCHANGED;
  clearingFollowUp: boolean;
  /** Hard-require a date even when the field was not in the request (e.g. after viewing). */
  requireIfMissing?: boolean;
}): { ok: true } | { ok: false; error: string } {
  if (opts.businessType !== "real_estate") return { ok: true };

  const status = opts.nextStatus ?? opts.previousStatus;
  if (!isActiveReLeadStatus(status)) return { ok: true };

  if (opts.clearingFollowUp) {
    return { ok: false, error: missingFollowUpMessage() };
  }

  if (opts.nextFollowUpDate === FOLLOW_UP_UNCHANGED) {
    if (opts.requireIfMissing && !hasRequiredFollowUp({ followUpDate: opts.previousFollowUpDate })) {
      return { ok: false, error: missingFollowUpMessage() };
    }
    return { ok: true };
  }

  if (!hasRequiredFollowUp({ followUpDate: opts.nextFollowUpDate })) {
    return { ok: false, error: missingFollowUpMessage() };
  }
  return { ok: true };
}
