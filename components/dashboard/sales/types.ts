import type { LucideIcon } from "lucide-react";
import type { AvailableContactAction, DailyCommitmentProgress, SalesActionReasonCode } from "@/lib/sales/intelligence/types";
import type { DealActiveStage } from "@/lib/sales/deals/display";

export type SalesKpiTrend = {
  label: string;
  direction: "up" | "down" | "flat" | "alert";
};

export type SalesKpiItem = {
  id: string;
  label: string;
  value: string;
  supporting: string;
  trend?: SalesKpiTrend;
  icon:
    | "customers"
    | "companies"
    | "individuals"
    | "followups"
    | "pipeline"
    | "won"
    | "conversion"
    | "response"
    | "enquiries"
    | "deals";
  href?: string;
};

export type SalesPriorityTask = {
  id: string;
  leadId: string;
  clientId: string;
  name: string;
  initials: string;
  industry: string;
  location: string;
  dueLabel: string;
  overdue: boolean;
  taskLabel: string;
  taskDetail: string;
  phone: string | null;
  formData?: Record<string, unknown> | null;
  href: string;
};

export type SalesEnquiryPriorityItem = {
  id: string;
  leadId: string;
  name: string;
  projectType: string | null;
  source: string | null;
  intent: "Hot" | "Warm" | "Cold" | null;
  receivedLabel: string;
  reason: string;
  phone: string | null;
  availableActions: AvailableContactAction[];
  href: string;
};

export type SalesDealAttentionItem = {
  id: string;
  dealId: string;
  name: string;
  customerName: string;
  stage: DealActiveStage | string;
  stageLabel: string;
  valueLabel: string;
  valueBasisLabel: string | null;
  nextActionLabel: string;
  nextActionWhen: string | null;
  noNextAction: boolean;
  attentionReason: string;
  reasonCode: SalesActionReasonCode;
  atRisk: boolean;
  urgency: number;
  href: string;
};

export type SalesFunnelStage = {
  id: string;
  label: string;
  count: number;
  icon: "enquiries" | "contacted" | "qualified" | "deals" | "proposal" | "won";
};

export type SalesActivityTodayMetric = {
  id: string;
  label: string;
  completed: number;
  target: number | null;
  status: DailyCommitmentProgress["status"] | "not_started" | "in_progress" | "completed";
};

export type SalesPipelineSnapshotStage = {
  id: string;
  label: string;
  color: string;
  dealCount: number;
  valueLabel: string;
  knownValue: number;
  awaitingEstimate: number;
  href: string;
};

export type SalesPlanSummary = {
  state: "active" | "complete" | "build";
  headline: string;
  supporting: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  remainingPriority: number;
  prospectRemaining: number | null;
};

export type SalesPipelineDeal = {
  id: string;
  name: string;
  industry: string;
  valueLabel: string;
  href: string;
};

export type SalesPipelineStage = {
  id: string;
  label: string;
  color: string;
  dealCount: number;
  valueLabel: string;
  deals: SalesPipelineDeal[];
  remainingCount: number;
};

export type SalesLeadSourceItem = {
  id: string;
  label: string;
  count: number;
  changePct: number | null;
  brand: "whatsapp" | "facebook" | "referral" | "website" | "other" | "walkin";
  trendLabel?: string;
  trendDirection?: "up" | "down" | "flat";
};

export type SalesActivityItem = {
  id: string;
  kind: "whatsapp" | "quote" | "call" | "won" | "other" | "deal" | "lead";
  title: string;
  detail: string | null;
  timeLabel: string;
  href?: string;
};

export type SalesPerformancePoint = {
  label: string;
  value: number;
};

export type SalesPerformanceView = {
  progressPct: number;
  target: number;
  achieved: number;
  remaining: number;
  series: SalesPerformancePoint[];
  hasTarget: boolean;
  hasChartData: boolean;
  daysLeftLabel?: string | null;
};

export type SalesDashboardShellProps = {
  userName: string;
  userRoleLabel: string;
  avatarUrl?: string | null;
  isSolo: boolean;
  unreadNotifications: number;
  whatsappBadge: number;
  tasksBadge: number;
  notificationRole: string;
};

export type { LucideIcon };
