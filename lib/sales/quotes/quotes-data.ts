/**
 * Salesperson-scoped quotations aggregates.
 *
 * Authorization: quotations on leads where assigned_to_id = authenticated user.
 * Date semantics: quotes included when created_at ∈ [from, to).
 * Conversion: accepted / non-draft quotes (matches client dashboard quotationsMetrics).
 * Pending KPI: effective status sent | viewed (awaiting customer response).
 */

import { addDays, differenceInCalendarDays, startOfDay, startOfYear, subYears } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTrend } from "@/lib/sales/sales-dashboard-display";
import {
  resolveSalesReportRange,
  sourceBucket,
  SALES_REPORT_PERIODS,
  SALES_REPORT_SOURCES,
  type SalesReportPeriodId,
} from "@/lib/sales/sales-reports-data";
import type { QuotationStatus } from "@/types";
import {
  effectiveQuoteStatus,
  isPendingStatus,
} from "./format";
import type {
  QuoteActivityItem,
  QuoteKpis,
  QuoteListRow,
  QuotePerformanceSlice,
  QuotesPayload,
  QuotesPeriodId,
  QuotesSourceFilter,
  QuotesStatusFilter,
  TrendDisplay,
} from "./types";

export const QUOTES_PERIODS: { id: QuotesPeriodId; label: string }[] = [
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "last_30", label: "Last 30 days" },
  { id: "last_90", label: "Last 90 days" },
  { id: "this_quarter", label: "This quarter" },
  { id: "this_year", label: "This year" },
];

export { SALES_REPORT_SOURCES as QUOTES_SOURCES };

export const QUOTES_STATUS_FILTERS: { id: QuotesStatusFilter; label: string }[] = [
  { id: "all", label: "All statuses" },
  { id: "draft", label: "Draft" },
  { id: "pending", label: "Pending" },
  { id: "sent", label: "Sent" },
  { id: "viewed", label: "Viewed" },
  { id: "accepted", label: "Accepted" },
  { id: "declined", label: "Declined" },
  { id: "expired", label: "Expired" },
];

/** Matches marketing journey: quote sent, no response after 3 days. */
export const QUOTE_FOLLOW_UP_DAYS = 3;
export const QUOTE_EXPIRES_SOON_DAYS = 3;

export const CONVERSION_FORMULA =
  "accepted ÷ non-draft quotes (sent, viewed, accepted, declined, expired)";

const PERF_COLORS: Record<QuotePerformanceSlice["key"], string> = {
  accepted: "#16A34A",
  pending: "#F59E0B",
  declined: "#EF4444",
  expired: "#8B5CF6",
};

export function isQuotesPeriod(v: string): v is QuotesPeriodId {
  return QUOTES_PERIODS.some((p) => p.id === v) || SALES_REPORT_PERIODS.some((p) => p.id === v);
}

export function isQuotesSource(v: string): v is QuotesSourceFilter {
  return SALES_REPORT_SOURCES.some((s) => s.id === v);
}

export function isQuotesStatus(v: string): v is QuotesStatusFilter {
  return QUOTES_STATUS_FILTERS.some((s) => s.id === v);
}

export function resolveQuotesRange(
  period: QuotesPeriodId,
  customFrom?: string | null,
  customTo?: string | null
): { from: Date; to: Date; previousFrom: Date; previousTo: Date; label: string } {
  if (period === "this_year") {
    const now = new Date();
    const from = startOfYear(now);
    const to = addDays(startOfDay(now), 1);
    return {
      from,
      to,
      previousFrom: startOfYear(subYears(now, 1)),
      previousTo: from,
      label: "This year",
    };
  }
  return resolveSalesReportRange(period as SalesReportPeriodId, customFrom, customTo);
}

function vsLabel(periodLabel: string): string {
  const cleaned = periodLabel.replace(/^Last /i, "").replace(/^This /i, "");
  return `vs last ${cleaned.toLowerCase()}`;
}

function pctTrend(
  current: number,
  previous: number,
  periodLabel: string,
  opts?: { invertSemantic?: boolean }
): TrendDisplay | null {
  const t = formatTrend(current, previous);
  if (t.direction === "none") return null;
  if (t.direction === "new") {
    return { direction: "new", label: `New ${vsLabel(periodLabel)}` };
  }
  if (t.direction === "flat") {
    return { direction: "flat", label: `No change ${vsLabel(periodLabel)}` };
  }
  if (opts?.invertSemantic) {
    if (t.direction === "down") {
      return { direction: "up", label: `${t.label} fewer ${vsLabel(periodLabel)}` };
    }
    if (t.direction === "up") {
      return { direction: "down", label: `${t.label} more ${vsLabel(periodLabel)}` };
    }
  }
  return {
    direction: t.direction,
    label: `${t.label} ${vsLabel(periodLabel)}`,
  };
}

