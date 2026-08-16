import type {
  CompanyQuotationRow,
  CompanyQuotationTab,
} from "@/components/dashboard/company/quotations/types";
import type { QuotationStatus } from "@/types";

export const COMPANY_QUOTATIONS_PAGE_SIZE = 10;

export type CompanyQuotationsSort = "updated_desc" | "updated_asc";

export type CompanyQuotationEmptyKind = "none" | "search" | "filters" | "tab" | "rows";

export type CompanyQuotationFilters = {
  ownerId: string;
  customerId: string;
  dealId: string;
  exceptionalStatus: "all" | "expired";
  dealPresence: "all" | "with" | "without";
  amountMin: string;
  amountMax: string;
  dateFrom: string;
  dateTo: string;
};

export const DEFAULT_COMPANY_QUOTATION_FILTERS: CompanyQuotationFilters = {
  ownerId: "all",
  customerId: "all",
  dealId: "all",
  exceptionalStatus: "all",
  dealPresence: "all",
  amountMin: "",
  amountMax: "",
  dateFrom: "",
  dateTo: "",
};

export const COMPANY_QUOTATION_TABS: Array<{
  id: CompanyQuotationTab;
  label: string;
}> = [
  { id: "all", label: "All Quotations" },
  { id: "draft", label: "Draft" },
  { id: "sent", label: "Sent" },
  { id: "viewed", label: "Viewed" },
  { id: "accepted", label: "Accepted" },
  { id: "declined", label: "Declined" },
];

export function companyQuotationMatchesTab(
  row: CompanyQuotationRow,
  tab: CompanyQuotationTab
): boolean {
  if (tab === "all") return true;
  if (tab === "declined") return row.effectiveStatus === "rejected";
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

export function companyQuotationMatchesFilters(
  row: CompanyQuotationRow,
  filters: CompanyQuotationFilters
): boolean {
  if (filters.ownerId !== "all" && row.owner?.id !== filters.ownerId) return false;
  if (
    filters.customerId !== "all" &&
    companyQuotationCustomerKey(row) !== filters.customerId
  ) {
    return false;
  }
  if (filters.dealId !== "all" && row.dealId !== filters.dealId) return false;
  if (filters.exceptionalStatus === "expired" && row.effectiveStatus !== "expired") {
    return false;
  }
  if (filters.dealPresence === "with" && !row.dealId) return false;
  if (filters.dealPresence === "without" && row.dealId) return false;

  const min = filters.amountMin.trim() === "" ? null : Number(filters.amountMin);
  const max = filters.amountMax.trim() === "" ? null : Number(filters.amountMax);
  if (min != null && Number.isFinite(min) && row.amount < min) return false;
  if (max != null && Number.isFinite(max) && row.amount > max) return false;

  const rowDate = new Date(row.quoteDate).getTime();
  if (filters.dateFrom) {
    const from = new Date(`${filters.dateFrom}T00:00:00`).getTime();
    if (Number.isFinite(from) && rowDate < from) return false;
  }
  if (filters.dateTo) {
    const to = new Date(`${filters.dateTo}T23:59:59.999`).getTime();
    if (Number.isFinite(to) && rowDate > to) return false;
  }
  return true;
}

export function companyQuotationFiltersActive(filters: CompanyQuotationFilters): boolean {
  return Object.entries(filters).some(([key, value]) => {
    if (["ownerId", "customerId", "dealId"].includes(key)) return value !== "all";
    if (key === "exceptionalStatus" || key === "dealPresence") return value !== "all";
    return value !== "";
  });
}

export function companyQuotationMoreFiltersActive(filters: CompanyQuotationFilters): boolean {
  return (
    filters.exceptionalStatus !== "all" ||
    filters.dealPresence !== "all" ||
    filters.amountMin !== "" ||
    filters.amountMax !== "" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== ""
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

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function buildCompanyQuotationsCsv(rows: CompanyQuotationRow[]): string {
  const header = [
    "Quotation",
    "Title",
    "Customer",
    "Customer phone",
    "Deal",
    "Amount",
    "Currency",
    "Status",
    "Owner",
    "Quote date",
    "Valid until",
    "Updated",
  ];
  return [
    header.map(csvCell).join(","),
    ...rows.map((row) =>
      [
        row.quoteNumber ?? "Draft",
        row.title,
        row.customerName,
        row.customerPhone,
        row.dealName,
        row.amount,
        row.currency,
        row.effectiveStatus === "rejected" ? "declined" : row.effectiveStatus,
        row.owner?.name,
        row.quoteDate,
        row.validUntil,
        row.updatedAt,
      ]
        .map(csvCell)
        .join(",")
    ),
  ].join("\n");
}
