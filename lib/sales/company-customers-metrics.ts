import { formatDealCurrency } from "@/lib/sales/format";
import type { SalesKpiItem } from "@/components/dashboard/sales/types";
import type {
  CompanyCustomerRow,
  CompanyCustomersFilters,
  CompanyCustomersSort,
  CompanyCustomersTab,
  CompanyCustomersTabCounts,
} from "@/components/dashboard/company/customers/types";

export const COMPANY_CUSTOMERS_PAGE_SIZE = 10;
export const COMPANY_CUSTOMERS_CAP = 2500;
export const COMPANY_CUSTOMERS_RECENT_DAYS = 30;

export const COMPANY_CUSTOMERS_TABS: Array<{
  id: CompanyCustomersTab;
  label: string;
}> = [
  { id: "all", label: "All Customers" },
  { id: "companies", label: "Companies" },
  { id: "individuals", label: "Individuals" },
  { id: "recent", label: "Recent" },
];

export function parseCompanyCustomersTab(value: string | null): CompanyCustomersTab | null {
  return COMPANY_CUSTOMERS_TABS.some((tab) => tab.id === value)
    ? (value as CompanyCustomersTab)
    : null;
}

export function formatCustomerType(value: string | null | undefined): CompanyCustomerRow["customerType"] {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "company") return "company";
  // Legacy contacts were person records before Customer type existed. Treat
  // an untyped legacy record as Individual until a manager explicitly changes it.
  return "individual";
}

export function customerTypeLabel(type: CompanyCustomerRow["customerType"]): string {
  return type === "company" ? "Company" : "Individual";
}

export function formatCustomerMoney(amount: number, currency = "USD"): string {
  return formatDealCurrency(amount, { currency });
}

export function customerValueLabel(opts: {
  wonDeals: number;
  knownValue: number;
  unknownCount: number;
  currency?: string;
}): string {
  if (opts.unknownCount > 0 && opts.knownValue <= 0) return "Not recorded";
  if (opts.unknownCount > 0) {
    return `${formatCustomerMoney(opts.knownValue, opts.currency)} + unrecorded`;
  }
  if (opts.wonDeals === 0) return formatCustomerMoney(0, opts.currency);
  return formatCustomerMoney(opts.knownValue, opts.currency);
}

