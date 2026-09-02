/**
 * Deterministic priority classes + internal ordering.
 * User-facing UX shows why — never an opaque AI score.
 */

import type { SalesActionReasonCode, SalesActionType } from "@/lib/sales/intelligence/types";
import type {
  AttentionPriorityClass,
  NextBestActionType,
  SalesAttentionType,
} from "./types";

const CLASS_RANK: Record<AttentionPriorityClass, number> = {
  IMMEDIATE: 400,
  TODAY: 300,
  NEEDS_PROGRESS: 200,
  WATCH: 100,
};

export function priorityClassRank(c: AttentionPriorityClass): number {
  return CLASS_RANK[c];
}

export function attentionTypeFromReason(
  reasonCode: SalesActionReasonCode | string,
  actionType?: SalesActionType | string | null
): SalesAttentionType {
  switch (reasonCode) {
    case "CUSTOMER_WAITING":
      return "CUSTOMER_WAITING";
    case "FOLLOWUP_OVERDUE":
      return actionType === "COMPLETE_SCHEDULED_CALL" || actionType === "COMPLETE_APPOINTMENT"
        ? "APPOINTMENT_MISSED"
        : "FOLLOWUP_OVERDUE";
    case "FOLLOWUP_DUE_TODAY":
    case "MANAGER_ASSIGNED":
      return actionType === "COMPLETE_SCHEDULED_CALL" || actionType === "COMPLETE_APPOINTMENT"
        ? "APPOINTMENT_TODAY"
        : "FOLLOWUP_DUE";
    case "SCHEDULED_TODAY":
      return "APPOINTMENT_TODAY";
    case "QUOTE_WAITING":
      return "QUOTE_FOLLOWUP_DUE";
    case "QUOTE_EXPIRING":
      return "QUOTE_EXPIRING";
    case "QUOTE_APPROVAL_NEEDED":
      return "QUOTE_APPROVAL_REQUIRED";
    case "QUOTE_CUSTOMER_CHANGES":
      return "QUOTE_REVISION_REQUESTED";
    case "QUOTE_VIEWED":
      return "QUOTE_FOLLOWUP_DUE";
    case "DEAL_STALE":
      return "DEAL_INACTIVE";
    case "NO_NEXT_ACTION":
      return "DEAL_NO_NEXT_ACTION";
    case "LATE_STAGE_NEEDS_ACTION":
      return "DEAL_NEEDS_PROGRESS";
    case "HIGH_INTENT_NEW_LEAD":
      return "NEW_LEAD_CONTACT";
    case "PROSPECTING_COMMITMENT":
    case "GOAL_PIPELINE_LOW":
      return "PROSPECTING";
    default:
      if (actionType === "RESPOND_TO_CUSTOMER") return "CUSTOMER_WAITING";
      if (actionType === "CREATE_QUOTE") return "CUSTOMER_WAITING";
      return "MANUAL_FOCUS_ITEM";
  }
}

export function priorityClassForAttention(
  type: SalesAttentionType,
  opts?: { overdue?: boolean; waitingMinutes?: number | null }
): AttentionPriorityClass {
  switch (type) {
    case "CUSTOMER_WAITING":
    case "HUMAN_HANDOFF_WAITING":
    case "SUPPORT_TO_SALES_HANDOFF":
    case "FOLLOWUP_OVERDUE":
    case "TASK_OVERDUE":
    case "APPOINTMENT_MISSED":
    case "CUSTOMER_QUESTION_UNRESOLVED":
      return "IMMEDIATE";
    case "FOLLOWUP_DUE":
    case "TASK_DUE":
    case "CUSTOMER_COMMITMENT_DUE":
    case "SALESPERSON_COMMITMENT_DUE":
    case "QUOTE_FOLLOWUP_DUE":
    case "QUOTE_REVISION_REQUESTED":
    case "QUOTE_APPROVAL_REQUIRED":
    case "APPOINTMENT_TODAY":
    case "APPOINTMENT_PREP":
    case "NEW_LEAD_CONTACT":
      return "TODAY";
    case "DEAL_NO_NEXT_ACTION":
    case "DEAL_INACTIVE":
    case "DEAL_BLOCKED":
    case "DEAL_NEEDS_PROGRESS":
      return "NEEDS_PROGRESS";
    case "QUOTE_EXPIRING":
    case "PROSPECTING":
    case "MANUAL_FOCUS_ITEM":
      return "WATCH";
    default:
      return opts?.overdue ? "IMMEDIATE" : "TODAY";
  }
}

/** Quote viewed increases relevance but must not force immediate customer contact. */
export function priorityClassForReason(
  reasonCode: SalesActionReasonCode | string,
  actionType?: SalesActionType | string | null
): AttentionPriorityClass {
  if (reasonCode === "QUOTE_VIEWED") return "WATCH";
  const type = attentionTypeFromReason(reasonCode, actionType);
  return priorityClassForAttention(type, {
    overdue: reasonCode === "FOLLOWUP_OVERDUE",
  });
}

