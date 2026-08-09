import type { LucideIcon } from "lucide-react";

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
  icon: "followups" | "pipeline" | "won" | "conversion" | "response";
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
  brand: "whatsapp" | "facebook" | "referral" | "website" | "other";
  trendLabel?: string;
  trendDirection?: "up" | "down" | "flat";
};

export type SalesActivityItem = {
  id: string;
  kind: "whatsapp" | "quote" | "call" | "won" | "other";
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
