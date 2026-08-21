export const CONVERSATION_TYPES = ["SALES", "SUPPORT", "GENERAL"] as const;
export type ConversationType = (typeof CONVERSATION_TYPES)[number];

export const CONVERSATION_QUEUES = ["SALES", "SUPPORT"] as const;
export type ConversationQueue = (typeof CONVERSATION_QUEUES)[number];

export const SUPPORT_CASE_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_ON_CUSTOMER",
  "RESOLVED",
] as const;
export type SupportCaseStatus = (typeof SUPPORT_CASE_STATUSES)[number];

export const SUPPORT_REASON_CATEGORIES = [
  "TECHNICAL",
  "INSTALLATION",
  "WARRANTY",
  "CUSTOMER_SERVICE",
  "OTHER",
] as const;
export type SupportReasonCategory = (typeof SUPPORT_REASON_CATEGORIES)[number];

export const CONVERSATION_TYPE_LABEL: Record<ConversationType, string> = {
  SALES: "Sales",
  SUPPORT: "Support",
  GENERAL: "General",
};

export const CONVERSATION_QUEUE_LABEL: Record<ConversationQueue, string> = {
  SALES: "Sales Team",
  SUPPORT: "Support Team",
};

export const SUPPORT_CASE_STATUS_LABEL: Record<SupportCaseStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  WAITING_ON_CUSTOMER: "Waiting on customer",
  RESOLVED: "Resolved",
};

export const SUPPORT_REASON_LABEL: Record<SupportReasonCategory, string> = {
  TECHNICAL: "Technical support",
  INSTALLATION: "Installation issue",
  WARRANTY: "Warranty issue",
  CUSTOMER_SERVICE: "Customer service",
  OTHER: "Other",
};

export function parseConversationType(value: unknown): ConversationType {
  if (value === "SUPPORT" || value === "GENERAL") return value;
  return "SALES";
}

export function parseConversationQueue(value: unknown): ConversationQueue {
  return value === "SUPPORT" ? "SUPPORT" : "SALES";
}

export function parseSupportCaseStatus(value: unknown): SupportCaseStatus {
  if (
    value === "IN_PROGRESS" ||
    value === "WAITING_ON_CUSTOMER" ||
    value === "RESOLVED"
  ) {
    return value;
  }
  return "OPEN";
}

export function parseSupportReasonCategory(value: unknown): SupportReasonCategory | null {
  if (
    value === "TECHNICAL" ||
    value === "INSTALLATION" ||
    value === "WARRANTY" ||
    value === "CUSTOMER_SERVICE" ||
    value === "OTHER"
  ) {
    return value;
  }
  return null;
}

export function supportStageLabel(status: SupportCaseStatus | null | undefined): string {
  if (!status) return "Open support";
  if (status === "OPEN") return "Open support";
  return SUPPORT_CASE_STATUS_LABEL[status];
}
