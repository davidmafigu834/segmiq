import type { ReportTrend } from "@/lib/sales/company-reports/metrics";

export const WEEKLY_SALES_REPORT_TYPE = "weekly_sales" as const;
export const WEEKLY_REPORT_VERSION = 1;

export type WeeklyReportStatus =
  | "scheduled"
  | "collecting_data"
  | "analysing"
  | "generating"
  | "ready"
  | "failed";

export type WeeklyReportKind = "system" | "user";

export type InsightKind = "fact" | "interpretation";

export type EvidenceKind = "deal" | "lead" | "quotation" | "task" | "message" | "aggregate";

export type EvidenceRef = {
  kind: EvidenceKind;
  ids: string[];
  label: string;
};

export type TaggedInsight = {
  kind: InsightKind;
  text: string;
  evidence?: EvidenceRef[];
};

export type WeekPeriod = {
  startDate: string;
  endDate: string;
  startIso: string;
  endIsoExclusive: string;
  timezone: string;
};

export type ComparedMetric = {
  id: string;
  label: string;
  current: number | null;
  previous: number | null;
  delta: number | null;
  trend: ReportTrend;
  format: "count" | "money" | "minutes" | "percent";
  invertGood?: boolean;
};

export type FunnelStageResult = {
  id: string;
  label: string;
  count: number;
  conversionPct: number;
  dropOff: number;
  sequential: boolean;
  note: string | null;
  bottleneck: boolean;
};

export type PipelineHealthBucketId =
  | "healthy"
  | "needs_attention"
  | "at_risk"
  | "stalled"
  | "quoted_awaiting_followup";

export type PipelineHealthBucket = {
  id: PipelineHealthBucketId;
  label: string;
  count: number;
  value: number;
  pct: number;
  causes: string[];
};

export type AttentionPriorityTag = "Reply Today" | "High Value" | "Stalled" | "Needs Review";

export type AttentionItem = {
  id: string;
  entityKind: "deal" | "lead";
  entityId: string;
  displayName: string;
  salespersonId: string | null;
  salespersonName: string | null;
  value: number | null;
  stage: string;
  stageLabel: string;
  lastActivityAt: string | null;
  daysInactive: number | null;
  latestEvent: string;
  reason: string;
  recommendedAction: string;
  priorityTag: AttentionPriorityTag | null;
};

export type SalespersonNarrative = {
  salespersonId: string;
  name: string;
  active: boolean;
  metrics: ComparedMetric[];
  strengths: string[];
  concerns: string[];
  coachingFocus: string;
  narrative: string;
  reassignedInCount: number;
  reassignedOutCount: number;
};

export type LostDealRow = {
  id: string;
  displayName: string;
  salespersonId: string | null;
  salespersonName: string | null;
  value: number | null;
  stageAtLoss: string;
  reason: string;
};

export type ConversationReliability = "Low sample" | "Emerging" | "Recurring" | "Reliable pattern";

export type ConversationPattern = {
  id: string;
  label: string;
  count: number;
  interpretation: string;
  reliability: ConversationReliability;
  evidence: EvidenceRef;
};

export type ManagerRecommendation = {
  title: string;
  evidence: string;
  action: string;
  objective: string;
};

export type NextWeekPriority = {
  title: string;
  affectedCount: number;
  pipelineValue: number | null;
  ownerLabel: string;
  targetDate: string | null;
  summary?: string | null;
};

export type PipelineHealthConfig = {
  needsAttentionDays: number;
  atRiskDays: number;
  quoteFollowupHours: number;
  stalledHoursByStage: Record<string, number>;
  slaResponseHours: number;
};

export type WeeklyReportCover = {
  organisationName: string;
  organisationLogoUrl: string | null;
  title: string;
  periodLabel: string;
  generatedAtLabel: string;
  preparedBy: string;
  timezone: string;
  currency: string;
};

export type WeeklyReportAiOutput = {
  executiveSummary: string;
  whatWentWell: string;
  whereMomentumWasLost: string;
  biggestRisk: string;
  biggestOpportunity: string;
  priorityForNextWeek: string;
  positiveFindings: string[];
  concerns: string[];
  risks: string[];
  opportunities: string[];
  managerRecommendations: ManagerRecommendation[];
  nextWeekPriorities: NextWeekPriority[];
  meetingAgenda: string[];
  salespersonNarratives: Array<{
    salespersonId: string;
    narrative: string;
    strengths: string[];
    concerns: string[];
    coachingFocus: string;
  }>;
  pipelineNarrative: string;
  lossAnalysisNarrative: string;
  conversationPatterns: Array<{ id: string; interpretation: string }>;
  dataSufficiencyNote: string | null;
};

