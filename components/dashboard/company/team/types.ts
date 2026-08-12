import type { SalesKpiItem } from "@/components/dashboard/sales/types";
import type { CompanyActivityItem, CompanyRevenuePoint } from "../types";

export type CompanyTeamTab = "all" | "salespeople" | "managers" | "inactive";

export type CompanyTeamAttention = "on_track" | "watch" | "needs_attention";

export type CompanyTeamRoleGroup = "salesperson" | "manager" | "support";

export type CompanyTeamMemberTableRow = {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
  /** Short role for Role column: Salesperson / Sales Manager / Manager */
  roleColumn: string;
  /** Title under name */
  titleLabel: string;
  roleGroup: CompanyTeamRoleGroup;
  isActive: boolean;
  alsoSells: boolean;
  activeDeals: number;
  pipelineValueKnown: number;
  pipelineValueLabel: string;
  pipelineAwaitingEstimate: number;
  dealsWon: number;
  wonValue: number;
  followUpsDue: number;
  overdueFollowUps: number;
  hasGoal: boolean;
  goalId: string | null;
  goalTarget: number | null;
  goalCurrency: string | null;
  goalProgressPct: number | null;
  attention: CompanyTeamAttention;
  attentionLabel: string;
  supportReason: string | null;
  dealsAtRisk: number;
  hotAwaitingContact: number;
};

export type CompanyTeamCompositionSlice = {
  id: CompanyTeamRoleGroup;
  label: string;
  count: number;
  pct: number;
  color: string;
};

export type CompanyTeamGoalCoverageBucket = {
  id: "above_80" | "mid" | "below_50" | "no_goal";
  label: string;
  count: number;
  color: string;
};

export type CompanyTeamSupportPerson = {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  reason: string;
  attention: CompanyTeamAttention;
  attentionLabel: string;
  goalProgressPct: number | null;
};

export type CompanyTeamNeedsAttentionItem = {
  id: string;
  label: string;
  href: string;
  severity: "critical" | "high" | "medium";
};

export type CompanyTeamFilters = {
  attention: "all" | CompanyTeamAttention;
  goal: "all" | "has" | "none";
  followUpsDue: boolean;
  dealsAtRisk: boolean;
};

export const DEFAULT_COMPANY_TEAM_FILTERS: CompanyTeamFilters = {
  attention: "all",
  goal: "all",
  followUpsDue: false,
  dealsAtRisk: false,
};

export type CompanyTeamMemberOverview = {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
  titleLabel: string;
  roleColumn: string;
  isActive: boolean;
  accountStatusLabel: "Active" | "Inactive";
  alsoSells: boolean;
  attention: CompanyTeamAttention;
  attentionLabel: string;
  hasGoal: boolean;
  goalId: string | null;
  goalTarget: number | null;
  goalAchieved: number;
  goalCurrency: string;
  goalProgressPct: number | null;
  goalTargetLabel: string | null;
  goalAchievedLabel: string | null;
  activeDeals: number;
  pipelineValueKnown: number;
  pipelineValueLabel: string;
  dealsWon: number;
  overdueFollowUps: number;
  avgResponseMinutes: number | null;
  avgResponseLabel: string;
  winRate: number | null;
  winRateLabel: string;
  closedDealsCount: number;
  performanceTrend: CompanyRevenuePoint[];
  hasPerformanceHistory: boolean;
  needsAttention: CompanyTeamNeedsAttentionItem[];
  recentActivity: CompanyActivityItem[];
};

export type CompanyTeamPageData = {
  clientId: string;
  clientName: string;
  alsoSells: boolean;
  canManageTeam: boolean;
  canReassignLeads: boolean;
  canSetGoals: boolean;
  generatedAt: string;
  currency: string;
  kpis: SalesKpiItem[];
  members: CompanyTeamMemberTableRow[];
  composition: CompanyTeamCompositionSlice[];
  compositionTotal: number;
  goalCoverage: {
    teamAvgPct: number | null;
    buckets: CompanyTeamGoalCoverageBucket[];
  };
  needingSupport: CompanyTeamSupportPerson[];
  emptyState: {
    noTeam: boolean;
  };
};
