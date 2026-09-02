/**
 * Sales Attention Engine — product types.
 *
 * Attention items are projections of canonical CRM state (tasks/follow-ups,
 * deals, quotations, conversations, appointments). They are not a parallel
 * business object. Persistence reuses sales_action_states.
 */

import type {
  AvailableContactAction,
  SalesActionReasonCode,
  SalesActionRecommendation,
  SalesActionType,
} from "@/lib/sales/intelligence/types";

/** User-facing priority classes — never show an opaque AI score. */
export type AttentionPriorityClass = "IMMEDIATE" | "TODAY" | "NEEDS_PROGRESS" | "WATCH";

/**
 * Attention candidate types (generic names; map from existing reason codes).
 */
export type SalesAttentionType =
  | "CUSTOMER_WAITING"
  | "FOLLOWUP_DUE"
  | "FOLLOWUP_OVERDUE"
  | "CUSTOMER_COMMITMENT_DUE"
  | "SALESPERSON_COMMITMENT_DUE"
  | "QUOTE_FOLLOWUP_DUE"
  | "QUOTE_EXPIRING"
  | "QUOTE_REVISION_REQUESTED"
  | "QUOTE_APPROVAL_REQUIRED"
  | "DEAL_NO_NEXT_ACTION"
  | "DEAL_INACTIVE"
  | "DEAL_BLOCKED"
  | "DEAL_NEEDS_PROGRESS"
  | "APPOINTMENT_TODAY"
  | "APPOINTMENT_PREP"
  | "APPOINTMENT_MISSED"
  | "HUMAN_HANDOFF_WAITING"
  | "CUSTOMER_QUESTION_UNRESOLVED"
  | "TASK_DUE"
  | "TASK_OVERDUE"
  | "SUPPORT_TO_SALES_HANDOFF"
  | "NEW_LEAD_CONTACT"
  | "MANUAL_FOCUS_ITEM"
  | "PROSPECTING";

export type NextBestActionType =
  | "REPLY_TO_CUSTOMER"
  | "FOLLOW_UP"
  | "PREPARE_QUOTATION"
  | "REVISE_QUOTATION"
  | "REQUEST_APPROVAL"
  | "SCHEDULE_APPOINTMENT"
  | "COMPLETE_APPOINTMENT"
  | "CONFIRM_TECHNICAL_REQUIREMENTS"
  | "CONFIRM_DELIVERY"
  | "CREATE_TASK"
  | "CALL_CUSTOMER"
  | "WAIT_UNTIL"
  | "ESCALATE"
  | "TRANSFER_TO_SUPPORT"
  | "NO_ACTION_REQUIRED"
  | "CONTACT_NEW_LEAD"
  | "CUSTOM";

export type AttentionItemState =
  | "OPEN"
  | "SNOOZED"
  | "COMPLETED"
  | "DISMISSED"
  | "INVALIDATED";

export type AttentionDismissReason =
  | "ALREADY_HANDLED"
  | "WAITING_ON_CUSTOMER"
  | "WAITING_ON_STOCK"
  | "WAITING_ON_MANAGER"
  | "NOT_A_REAL_OPPORTUNITY"
  | "DUPLICATE"
  | "OTHER";

export type FocusActionKind =
  | "draft_message"
  | "open_whatsapp"
  | "view_deal"
  | "view_lead"
  | "view_quotation"
  | "prepare_quotation"
  | "revise_quotation"
  | "create_task"
  | "schedule_appointment"
  | "view_appointment"
  | "call"
  | "snooze"
  | "done"
  | "not_relevant"
  | "draft_and_send"
  | "summarize";

export type FocusAction = {
  kind: FocusActionKind;
  label: string;
  href?: string;
  prompt?: string;
  primary?: boolean;
};

export type SalesAttentionItem = {
  id: string;
  fingerprint: string;
  companyId: string;
  salespersonId: string;

  type: SalesAttentionType;
  priorityClass: AttentionPriorityClass;
  /** Internal sort only — never display as "AI Priority N". */
  internalScore: number;

  title: string;
  subtitle: string | null;
  reasonCode: SalesActionReasonCode | string;
  reasonSummary: string;
  whyNow: string;

  suggestedActionType: NextBestActionType;
  suggestedActionSummary: string;

  customerName: string | null;
  leadId: string | null;
  dealId: string | null;
  conversationId: string | null;
  quotationId: string | null;
  quotationLabel: string | null;
  taskId: string | null;
  appointmentId: string | null;
  dealStage: string | null;
  projectType: string | null;
  phone: string | null;

  dueAt: string | null;
  waitingMinutes: number | null;
  inactivityDays: number | null;

  state: AttentionItemState;
  snoozedUntil: string | null;

  actions: FocusAction[];
  availableContactActions: AvailableContactAction[];

  /** Source recommendation from Daily Plan / priority engine. */
  sourceActionType: SalesActionType | null;
  metadata: Record<string, unknown>;
};

export type TodaysFocusSummary = {
  total: number;
  immediate: number;
  today: number;
  needsProgress: number;
  watch: number;
};

export type TodaysFocusPayload = {
  generatedAt: string;
  planDate: string;
  timezone: string;
  lastRefreshedLabel: string;
  summary: TodaysFocusSummary;
  items: SalesAttentionItem[];
  /**
   * Uncontacted / overnight enquiries — not main Today's Focus.
   * WhatsApp already shows unread; this lane offers summarize + draft + send.
   */
  newEnquiries: SalesAttentionItem[];
  nextBest: SalesAttentionItem | null;
  empty: boolean;
  emptyMessage: string | null;
  planError: boolean;
  /** Underlying daily plan still available for commitments / focus mode. */
  focusModeTitle: string | null;
  queueVersion: string;
};

export type DealNextBestAction = {
  actionType: NextBestActionType;
  reasonCode: string;
  dueAt: string | null;
  waitUntil: string | null;
  title: string;
  summary: string;
  sourceConversationId: string | null;
  sourceQuotationId: string | null;
  sourceTaskId: string | null;
  dealId: string;
  leadId: string | null;
  priorityClass: AttentionPriorityClass;
};

export type AttentionFlags = {
  enabled: boolean;
  dashboard: boolean;
  commandCenter: boolean;
  nextBestAction: boolean;
  whatsappSummary: boolean;
  draftFollowup: boolean;
  callBrief: boolean;
  proactiveIntegration: boolean;
};

/** Map helpers keep Daily Plan ↔ Attention vocabulary aligned. */
export type AttentionMappedFromPlan = {
  item: SalesAttentionItem;
  source: SalesActionRecommendation;
};
