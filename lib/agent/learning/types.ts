/**
 * SegmiQ Agent Learning — shared types.
 * Observation creates evidence. Humans establish company truth.
 */

export const LEARNING_EXTRACTOR_VERSION = "1.0.0";
export const LEARNING_PROMPT_VERSION = "1.0.0";

export const LEARNING_SOURCES = [
  "CONVERSATION_SEGMENT",
  "HUMAN_CORRECTION",
  "TEACH_SEGMIQ",
  "MANAGER_FEEDBACK",
  "DEAL_PROGRESS",
  "QUOTATION_EVENT",
  "APPOINTMENT_EVENT",
  "HUMAN_TAKEOVER",
  "DAILY_BATCH",
  "BRAIN_UPDATED",
] as const;
export type LearningSource = (typeof LEARNING_SOURCES)[number];

export const LEARNING_TYPES = [
  "NEW_KNOWLEDGE",
  "REINFORCEMENT",
  "CONFLICT",
  "CORRECTION",
  "TERMINOLOGY",
  "BEHAVIOR_PATTERN",
] as const;
export type LearningType = (typeof LEARNING_TYPES)[number];

export const LEARNING_CATEGORIES = [
  "TONE",
  "QUALIFICATION",
  "FAQ",
  "OBJECTION_HANDLING",
  "PRODUCT_EXPLANATION",
  "SALES_PROCESS",
  "ESCALATION",
  "FOLLOW_UP",
  "CUSTOMER_LANGUAGE",
  "CLOSING_PATTERN",
  "APPOINTMENT_PATTERN",
  "SUPPORT_PATTERN",
  "COMMERCIAL_PATTERN",
] as const;
export type LearningCategory = (typeof LEARNING_CATEGORIES)[number];

export const LEARNING_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "VERY_HIGH"] as const;
export type LearningRiskLevel = (typeof LEARNING_RISK_LEVELS)[number];

export const LEARNING_CONFIDENCE_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type LearningConfidenceLevel = (typeof LEARNING_CONFIDENCE_LEVELS)[number];

export const LEARNING_COMPARISON_STATES = ["NEW", "SUPPORTS_EXISTING", "CONFLICTS", "DUPLICATES"] as const;
export type LearningComparisonState = (typeof LEARNING_COMPARISON_STATES)[number];

export const LEARNING_CANDIDATE_STATUSES = [
  "DETECTED",
  "REVIEWING",
  "APPROVED",
  "REJECTED",
  "MERGED",
  "EXPIRED",
] as const;
export type LearningCandidateStatus = (typeof LEARNING_CANDIDATE_STATUSES)[number];

export const LEARNING_KNOWLEDGE_STATUSES = ["ACTIVE", "INACTIVE", "SUPERSEDED", "NEEDS_REVIEW"] as const;
export type LearningKnowledgeStatus = (typeof LEARNING_KNOWLEDGE_STATUSES)[number];

export const LEARNING_KNOWLEDGE_SOURCES = [
  "SALES_TEAM_LEARNING",
  "MANAGER_TAUGHT",
  "HUMAN_CORRECTION",
] as const;
export type LearningKnowledgeSource = (typeof LEARNING_KNOWLEDGE_SOURCES)[number];

export const LEARNING_JOB_STATES = ["QUEUED", "PROCESSING", "COMPLETED", "SKIPPED", "FAILED"] as const;
export type LearningJobState = (typeof LEARNING_JOB_STATES)[number];

export const LEARNING_SKIP_REASONS = [
  "LEARNING_DISABLED",
  "CONVERSATION_EXCLUDED",
  "NO_HUMAN_MESSAGES",
  "INSUFFICIENT_CONTENT",
  "PRIVATE_CONVERSATION",
  "DUPLICATE_SEGMENT",
  "UNSUPPORTED_SOURCE",
  "FEATURE_FLAG_OFF",
  "SOURCE_DISABLED",
  "TENANT_BUDGET",
  "NO_ELIGIBLE_MESSAGES",
] as const;
export type LearningSkipReason = (typeof LEARNING_SKIP_REASONS)[number];

export const MESSAGE_ORIGINS = ["CUSTOMER", "HUMAN_SALESPERSON", "AGENT", "SYSTEM"] as const;
export type MessageOrigin = (typeof MESSAGE_ORIGINS)[number];

export const EXCLUSION_REASONS = [
  "SENSITIVE_CUSTOMER",
  "LEGAL_MATTER",
  "UNUSUAL_EXCEPTION",
  "CONFIDENTIAL_NEGOTIATION",
  "OTHER",
] as const;
export type LearningExclusionReason = (typeof EXCLUSION_REASONS)[number];

export const TEACH_INTENTS = [
  "GOOD_RESPONSE",
  "WRONG_RESPONSE",
  "REMEMBER_APPROACH",
  "NEVER_RESPOND_THIS_WAY",
  "ADD_AS_FAQ",
  "ADD_TO_PLAYBOOK",
  "ADD_TERMINOLOGY",
] as const;
export type TeachIntent = (typeof TEACH_INTENTS)[number];

export const EDIT_CLASSES = [
  "TRIVIAL_EDIT",
  "TONE_EDIT",
  "FACTUAL_CORRECTION",
  "POLICY_CORRECTION",
  "TECHNICAL_CORRECTION",
  "COMMERCIAL_CORRECTION",
] as const;
export type SemanticEditClass = (typeof EDIT_CLASSES)[number];

