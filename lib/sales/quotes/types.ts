/**
 * Salesperson Quotations workspace types.
 */

import type { QuotationStatus } from "@/types";
import type {
  SalesReportPeriodId,
  SalesReportSourceFilter,
} from "@/lib/sales/sales-reports-data";

export type QuotesPeriodId = SalesReportPeriodId | "this_year";

export type QuotesSourceFilter = SalesReportSourceFilter;

/** UI status filter — maps to QuotationStatus (+ pending bucket). */
export type QuotesStatusFilter =
  | "all"
  | "draft"
  | "pending"
  | "sent"
  | "viewed"
  | "accepted"
  | "declined"
  | "expired";

export type TrendDisplay = {
  direction: "up" | "down" | "flat" | "new" | "none" | "alert";
  label: string;
};

export type QuoteListRow = {
  id: string;
  leadId: string;
  clientId: string;
  quoteNumber: string | null;
  revisionNumber: number;
  status: QuotationStatus;
  /** Status after applying valid_until expiry for sent/viewed quotes. */
  effectiveStatus: QuotationStatus;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  /** Secondary line under customer (company / org from lead form_data when present). */
  customerSecondary: string | null;
  projectType: string | null;
  total: number | null;
  currency: string;
  sentAt: string | null;
  validUntil: string | null;
  viewedAt: string | null;
  acceptedAt: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
  publicToken: string | null;
  preparedByName: string | null;
  source: string | null;
  sourceKey: Exclude<QuotesSourceFilter, "all">;
  sourceLabel: string;
  /** Deterministic: pending/sent/viewed, sent ≥3 days ago, no outcome. */
  needsFollowUp: boolean;
  expiresSoon: boolean;
  isExpired: boolean;
};

export type QuoteActivityItem = {
  id: string;
  type: "created" | "sent" | "viewed" | "accepted" | "declined" | "expired";
  title: string;
  detail: string;
  at: string;
  quoteId: string;
  leadId: string;
};

export type QuotePerformanceSlice = {
  key: "accepted" | "pending" | "declined" | "expired";
  label: string;
  count: number;
  pct: number;
  color: string;
};

export type QuoteKpis = {
  total: { value: number; trend: TrendDisplay | null };
  pending: { value: number; pctOfTotal: number | null };
  accepted: { value: number; trend: TrendDisplay | null };
  declined: { value: number; trend: TrendDisplay | null };
  conversionRate: {
    /** accepted / non-draft quotes in period. null when no sent outcomes. */
    value: number | null;
    trend: TrendDisplay | null;
    formula: string;
  };
};

export type QuotesPayload = {
  currency: string;
  meta: {
    period: QuotesPeriodId;
    periodLabel: string;
    source: QuotesSourceFilter;
    status: QuotesStatusFilter;
    from: string;
    to: string;
    /** Quotes are included when created_at is in [from, to). */
    dateField: "created_at";
    conversionFormula: string;
    hasTemplates: boolean;
    allTimeCount: number;
  };
  kpis: QuoteKpis;
  quotes: QuoteListRow[];
  performance: {
    slices: QuotePerformanceSlice[];
    total: number;
    emptyReason: "none" | "drafts_only" | "no_data";
  };
  activity: QuoteActivityItem[];
  /** Active leads for Create quote picker. */
  createCandidates: Array<{
    id: string;
    name: string | null;
    phone: string | null;
    projectType: string | null;
    clientId: string;
    status: string;
  }>;
};
