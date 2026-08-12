import type { SalesKpiItem } from "@/components/dashboard/sales/types";
import type { DealStage, DecisionMakerStatus } from "@/types";
import type { DealCommercialValue } from "@/lib/sales/deals/commercial-value";
import type { DealAttentionState } from "@/lib/sales/deals/attention";

export type CompanyPipelineTab =
  | "all"
  | "QUALIFIED"
  | "SCOPING"
  | "PROPOSAL_SENT"
  | "NEGOTIATING"
  | "WON"
  | "LOST";

export type CompanyPipelineHealth = "on_track" | "needs_attention" | "at_risk";

export type CompanyPipelineGroupBy = "none" | "stage" | "owner";

export type CompanyPipelineSort =
  | "next_action"
  | "value"
  | "expected_decision"
  | "newest"
  | "last_activity"
  | "attention";

export type CompanyPipelineNextActionFilter =
  | "all"
  | "overdue"
  | "today"
  | "week"
  | "none";

export type CompanyPipelineFilters = {
  ownerId: string | "all";
  health: "all" | CompanyPipelineHealth;
  nextAction: CompanyPipelineNextActionFilter;
  source: string | "all";
  valueMin: string;
  valueMax: string;
};

export const DEFAULT_COMPANY_PIPELINE_FILTERS: CompanyPipelineFilters = {
  ownerId: "all",
  health: "all",
  nextAction: "all",
  source: "all",
  valueMin: "",
  valueMax: "",
};

export type CompanyPipelineOwnerOption = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type CompanyPipelineSourceOption = {
  key: string;
  label: string;
};

export type CompanyPipelineNextActionView = {
  hasNextAction: boolean;
  isOverdue: boolean;
  label: string | null;
  at: string | null;
  whenLabel: string | null;
  urgency: "overdue" | "today" | "tomorrow" | "soon" | "later" | null;
};

export type CompanyPipelineDealRow = {
  id: string;
  dealName: string;
  category: string | null;
  customerName: string;
  customerLocation: string | null;
  customerPhone: string | null;
  originatingLeadId: string;
  stage: DealStage;
  stageLabel: string;
  valueLabel: string;
  valueKnown: number | null;
  valuePending: boolean;
  expectedDecisionAt: string | null;
  expectedDecisionLabel: string;
  nextAction: CompanyPipelineNextActionView;
  ownerId: string | null;
  ownerName: string | null;
  ownerAvatarUrl: string | null;
  health: CompanyPipelineHealth;
  healthLabel: string;
  healthReason: string;
  atRisk: boolean;
  urgency: number;
  sourceKey: string | null;
  sourceLabel: string | null;
  lostReason: string | null;
  wonValue: number | null;
  closedAt: string | null;
  closedAtLabel: string | null;
  createdAt: string;
  lastActivityAt: string;
  canModify: boolean;
};

export type CompanyPipelineDealDetail = {
  id: string;
  dealName: string;
  stage: DealStage;
  stageLabel: string;
  commercial: DealCommercialValue;
  valueLabel: string;
  customerName: string;
  customerLocation: string | null;
  customerPhone: string | null;
  whatsappHref: string | null;
  telHref: string | null;
  expectedDecisionAt: string | null;
  expectedDecisionLabel: string;
  ownerId: string | null;
  ownerName: string | null;
  ownerAvatarUrl: string | null;
  nextAction: CompanyPipelineNextActionView;
  health: CompanyPipelineHealth;
  healthLabel: string;
  healthReason: string;
  healthBarPct: number;
  customerNeed: string | null;
  decisionMakerName: string | null;
  decisionMakerStatus: DecisionMakerStatus | null;
  decisionMakerLabel: string | null;
  products: string[];
  originatingLeadId: string;
  leadSource: string | null;
  canModify: boolean;
  canReassign: boolean;
  viewDealHref: string;
  attention: Pick<DealAttentionState, "code" | "atRisk" | "needsAttention" | "reason">;
};

export type CompanyPipelineTabCounts = Record<CompanyPipelineTab, number>;

export type CompanyPipelineEligibleLead = {
  id: string;
  name: string;
  projectType: string | null;
};

export type CompanyPipelinePageData = {
  clientId: string;
  clientName: string;
  currency: string;
  actorUserId: string;
  alsoSells: boolean;
  canReassign: boolean;
  canCreateDeal: boolean;
  kpis: SalesKpiItem[];
  rows: CompanyPipelineDealRow[];
  tabCounts: CompanyPipelineTabCounts;
  owners: CompanyPipelineOwnerOption[];
  sources: CompanyPipelineSourceOption[];
  eligibleLeads: CompanyPipelineEligibleLead[];
  qualifiedLeadsHref: string;
  dealWorkspaceBase: string;
};
