/**
 * Daily Sales Intelligence — shared types.
 * attentionScore is internal only; never surface prominently in UI.
 */

import type { LeadSource, LeadStatus } from "@/types";

export type SalesActionType =
  | "CONTACT_NEW_LEAD"
  | "RESPOND_TO_CUSTOMER"
  | "COMPLETE_FOLLOW_UP"
  | "FOLLOW_UP_QUOTE"
  | "FOLLOW_UP_NEGOTIATION"
  | "REENGAGE_STALE_DEAL"
  | "COMPLETE_SCHEDULED_CALL"
  | "COMPLETE_APPOINTMENT"
  | "CREATE_QUOTE"
  | "SCHEDULE_NEXT_ACTION"
  | "PROSPECT_NEW_CUSTOMERS"
  | "LOG_OUTREACH"
  | "ADD_VALID_PROSPECT"
  | "MANUAL_TASK"
  | "MANAGER_ASSIGNED_TASK";

export type SalesActionReasonCode =
  | "HIGH_INTENT_NEW_LEAD"
  | "CUSTOMER_WAITING"
  | "FOLLOWUP_OVERDUE"
  | "FOLLOWUP_DUE_TODAY"
  | "QUOTE_WAITING"
  | "QUOTE_APPROVAL_NEEDED"
  | "QUOTE_EXPIRING"
  | "QUOTE_VIEWED"
  | "QUOTE_CUSTOMER_CHANGES"
  | "DEAL_STALE"
  | "NO_NEXT_ACTION"
  | "LATE_STAGE_NEEDS_ACTION"
  | "GOAL_PIPELINE_LOW"
  | "SCHEDULED_TODAY"
  | "MANAGER_ASSIGNED"
  | "PROSPECTING_COMMITMENT";

export type SalesActionOrigin =
  | "USER_CREATED"
  | "MANAGER_ASSIGNED"
  | "SYSTEM_RECOMMENDED"
  | "GOAL_COMMITMENT";

export type FocusMode = "BUILD" | "MOVE" | "CLOSE";

export type SourceEntityType = "lead" | "deal" | "quotation" | "task" | "goal" | "none";

export type AvailableContactAction = "call" | "whatsapp" | "open_lead" | "add_prospect" | "log_outreach" | "schedule_follow_up" | "create_quote";

export type SalesActionRecommendation = {
  id: string;
  idempotencyKey: string;
  actionType: SalesActionType;
  origin: SalesActionOrigin;
  sourceEntityType: SourceEntityType;
  sourceEntityId: string | null;
  /** Internal 0–100 sort key — do not display prominently */
  attentionScore: number;
  title: string;
  subtitle: string | null;
  recommendedActionLabel: string;
  reasonCode: SalesActionReasonCode;
  reason: string;
  urgencyLabel: string | null;
  dueAt: string | null;
  customer: {
    leadId: string | null;
    name: string;
    phone: string | null;
    score: number | null;
    scoreBand: "Hot" | "Warm" | "Cold" | null;
    source: LeadSource | string | null;
    status: LeadStatus | string | null;
    projectType: string | null;
    dealValue: number | null;
  } | null;
  availableActions: AvailableContactAction[];
  metadata: Record<string, unknown>;
};

export type PipelineCoverageResult = {
  available: boolean;
  remainingGoalValue: number | null;
  activePipelineValue: number | null;
  coverageRatio: number | null;
  coverageLabel: string;
  interpretation: string;
};

export type DailyCommitmentKind =
  | "NEW_PROSPECTS"
  | "OUTREACH_ATTEMPTS"
  | "CALLS"
  | "FOLLOW_UPS"
  | "QUOTES_CREATED"
  | "APPOINTMENTS";

export type DailyCommitmentProgress = {
  kind: DailyCommitmentKind;
  label: string;
  completed: number;
  target: number;
  status: "not_started" | "in_progress" | "completed";
};

export type FocusModeResult = {
  mode: FocusMode;
  title: string;
  body: string;
  priorityActionCount: number;
};

export type DailySalesPlanProgress = {
  priorityCompleted: number;
  priorityTotal: number;
  commitments: DailyCommitmentProgress[];
  planComplete: boolean;
};

