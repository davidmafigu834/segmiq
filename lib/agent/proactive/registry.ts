/**
 * Central registry of proactive triggers.
 * Business logic lives here so listeners do not invent one-off rules.
 */

export type TriggerDef = {
  eventType: string;
  sourceEntity: string;
  risk: "LOW" | "MEDIUM" | "HIGH";
  customerFacing: boolean;
  defaultAction: "NO_ACTION" | "SCHEDULE_EVALUATION" | "CREATE_TASK" | "NOTIFY";
  policyCategory: string;
  invalidatedBy: string[];
  needsModel: boolean;
  description: string;
};

export const DOMAIN_EVENT_TYPES = {
  QUOTATION_SENT: "quotation.sent",
  QUOTATION_VIEWED: "quotation.viewed",
  QUOTATION_ACCEPTED: "quotation.accepted",
  QUOTATION_DECLINED: "quotation.declined",
  QUOTATION_EXPIRED: "quotation.expired",
  QUOTATION_SUPERSEDED: "quotation.superseded",
  QUOTATION_CHANGE_REQUESTED: "quotation.change_requested",
  DEAL_CREATED: "deal.created",
  DEAL_STAGE_CHANGED: "deal.stage_changed",
  DEAL_OWNER_CHANGED: "deal.owner_changed",
  DEAL_CLOSED: "deal.closed",
  DEAL_REOPENED: "deal.reopened",
  APPOINTMENT_CREATED: "appointment.created",
  APPOINTMENT_RESCHEDULED: "appointment.rescheduled",
  APPOINTMENT_CANCELLED: "appointment.cancelled",
  APPOINTMENT_COMPLETED: "appointment.completed",
  APPOINTMENT_MISSED: "appointment.missed",
  TASK_CREATED: "task.created",
  TASK_COMPLETED: "task.completed",
  TASK_CANCELLED: "task.cancelled",
  CONVERSATION_ASSIGNED: "conversation.assigned",
  CONVERSATION_TRANSFERRED: "conversation.transferred",
  CONVERSATION_HUMAN_TAKEOVER: "conversation.human_takeover",
  CONVERSATION_AGENT_RESUMED: "conversation.agent_resumed",
  CONVERSATION_CUSTOMER_MESSAGE: "conversation.customer_message_received",
  CONVERSATION_HUMAN_MESSAGE: "conversation.human_message_sent",
  CONVERSATION_AGENT_MESSAGE: "conversation.agent_message_sent",
  SUPPORT_CASE_CREATED: "support.case_created",
  SUPPORT_CASE_RESOLVED: "support.case_resolved",
  CUSTOMER_OPTED_OUT: "customer.opted_out",
  CUSTOMER_COMMITMENT: "customer.commitment_created",
} as const;

export const TEMPORAL_TRIGGER_TYPES = {
  QUOTATION_FOLLOWUP_DUE: "quotation.followup_due",
  QUOTATION_EXPIRING_SOON: "quotation.expiring_soon",
  DEAL_INACTIVE: "deal.inactive",
  DEAL_NEXT_ACTION_MISSING: "deal.next_action_missing",
  APPOINTMENT_REMINDER_DUE: "appointment.reminder_due",
  APPOINTMENT_SALESPERSON_REMINDER: "appointment.salesperson_reminder_due",
  APPOINTMENT_FOLLOWUP_DUE: "appointment.followup_due",
  TASK_DUE: "task.due",
  CUSTOMER_FOLLOWUP_DUE: "customer.followup_due",
  CONVERSATION_RESPONSE_SLA: "conversation.response_sla_risk",
} as const;

