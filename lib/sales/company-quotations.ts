import { differenceInCalendarDays, parseISO } from "date-fns";
import type {
  CompanyQuotationAttention,
  CompanyQuotationEngagement,
  CompanyQuotationRow,
  CompanyQuotationTab,
} from "@/components/dashboard/company/quotations/types";
import type { QuotationStatus } from "@/types";
import { formatMoneyCompact } from "@/lib/quotations/totals";

export const COMPANY_QUOTATIONS_PAGE_SIZE = 10;
export const COMPANY_QUOTATION_EXPIRING_DAYS = 7;
export const COMPANY_QUOTATION_STALE_SENT_DAYS = 5;

export type CompanyQuotationsSort = "updated_desc" | "updated_asc";

export type CompanyQuotationEmptyKind = "none" | "search" | "filters" | "tab" | "rows";

export type CompanyQuotationFilters = {
  ownerId: string;
  customerId: string;
  dealId: string;
  quoteStatus: "all" | "draft" | "sent" | "viewed" | "accepted" | "declined" | "expired" | "superseded";
  approval: "all" | "not_required" | "pending" | "approved" | "changes_requested" | "rejected";
  commercial: "all" | "margin_below" | "margin_near" | "discount_exception";
  engagement: "all" | "not_viewed" | "viewed" | "changes_requested" | "accepted";
  expiry: "all" | "expiring_soon" | "expired";
  currency: string;
  dateField: "created" | "sent" | "response";
  dateFrom: string;
  dateTo: string;
};

export const DEFAULT_COMPANY_QUOTATION_FILTERS: CompanyQuotationFilters = {
  ownerId: "all",
  customerId: "all",
  dealId: "all",
  quoteStatus: "all",
  approval: "all",
  commercial: "all",
  engagement: "all",
  expiry: "all",
  currency: "all",
  dateField: "created",
  dateFrom: "",
  dateTo: "",
};

export const COMPANY_QUOTATION_TABS: Array<{
  id: CompanyQuotationTab;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "needs_attention", label: "Needs attention" },
  { id: "pending_approval", label: "Pending approval" },
  { id: "sent", label: "Sent" },
  { id: "accepted", label: "Accepted" },
  { id: "declined", label: "Declined" },
  { id: "expired", label: "Expired" },
];

export function companyQuotationIsPendingApproval(row: CompanyQuotationRow): boolean {
  return row.approvalStatus === "pending" || row.status === "pending_approval";
}

export function companyQuotationIsExpiringSoon(
  row: CompanyQuotationRow,
  now = new Date(),
  days = COMPANY_QUOTATION_EXPIRING_DAYS
): boolean {
  if (row.effectiveStatus !== "sent" && row.effectiveStatus !== "viewed") return false;
  if (!row.validUntil) return false;
  const until = parseISO(row.validUntil);
  if (Number.isNaN(until.getTime())) return false;
  const remaining = differenceInCalendarDays(until, now);
  return remaining >= 0 && remaining <= days;
}

export function companyQuotationNeedsAttention(
  row: CompanyQuotationRow,
  now = new Date()
): boolean {
  if (companyQuotationIsPendingApproval(row)) return true;
  if (row.approvalStatus === "changes_requested") return true;
  if (row.customerResponseType === "changes_requested" || row.customerResponseType === "question") {
    return true;
  }
  if (companyQuotationIsExpiringSoon(row, now)) return true;
  if (
    row.effectiveStatus === "accepted" &&
    row.dealId &&
    row.dealStage &&
    row.dealStage !== "WON"
  ) {
    return true;
  }
  if (
    (row.effectiveStatus === "sent" || row.effectiveStatus === "viewed") &&
    row.sentAt &&
    !row.customerResponseType
  ) {
    const sent = parseISO(row.sentAt);
    if (!Number.isNaN(sent.getTime())) {
      const days = differenceInCalendarDays(now, sent);
      if (days >= COMPANY_QUOTATION_STALE_SENT_DAYS) return true;
    }
  }
  if (row.marginHealth === "below_policy" && companyQuotationIsPendingApproval(row)) {
    return true;
  }
  return false;
}

