/**
 * Application DEFAULTS for sales execution — not business truth.
 * Managers can override via sales_execution_settings later.
 */

import type { PriorityWeights } from "./types";

/** Hours without meaningful activity before a stage is considered stale. */
export const DEFAULT_STAGE_INACTIVITY_HOURS: Record<string, number> = {
  NEW: 24,
  CONTACTED: 72,
  QUALIFIED: 72,
  // Deal stages
  SCOPING: 96,
  NEGOTIATING: 168, // ~7 days
  PROPOSAL_SENT: 72,
};

/** Hours after a quote is sent before follow-up is recommended. */
export const DEFAULT_QUOTE_FOLLOWUP_HOURS = 72;

/** Minutes within which a new high-intent lead is treated as "fresh inbound". */
export const DEFAULT_FRESH_LEAD_WINDOW_MINUTES = 120;

/** Max items in Up Next queue. */
export const DEFAULT_PRIORITY_QUEUE_LIMIT = 8;

export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  freshness: 18,
  intent: 16,
  responseUrgency: 14,
  followUpUrgency: 14,
  stageUrgency: 10,
  quoteUrgency: 10,
  inactivityRisk: 10,
  customerWaiting: 16,
  appointmentUrgency: 8,
  goalImpact: 6,
  valueSignal: 4,
};

export const DEFAULT_SALES_EXECUTION = {
  stageInactivityHours: DEFAULT_STAGE_INACTIVITY_HOURS,
  quoteFollowupHours: DEFAULT_QUOTE_FOLLOWUP_HOURS,
  freshLeadWindowMinutes: DEFAULT_FRESH_LEAD_WINDOW_MINUTES,
  priorityQueueLimit: DEFAULT_PRIORITY_QUEUE_LIMIT,
  weights: DEFAULT_PRIORITY_WEIGHTS,
  /** Mon–Fri fallback when no working-day calendar exists. */
  workingDays: [1, 2, 3, 4, 5] as const,
  /** Default company work window when operating hours are not configured. */
  workStartTime: "08:00",
  workEndTime: "17:00",
  timezoneFallback: "Africa/Harare",
} as const;

export const INBOUND_LEAD_SOURCES = new Set([
  "FACEBOOK",
  "FACEBOOK_AD",
  "WHATSAPP_INBOUND",
  "LANDING_PAGE",
  "WEBSITE",
]);

/** Sources that can count toward salesperson prospecting (not inbound acquisition). */
export const PROSPECTING_ELIGIBLE_SOURCES = new Set([
  "MANUAL",
  "REFERRAL",
]);

/** Lead acquisition statuses still worked in the daily plan (pre-deal). */
export const ACTIVE_LEAD_LIFECYCLE_STATUSES = new Set([
  "NEW",
  "CONTACTED",
  "QUALIFIED",
]);

/** @deprecated Prefer ACTIVE_LEAD_LIFECYCLE_STATUSES + active deals */
export const ACTIVE_PIPELINE_STATUSES = new Set([
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  // Legacy commercial statuses if migration not yet applied
  "NEGOTIATING",
  "PROPOSAL_SENT",
]);

export const ACTIVE_DEAL_STAGES = new Set([
  "QUALIFIED",
  "SCOPING",
  "PROPOSAL_SENT",
  "NEGOTIATING",
]);

export const CLOSED_PIPELINE_STATUSES = new Set([
  "WON",
  "LOST",
  "NOT_QUALIFIED",
  "CONVERTED_TO_DEAL",
]);

export const OPEN_QUOTE_STATUSES = new Set(["sent", "viewed"]);

export const MEANINGFUL_LEAD_EVENT_TYPES = new Set([
  "CALL_LOGGED",
  "MESSAGE_SENT",
  "MESSAGE_RECEIVED",
  "DOCUMENT_SENT",
  "FOLLOW_UP_SET",
  "STATUS_CHANGED",
]);

export const FIRST_RESPONSE_EVENT_TYPES = new Set([
  "CALL_LOGGED",
  "MESSAGE_SENT",
]);
