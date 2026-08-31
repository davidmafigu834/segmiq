/**
 * SegmiQ Agent — shared types.
 *
 * The agent sits on top of canonical SegmiQ systems (leads, deals, quotations,
 * follow-ups, WhatsApp). Nothing in this module duplicates business entities.
 */

export const AGENT_AUTONOMY_MODES = ["ASSIST", "COPILOT", "AUTOPILOT"] as const;
export type AgentAutonomyMode = (typeof AGENT_AUTONOMY_MODES)[number];

/** Shared intelligence foundation. Each mode has different context, tools, and authority. */
export const AGENT_MODES = ["CUSTOMER", "SALESPERSON", "MANAGER"] as const;
export type AgentMode = (typeof AGENT_MODES)[number];

export const AGENT_EXECUTION_STATES = [
  "QUEUED",
  "RUNNING",
  "WAITING_FOR_TOOL",
  "WAITING_FOR_HUMAN",
  "WAITING_FOR_INPUT",
  "WAITING_FOR_CONFIRMATION",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "SKIPPED",
] as const;
export type AgentExecutionState = (typeof AGENT_EXECUTION_STATES)[number];

export const AGENT_CONVERSATION_STATUSES = [
  "IDLE",
  "AI_HANDLING",
  "HUMAN_NEEDED",
  "PAUSED",
  "WAITING_ON_CUSTOMER",
  "FOLLOW_UP_SCHEDULED",
  "HUMAN_HANDLING",
] as const;
export type AgentConversationStatus = (typeof AGENT_CONVERSATION_STATUSES)[number];

export type { AgentConversationMode, RealEstateAgentSettings } from "./real-estate/types";

export const AGENT_INTENTS = [
  "NEW_SALES_ENQUIRY",
  "PRODUCT_QUESTION",
  "QUALIFICATION_RESPONSE",
  "PRICING_REQUEST",
  "QUOTATION_REQUEST",
  "QUOTATION_CHANGE_REQUEST",
  "DISCOUNT_REQUEST",
  "APPOINTMENT_REQUEST",
  "RESCHEDULE_REQUEST",
  "FOLLOW_UP_REQUEST",
  "CALLBACK_REQUEST",
  "SUPPORT_REQUEST",
  "COMPLAINT",
  "EXISTING_DEAL_QUESTION",
  "GENERAL_MESSAGE",
  "HUMAN_REQUEST",
] as const;
export type AgentIntent = (typeof AGENT_INTENTS)[number];

export const AGENT_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "VERY_HIGH"] as const;
export type AgentRiskLevel = (typeof AGENT_RISK_LEVELS)[number];

export const AGENT_ESCALATION_REASONS = [
  "LOW_CONFIDENCE",
  "CUSTOMER_REQUESTED_HUMAN",
  "PRICING_DISPUTE",
  "COMPLAINT",
  "TECHNICAL_RISK",
  "COMMERCIAL_APPROVAL",
  "UNSUPPORTED_REQUEST",
  "POLICY_BLOCKED",
  "CONFLICTING_CUSTOMER_DATA",
  "SYSTEM_FAILURE",
  "RATE_LIMITED",
  "ATTACHMENT_REVIEW",
  "KNOWLEDGE_CONFLICT",
] as const;
export type AgentEscalationReason = (typeof AGENT_ESCALATION_REASONS)[number];