export function companyQuotationMatchesTab(
  row: CompanyQuotationRow,
  tab: CompanyQuotationTab,
  now = new Date()
): boolean {
  if (tab === "all") return true;
  if (tab === "needs_attention") return companyQuotationNeedsAttention(row, now);
  if (tab === "declined") return row.effectiveStatus === "rejected";
  if (tab === "pending_approval") return companyQuotationIsPendingApproval(row);
  if (tab === "expired") return row.effectiveStatus === "expired";
  if (tab === "sent") {
    return row.effectiveStatus === "sent" || row.effectiveStatus === "viewed";
  }
  return row.effectiveStatus === tab;
}

export function companyQuotationMatchesSearch(
  row: CompanyQuotationRow,
  search: string
): boolean {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return [
    row.quoteNumber,
    row.title,
    row.customerName,
    row.customerPhone,
    row.customerEmail,
    row.dealName,
    row.owner?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}

export function companyQuotationCustomerKey(row: CompanyQuotationRow): string {
  return row.contactId ?? `name:${row.customerName.trim().toLowerCase()}`;
}

function rowDateForFilter(row: CompanyQuotationRow, field: CompanyQuotationFilters["dateField"]): string | null {
  if (field === "sent") return row.sentAt;
  if (field === "response") {
    return row.customerResponseType ? row.updatedAt : null;
  }
  return row.createdAt;
}

export function companyQuotationMatchesFilters(
  row: CompanyQuotationRow,
  filters: CompanyQuotationFilters,
  now = new Date()
): boolean {
  if (filters.ownerId !== "all" && row.owner?.id !== filters.ownerId) return false;
  if (
    filters.customerId !== "all" &&
    companyQuotationCustomerKey(row) !== filters.customerId
  ) {
    return false;
  }
  if (filters.dealId !== "all" && row.dealId !== filters.dealId) return false;
  if (filters.currency !== "all" && row.currency !== filters.currency) return false;

  if (filters.quoteStatus !== "all") {
    if (filters.quoteStatus === "declined") {
      if (row.effectiveStatus !== "rejected") return false;
    } else if (row.effectiveStatus !== filters.quoteStatus) {
      return false;
    }
  }

  if (filters.approval !== "all") {
    const approval = (row.approvalStatus || "not_required").replace(/-/g, "_");
    if (approval !== filters.approval) return false;
  }

  if (filters.commercial === "margin_below" && row.marginHealth !== "below_policy") return false;
  if (filters.commercial === "margin_near" && row.marginHealth !== "near_minimum") return false;
  if (filters.commercial === "discount_exception" && !row.discountExceedsAuthority) return false;

  const engagement = companyQuotationEngagement(row);
  if (filters.engagement === "not_viewed" && engagement !== "sent") return false;
  if (filters.engagement === "viewed" && engagement !== "viewed") return false;
  if (filters.engagement === "changes_requested" && engagement !== "changes_requested") return false;
  if (filters.engagement === "accepted" && engagement !== "accepted") return false;

  if (filters.expiry === "expired" && row.effectiveStatus !== "expired") return false;
  if (filters.expiry === "expiring_soon" && !companyQuotationIsExpiringSoon(row, now)) {
    return false;
  }

  const rowDateValue = rowDateForFilter(row, filters.dateField);
  const rowDate = rowDateValue ? new Date(rowDateValue).getTime() : NaN;
  if (filters.dateFrom) {
    const from = new Date(`${filters.dateFrom}T00:00:00`).getTime();
    if (Number.isFinite(from) && (!Number.isFinite(rowDate) || rowDate < from)) return false;
  }
  if (filters.dateTo) {
    const to = new Date(`${filters.dateTo}T23:59:59.999`).getTime();
    if (Number.isFinite(to) && (!Number.isFinite(rowDate) || rowDate > to)) return false;
  }
  return true;
}

export function companyQuotationFiltersActive(filters: CompanyQuotationFilters): boolean {
  return Object.entries(filters).some(([key, value]) => {
    if (key === "dateField") return false;
    if (["ownerId", "customerId", "dealId", "quoteStatus", "approval", "commercial", "engagement", "expiry", "currency"].includes(key)) {
      return value !== "all";
    }
    return value !== "";
  });
}

export function companyQuotationMoreFiltersActive(filters: CompanyQuotationFilters): boolean {
  return (
    filters.quoteStatus !== "all" ||
    filters.approval !== "all" ||
    filters.commercial !== "all" ||
    filters.engagement !== "all" ||
    filters.expiry !== "all" ||
    filters.currency !== "all" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== "" ||
    filters.customerId !== "all" ||
    filters.dealId !== "all"
  );
}

export function sortCompanyQuotations(
  rows: CompanyQuotationRow[],
  sort: CompanyQuotationsSort
): CompanyQuotationRow[] {
  return [...rows].sort((a, b) => {
    const at = Date.parse(a.updatedAt) || 0;
    const bt = Date.parse(b.updatedAt) || 0;
    if (at === bt) return a.id.localeCompare(b.id);
    return sort === "updated_asc" ? at - bt : bt - at;
  });
}

export function companyQuotationSendLabel(
  status: QuotationStatus
): "Send" | "Send Again" | null {
  if (status === "draft") return "Send";
  if (status === "sent" || status === "viewed") return "Send Again";
  return null;
}

export function companyQuotationEmptyKind({
  allCount,
  filteredCount,
  search,
  filtersActive,
}: {
  allCount: number;
  filteredCount: number;
  search: string;
  filtersActive: boolean;
}): CompanyQuotationEmptyKind {
  if (filteredCount > 0) return "rows";
  if (search.trim()) return "search";
  if (filtersActive) return "filters";
  if (allCount === 0) return "none";
  return "tab";
}

export function companyQuotationPageItems(
  page: number,
  pageCount: number
): Array<number | "ellipsis"> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }
  const selected = new Set([1, pageCount, page, page - 1, page + 1]);
  const numbers = [...selected]
    .filter((value) => value >= 1 && value <= pageCount)
    .sort((a, b) => a - b);
  const items: Array<number | "ellipsis"> = [];
  for (const value of numbers) {
    const previous = items[items.length - 1];
    if (typeof previous === "number" && value - previous > 1) items.push("ellipsis");
    items.push(value);
  }
  return items;
}