export const MANAGER_LEARNING_FEEDBACK = [
  "USEFUL",
  "INCORRECT",
  "TOO_SPECIFIC",
  "ONE_OFF_EXCEPTION",
  "ALREADY_KNOWN",
  "UNSAFE",
] as const;
export type ManagerLearningFeedback = (typeof MANAGER_LEARNING_FEEDBACK)[number];

export const LEARNING_DESTINATIONS = [
  "LEARNED_KNOWLEDGE",
  "QUALIFICATION_PLAYBOOK",
  "FAQ",
  "BRAND_VOICE",
  "RESPONSE_EXAMPLE",
  "SALES_PROCESS",
  "ESCALATION",
  "TERMINOLOGY",
] as const;
export type LearningDestination = (typeof LEARNING_DESTINATIONS)[number];

export const LEARNING_PERMISSIONS = [
  "agent.learning.view",
  "agent.learning.submit",
  "agent.learning.review",
  "agent.learning.approve",
  "agent.learning.reject",
  "agent.learning.manage",
  "agent.learning.settings",
  "agent.learning.excludeConversation",
] as const;
export type LearningPermission = (typeof LEARNING_PERMISSIONS)[number];

export const LEARNING_FLAG_KEYS = [
  "agent.learning.enabled",
  "agent.learning.sales",
  "agent.learning.support",
  "agent.learning.copilotEdits",
  "agent.learning.teach",
  "agent.learning.indicators",
  "agent.learning.autoAnalyze",
  "agent.learning.retrieval",
] as const;
export type LearningFlagKey = (typeof LEARNING_FLAG_KEYS)[number];

export type LearningConfig = {
  sales: boolean;
  support: boolean;
  copilotEdits: boolean;
  teach: boolean;
  managerFeedback: boolean;
  internalNotes: boolean;
  indicators: boolean;
  autoAnalyze: boolean;
  retrieval: boolean;
  idleMinutes: number;
  minHumanMessages: number;
  minMeaningfulChars: number;
  dailyTokenBudget: number;
  managersMayDirectApprove: boolean;
};

export type LearningSettings = {
  clientId: string;
  enabled: boolean;
  suggestReplies: boolean;
  config: LearningConfig;
};

export type LearningObservation = {
  type: LearningType;
  category: LearningCategory;
  title: string;
  summary: string;
  proposedLearning: string;
  riskLevel: LearningRiskLevel;
  evidenceMessageIds: string[];
  confidence: LearningConfidenceLevel;
  phrase?: string;
  canonicalMeaning?: string;
  oneOffException?: boolean;
};

export type ExtractorOutput = {
  observations: LearningObservation[];
};

export type KnowledgeCompareResult = {
  state: LearningComparisonState;
  existingType?: string;
  existingId?: string;
  summary: string;
};

export type LearningCandidate = {
  id: string;
  clientId: string;
  type: LearningType;
  category: LearningCategory;
  title: string;
  summary: string;
  proposedLearning: string;
  originalProposedLearning: string | null;
  confidenceLevel: LearningConfidenceLevel;
  confidenceScore: number | null;
  evidenceCount: number;
  conversationCount: number;
  salespersonCount: number;
  riskLevel: LearningRiskLevel;
  comparisonState: LearningComparisonState;
  existingKnowledgeType: string | null;
  existingKnowledgeId: string | null;
  existingKnowledgeSummary: string | null;
  status: LearningCandidateStatus;
  semanticKey: string;
  previouslyRejected: boolean;
  resurfacedAt: string | null;
  firstObservedAt: string;
  lastObservedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  managerFeedback: ManagerLearningFeedback | null;
  managerComment: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export type LearnedKnowledge = {
  id: string;
  clientId: string;
  candidateId: string | null;
  category: string;
  title: string;
  content: string;
  originalContent: string | null;
  source: LearningKnowledgeSource;
  status: LearningKnowledgeStatus;
  confidenceLevel: LearningConfidenceLevel;
  evidenceCount: number;
  conversationCount: number;
  salespersonCount: number;
  usageCount: number;
  approvedBy: string | null;
  approvedAt: string | null;
  firstObservedAt: string | null;
  lastObservedAt: string | null;
  lastReinforcedAt: string | null;
  destinationType: string | null;
  destinationId: string | null;
  supersededBy: string | null;
  intentHints: string[];
  semanticKey: string;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeUsedRef = {
  type: "COMPANY_BRAIN" | "LEARNED_KNOWLEDGE" | "QUOTATION" | "PRODUCT" | "PACKAGE";
  id: string;
  title: string;
  category?: string;
};

export const DEFAULT_LEARNING_CONFIG: LearningConfig = {
  sales: true,
  support: false,
  copilotEdits: true,
  teach: true,
  managerFeedback: true,
  internalNotes: false,
  indicators: true,
  autoAnalyze: true,
  retrieval: true,
  idleMinutes: 12,
  minHumanMessages: 2,
  minMeaningfulChars: 80,
  dailyTokenBudget: 400_000,
  managersMayDirectApprove: false,
};

export const CATEGORY_LABELS: Record<LearningCategory, string> = {
  TONE: "Tone",
  QUALIFICATION: "Qualification",
  FAQ: "FAQ",
  OBJECTION_HANDLING: "Objection handling",
  PRODUCT_EXPLANATION: "Product explanation",
  SALES_PROCESS: "Sales process",
  ESCALATION: "Escalation",
  FOLLOW_UP: "Follow-up",
  CUSTOMER_LANGUAGE: "Customer language",
  CLOSING_PATTERN: "Closing pattern",
  APPOINTMENT_PATTERN: "Appointment pattern",
  SUPPORT_PATTERN: "Support pattern",
  COMMERCIAL_PATTERN: "Commercial pattern",
};