export type WeeklyTeamSnapshot = {
  clientId: string;
  organisationName: string;
  organisationLogoUrl: string | null;
  currency: string;
  timezone: string;
  period: WeekPeriod;
  previousPeriod: WeekPeriod;
  nowIso: string;
  health: PipelineHealthConfig;
  salespeople: SnapshotPerson[];
  current: PeriodFacts;
  previous: PeriodFacts;
  activePipeline: SnapshotDeal[];
  openQuotes: SnapshotQuote[];
  lostThisWeek: LostDealRow[];
  lostPreviousWeek: LostDealRow[];
  attentionSeed: AttentionItem[];
  conversation: ConversationAggregate;
  reassignments: ReassignmentEvent[];
  activityVolume: number;
};

export type SnapshotPerson = {
  id: string;
  name: string;
  active: boolean;
  role: string;
};

export type PeriodFacts = {
  newLeads: number;
  contactedLeads: number;
  qualifiedLeads: number;
  dealsCreated: number;
  quotationsSent: number;
  quotationsAccepted: number;
  dealsWon: number;
  dealsLost: number;
  revenueWon: number;
  pipelineValue: number;
  avgFirstResponseMinutes: number | null;
  delayedResponses: number;
  onTimeResponses: number;
  delayedByHour: Record<string, number>;
  followUpsCompleted: number;
  followUpsMissed: number;
  overdueTasks: number;
  appointments: number;
  dealsProgressed: number;
  inboundMessages: number;
  outboundMessages: number;
  conversionRate: number | null;
  quotationToWinRate: number | null;
  leadsByPerson: Record<string, PersonPeriodFacts>;
};

export type PersonPeriodFacts = {
  leadsAssigned: number;
  leadsContacted: number;
  dealsCreated: number;
  quotationsSent: number;
  dealsWon: number;
  dealsLost: number;
  revenueWon: number;
  activePipelineValue: number;
  avgFirstResponseMinutes: number | null;
  followUpsCompleted: number;
  missedFollowUps: number;
  overdueActivities: number;
  staleDeals: number;
  conversionRate: number | null;
};

export type SnapshotDeal = {
  id: string;
  originatingLeadId: string | null;
  title: string;
  ownerId: string | null;
  ownerName: string | null;
  stage: string;
  value: number | null;
  lastActivityAt: string | null;
  nextActionAt: string | null;
  nextActionLabel: string | null;
  expectedDecisionAt: string | null;
  createdAt: string;
  hasOpenQuote: boolean;
  quoteSentAt: string | null;
  quoteFollowedUp: boolean;
  customerWaiting: boolean;
};

export type SnapshotQuote = {
  id: string;
  dealId: string | null;
  leadId: string | null;
  preparedById: string | null;
  status: string;
  total: number | null;
  sentAt: string | null;
};

export type ConversationAggregate = {
  scannedCount: number;
  truncated: boolean;
  patterns: Array<{ id: string; label: string; count: number; sampleIds: string[] }>;
};

export type ReassignmentEvent = {
  entityId: string;
  fromId: string | null;
  toId: string | null;
  at: string;
};

export type ResponseCoverage = {
  contactedAverageMinutes: number | null;
  newLeads: number;
  contactedLeads: number;
  onTime: number;
  missedSla: number;
  slaHours: number;
};

export type WeeklyReportPayload = {
  cover: WeeklyReportCover;
  metrics: ComparedMetric[];
  funnel: FunnelStageResult[];
  funnelExplanation: TaggedInsight[];
  pipelineHealth: PipelineHealthBucket[];
  pipelineHealthNarrative: string;
  attention: AttentionItem[];
  salespeople: SalespersonNarrative[];
  responseCoverage: ResponseCoverage;
  lostDeals: {
    count: number;
    previousCount: number;
    value: number;
    previousValue: number;
    rows: LostDealRow[];
    reasonCounts: Array<{ reason: string; count: number }>;
    narrative: string;
  };
  conversation: ConversationPattern[];
  insights: TaggedInsight[];
  ai: WeeklyReportAiOutput;
  evidence: EvidenceRef[];
  lowData: boolean;
  activityVolume: number;
  comparison: {
    previousWeek: WeekPeriod;
    fourWeekAverageSupported: boolean;
  };
};

export type WeeklyReportListItem = {
  id: string;
  periodStartDate: string;
  periodEndDate: string;
  periodLabel: string;
  generatedAt: string | null;
  status: WeeklyReportStatus;
  headline: string | null;
  findingCount: number;
  hasPdf: boolean;
  currency: string;
  lowData: boolean;
  newLeads: number | null;
  dealsWon: number | null;
  revenueWon: number | null;
  keyIssue: string | null;
};

export type WeeklyReportDetail = WeeklyReportListItem & {
  timezone: string;
  currency: string;
  reportVersion: number;
  aiStatus: string | null;
  pdfStatus: string | null;
  generationError: string | null;
  payload: WeeklyReportPayload | null;
};
