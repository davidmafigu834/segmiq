/**
 * Closed-deal (Won & Lost) types for the salesperson workspace.
 */

import type {
  SalesReportPeriodId,
  SalesReportSourceFilter,
} from "@/lib/sales/sales-reports-data";

export type OutcomeTab = "all" | "won" | "lost";

export type WonLostPeriodId = SalesReportPeriodId | "this_year";

export type WonLostSourceFilter = SalesReportSourceFilter;

export type WonLostGranularity = "weekly" | "monthly";

export type ClosedDealRow = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  projectType: string | null;
  status: "WON" | "LOST";
  dealValue: number | null;
  closeDate: string;
  source: string | null;
  sourceKey: Exclude<WonLostSourceFilter, "all">;
  sourceLabel: string;
  reason: string | null;
  note: string | null;
  contactId: string | null;
  clientId: string;
  createdAt: string;
};

export type OutcomeReasonRow = {
  reason: string;
  count: number;
  pct: number;
};

export type WinLossTrendPoint = {
  label: string;
  periodStart: string;
  won: number;
  lost: number;
};

export type TrendDisplay = {
  direction: "up" | "down" | "flat" | "new" | "none" | "alert";
  label: string;
};

export type ClosedDealKpis = {
  wonDeals: { value: number; trend: TrendDisplay | null };
  lostDeals: { value: number; trend: TrendDisplay | null };
  winRate: { value: number | null; trend: TrendDisplay | null };
  revenueWon: {
    value: number | null;
    recordedCount: number;
    trend: TrendDisplay | null;
  };
  lostValue: {
    value: number | null;
    recordedCount: number;
    lostCount: number;
    trend: TrendDisplay | null;
  };
};

export type WonLostPayload = {
  currency: string;
  meta: {
    period: WonLostPeriodId;
    periodLabel: string;
    source: WonLostSourceFilter;
    outcome: OutcomeTab;
    from: string;
    to: string;
    vsLabel: string;
    granularity: WonLostGranularity;
    closeDateField: "updated_at";
    hasWonReasons: false;
    wonReasonsNote: string;
  };
  kpis: ClosedDealKpis;
  /** All closed deals in period+source (before outcome tab / search). Used for export of filtered view. */
  deals: ClosedDealRow[];
  trend: WinLossTrendPoint[];
  lostReasons: {
    rows: OutcomeReasonRow[];
    withReason: number;
    totalLost: number;
  };
  wonReasons: {
    rows: OutcomeReasonRow[];
    withReason: number;
    totalWon: number;
    available: false;
  };
  totals: {
    closedAllTime: number;
  };
};
