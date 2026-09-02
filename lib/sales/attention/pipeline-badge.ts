/**
 * Compact pipeline / hub attention badge from Sales Attention signals.
 * Complements getDealAttentionState — does not replace Deal stage.
 */

import { getDealAttentionState, type DealAttentionState } from "@/lib/sales/deals/attention";
import type { DealRow } from "@/types";

export type PipelineAttentionBadge = {
  label: string;
  tone: "danger" | "warning" | "info" | "neutral";
  code: string;
};

/**
 * Prefer live waiting / commitment signals when provided; else deal attention.
 */
export function resolvePipelineAttentionBadge(opts: {
  deal: Pick<
    DealRow,
    | "stage"
    | "next_action_at"
    | "next_action_label"
    | "expected_decision_at"
    | "last_meaningful_activity_at"
    | "updated_at"
    | "value_status"
  > & { wait_until?: string | null };
  awaitingReplyMinutes?: number | null;
  hasOpenCommitmentDue?: boolean;
  commitmentLabel?: string | null;
  now?: Date;
}): PipelineAttentionBadge | null {
  const now = opts.now ?? new Date();

  if (opts.awaitingReplyMinutes != null && opts.awaitingReplyMinutes >= 0) {
    const mins = opts.awaitingReplyMinutes;
    const label =
      mins < 60 ? `Waiting ${Math.max(1, mins)}m` : `Waiting ${Math.floor(mins / 60)}h`;
    return { label, tone: "danger", code: "CUSTOMER_WAITING" };
  }

  if (opts.deal.wait_until) {
    const until = Date.parse(opts.deal.wait_until);
    if (Number.isFinite(until) && until > now.getTime()) {
      return { label: "Waiting", tone: "neutral", code: "WAIT_UNTIL" };
    }
  }

  if (opts.hasOpenCommitmentDue) {
    return {
      label: opts.commitmentLabel?.slice(0, 18) || "Commitment due",
      tone: "warning",
      code: "COMMITMENT_DUE",
    };
  }

  const att: DealAttentionState = getDealAttentionState(opts.deal, now);
  if (!att.needsAttention || !att.badge) return null;

  const tone =
    att.badge.toLowerCase().includes("overdue") ||
    att.badge.toLowerCase().includes("at risk") ||
    att.badge.toLowerCase().includes("no next")
      ? "danger"
      : att.badge.toLowerCase().includes("today")
        ? "warning"
        : "info";

  return { label: att.badge, tone, code: att.code };
}