export function suggestedActionFromAttention(
  type: SalesAttentionType,
  actionType?: SalesActionType | string | null
): NextBestActionType {
  switch (type) {
    case "CUSTOMER_WAITING":
      return actionType === "CREATE_QUOTE" ? "PREPARE_QUOTATION" : "REPLY_TO_CUSTOMER";
    case "FOLLOWUP_DUE":
    case "FOLLOWUP_OVERDUE":
    case "CUSTOMER_COMMITMENT_DUE":
    case "SALESPERSON_COMMITMENT_DUE":
    case "QUOTE_FOLLOWUP_DUE":
    case "TASK_DUE":
    case "TASK_OVERDUE":
      return "FOLLOW_UP";
    case "QUOTE_REVISION_REQUESTED":
      return "REVISE_QUOTATION";
    case "QUOTE_APPROVAL_REQUIRED":
      return "REQUEST_APPROVAL";
    case "QUOTE_EXPIRING":
      return "FOLLOW_UP";
    case "DEAL_NO_NEXT_ACTION":
      return "CREATE_TASK";
    case "DEAL_INACTIVE":
    case "DEAL_NEEDS_PROGRESS":
      return "FOLLOW_UP";
    case "DEAL_BLOCKED":
      return "ESCALATE";
    case "APPOINTMENT_TODAY":
    case "APPOINTMENT_PREP":
      return "COMPLETE_APPOINTMENT";
    case "APPOINTMENT_MISSED":
      return "SCHEDULE_APPOINTMENT";
    case "HUMAN_HANDOFF_WAITING":
      return "REPLY_TO_CUSTOMER";
    case "CUSTOMER_QUESTION_UNRESOLVED":
      return "CONFIRM_DELIVERY";
    case "NEW_LEAD_CONTACT":
      return "CONTACT_NEW_LEAD";
    case "PROSPECTING":
      return "CUSTOM";
    default:
      return "FOLLOW_UP";
  }
}

export function attentionTypeLabel(type: SalesAttentionType): string {
  switch (type) {
    case "CUSTOMER_WAITING":
      return "Customer waiting";
    case "FOLLOWUP_DUE":
      return "Follow-up due";
    case "FOLLOWUP_OVERDUE":
      return "Follow-up overdue";
    case "CUSTOMER_COMMITMENT_DUE":
      return "Customer commitment due";
    case "SALESPERSON_COMMITMENT_DUE":
      return "Your commitment due";
    case "QUOTE_FOLLOWUP_DUE":
      return "Quote follow-up";
    case "QUOTE_EXPIRING":
      return "Quote expiring";
    case "QUOTE_REVISION_REQUESTED":
      return "Quote revision requested";
    case "QUOTE_APPROVAL_REQUIRED":
      return "Quote approval required";
    case "DEAL_NO_NEXT_ACTION":
      return "No next action";
    case "DEAL_INACTIVE":
      return "Deal inactive";
    case "DEAL_BLOCKED":
      return "Deal blocked";
    case "DEAL_NEEDS_PROGRESS":
      return "Deal needs progress";
    case "APPOINTMENT_TODAY":
      return "Appointment today";
    case "APPOINTMENT_PREP":
      return "Appointment prep";
    case "APPOINTMENT_MISSED":
      return "Missed appointment";
    case "HUMAN_HANDOFF_WAITING":
      return "Human handoff";
    case "CUSTOMER_QUESTION_UNRESOLVED":
      return "Unresolved question";
    case "TASK_DUE":
      return "Task due";
    case "TASK_OVERDUE":
      return "Task overdue";
    case "SUPPORT_TO_SALES_HANDOFF":
      return "Support handoff";
    case "NEW_LEAD_CONTACT":
      return "New enquiry";
    case "PROSPECTING":
      return "Prospecting";
    case "MANUAL_FOCUS_ITEM":
      return "Focus item";
    default:
      return "Attention";
  }
}

export function priorityClassLabel(c: AttentionPriorityClass): string {
  switch (c) {
    case "IMMEDIATE":
      return "Immediate";
    case "TODAY":
      return "Today";
    case "NEEDS_PROGRESS":
      return "Needs progress";
    case "WATCH":
      return "Watch";
    default:
      return c;
  }
}

export function compareAttentionItems(
  a: { priorityClass: AttentionPriorityClass; internalScore: number; dueAt: string | null; fingerprint: string },
  b: { priorityClass: AttentionPriorityClass; internalScore: number; dueAt: string | null; fingerprint: string }
): number {
  const pr = priorityClassRank(b.priorityClass) - priorityClassRank(a.priorityClass);
  if (pr !== 0) return pr;
  if (b.internalScore !== a.internalScore) return b.internalScore - a.internalScore;
  const aDue = a.dueAt ?? "";
  const bDue = b.dueAt ?? "";
  if (aDue !== bDue) return aDue.localeCompare(bDue);
  return a.fingerprint.localeCompare(b.fingerprint);
}
