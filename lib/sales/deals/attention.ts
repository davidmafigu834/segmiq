/**
 * Deterministic Deal attention — shared by Pipeline board, Picks, and dashboard.
 * Same urgency rules as Daily Sales Intelligence (no separate ranking engine).
 */

import type { DealRow } from "@/types";
import type { SalesActionReasonCode } from "@/lib/sales/intelligence/types";
import { reasonText } from "@/lib/sales/intelligence/reasons";
import { DEFAULT_STAGE_INACTIVITY_HOURS } from "@/lib/sales/intelligence/defaults";
import { getDealNextActionState } from "./timeline";
import { DEAL_ACTIVE_STAGES } from "./display";

export type DealAttentionState = {
  code: SalesActionReasonCode;
  reason: string;
  atRisk: boolean;
  urgency: number;
  /** Compact card badge — null when no attention chrome needed */
  badge: string | null;
  needsAttention: boolean;
};

function dueBadgeLabel(at: string, now: Date): string | null {
  const due = new Date(at);
  if (Number.isNaN(due.getTime())) return null;
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const dayDiff = Math.round((startDue.getTime() - startToday.getTime()) / 86_400_000);
  if (dayDiff < 0) return "Overdue";
  if (dayDiff === 0) return "Due today";
  if (dayDiff === 1) return "Due tomorrow";
  if (dayDiff <= 7) return `Due in ${dayDiff}d`;
  return null;
}

/**
 * Derive attention for an active Deal. Closed deals return a no-op state.
 */
export function getDealAttentionState(
  deal: Pick<
    DealRow,
    | "stage"
    | "next_action_at"
    | "next_action_label"
    | "expected_decision_at"
    | "last_meaningful_activity_at"
    | "updated_at"
    | "value_status"
  >,
  now: Date = new Date()
): DealAttentionState {
  if (!(DEAL_ACTIVE_STAGES as readonly string[]).includes(deal.stage)) {
    return {
      code: "FOLLOWUP_DUE_TODAY",
      reason: "",
      atRisk: false,
      urgency: 0,
      badge: null,
      needsAttention: false,
    };
  }

  const next = getDealNextActionState(deal);

  if (!next.hasNextAction) {
    return {
      code: "NO_NEXT_ACTION",
      reason: reasonText("NO_NEXT_ACTION"),
      atRisk: true,
      urgency: 90,
      badge: "No next action",
      needsAttention: true,
    };
  }

  if (next.isOverdue) {
    return {
      code: "FOLLOWUP_OVERDUE",
      reason: reasonText("FOLLOWUP_OVERDUE"),
      atRisk: true,
      urgency: 95,
      badge: "Overdue",
      needsAttention: true,
    };
  }

  if (deal.expected_decision_at) {
    const decision = Date.parse(deal.expected_decision_at);
    const hours = (decision - now.getTime()) / 3_600_000;
    if (Number.isFinite(hours) && hours >= 0 && hours <= 48) {
      return {
        code: "LATE_STAGE_NEEDS_ACTION",
        reason: reasonText("LATE_STAGE_NEEDS_ACTION"),
        atRisk: false,
        urgency: 85,
        badge: "Decision soon",
        needsAttention: true,
      };
    }
  }

  if (deal.stage === "PROPOSAL_SENT" || deal.stage === "NEGOTIATING") {
    const dueSoon =
      next.at != null && Date.parse(next.at) - now.getTime() < 24 * 3_600_000;
    if (dueSoon) {
      return {
        code: deal.stage === "PROPOSAL_SENT" ? "QUOTE_WAITING" : "LATE_STAGE_NEEDS_ACTION",
        reason: reasonText(
          deal.stage === "PROPOSAL_SENT" ? "QUOTE_WAITING" : "LATE_STAGE_NEEDS_ACTION"
        ),
        atRisk: false,
        urgency: 80,
        badge: deal.stage === "PROPOSAL_SENT" ? "Proposal sent" : "Needs follow-up",
        needsAttention: true,
      };
    }
  }

  const last = deal.last_meaningful_activity_at
    ? Date.parse(deal.last_meaningful_activity_at)
    : Date.parse(deal.updated_at);
  const inactivityHours = Number.isFinite(last)
    ? (now.getTime() - last) / 3_600_000
    : 0;
  const threshold = DEFAULT_STAGE_INACTIVITY_HOURS[deal.stage] ?? 72;
  if (inactivityHours >= threshold) {
    const ageLabel =
      inactivityHours >= 48
        ? `${Math.floor(inactivityHours / 24)} days`
        : `${Math.floor(inactivityHours)}h`;
    return {
      code: "DEAL_STALE",
      reason: reasonText("DEAL_STALE", { ageLabel }),
      atRisk: true,
      urgency: 75,
      badge: "At risk",
      needsAttention: true,
    };
  }

  if (deal.value_status === "PENDING_ESTIMATE") {
    return {
      code: "NO_NEXT_ACTION",
      reason: "Value still needs estimate",
      atRisk: false,
      urgency: 40,
      badge: null,
      needsAttention: true,
    };
  }

  if (next.at) {
    const badge = dueBadgeLabel(next.at, now);
    const d = new Date(next.at);
    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (isToday) {
      return {
        code: "FOLLOWUP_DUE_TODAY",
        reason: reasonText("FOLLOWUP_DUE_TODAY"),
        atRisk: false,
        urgency: 70,
        badge: badge ?? "Due today",
        needsAttention: true,
      };
    }
    if (badge) {
      return {
        code: "FOLLOWUP_DUE_TODAY",
        reason: reasonText("FOLLOWUP_DUE_TODAY"),
        atRisk: false,
        urgency: 50,
        badge,
        needsAttention: true,
      };
    }
  }

  return {
    code: "FOLLOWUP_DUE_TODAY",
    reason: "",
    atRisk: false,
    urgency: 30,
    badge: null,
    needsAttention: false,
  };
}

/** Sort active deals for a stage column: attention urgency desc, then next action, then id. */
export function compareDealsByAttention(
  a: { deal: DealRow; urgency: number },
  b: { deal: DealRow; urgency: number }
): number {
  if (b.urgency !== a.urgency) return b.urgency - a.urgency;
  const aNext = a.deal.next_action_at ? Date.parse(a.deal.next_action_at) : Number.POSITIVE_INFINITY;
  const bNext = b.deal.next_action_at ? Date.parse(b.deal.next_action_at) : Number.POSITIVE_INFINITY;
  if (aNext !== bNext) return aNext - bNext;
  return a.deal.id.localeCompare(b.deal.id);
}

export function dealAgeDays(createdAt: string, now: Date = new Date()): number {
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((now.getTime() - t) / 86_400_000));
}

export function attentionBadgeTone(
  badge: string | null
): "danger" | "warning" | "info" | "neutral" {
  if (!badge) return "neutral";
  const b = badge.toLowerCase();
  if (b.includes("overdue") || b.includes("at risk") || b.includes("no next")) return "danger";
  if (b.includes("today") || b.includes("decision") || b.includes("follow")) return "warning";
  if (b.includes("proposal") || b.includes("due")) return "info";
  return "neutral";
}