export function companyQuotationEngagement(row: CompanyQuotationRow): CompanyQuotationEngagement {
  if (row.effectiveStatus === "accepted" || row.customerResponseType === "accepted") {
    return "accepted";
  }
  if (row.effectiveStatus === "rejected" || row.customerResponseType === "declined") {
    return "declined";
  }
  if (
    row.customerResponseType === "changes_requested" ||
    row.customerResponseType === "question"
  ) {
    return "changes_requested";
  }
  if (row.viewedAt || row.effectiveStatus === "viewed") return "viewed";
  if (row.sentAt || row.effectiveStatus === "sent") return "sent";
  return "not_sent";
}

export function companyQuotationEngagementLabel(state: CompanyQuotationEngagement): string {
  switch (state) {
    case "not_sent":
      return "Not sent";
    case "sent":
      return "Sent";
    case "viewed":
      return "Viewed";
    case "changes_requested":
      return "Changes requested";
    case "accepted":
      return "Accepted";
    case "declined":
      return "Declined";
  }
}

export function companyQuotationApprovalLabel(status: string | null | undefined): string {
  const value = (status || "not_required").replace(/-/g, "_");
  switch (value) {
    case "pending":
    case "required":
      return "Pending";
    case "approved":
      return "Approved";
    case "changes_requested":
      return "Changes requested";
    case "rejected":
      return "Rejected";
    default:
      return "Not required";
  }
}

export function companyQuotationNextAction(row: CompanyQuotationRow, now = new Date()): string {
  if (companyQuotationIsPendingApproval(row)) return "Approve";
  if (row.approvalStatus === "changes_requested" || row.customerResponseType === "changes_requested") {
    return "Review changes";
  }
  if (companyQuotationIsExpiringSoon(row, now)) return "Follow up";
  if (row.effectiveStatus === "accepted" && row.dealStage && row.dealStage !== "WON") {
    return "Review Deal";
  }
  if (
    (row.effectiveStatus === "sent" || row.effectiveStatus === "viewed") &&
    row.sentAt
  ) {
    const sent = parseISO(row.sentAt);
    if (!Number.isNaN(sent.getTime()) && differenceInCalendarDays(now, sent) >= COMPANY_QUOTATION_STALE_SENT_DAYS) {
      return "Follow up";
    }
  }
  return "—";
}