function ptsTrend(
  current: number | null,
  previous: number | null,
  periodLabel: string
): TrendDisplay | null {
  if (current == null || previous == null) return null;
  const delta = current - previous;
  if (delta === 0) return { direction: "flat", label: `No change ${vsLabel(periodLabel)}` };
  const sign = delta > 0 ? "+" : "";
  return {
    direction: delta > 0 ? "up" : "down",
    label: `${sign}${delta} pts ${vsLabel(periodLabel)}`,
  };
}

function conversionPct(rows: QuoteListRow[]): number | null {
  const nonDraft = rows.filter((q) => q.effectiveStatus !== "draft");
  if (nonDraft.length === 0) return null;
  const accepted = nonDraft.filter((q) => q.effectiveStatus === "accepted").length;
  return Math.round((accepted / nonDraft.length) * 100);
}

function companyFromFormData(formData: Record<string, unknown> | null | undefined): string | null {
  if (!formData || typeof formData !== "object") return null;
  for (const key of ["company", "company_name", "organisation", "organization", "business_name"]) {
    const v = formData[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

type DbQuote = {
  id: string;
  lead_id: string;
  client_id: string;
  quote_number: string | null;
  revision_number: number | null;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  total: number | string | null;
  currency: string | null;
  sent_at: string | null;
  valid_until: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
  public_token: string | null;
  prepared_by_name: string | null;
};

type DbLead = {
  id: string;
  name: string | null;
  phone: string | null;
  project_type: string | null;
  source: string | null;
  client_id: string;
  status: string;
  form_data?: Record<string, unknown> | null;
  is_archived?: boolean | null;
};

function mapQuote(
  row: DbQuote,
  lead: DbLead | undefined,
  now: Date
): QuoteListRow {
  const status = (row.status as QuotationStatus) || "draft";
  const effective = effectiveQuoteStatus(status, row.valid_until, now);
  const src = sourceBucket(lead?.source);
  const totalNum = row.total != null ? Number(row.total) : null;
  const sentAt = row.sent_at;
  const validUntil = row.valid_until;

  let needsFollowUp = false;
  if (isPendingStatus(effective) && sentAt) {
    const daysSinceSent = differenceInCalendarDays(now, new Date(sentAt));
    needsFollowUp = daysSinceSent >= QUOTE_FOLLOW_UP_DAYS;
  }

  let expiresSoon = false;
  const isExpired = effective === "expired";
  if (validUntil && isPendingStatus(effective)) {
    const daysLeft = differenceInCalendarDays(new Date(validUntil), now);
    expiresSoon = daysLeft >= 0 && daysLeft <= QUOTE_EXPIRES_SOON_DAYS;
  }

  const company = companyFromFormData(lead?.form_data ?? null);
  const customerName = row.customer_name?.trim() || lead?.name?.trim() || null;
  let customerSecondary: string | null = company;
  if (customerSecondary && customerName && customerSecondary.toLowerCase() === customerName.toLowerCase()) {
    customerSecondary = null;
  }

  return {
    id: row.id,
    leadId: row.lead_id,
    clientId: row.client_id,
    quoteNumber: row.quote_number,
    revisionNumber: Number(row.revision_number) || 1,
    status,
    effectiveStatus: effective,
    customerName,
    customerPhone: row.customer_phone ?? lead?.phone ?? null,
    customerEmail: row.customer_email,
    customerSecondary,
    projectType: lead?.project_type?.trim() || null,
    total: totalNum != null && Number.isFinite(totalNum) ? totalNum : null,
    currency: row.currency || "USD",
    sentAt,
    validUntil,
    viewedAt: row.viewed_at,
    acceptedAt: row.accepted_at,
    respondedAt: row.responded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publicToken: row.public_token,
    preparedByName: row.prepared_by_name,
    source: lead?.source ?? null,
    sourceKey: src.key,
    sourceLabel: src.label,
    needsFollowUp,
    expiresSoon,
    isExpired,
  };
}

function matchesStatusFilter(row: QuoteListRow, status: QuotesStatusFilter): boolean {
  if (status === "all") return true;
  if (status === "pending") return isPendingStatus(row.effectiveStatus);
  if (status === "declined") return row.effectiveStatus === "rejected";
  return row.effectiveStatus === status;
}

function buildKpis(current: QuoteListRow[], previous: QuoteListRow[], periodLabel: string): QuoteKpis {
  const total = current.length;
  const pending = current.filter((q) => isPendingStatus(q.effectiveStatus)).length;
  const accepted = current.filter((q) => q.effectiveStatus === "accepted").length;
  const declined = current.filter((q) => q.effectiveStatus === "rejected").length;

  const totalPrev = previous.length;
  const acceptedPrev = previous.filter((q) => q.effectiveStatus === "accepted").length;
  const declinedPrev = previous.filter((q) => q.effectiveStatus === "rejected").length;

  const conv = conversionPct(current);
  const convPrev = conversionPct(previous);

  return {
    total: {
      value: total,
      trend: pctTrend(total, totalPrev, periodLabel),
    },
    pending: {
      value: pending,
      pctOfTotal: total > 0 ? Math.round((pending / total) * 100) : null,
    },
    accepted: {
      value: accepted,
      trend: pctTrend(accepted, acceptedPrev, periodLabel),
    },
    declined: {
      value: declined,
      trend: pctTrend(declined, declinedPrev, periodLabel, { invertSemantic: true }),
    },
    conversionRate: {
      value: conv,
      trend: ptsTrend(conv, convPrev, periodLabel),
      formula: CONVERSION_FORMULA,
    },
  };
}

function buildPerformance(rows: QuoteListRow[]): QuotesPayload["performance"] {
  const nonDraft = rows.filter((q) => q.effectiveStatus !== "draft");
  if (rows.length === 0) {
    return { slices: [], total: 0, emptyReason: "no_data" };
  }
  if (nonDraft.length === 0) {
    return { slices: [], total: 0, emptyReason: "drafts_only" };
  }

  const counts = {
    accepted: nonDraft.filter((q) => q.effectiveStatus === "accepted").length,
    pending: nonDraft.filter((q) => isPendingStatus(q.effectiveStatus)).length,
    declined: nonDraft.filter((q) => q.effectiveStatus === "rejected").length,
    expired: nonDraft.filter((q) => q.effectiveStatus === "expired").length,
  };
  const total = nonDraft.length;
  const order: QuotePerformanceSlice["key"][] = ["accepted", "pending", "declined", "expired"];
  const labels: Record<QuotePerformanceSlice["key"], string> = {
    accepted: "Accepted",
    pending: "Pending",
    declined: "Declined",
    expired: "Expired",
  };

  const slices: QuotePerformanceSlice[] = order
    .filter((k) => counts[k] > 0)
    .map((k) => ({
      key: k,
      label: labels[k],
      count: counts[k],
      pct: Math.round((counts[k] / total) * 100),
      color: PERF_COLORS[k],
    }));

  return { slices, total, emptyReason: "none" };
}

function buildActivity(rows: QuoteListRow[], limit = 5): QuoteActivityItem[] {
  const events: QuoteActivityItem[] = [];

  for (const q of rows) {
    const label = q.quoteNumber?.trim() || "Draft";
    const who = q.customerName?.trim() || "Customer";
    const detail = `${label} · ${who}`;

    if (q.acceptedAt || (q.effectiveStatus === "accepted" && q.respondedAt)) {
      events.push({
        id: `${q.id}-accepted`,
        type: "accepted",
        title: "Quote accepted",
        detail,
        at: q.acceptedAt || q.respondedAt!,
        quoteId: q.id,
        leadId: q.leadId,
      });
    }
    if (q.effectiveStatus === "rejected" && (q.respondedAt || q.updatedAt)) {
      events.push({
        id: `${q.id}-declined`,
        type: "declined",
        title: "Quote declined",
        detail,
        at: q.respondedAt || q.updatedAt,
        quoteId: q.id,
        leadId: q.leadId,
      });
    }
    if (q.viewedAt) {
      events.push({
        id: `${q.id}-viewed`,
        type: "viewed",
        title: "Quote viewed",
        detail,
        at: q.viewedAt,
        quoteId: q.id,
        leadId: q.leadId,
      });
    }
    if (q.sentAt) {
      events.push({
        id: `${q.id}-sent`,
        type: "sent",
        title: "Quote sent",
        detail,
        at: q.sentAt,
        quoteId: q.id,
        leadId: q.leadId,
      });
    }
    if (q.effectiveStatus === "expired" && q.validUntil) {
      events.push({
        id: `${q.id}-expired`,
        type: "expired",
        title: "Quote expired",
        detail,
        at: q.validUntil,
        quoteId: q.id,
        leadId: q.leadId,
      });
    }
    events.push({
      id: `${q.id}-created`,
      type: "created",
      title: "Quote created",
      detail,
      at: q.createdAt,
      quoteId: q.id,
      leadId: q.leadId,
    });
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return events.slice(0, limit);
}

export function buildQuotesCsv(
  rows: QuoteListRow[],
  opts?: { currency?: string }
): string {
  const headers = [
    "Quote",
    "Customer",
    "Project",
    "Amount",
    "Status",
    "Sent on",
    "Valid until",
    "Source",
  ];
  const lines = [headers.join(",")];
  for (const q of rows) {
    const cells = [
      q.quoteNumber ?? "Draft",
      q.customerName ?? "",
      q.projectType ?? "",
      q.total != null ? String(q.total) : "",
      q.effectiveStatus,
      q.sentAt ?? "",
      q.validUntil ?? "",
      q.sourceLabel,
    ].map((c) => `"${String(c).replace(/"/g, '""')}"`);
    lines.push(cells.join(","));
  }
  void opts;
  return lines.join("\n");
}

export async function fetchSalespersonQuotes(opts: {
  userId: string;
  period?: QuotesPeriodId;
  source?: QuotesSourceFilter;
  status?: QuotesStatusFilter;
  customFrom?: string | null;
  customTo?: string | null;
}): Promise<QuotesPayload> {
  const period = opts.period ?? "this_month";
  const source = opts.source ?? "all";
  const status = opts.status ?? "all";
  const range = resolveQuotesRange(period, opts.customFrom, opts.customTo);
  const now = new Date();
  const supabase = createAdminClient();

  const leadsRes = await supabase
    .from("leads")
    .select("id, name, phone, project_type, source, client_id, status, form_data, is_archived")
    .eq("assigned_to_id", opts.userId);

  let leadRows = (leadsRes.data ?? []) as DbLead[];
  if (leadsRes.error && String(leadsRes.error.message || "").includes("is_archived")) {
    const retry = await supabase
      .from("leads")
      .select("id, name, phone, project_type, source, client_id, status, form_data")
      .eq("assigned_to_id", opts.userId);
    leadRows = (retry.data ?? []) as DbLead[];
  }

  const leadMap = new Map(leadRows.map((l) => [l.id, l]));
  const leadIds = leadRows.map((l) => l.id);

  let quoteRows: DbQuote[] = [];
  let allTimeCount = 0;

  if (leadIds.length > 0) {
    const [allRes, periodRes] = await Promise.all([
      supabase
        .from("quotations")
        .select("id", { count: "exact", head: true })
        .in("lead_id", leadIds),
      supabase
        .from("quotations")
        .select(
          "id, lead_id, client_id, quote_number, revision_number, status, customer_name, customer_phone, customer_email, total, currency, sent_at, valid_until, viewed_at, accepted_at, responded_at, created_at, updated_at, public_token, prepared_by_name"
        )
        .in("lead_id", leadIds)
        .order("updated_at", { ascending: false }),
    ]);
    allTimeCount = allRes.count ?? 0;
    quoteRows = (periodRes.data ?? []) as DbQuote[];
  }

  const clientIds = [...new Set(leadRows.map((l) => l.client_id).filter(Boolean))];
  let hasTemplates = false;
  if (clientIds.length > 0) {
    const { count } = await supabase
      .from("quote_templates")
      .select("id", { count: "exact", head: true })
      .in("client_id", clientIds)
      .eq("is_active", true);
    hasTemplates = (count ?? 0) > 0;
  }

  const mappedAll = quoteRows.map((q) => mapQuote(q, leadMap.get(q.lead_id), now));

  const inRange = (iso: string, from: Date, to: Date) => {
    const t = new Date(iso).getTime();
    return t >= from.getTime() && t < to.getTime();
  };

  const currentPeriod = mappedAll.filter((q) => inRange(q.createdAt, range.from, range.to));
  const previousPeriod = mappedAll.filter((q) =>
    inRange(q.createdAt, range.previousFrom, range.previousTo)
  );

  const filterSource = (rows: QuoteListRow[]) =>
    rows.filter((q) => source === "all" || q.sourceKey === source);

  const currentSourced = filterSource(currentPeriod);
  const previousSourced = filterSource(previousPeriod);

  const kpis = buildKpis(currentSourced, previousSourced, range.label);

  const quotes = currentSourced
    .filter((q) => matchesStatusFilter(q, status))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const performance = buildPerformance(currentSourced);
  const activity = buildActivity(mappedAll, 5);

  const createCandidates = leadRows
    .filter((l) => !l.is_archived && l.status !== "LOST" && l.status !== "NOT_QUALIFIED")
    .slice(0, 80)
    .map((l) => ({
      id: l.id,
      name: l.name,
      phone: l.phone,
      projectType: l.project_type,
      clientId: l.client_id,
      status: l.status,
    }));

  const currency =
    quotes.find((q) => q.currency)?.currency ||
    mappedAll.find((q) => q.currency)?.currency ||
    "USD";

  return {
    currency,
    meta: {
      period,
      periodLabel: range.label,
      source,
      status,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      dateField: "created_at",
      conversionFormula: CONVERSION_FORMULA,
      hasTemplates,
      allTimeCount,
    },
    kpis,
    quotes,
    performance,
    activity,
    createCandidates,
  };
}