export function formatCustomerDate(value: string | null, now = new Date()): string {
  if (!value) return "No activity yet";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "No activity yet";
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  if (sameDay) return `Today, ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  if (date.getFullYear() === now.getFullYear()) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function isRecentCustomer(row: Pick<CompanyCustomerRow, "lastInteractionAt">, now = new Date()): boolean {
  if (!row.lastInteractionAt) return false;
  const at = Date.parse(row.lastInteractionAt);
  if (!Number.isFinite(at)) return false;
  return at >= now.getTime() - COMPANY_CUSTOMERS_RECENT_DAYS * 24 * 60 * 60 * 1000;
}

export function matchesCompanyCustomersTab(
  row: CompanyCustomerRow,
  tab: CompanyCustomersTab,
  now = new Date()
): boolean {
  if (tab === "companies") return row.customerType === "company";
  if (tab === "individuals") return row.customerType === "individual";
  if (tab === "recent") return isRecentCustomer(row, now);
  return true;
}

export function matchesCompanyCustomersSearch(row: CompanyCustomerRow, query: string): boolean {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return true;
  return [
    row.name,
    row.industry,
    row.primaryContactName,
    row.phone,
    row.email,
    row.location,
    row.ownerName,
  ].some((value) => value?.toLocaleLowerCase().includes(q));
}

export function matchesCompanyCustomersFilters(
  row: CompanyCustomerRow,
  filters: CompanyCustomersFilters
): boolean {
  if (filters.customerType !== "all" && row.customerType !== filters.customerType) return false;
  if (filters.ownerId === "unassigned" && row.ownerId) return false;
  if (filters.ownerId !== "all" && filters.ownerId !== "unassigned" && row.ownerId !== filters.ownerId) {
    return false;
  }
  if (filters.activeDeals === "yes" && row.activeDeals === 0) return false;
  if (filters.activeDeals === "no" && row.activeDeals > 0) return false;
  if (filters.customerValue === "known" && (row.wonDeals === 0 || row.wonValueUnknownCount > 0)) {
    return false;
  }
  if (filters.customerValue === "not_recorded" && row.wonValueUnknownCount === 0) return false;
  return true;
}

export function companyCustomersFiltersActive(filters: CompanyCustomersFilters): boolean {
  return (
    filters.customerType !== "all" ||
    filters.ownerId !== "all" ||
    filters.activeDeals !== "all" ||
    filters.customerValue !== "all"
  );
}

function dateValue(value: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sortCompanyCustomersRows(
  rows: CompanyCustomerRow[],
  sort: CompanyCustomersSort
): CompanyCustomerRow[] {
  return [...rows].sort((a, b) => {
    if (sort === "customer_asc") return a.name.localeCompare(b.name);
    if (sort === "customer_desc") return b.name.localeCompare(a.name);
    if (sort === "value_desc") return b.wonValueKnown - a.wonValueKnown;
    if (sort === "value_asc") return a.wonValueKnown - b.wonValueKnown;
    if (sort === "deals_desc") return b.activeDeals - a.activeDeals || b.totalDeals - a.totalDeals;
    if (sort === "customer_since") return dateValue(b.customerSince) - dateValue(a.customerSince);
    return dateValue(b.lastInteractionAt) - dateValue(a.lastInteractionAt) || dateValue(b.customerSince) - dateValue(a.customerSince);
  });
}

export function countCompanyCustomersTabs(
  rows: CompanyCustomerRow[],
  now = new Date()
): CompanyCustomersTabCounts {
  return {
    all: rows.length,
    companies: rows.filter((row) => row.customerType === "company").length,
    individuals: rows.filter((row) => row.customerType === "individual").length,
    recent: rows.filter((row) => isRecentCustomer(row, now)).length,
  };
}

export function buildCompanyCustomersKpis(opts: {
  totalCustomers: number;
  companies: number;
  individuals: number;
  activeDeals: number;
  customersWithActiveDeals: number;
  activePipelineKnown: number;
  activePipelineUnknownCount: number;
  currency?: string;
}): SalesKpiItem[] {
  const pipelineValue =
    opts.activePipelineKnown <= 0 && opts.activePipelineUnknownCount > 0
      ? "—"
      : formatCustomerMoney(opts.activePipelineKnown, opts.currency);
  return [
    {
      id: "total-customers",
      label: "Total Customers",
      value: String(opts.totalCustomers),
      supporting: "Customer records",
      icon: "customers",
    },
    {
      id: "company-customers",
      label: "Companies",
      value: String(opts.companies),
      supporting: "Classified as companies",
      icon: "companies",
    },
    {
      id: "individual-customers",
      label: "Individuals",
      value: String(opts.individuals),
      supporting: "Classified as individuals",
      icon: "individuals",
    },
    {
      id: "customer-active-deals",
      label: "Active Deals",
      value: String(opts.activeDeals),
      supporting: `${opts.customersWithActiveDeals} customer${opts.customersWithActiveDeals === 1 ? "" : "s"}`,
      icon: "deals",
      href: "/client/pipeline",
    },
    {
      id: "customer-pipeline-value",
      label: "Total Pipeline Value",
      value: pipelineValue,
      supporting:
        opts.activePipelineUnknownCount > 0
          ? `${opts.activePipelineUnknownCount} Deal${opts.activePipelineUnknownCount === 1 ? "" : "s"} awaiting estimate`
          : "Known active Deal values",
      icon: "pipeline",
      href: "/client/pipeline",
    },
  ];
}
