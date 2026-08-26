/**
 * Proactive Event Agent — shared types.
 *
 * This is not a second CRM. Jobs are scheduled *evaluations*.
 * Canonical follow-up work stays on leads.follow_up_date / call_logs.callback_at.
 */

export const PROACTIVE_JOB_STATES = [
  "SCHEDULED",
  "EVALUATING",
  "WAITING_FOR_POLICY",
  "WAITING_FOR_HUMAN",
  "WAITING_FOR_CHANNEL",
  "EXECUTING",
  "COMPLETED",
  "SKIPPED",
  "CANCELLED",
  "FAILED",
  "EXPIRED",
] as const;
export type ProactiveJobState = (typeof PROACTIVE_JOB_STATES)[number];

export const ACTOR_TYPES = ["CUSTOMER", "HUMAN", "AGENT", "SYSTEM"] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

export const ENTITY_TYPES = [
  "CUSTOMER",
  "LEAD",
  "DEAL",
  "QUOTATION",
  "APPOINTMENT",
  "TASK",
  "CONVERSATION",
  "SUPPORT_CASE",
  "PRODUCT",
  "INVENTORY",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const FOLLOW_UP_SOURCES = [
  "HUMAN_CREATED",
  "CUSTOMER_COMMITMENT",
  "AGENT_CREATED",
  "SYSTEM_POLICY",
] as const;
export type FollowUpSource = (typeof FOLLOW_UP_SOURCES)[number];

export const PROACTIVE_ACTION_MODES = [
  "NO_ACTION",
  "CREATE_TASK",
  "NOTIFY",
  "CUSTOMER_MESSAGE",
  "ESCALATE",
  "REQUEST_APPROVAL",
] as const;
export type ProactiveActionMode = (typeof PROACTIVE_ACTION_MODES)[number];

export const PROACTIVE_DECISIONS = [
  "NO_ACTION",
  "SEND_MESSAGE",
  "CREATE_TASK",
  "NOTIFY_HUMAN",
  "ESCALATE",
  "PREPARE_WORK",
  "WOULD_HAVE_SENT",
] as const;
export type ProactiveDecision = (typeof PROACTIVE_DECISIONS)[number];

export const REASON_CODES = [
  "CUSTOMER_ALREADY_RESPONDED",
  "RECENT_HUMAN_CONTACT",
  "QUOTE_NOT_ACTIVE",
  "QUOTE_SUPERSEDED",
  "QUOTE_ACCEPTED",
  "QUOTE_DECLINED",
  "QUOTE_EXPIRED",
  "QUOTE_PENDING_APPROVAL",
  "DEAL_CLOSED",
  "DEAL_HAS_FUTURE_APPOINTMENT",
  "DEAL_HAS_NEXT_ACTION",
  "CUSTOMER_OPTED_OUT",
  "AGENT_PAUSED",
  "AGENT_DISABLED",
  "HUMAN_ACTIVE",
  "CONTACT_WINDOW_CLOSED",
  "MAX_ATTEMPTS_REACHED",
  "ACTIVE_SUPPORT_ESCALATION",
  "CUSTOMER_REQUESTED_LATER_DATE",
  "DUPLICATE_EVENT",
  "CHANNEL_UNAVAILABLE",
  "STALE_ACTION",
  "STALE_AFTER_CHANNEL_FAILURE",
  "POLICY_BLOCKED",
  "PROACTIVE_DISABLED",
  "CUSTOMER_MESSAGING_DISABLED",
  "SHADOW_MODE",
  "APPROVAL_REQUIRED",
  "LOW_CONFIDENCE",
  "NO_ACTION_NEEDED",
  "CIRCUIT_OPEN",
  "RATE_LIMITED",
  "AUTONOMY_ASSIST",
  "PLATFORM_DISABLED",
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

export const REASON_CODE_LABELS: Record<ReasonCode, string> = {
  CUSTOMER_ALREADY_RESPONDED: "Customer already replied",
  RECENT_HUMAN_CONTACT: "A salesperson contacted the customer recently",
  QUOTE_NOT_ACTIVE: "Quotation is no longer awaiting a response",
  QUOTE_SUPERSEDED: "A newer quotation replaced this one",
  QUOTE_ACCEPTED: "Quotation was accepted",
  QUOTE_DECLINED: "Quotation was declined",
  QUOTE_EXPIRED: "Quotation has expired",
  QUOTE_PENDING_APPROVAL: "Quotation is waiting for approval",
  DEAL_CLOSED: "Deal is closed",
  DEAL_HAS_FUTURE_APPOINTMENT: "An appointment is already scheduled",
  DEAL_HAS_NEXT_ACTION: "A next action already exists",
  CUSTOMER_OPTED_OUT: "Customer asked not to be contacted",
  AGENT_PAUSED: "Agent is paused on this conversation",
  AGENT_DISABLED: "Agent is disabled for this conversation",
  HUMAN_ACTIVE: "A salesperson is handling this conversation",
  CONTACT_WINDOW_CLOSED: "Outside allowed contact hours",
  MAX_ATTEMPTS_REACHED: "Maximum autonomous follow-ups reached",
  ACTIVE_SUPPORT_ESCALATION: "An active support issue should be resolved first",
  CUSTOMER_REQUESTED_LATER_DATE: "Customer asked to be contacted later",
  DUPLICATE_EVENT: "This event was already processed",
  CHANNEL_UNAVAILABLE: "WhatsApp is disconnected",
  STALE_ACTION: "This action is no longer timely",
  STALE_AFTER_CHANNEL_FAILURE: "The reminder expired while WhatsApp was offline",
  POLICY_BLOCKED: "Company policy blocked this action",
  PROACTIVE_DISABLED: "Proactive Agent is off",
  CUSTOMER_MESSAGING_DISABLED: "Customer-initiated outreach is off",
  SHADOW_MODE: "Shadow mode — would have acted, nothing sent",
  APPROVAL_REQUIRED: "A person must approve this message",
  LOW_CONFIDENCE: "The agent was not confident enough to act",
  NO_ACTION_NEEDED: "Nothing needed to happen",
  CIRCUIT_OPEN: "Proactive messaging is paused because of repeated failures",
  RATE_LIMITED: "A contact or company rate limit was reached",
  AUTONOMY_ASSIST: "Assist mode drafts only — no autonomous send",
  PLATFORM_DISABLED: "Proactive execution is disabled on this server",
};

export type DomainEvent = {
  id?: string;
  clientId: string;
  type: string;
  entityType: EntityType;
  entityId: string;
  actorType: ActorType;
  actorId?: string | null;
  occurredAt: Date;
  payload: Record<string, unknown>;
  correlationId?: string | null;
  causationId?: string | null;
  source?: string;
  version?: number;
  fingerprint: string;
};

export type ContactWindow = {
  start: string;
  end: string;
} | null;

export type ProactiveContactWindows = {
  /** 0 = Sunday … 6 = Saturday. null = disabled that day. */
  days: Record<number, ContactWindow>;
};

export type ProactiveConfig = {
  quoteFollowUpEnabled: boolean;
  quoteExpiryNotifySalesperson: boolean;
  quoteExpiryHoursBefore: number;
  quoteExpiryCustomerReminder: boolean;
  quoteAfterMaxAttempts: "CREATE_TASK" | "NOTIFY" | "NO_ACTION";
  dealInactivityEnabled: boolean;
  dealInactivityBusinessDays: number;
  dealInactivityAction: "CREATE_TASK" | "NOTIFY" | "CUSTOMER_MESSAGE" | "NO_ACTION";
  dealInactivityStages: string[];
  dealNextActionMissingEnabled: boolean;
  appointmentCustomerReminder: boolean;
  appointmentCustomerReminderHours: number;
  appointmentSalespersonReminder: boolean;
  appointmentSalespersonReminderMinutes: number;
  appointmentMissedCustomerMessage: boolean;
  appointmentMissedCreateTask: boolean;
  responseSlaAlertsEnabled: boolean;
  responseSlaMinutes: number;
  maxMessagesPerCustomerPerDay: number;
  maxMessagesPerConversationPerHour: number;
  companyHourlyLimit: number;
  contactWindows: ProactiveContactWindows;
};

export type ProactiveSettings = {
  clientId: string;
  enabled: boolean;
  shadowMode: boolean;
  customerMessaging: boolean;
  internalActions: boolean;
  circuitOpen: boolean;
  circuitOpenedAt: string | null;
  circuitReason: string | null;
  config: ProactiveConfig;
};

export const DEFAULT_CONTACT_WINDOWS: ProactiveContactWindows = {
  days: {
    0: null,
    1: { start: "08:00", end: "18:00" },
    2: { start: "08:00", end: "18:00" },
    3: { start: "08:00", end: "18:00" },
    4: { start: "08:00", end: "18:00" },
    5: { start: "08:00", end: "18:00" },
    6: { start: "09:00", end: "13:00" },
  },
};

export const DEFAULT_PROACTIVE_CONFIG: ProactiveConfig = {
  quoteFollowUpEnabled: true,
  quoteExpiryNotifySalesperson: true,
  quoteExpiryHoursBefore: 24,
  quoteExpiryCustomerReminder: false,
  quoteAfterMaxAttempts: "CREATE_TASK",
  dealInactivityEnabled: true,
  dealInactivityBusinessDays: 5,
  dealInactivityAction: "CREATE_TASK",
  dealInactivityStages: ["QUALIFIED", "SCOPING", "PROPOSAL_SENT", "NEGOTIATING"],
  dealNextActionMissingEnabled: true,
  appointmentCustomerReminder: true,
  appointmentCustomerReminderHours: 24,
  appointmentSalespersonReminder: true,
  appointmentSalespersonReminderMinutes: 30,
  appointmentMissedCustomerMessage: false,
  appointmentMissedCreateTask: true,
  responseSlaAlertsEnabled: true,
  responseSlaMinutes: 15,
  maxMessagesPerCustomerPerDay: 2,
  maxMessagesPerConversationPerHour: 1,
  companyHourlyLimit: 40,
  contactWindows: DEFAULT_CONTACT_WINDOWS,
};

export type ProactiveJob = {
  id: string;
  clientId: string;
  leadId: string | null;
  contactId: string | null;
  dealId: string | null;
  quotationId: string | null;
  quotationVersion: number | null;
  appointmentId: string | null;
  conversationId: string | null;
  triggerType: string;
  triggerEventId: string | null;
  policyId: string;
  attemptNumber: number;
  fingerprint: string;
  status: ProactiveJobState;
  scheduledAt: string;
  staleAfter: string | null;
  evaluatedAt: string | null;
  executedAt: string | null;
  decision: string | null;
  reasonCode: string | null;
  actionType: string | null;
  customerMessage: string | null;
  decisionSummary: string | null;
  conditions: Record<string, unknown>;
  payload: Record<string, unknown>;
  actorOrigin: ActorType | null;
  correlationId: string | null;
  causationId: string | null;
  agentExecutionId: string | null;
  retryCount: number;
  cancelledById: string | null;
  cancelledReason: string | null;
  skipReason: string | null;
  failureReason: string | null;
  createdAt: string;
};

export type PolicyEvaluation = {
  allowed: boolean;
  actionMode: ProactiveActionMode;
  reasonCode: ReasonCode | null;
  reasons: string[];
  conditions: Record<string, boolean | string | null>;
  nextEligibleAt?: Date;
  approvalRequired?: boolean;
  terminalStatus?: Extract<ProactiveJobState, "SKIPPED" | "EXPIRED" | "CANCELLED">;
};

export type ProactiveDecisionContract = {
  decision: ProactiveDecision;
  reasonCode: ReasonCode;
  customerMessage?: string;
  task?: { title: string; dueAt?: string; priority?: string };
  escalation?: { reason: string; priority: string };
  confidence: number;
  summary: string;
};
