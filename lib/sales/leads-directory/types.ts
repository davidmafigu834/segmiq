/**
 * Salesperson Leads directory (sidebar: Leads → /sales/call-now).
 * Distinct from My Pipeline (/sales/pipeline).
 */

import type { LeadStatus } from "@/types";
import type {
  SalesReportPeriodId,
  SalesReportSourceFilter,
} from "@/lib/sales/sales-reports-data";
import type { LeadScoreBand } from "@/lib/sales/format";

export type LeadsPeriodId = SalesReportPeriodId | "this_year" | "all";

export type LeadsSourceFilter = SalesReportSourceFilter;

export type LeadsStageFilter = "all" | LeadStatus;

export type LeadsIntentFilter = "all" | "hot" | "warm" | "cold";

export type AttentionFilter =
  | "none"
  | "never_contacted"
  | "stale"
  | "follow_up_overdue"
  | "hot"
  | "uncontacted";

export type TrendDisplay = {
  direction: "up" | "down" | "flat" | "new" | "none" | "alert";
  label: string;
};

export type LeadDirectoryRow = {
  id: string;
  clientId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  projectType: string | null;
  company: string | null;
  location: string | null;
  contextLine: string | null;
  source: string | null;
  sourceKey: Exclude<LeadsSourceFilter, "all">;
  sourceLabel: string;
  status: LeadStatus;
  score: number | null;
  scoreBand: LeadScoreBand | null;
  scoreLabel: string | null;
  lastContactAt: string | null;
  followUpDate: string | null;
  createdAt: string;
  updatedAt: string;
  isStale: boolean;
  neverContacted: boolean;
  followUpOverdue: boolean;
  budget: string | null;
  formData: Record<string, unknown> | null;
};

export type SourceSlice = {
  key: Exclude<LeadsSourceFilter, "all">;
  label: string;
  count: number;
  pct: number;
  color: string;
};

export type StageSlice = {
  status: LeadStatus;
  label: string;
  count: number;
  pct: number;
  color: string;
};

export type LeadDirectoryKpis = {
  total: { value: number; trend: TrendDisplay | null };
  newInPeriod: { value: number; label: string };
  hot: { value: number };
  won: { value: number; trend: TrendDisplay | null };
  conversionRate: {
    value: number | null;
    trend: TrendDisplay | null;
    formula: string;
  };
};

export type LeadsDirectoryPayload = {
  meta: {
    period: LeadsPeriodId;
    periodLabel: string;
    source: LeadsSourceFilter;
    stage: LeadsStageFilter;
    intent: LeadsIntentFilter;
    attention: AttentionFilter;
    from: string | null;
    to: string | null;
    dateField: "created_at";
    conversionFormula: string;
    allTimeCount: number;
    page: number;
    pageSize: number;
    totalFiltered: number;
  };
  kpis: LeadDirectoryKpis;
  leads: LeadDirectoryRow[];
  bySource: { slices: SourceSlice[]; total: number };
  byStage: { slices: StageSlice[]; total: number };
  hotLeads: LeadDirectoryRow[];
};
