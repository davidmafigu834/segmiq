import type { SalesActionReasonCode } from "@/lib/sales/intelligence/types";
import type {
  SalesFunnelStage,
  SalesKpiItem,
  SalesPipelineSnapshotStage,
} from "@/components/dashboard/sales/types";
import type { BusinessType } from "@/lib/terminology";

export type CompanyFocusSeverity = "critical" | "high" | "medium" | "info";

export type CompanyFocusSignal = {
  id: string;
  severity: CompanyFocusSeverity;
  count: number;
  label: string;
  supporting: string;
  href: string;
  ctaLabel?: string;
};

export type CompanyTeamMemberRow = {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  roleLabel: string;
  activeDeals: number;
  pipelineValueKnown: number;
  pipelineValueLabel: string;
  pipelineAwaitingEstimate: number;
  dealsWon: number;
  wonValue: number;
  followUpsDue: number;
  hasGoal: boolean;
  goalProgressPct: number | null;
  href: string;
};

export type CompanyLeadSourceItem = {
  id: string;
  label: string;
  count: number;
  pct: number;
  brand: "whatsapp" | "facebook" | "referral" | "website" | "walkin" | "other";
};

export type CompanyAtRiskDeal = {
  id: string;
  dealId: string;
  name: string;
  valueLabel: string;
  knownValue: number | null;
  reason: string;
  reasonCode: SalesActionReasonCode;
  ownerName: string | null;
  ownerId: string | null;
  stageLabel: string;
  urgency: number;
  href: string;
};

export type CompanyRevenuePoint = {
  monthKey: string;
  label: string;
  value: number;
};

export type CompanyActivityItem = {
  id: string;
  kind: "whatsapp" | "quote" | "call" | "won" | "other" | "deal" | "lead";
  title: string;
  detail: string | null;
  timeLabel: string;
  href?: string;
  actorName: string | null;
};

export type CompanyCalendarItem = {
  id: string;
  kind: "follow_up" | "call" | "deal_action" | "quote_review";
  title: string;
  customerName: string | null;
  ownerName: string | null;
  ownerId: string | null;
  startAt: string;
  dayKey: string;
  dayLabel: string;
  timeLabel: string;
  overdue: boolean;
  href: string;
};

export type CompanySalesDashboardData = {
  clientId: string;
  clientName: string;
  alsoSells: boolean;
  businessType: BusinessType;
  generatedAt: string;
  kpis: SalesKpiItem[];
  focusAreas: CompanyFocusSignal[];
  focusAreasViewAllHref: string;
  teamCalendar: CompanyCalendarItem[];
  teamCalendarOverdueCount: number;
  team: CompanyTeamMemberRow[];
  teamTotal: number;
  teamViewAllHref: string;
  funnel: SalesFunnelStage[];
  conversionRate: number | null;
  conversionDefinition: string;
  sources: CompanyLeadSourceItem[];
  sourcesEmpty: boolean;
  pipelineSnapshot: SalesPipelineSnapshotStage[];
  hasActiveDeals: boolean;
  atRiskDeals: CompanyAtRiskDeal[];
  atRiskTotal: number;
  atRiskViewAllHref: string;
  revenueTrend: CompanyRevenuePoint[];
  revenueTotal: number;
  revenueTotalLabel: string;
  revenueTrendCompare?: SalesKpiItem["trend"];
  hasRevenueHistory: boolean;
  recentActivity: CompanyActivityItem[];
  emptyState: {
    noTeam: boolean;
    noLeads: boolean;
    noDeals: boolean;
    isNewCompany: boolean;
  };
  metrics: {
    newEnquiries30d: number;
    qualifiedLeads30d: number;
    activeDeals: number;
    pipelineValueKnown: number;
    pipelineAwaitingEstimate: number;
    dealsWonThisMonth: number;
    wonValueThisMonth: number;
    overdueFollowUps: number;
    dealsAtRisk: number;
    hotAwaitingContact: number;
    noNextAction: number;
    unassignedLeads: number;
    avgResponseMinutes: number | null;
  };
};