export function companyQuotationCommercialLabel(
  row: CompanyQuotationRow,
  canSeeMarginPercent: boolean
): { primary: string; secondary: string | null; tone: "success" | "warning" | "danger" | "neutral" } {
  if (row.marginHealth === "below_policy") {
    return {
      primary: canSeeMarginPercent && row.marginPercent != null ? `${row.marginPercent}%` : "Below policy",
      secondary: canSeeMarginPercent && row.marginPercent != null ? "Below policy" : null,
      tone: "danger",
    };
  }
  if (row.marginHealth === "near_minimum") {
    return {
      primary: canSeeMarginPercent && row.marginPercent != null ? `${row.marginPercent}%` : "Near minimum",
      secondary: canSeeMarginPercent && row.marginPercent != null ? "Near minimum" : null,
      tone: "warning",
    };
  }
  if (row.marginHealth === "healthy") {
    return {
      primary: canSeeMarginPercent && row.marginPercent != null ? `${row.marginPercent}% margin` : "Healthy",
      secondary: row.discountPercent != null && row.discountPercent > 0 ? `${row.discountPercent}% discount` : null,
      tone: "success",
    };
  }
  if (row.discountPercent != null && row.discountPercent > 0) {
    return {
      primary: `${row.discountPercent}% discount`,
      secondary: row.discountExceedsAuthority ? "Above authority" : null,
      tone: row.discountExceedsAuthority ? "warning" : "neutral",
    };
  }
  return { primary: "—", secondary: null, tone: "neutral" };
}

export function companyQuotationAttention(rows: CompanyQuotationRow[], now = new Date()): CompanyQuotationAttention {
  const pending = rows.filter(companyQuotationIsPendingApproval);
  const awaiting = rows.filter(
    (row) => row.effectiveStatus === "sent" || row.effectiveStatus === "viewed"
  );
  const accepted = rows.filter((row) => row.effectiveStatus === "accepted");
  return {
    pendingApproval: pending.length,
    pendingApprovalValue: pending.reduce((sum, row) => sum + row.amount, 0),
    needsAttention: rows.filter((row) => companyQuotationNeedsAttention(row, now)).length,
    awaitingCustomer: awaiting.length,
    acceptedValue: accepted.reduce((sum, row) => sum + (row.acceptedTotal ?? row.amount), 0),
    expiringSoon: rows.filter((row) => companyQuotationIsExpiringSoon(row, now)).length,
  };
}

export function formatAttentionValue(amount: number, currency: string): string {
  if (!Number.isFinite(amount)) return "—";
  if (Math.abs(amount) >= 10_000) {
    const thousands = amount / 1000;
    const compact = thousands >= 100 ? thousands.toFixed(0) : thousands.toFixed(1).replace(/\.0$/, "");
    const symbol =
      currency === "USD" ? "$" : currency === "ZAR" ? "R" : currency === "BWP" ? "P" : `${currency} `;
    return `${symbol}${compact}k`;
  }
  return formatMoneyCompact(amount, currency);
}

export function emptyCompanyQuotationCounts(): Record<CompanyQuotationTab, number> {
  return {
    all: 0,
    needs_attention: 0,
    pending_approval: 0,
    sent: 0,
    accepted: 0,
    declined: 0,
    expired: 0,
  };
}

export function emptyCompanyQuotationAttention(): CompanyQuotationAttention {
  return {
    pendingApproval: 0,
    pendingApprovalValue: 0,
    needsAttention: 0,
    awaitingCustomer: 0,
    acceptedValue: 0,
    expiringSoon: 0,
  };
}

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function buildCompanyQuotationsCsv(rows: CompanyQuotationRow[]): string {
  const header = [
    "Quotation",
    "Version",
    "Customer",
    "Customer phone",
    "Deal",
    "Amount",
    "Currency",
    "Quotation status",
    "Approval",
    "Customer engagement",
    "Owner",
    "Valid until",
    "Updated",
  ];
  return [
    header.map(csvCell).join(","),
    ...rows.map((row) =>
      [
        row.quoteNumber ?? "Draft",
        row.revisionNumber,
        row.customerName,
        row.customerPhone,
        row.dealName,
        row.amount,
        row.currency,
        row.effectiveStatus === "rejected" ? "declined" : row.effectiveStatus,
        companyQuotationApprovalLabel(row.approvalStatus),
        companyQuotationEngagementLabel(companyQuotationEngagement(row)),
        row.owner?.name,
        row.validUntil,
        row.updatedAt,
      ]
        .map(csvCell)
        .join(",")
    ),
  ].join("\n");
}