export const TRIGGER_REGISTRY: Record<string, TriggerDef> = {
  [TEMPORAL_TRIGGER_TYPES.QUOTATION_FOLLOWUP_DUE]: {
    eventType: TEMPORAL_TRIGGER_TYPES.QUOTATION_FOLLOWUP_DUE,
    sourceEntity: "QUOTATION",
    risk: "MEDIUM",
    customerFacing: true,
    defaultAction: "SCHEDULE_EVALUATION",
    policyCategory: "quotations",
    needsModel: true,
    description: "Evaluate whether a quotation still needs a follow-up.",
    invalidatedBy: [
      DOMAIN_EVENT_TYPES.QUOTATION_ACCEPTED,
      DOMAIN_EVENT_TYPES.QUOTATION_DECLINED,
      DOMAIN_EVENT_TYPES.QUOTATION_SUPERSEDED,
      DOMAIN_EVENT_TYPES.QUOTATION_EXPIRED,
      DOMAIN_EVENT_TYPES.QUOTATION_CHANGE_REQUESTED,
      DOMAIN_EVENT_TYPES.CONVERSATION_CUSTOMER_MESSAGE,
      DOMAIN_EVENT_TYPES.CONVERSATION_HUMAN_MESSAGE,
      DOMAIN_EVENT_TYPES.CUSTOMER_COMMITMENT,
      DOMAIN_EVENT_TYPES.CUSTOMER_OPTED_OUT,
      DOMAIN_EVENT_TYPES.DEAL_CLOSED,
    ],
  },
  [TEMPORAL_TRIGGER_TYPES.QUOTATION_EXPIRING_SOON]: {
    eventType: TEMPORAL_TRIGGER_TYPES.QUOTATION_EXPIRING_SOON,
    sourceEntity: "QUOTATION",
    risk: "LOW",
    customerFacing: false,
    defaultAction: "NOTIFY",
    policyCategory: "quotations",
    needsModel: false,
    description: "Notify the owner before a quotation expires. Customer reminder is opt-in.",
    invalidatedBy: [
      DOMAIN_EVENT_TYPES.QUOTATION_ACCEPTED,
      DOMAIN_EVENT_TYPES.QUOTATION_DECLINED,
      DOMAIN_EVENT_TYPES.QUOTATION_SUPERSEDED,
      DOMAIN_EVENT_TYPES.QUOTATION_EXPIRED,
      DOMAIN_EVENT_TYPES.DEAL_CLOSED,
    ],
  },
  [TEMPORAL_TRIGGER_TYPES.CUSTOMER_FOLLOWUP_DUE]: {
    eventType: TEMPORAL_TRIGGER_TYPES.CUSTOMER_FOLLOWUP_DUE,
    sourceEntity: "TASK",
    risk: "MEDIUM",
    customerFacing: true,
    defaultAction: "SCHEDULE_EVALUATION",
    policyCategory: "commitments",
    needsModel: true,
    description: "Customer-requested follow-up became due — re-evaluate current state.",
    invalidatedBy: [
      DOMAIN_EVENT_TYPES.CUSTOMER_OPTED_OUT,
      DOMAIN_EVENT_TYPES.DEAL_CLOSED,
      DOMAIN_EVENT_TYPES.TASK_CANCELLED,
      DOMAIN_EVENT_TYPES.CONVERSATION_HUMAN_MESSAGE,
    ],
  },
  [TEMPORAL_TRIGGER_TYPES.APPOINTMENT_REMINDER_DUE]: {
    eventType: TEMPORAL_TRIGGER_TYPES.APPOINTMENT_REMINDER_DUE,
    sourceEntity: "APPOINTMENT",
    risk: "LOW",
    customerFacing: true,
    defaultAction: "SCHEDULE_EVALUATION",
    policyCategory: "appointments",
    needsModel: false,
    description: "Customer appointment reminder — uses an approved template.",
    invalidatedBy: [
      DOMAIN_EVENT_TYPES.APPOINTMENT_CANCELLED,
      DOMAIN_EVENT_TYPES.APPOINTMENT_RESCHEDULED,
      DOMAIN_EVENT_TYPES.APPOINTMENT_COMPLETED,
      DOMAIN_EVENT_TYPES.CUSTOMER_OPTED_OUT,
    ],
  },
  [TEMPORAL_TRIGGER_TYPES.APPOINTMENT_SALESPERSON_REMINDER]: {
    eventType: TEMPORAL_TRIGGER_TYPES.APPOINTMENT_SALESPERSON_REMINDER,
    sourceEntity: "APPOINTMENT",
    risk: "LOW",
    customerFacing: false,
    defaultAction: "NOTIFY",
    policyCategory: "appointments",
    needsModel: false,
    description: "In-app salesperson reminder. Does not duplicate T-30 WhatsApp reminders.",
    invalidatedBy: [
      DOMAIN_EVENT_TYPES.APPOINTMENT_CANCELLED,
      DOMAIN_EVENT_TYPES.APPOINTMENT_RESCHEDULED,
      DOMAIN_EVENT_TYPES.APPOINTMENT_COMPLETED,
    ],
  },
  [TEMPORAL_TRIGGER_TYPES.APPOINTMENT_FOLLOWUP_DUE]: {
    eventType: TEMPORAL_TRIGGER_TYPES.APPOINTMENT_FOLLOWUP_DUE,
    sourceEntity: "APPOINTMENT",
    risk: "MEDIUM",
    customerFacing: false,
    defaultAction: "CREATE_TASK",
    policyCategory: "appointments",
    needsModel: false,
    description: "Missed or completed appointment — evaluate the next commercial step.",
    invalidatedBy: [DOMAIN_EVENT_TYPES.APPOINTMENT_CANCELLED],
  },
  [TEMPORAL_TRIGGER_TYPES.DEAL_INACTIVE]: {
    eventType: TEMPORAL_TRIGGER_TYPES.DEAL_INACTIVE,
    sourceEntity: "DEAL",
    risk: "LOW",
    customerFacing: false,
    defaultAction: "CREATE_TASK",
    policyCategory: "deals",
    needsModel: false,
    description: "Active Deal with no meaningful activity for the configured business days.",
    invalidatedBy: [
      DOMAIN_EVENT_TYPES.DEAL_CLOSED,
      DOMAIN_EVENT_TYPES.APPOINTMENT_CREATED,
      DOMAIN_EVENT_TYPES.CUSTOMER_COMMITMENT,
      DOMAIN_EVENT_TYPES.CONVERSATION_CUSTOMER_MESSAGE,
      DOMAIN_EVENT_TYPES.CONVERSATION_HUMAN_MESSAGE,
      DOMAIN_EVENT_TYPES.QUOTATION_SENT,
    ],
  },
  [TEMPORAL_TRIGGER_TYPES.DEAL_NEXT_ACTION_MISSING]: {
    eventType: TEMPORAL_TRIGGER_TYPES.DEAL_NEXT_ACTION_MISSING,
    sourceEntity: "DEAL",
    risk: "LOW",
    customerFacing: false,
    defaultAction: "CREATE_TASK",
    policyCategory: "deals",
    needsModel: false,
    description: "Active Deal with no upcoming task, appointment, or scheduled Agent action.",
    invalidatedBy: [
      DOMAIN_EVENT_TYPES.DEAL_CLOSED,
      DOMAIN_EVENT_TYPES.TASK_CREATED,
      DOMAIN_EVENT_TYPES.APPOINTMENT_CREATED,
      DOMAIN_EVENT_TYPES.CUSTOMER_COMMITMENT,
    ],
  },
  [TEMPORAL_TRIGGER_TYPES.CONVERSATION_RESPONSE_SLA]: {
    eventType: TEMPORAL_TRIGGER_TYPES.CONVERSATION_RESPONSE_SLA,
    sourceEntity: "CONVERSATION",
    risk: "LOW",
    customerFacing: false,
    defaultAction: "NOTIFY",
    policyCategory: "response_alerts",
    needsModel: false,
    description: "Inbound enquiry waiting without a response while the Agent is paused.",
    invalidatedBy: [
      DOMAIN_EVENT_TYPES.CONVERSATION_HUMAN_MESSAGE,
      DOMAIN_EVENT_TYPES.CONVERSATION_AGENT_MESSAGE,
      DOMAIN_EVENT_TYPES.CONVERSATION_AGENT_RESUMED,
    ],
  },
};

export function jobFingerprint(parts: {
  clientId: string;
  triggerType: string;
  entityId: string;
  policyId?: string;
  attemptNumber: number;
}): string {
  return [
    parts.clientId,
    parts.triggerType,
    parts.entityId,
    parts.policyId ?? "default",
    String(parts.attemptNumber),
  ].join(":");
}

export function eventFingerprint(parts: {
  clientId: string;
  type: string;
  entityId: string;
  idempotencyKey: string;
}): string {
  return [parts.clientId, parts.type, parts.entityId, parts.idempotencyKey].join(":");
}