/** Company-level agent configuration (agent_company_settings row, camelCased). */
export type AgentCompanySettings = {
  clientId: string;
  enabled: boolean;
  autonomyMode: AgentAutonomyMode;
  respondToEnquiries: boolean;
  qualifyLeads: boolean;
  createLeads: boolean;
  createDeals: boolean;
  createTasks: boolean;
  scheduleCallbacks: boolean;
  scheduleAppointments: boolean;
  rescheduleAppointments: boolean;
  prepareQuotations: boolean;
  sendQuotations: boolean;
  sendFollowUps: boolean;
  transferSupport: boolean;
  createSupportCases: boolean;
  negotiateDiscounts: boolean;
  quoteAutoSendLimit: number | null;
  businessHoursPolicy: "ALWAYS" | "BUSINESS_HOURS_ONLY" | "AFTER_HOURS_ACK";
  disclosureText: string | null;
  tone: "professional" | "friendly" | "concise";
  languagePreference: string | null;
  escalationUserId: string | null;
  maxQuestionsPerMessage: number;
  debounceSeconds: number;
  dailyExecutionLimit: number;
  conversationHourlyLimit: number;
  testMode: boolean;
  /** Independent of Customer Agent. Observe eligible human conversations. */
  learningEnabled: boolean;
  /** Copilot / suggest-reply. May be on while Customer Agent is off. */
  suggestReplies: boolean;
  /**
   * Sales Agent — internal work commands for salespeople.
   * Independent of Customer Agent. Does not send messages to customers.
   */
  salesAgentEnabled: boolean;
  salesAgentCommandCenter: boolean;
  salesAgentSalesHubCommand: boolean;
  salesAgentQuotationCreation: boolean;
  salesAgentQuotationUpdate: boolean;
  salesAgentContextualExtraction: boolean;
  /** Real-estate WhatsApp agent toggles (null-equivalent when client is trades). */
  realEstate?: import("./real-estate/types").RealEstateAgentSettings;
};

/** Per-conversation agent state (agent_conversation_state row, camelCased). */
export type AgentConversationState = {
  leadId: string;
  clientId: string;
  agentEnabled: boolean;
  status: AgentConversationStatus;
  humanNeededReason: string | null;
  pausedUntil: string | null;
  pausedById: string | null;
  pauseReason: string | null;
  humanTakeover: boolean;
  conversationMode: import("./real-estate/types").AgentConversationMode;
  lastAgentMessageAt: string | null;
  lastHumanMessageAt: string | null;
  lastCustomerMessageAt: string | null;
  pendingExecutionId: string | null;
  lockAcquiredAt: string | null;
};

/**
 * Normalized inbound conversation event handed to the agent runtime.
 * Derived from the canonical whatsapp_messages record — never provider payloads.
 */
export type InboundConversationEvent = {
  /** whatsapp_messages.id — canonical persisted message. */
  messageId: string;
  clientId: string;
  /** Lead-backed conversation id. */
  leadId: string;
  contactId: string | null;
  channel: "whatsapp";
  messageType: string;
  text: string;
  hasAttachment: boolean;
  timestamp: string;
  ownerId: string | null;
  conversationType: "SALES" | "SUPPORT" | "GENERAL";
  isNewLead: boolean;
};

/** One memory field entry. Supersession keeps history without duplicating currency. */
export type AgentMemoryEntry = {
  value: string;
  source: "customer_message" | "agent_inference" | "crm";
  confidence: number;
  updatedAt: string;
  evidence?: string;
  superseded?: Array<{ value: string; updatedAt: string }>;
};

/** Flat map keyed by dot paths, e.g. "requirements.projectType". */
export type AgentCustomerMemory = Record<string, AgentMemoryEntry>;

/** Result of a policy check for a requested tool call. */
export type AgentPolicyDecision =
  | { allowed: true }
  | { allowed: false; reason: string; escalate?: AgentEscalationReason };

export type AgentToolStatus = "EXECUTED" | "BLOCKED" | "FAILED" | "SIMULATED" | "INVALID";

/** Audit-safe record of one tool call within an execution. */
export type AgentActionRecord = {
  toolName: string;
  riskLevel: AgentRiskLevel;
  status: AgentToolStatus;
  inputSummary: Record<string, unknown>;
  resultSummary: Record<string, unknown> | null;
  blockedReason?: string;
  error?: string;
  createdRecordType?: string;
  createdRecordId?: string;
};

/** Usage metadata for one model call. */
export type AgentModelUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type AgentRunOutcome = {
  executionId: string;
  state: AgentExecutionState;
  reply: string | null;
  replyStatus: "SENT" | "DRAFTED" | "SUPPRESSED" | "FAILED" | null;
  intents: AgentIntent[];
  actions: AgentActionRecord[];
  escalationReason?: AgentEscalationReason;
};
