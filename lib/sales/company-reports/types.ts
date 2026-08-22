import type { ReportGranularity } from "./range";
import type { FunnelStage, PipelineStageSlice, ReportTrend, SourceSlice } from "./metrics";

export type CompanyReportTab =
  | "overview"
  | "sales"
  | "pipeline"
  | "leads"
  | "whatsapp"
  | "quotations"
  | "team"
  | "customers"
  | "activities";

export const COMPANY_REPORT_TABS: { id: CompanyReportTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "sales", label: "Sales" },
  { id: "pipeline", label: "Pipeline" },
  { id: "leads", label: "Leads" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "quotations", label: "Quotations" },
  { id: "team", label: "Team" },
  { id: "customers", label: "Customers" },
  { id: "activities", label: "Activities" },
];

export type ReportKpi = {
  id: string;
  label: string;
  value: string;
  raw: number | null;
  trend: ReportTrend;
  sparkline: number[];
  invertGood?: boolean;
  tip?: string;
};

export type ReportTimePoint = {
  key: string;
  label: string;
  current: number;
  previous: number;
};

export type ReportSalespersonRow = {
  userId: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  revenueWon: number;
  dealsWon: number;
  sparkline: number[];
  trend: ReportTrend;
};

export type PerformanceSummaryRow = {
  id: string;
  label: string;
  value: string;
  trend: ReportTrend;
  invertGood?: boolean;
};

export type CompanyReportOverview = {
  tab: "overview";
  generatedAt: string;
  currency: string;
  timezoneNote: string;
  range: {
    from: string;
    to: string;
    label: string;
    previousFrom: string;
    previousTo: string;
    previousLabel: string;
    granularity: ReportGranularity;
  };
  filters: {
    ownerId: string | null;
    ownerName: string | null;
  };
  kpis: ReportKpi[];
  revenueSeries: ReportTimePoint[];
  pipeline: {
    slices: PipelineStageSlice[];
    activeCount: number;
    knownValue: number;
    pendingCount: number;
    mode: "count" | "value";
  };
  performanceSummary: PerformanceSummaryRow[];
  leadSeries: ReportTimePoint[];
  funnel: {
    stages: FunnelStage[];
    methodology: string;
  };
  topSalespeople: ReportSalespersonRow[];
  leadSources: {
    rows: SourceSlice[];
    total: number;
  };
  owners: Array<{ id: string; name: string }>;
  errors: Partial<Record<string, string>>;
};

export type CompanyReportSalesTab = {
  tab: "sales";
  generatedAt: string;
  currency: string;
  range: CompanyReportOverview["range"];
  filters: CompanyReportOverview["filters"];
  owners: CompanyReportOverview["owners"];
  kpis: ReportKpi[];
  revenueSeries: ReportTimePoint[];
  bySalesperson: ReportSalespersonRow[];
  winRate: number | null;
  wonCount: number;
  lostCount: number;
  errors: Partial<Record<string, string>>;
};

export type CompanyReportPipelineTab = {
  tab: "pipeline";
  generatedAt: string;
  currency: string;
  range: CompanyReportOverview["range"];
  filters: CompanyReportOverview["filters"];
  owners: CompanyReportOverview["owners"];
  kpis: ReportKpi[];
  pipeline: CompanyReportOverview["pipeline"];
  noNextAction: number;
  errors: Partial<Record<string, string>>;
};

export type CompanyReportLeadsTab = {
  tab: "leads";
  generatedAt: string;
  currency: string;
  range: CompanyReportOverview["range"];
  filters: CompanyReportOverview["filters"];
  owners: CompanyReportOverview["owners"];
  kpis: ReportKpi[];
  leadSeries: ReportTimePoint[];
  funnel: CompanyReportOverview["funnel"];
  leadSources: CompanyReportOverview["leadSources"];
  errors: Partial<Record<string, string>>;
};

export type CompanyReportWhatsAppTab = {
  tab: "whatsapp";
  generatedAt: string;
  currency: string;
  range: CompanyReportOverview["range"];
  filters: CompanyReportOverview["filters"];
  owners: CompanyReportOverview["owners"];
  kpis: ReportKpi[];
  conversations: number;
  inbound: number;
  outbound: number;
  awaitingReply: number;
  byRep: Array<{ userId: string; name: string; outboundMessages: number; assignedChats: number }>;
  errors: Partial<Record<string, string>>;
};

export type CompanyReportQuotationsTab = {
  tab: "quotations";
  generatedAt: string;
  currency: string;
  range: CompanyReportOverview["range"];
  filters: CompanyReportOverview["filters"];
  owners: CompanyReportOverview["owners"];
  kpis: ReportKpi[];
  byStatus: Array<{ status: string; label: string; count: number }>;
  bySalesperson: Array<{
    userId: string;
    name: string;
    created: number;
    quotedValue: number;
    accepted: number;
    acceptedValue: number;
    acceptRate: number | null;
  }>;
  errors: Partial<Record<string, string>>;
};

export type CompanyReportTeamTab = {
  tab: "team";
  generatedAt: string;
  currency: string;
  range: CompanyReportOverview["range"];
  filters: CompanyReportOverview["filters"];
  owners: CompanyReportOverview["owners"];
  rows: Array<{
    userId: string;
    name: string;
    initials: string;
    avatarUrl: string | null;
    revenueWon: number;
    dealsWon: number;
    pipelineValue: number;
    newLeads: number;
    avgResponseMinutes: number | null;
  }>;
  errors: Partial<Record<string, string>>;
};

export type CompanyReportCustomersTab = {
  tab: "customers";
  generatedAt: string;
  currency: string;
  range: CompanyReportOverview["range"];
  filters: CompanyReportOverview["filters"];
  owners: CompanyReportOverview["owners"];
  kpis: ReportKpi[];
  topCustomers: Array<{
    contactId: string;
    name: string;
    revenueWon: number;
    dealsWon: number;
  }>;
  errors: Partial<Record<string, string>>;
};

export type CompanyReportActivitiesTab = {
  tab: "activities";
  generatedAt: string;
  currency: string;
  range: CompanyReportOverview["range"];
  filters: CompanyReportOverview["filters"];
  owners: CompanyReportOverview["owners"];
  kpis: ReportKpi[];
  byType: Array<{ type: string; label: string; count: number }>;
  errors: Partial<Record<string, string>>;
};

export type CompanyReportPayload =
  | CompanyReportOverview
  | CompanyReportSalesTab
  | CompanyReportPipelineTab
  | CompanyReportLeadsTab
  | CompanyReportWhatsAppTab
  | CompanyReportQuotationsTab
  | CompanyReportTeamTab
  | CompanyReportCustomersTab
  | CompanyReportActivitiesTab;