export type DailyPlanSchedule = {
  timezone: string;
  planDate: string;
  weekdayLabel: string;
  dateLabel: string;
  isWorkingDay: boolean;
  withinHours: boolean;
  beforeStart: boolean;
  afterEnd: boolean;
  workStartLabel: string;
  workEndLabel: string;
  workingDaysLabel: string;
  minutesLeftInWorkday: number | null;
  hoursLeftLabel: string | null;
  summary: string;
};

export type DailyFocusStatusPayload = {
  yesterdayMissed: boolean;
  yesterdayLabel: string | null;
  missedStreak: number;
  headline: string | null;
  supporting: string | null;
};

export type DailySalesPlanPayload = {
  generatedAt: string;
  planDate: string;
  timezone: string;
  schedule: DailyPlanSchedule;
  focus: FocusModeResult;
  coverage: PipelineCoverageResult;
  progress: DailySalesPlanProgress;
  nextBestAction: SalesActionRecommendation | null;
  queue: SalesActionRecommendation[];
  whatNeedsAttention: Array<{
    id: string;
    text: string;
    href: string;
  }>;
  goal: {
    hasGoal: boolean;
    targetValue: number | null;
    achievedValue: number | null;
    remainingValue: number | null;
    currency: string | null;
    workingDaysLeft: number | null;
    daysLeftLabel: string | null;
    dailyFocus: DailyFocusStatusPayload | null;
  };
  settingsConfigured: boolean;
  capabilities: {
    hasFocusMode: true;
    hasCommitments: boolean;
  };
};

/** Signal bag fed into the pure priority engine (testable without DB). */
export type LeadIntelligenceSignal = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: LeadSource | string | null;
  status: LeadStatus | string;
  score: number | null;
  manualPriority: "hot" | "warm" | "cold" | null;
  projectType: string | null;
  dealValue: number | null;
  budget: string | null;
  createdAt: string;
  followUpDate: string | null;
  callbackAt: string | null;
  assignedToId: string;
  followUpCreatedById: string | null;
  firstRespondedAt: string | null;
  lastMeaningfulActivityAt: string | null;
  awaitingReplyMinutes: number | null;
  hasFutureNextAction: boolean;
  openQuote: {
    id: string;
    quoteNumber: string | null;
    total: number | null;
    status: string;
    sentAt: string | null;
    approvalStatus?: string | null;
    viewedAt?: string | null;
    validUntil?: string | null;
    customerResponded?: boolean;
  } | null;
  isWhatsAppCapable: boolean;
  /** When set, this signal represents an active Deal (post Lead→Deal conversion). */
  dealId?: string | null;
};

export type PriorityEngineContext = {
  now: Date;
  salespersonId: string;
  planDate: string;
  remainingGoalValue: number | null;
  activePipelineValue: number | null;
  hasConfiguredProspectTarget: boolean;
  prospectTarget: number | null;
  prospectsCompletedToday: number;
  stageInactivityHours: Record<string, number>;
  quoteFollowupHours: number;
  weights: PriorityWeights;
};

export type PriorityWeights = {
  freshness: number;
  intent: number;
  responseUrgency: number;
  followUpUrgency: number;
  stageUrgency: number;
  quoteUrgency: number;
  inactivityRisk: number;
  customerWaiting: number;
  appointmentUrgency: number;
  goalImpact: number;
  valueSignal: number;
};

export type SalesExecutionSettingsRow = {
  id: string;
  clientId: string;
  salespersonId: string | null;
  dailyProspectTarget: number | null;
  dailyCallTarget: number | null;
  dailyFollowupTarget: number | null;
  dailyQuoteTarget: number | null;
  dailyAppointmentTarget: number | null;
  stageInactivityHours: Record<string, number> | null;
  quoteFollowupHours: number | null;
  priorityWeights: Partial<PriorityWeights> | null;
  /** Null inherits company baseline / default Mon–Fri. */
  workingDays: number[] | null;
  workStartTime: string | null;
  workEndTime: string | null;
};

export type ActionStateRow = {
  id: string;
  idempotencyKey: string;
  actionType: SalesActionType;
  reasonCode: SalesActionReasonCode;
  sourceEntityType: SourceEntityType;
  sourceEntityId: string | null;
  state: "active" | "completed" | "snoozed" | "skipped" | "resolved";
  snoozedUntil: string | null;
  skipReason: string | null;
  completedAt: string | null;
  resolvedAt: string | null;
  metadata: Record<string, unknown> | null;
};
