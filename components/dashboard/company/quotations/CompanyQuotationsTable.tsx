"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FilePenLine,
  FilePlus2,
  FileText,
  Filter,
  MoreHorizontal,
  Search,
} from "lucide-react";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { Avatar, Badge, Button, Checkbox } from "@/components/sales/ui";
import {
  COMPANY_QUOTATIONS_PAGE_SIZE,
  DEFAULT_COMPANY_QUOTATION_FILTERS,
  companyQuotationApprovalLabel,
  companyQuotationCommercialLabel,
  companyQuotationEngagement,
  companyQuotationEngagementLabel,
  companyQuotationIsPendingApproval,
  companyQuotationMoreFiltersActive,
  companyQuotationNextAction,
  companyQuotationPageItems,
  type CompanyQuotationEmptyKind,
  type CompanyQuotationFilters,
} from "@/lib/sales/company-quotations";
import {
  formatQuoteAmount,
  formatQuoteStatus,
  formatQuoteValidity,
  getQuoteStatusTone,
} from "@/lib/sales/quotes";
import { cn } from "@/lib/ui/cn";
import type {
  CompanyQuotationPermissions,
  CompanyQuotationRow,
  CompanyQuotationTab,
  CompanyQuotationsPageData,
} from "./types";

function displayQuoteNumber(row: CompanyQuotationRow): string {
  return row.quoteNumber?.trim() || "Draft";
}

function relativeTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = parseISO(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

function approvalTone(status: string | null | undefined): "neutral" | "warning" | "success" | "danger" | "brand" {
  const value = (status || "not_required").replace(/-/g, "_");
  if (value === "pending" || value === "required") return "warning";
  if (value === "approved") return "brand";
  if (value === "changes_requested") return "warning";
  if (value === "rejected") return "danger";
  return "neutral";
}

function engagementTone(
  state: ReturnType<typeof companyQuotationEngagement>
): "neutral" | "info" | "warning" | "success" | "danger" {
  if (state === "viewed") return "info";
  if (state === "changes_requested") return "warning";
  if (state === "accepted") return "success";
  if (state === "declined") return "danger";
  return "neutral";
}

function SearchableFilter({
  value,
  onChange,
  label,
  options,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  options: Array<{ id: string; label: string }>;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selected = value === "all" ? label : options.find((option) => option.id === value)?.label ?? label;
  const matches = options.filter((option) =>
    option.label.toLowerCase().includes(query.trim().toLowerCase())
  );

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className={cn("relative min-w-0", className)} ref={ref}>
      <button
        type="button"
        className="flex h-9 w-full items-center justify-between gap-2 rounded-[8px] border border-sales-border bg-sales-surface py-0 pl-3 pr-2 text-left text-[12px] font-medium text-sales-text-secondary outline-none transition-colors hover:border-sales-border-strong focus:border-sales-brand-border focus:shadow-[var(--sales-focus-ring)]"
        onClick={() => {
          setOpen((current) => !current);
          setQuery("");
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="min-w-0 truncate">{selected}</span>
        <ChevronDown size={14} strokeWidth={1.8} className="shrink-0 text-sales-text-muted" />
      </button>
      {open ? (
        <div className="absolute left-0 top-10 z-40 w-[min(240px,calc(100vw-32px))] overflow-hidden rounded-[10px] border border-sales-border bg-sales-surface shadow-sales-popover">
          <div className="border-b border-sales-border-subtle p-2">
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="h-8 w-full rounded-[6px] border border-sales-border bg-sales-surface px-2 text-[12px] text-sales-text-primary outline-none focus:border-sales-brand-border"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1" role="listbox">
            <button
              type="button"
              className="flex w-full px-3 py-1.5 text-left text-[12px] text-sales-text-primary hover:bg-sales-surface-hover"
              onClick={() => {
                onChange("all");
                setOpen(false);
              }}
            >
              {label}
            </button>
            {matches.map((option) => (
              <button
                type="button"
                key={option.id}
                className={cn(
                  "flex w-full px-3 py-1.5 text-left text-[12px] text-sales-text-primary hover:bg-sales-surface-hover",
                  option.id === value && "bg-sales-brand-soft"
                )}
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            ))}
            {matches.length === 0 ? (
              <p className="px-3 py-2 text-[12px] text-sales-text-muted">No matches</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FiltersPopover({
  data,
  filters,
  onChange,
}: {
  data: CompanyQuotationsPageData;
  filters: CompanyQuotationFilters;
  onChange: (filters: CompanyQuotationFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = companyQuotationMoreFiltersActive(filters) || filters.ownerId !== "all";
  const field =
    "h-9 w-full rounded-[8px] border border-sales-border bg-sales-surface px-2.5 text-[12px] text-sales-text-primary outline-none focus:border-sales-brand-border";

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="secondary"
        size="sm"
        className={cn("h-9", active && "border-sales-brand-border bg-sales-brand-soft")}
        leftIcon={<Filter size={14} />}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        Filters
        {active ? (
          <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-sales-brand px-1 text-[9px] font-bold text-sales-brand-text">
            {
              [
                filters.ownerId !== "all",
                filters.customerId !== "all",
                filters.dealId !== "all",
                filters.quoteStatus !== "all",
                filters.approval !== "all",
                filters.commercial !== "all",
                filters.engagement !== "all",
                filters.expiry !== "all",
                filters.currency !== "all",
              ].filter(Boolean).length
            }
          </span>
        ) : null}
      </Button>
      {open ? (
        <div className="absolute right-0 top-11 z-40 w-[min(360px,calc(100vw-32px))] rounded-[12px] border border-sales-border bg-sales-surface p-4 shadow-sales-popover">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[13px] font-semibold text-sales-text-primary">Filters</p>
            <button
              type="button"
              className="text-[12px] font-medium text-sales-brand-fg hover:underline"
              onClick={() => onChange(DEFAULT_COMPANY_QUOTATION_FILTERS)}
            >
              Clear
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2">
              <span className="mb-1 block text-[11px] font-medium text-sales-text-muted">Salesperson</span>
              <SearchableFilter
                value={filters.ownerId}
                onChange={(ownerId) => onChange({ ...filters, ownerId })}
                label="All salespeople"
                options={data.owners.map((owner) => ({ id: owner.id, label: owner.name }))}
              />
            </label>
            <label>
              <span className="mb-1 block text-[11px] font-medium text-sales-text-muted">Status</span>
              <select
                className={field}
                value={filters.quoteStatus}
                onChange={(event) =>
                  onChange({
                    ...filters,
                    quoteStatus: event.target.value as CompanyQuotationFilters["quoteStatus"],
                  })
                }
              >
                <option value="all">Any status</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="viewed">Viewed</option>
                <option value="accepted">Accepted</option>
                <option value="declined">Declined</option>
                <option value="expired">Expired</option>
                <option value="superseded">Superseded</option>
              </select>
            </label>
            <label>
              <span className="mb-1 block text-[11px] font-medium text-sales-text-muted">Approval</span>
              <select
                className={field}
                value={filters.approval}
                onChange={(event) =>
                  onChange({
                    ...filters,
                    approval: event.target.value as CompanyQuotationFilters["approval"],
                  })
                }
              >
                <option value="all">Any approval</option>
                <option value="not_required">Not required</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="changes_requested">Changes requested</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
            <label>
              <span className="mb-1 block text-[11px] font-medium text-sales-text-muted">Commercial</span>
              <select
                className={field}
                value={filters.commercial}
                onChange={(event) =>
                  onChange({
                    ...filters,
                    commercial: event.target.value as CompanyQuotationFilters["commercial"],
                  })
                }
              >
                <option value="all">Any commercial</option>
                <option value="margin_below">Margin below policy</option>
                <option value="margin_near">Margin near minimum</option>
                <option value="discount_exception">Discount exception</option>
              </select>
            </label>
            <label>
              <span className="mb-1 block text-[11px] font-medium text-sales-text-muted">Customer</span>
              <select
                className={field}
                value={filters.engagement}
                onChange={(event) =>
                  onChange({
                    ...filters,
                    engagement: event.target.value as CompanyQuotationFilters["engagement"],
                  })
                }
              >
                <option value="all">Any engagement</option>
                <option value="not_viewed">Not viewed</option>
                <option value="viewed">Viewed</option>
                <option value="changes_requested">Changes requested</option>
                <option value="accepted">Accepted</option>
              </select>
            </label>
            <label>
              <span className="mb-1 block text-[11px] font-medium text-sales-text-muted">Expiry</span>
              <select
                className={field}
                value={filters.expiry}
                onChange={(event) =>
                  onChange({
                    ...filters,
                    expiry: event.target.value as CompanyQuotationFilters["expiry"],
                  })
                }
              >
                <option value="all">Any expiry</option>
                <option value="expiring_soon">Expiring soon</option>
                <option value="expired">Expired</option>
              </select>
            </label>
            {data.currencies.length > 1 ? (
              <label>
                <span className="mb-1 block text-[11px] font-medium text-sales-text-muted">Currency</span>
                <select
                  className={field}
                  value={filters.currency}
                  onChange={(event) => onChange({ ...filters, currency: event.target.value })}
                >
                  <option value="all">All currencies</option>
                  {data.currencies.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className={data.currencies.length > 1 ? "" : "col-span-2"}>
              <span className="mb-1 block text-[11px] font-medium text-sales-text-muted">Deal</span>
              <SearchableFilter
                value={filters.dealId}
                onChange={(dealId) => onChange({ ...filters, dealId })}
                label="All Deals"
                options={data.deals}
              />
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DatePopover({
  filters,
  onChange,
}: {
  filters: CompanyQuotationFilters;
  onChange: (filters: CompanyQuotationFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = Boolean(filters.dateFrom || filters.dateTo);
  const field =
    "h-9 w-full rounded-[8px] border border-sales-border bg-sales-surface px-2.5 text-[12px] text-sales-text-primary outline-none focus:border-sales-brand-border";

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="secondary"
        size="sm"
        className={cn("h-9", active && "border-sales-brand-border bg-sales-brand-soft")}
        onClick={() => setOpen((value) => !value)}
      >
        Date
      </Button>
      {open ? (
        <div className="absolute right-0 top-11 z-40 w-[min(280px,calc(100vw-32px))] rounded-[12px] border border-sales-border bg-sales-surface p-4 shadow-sales-popover">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-sales-text-muted">Date field</span>
            <select
              className={field}
              value={filters.dateField}
              onChange={(event) =>
                onChange({
                  ...filters,
                  dateField: event.target.value as CompanyQuotationFilters["dateField"],
                })
              }
            >
              <option value="created">Created</option>
              <option value="sent">Sent</option>
              <option value="response">Response</option>
            </select>
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label>
              <span className="mb-1 block text-[11px] font-medium text-sales-text-muted">From</span>
              <input
                type="date"
                className={field}
                value={filters.dateFrom}
                onChange={(event) => onChange({ ...filters, dateFrom: event.target.value })}
              />
            </label>
            <label>
              <span className="mb-1 block text-[11px] font-medium text-sales-text-muted">To</span>
              <input
                type="date"
                className={field}
                value={filters.dateTo}
                onChange={(event) => onChange({ ...filters, dateTo: event.target.value })}
              />
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RowMenu({
  row,
  alignUp,
  alsoSells,
  onView,
  onPdf,
  onEdit,
  onDuplicate,
  onRevise,
  onOpenDeal,
  onOpenCustomer,
  onOpenWorkspace,
}: {
  row: CompanyQuotationRow;
  alignUp: boolean;
  alsoSells: boolean;
  onView: () => void;
  onPdf: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onRevise: () => void;
  onOpenDeal: () => void;
  onOpenCustomer: () => void;
  onOpenWorkspace: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const canRevise = ["sent", "viewed", "rejected", "expired"].includes(row.effectiveStatus);

  function action(icon: ReactNode, label: string, handler: () => void) {
    return (
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12px] text-sales-text-primary hover:bg-sales-surface-hover"
        onClick={() => {
          setOpen(false);
          handler();
        }}
      >
        <span className="text-sales-text-muted [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
        {label}
      </button>
    );
  }

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        type="button"
        aria-label={`Actions for ${displayQuoteNumber(row)}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-sales-text-muted hover:bg-sales-surface-hover hover:text-sales-text-primary"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <MoreHorizontal size={16} strokeWidth={1.8} />
      </button>
      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute right-0 z-40 w-56 overflow-hidden rounded-[10px] border border-sales-border bg-sales-surface py-1 shadow-sales-popover",
            alignUp ? "bottom-9" : "top-9"
          )}
          onClick={(event) => event.stopPropagation()}
        >
          {action(<ExternalLink />, "Open quotation", onView)}
          {alsoSells ? action(<FilePenLine />, "Open quotation workspace", onOpenWorkspace) : null}
          {alsoSells && row.effectiveStatus === "draft" ? action(<FilePenLine />, "Edit", onEdit) : null}
          {action(<Download />, "View PDF", onPdf)}
          {alsoSells && canRevise ? action(<FilePlus2 />, "Create revision", onRevise) : null}
          {alsoSells ? action(<Copy />, "Duplicate", onDuplicate) : null}
          {row.dealId ? action(<ExternalLink />, "Open Deal", onOpenDeal) : null}
          {row.contactId ? action(<ExternalLink />, "Open customer", onOpenCustomer) : null}
        </div>
      ) : null}
    </div>
  );
}

function emptyCopy(
  tab: CompanyQuotationTab,
  kind: CompanyQuotationEmptyKind,
  searchQuery: string
): { title: string; body: string } {
  if (kind === "search") {
    return {
      title: `No quotations match “${searchQuery}”`,
      body: "Try a different quotation number, customer or Deal.",
    };
  }
  if (kind === "filters") {
    return {
      title: "No quotations match these filters.",
      body: "Clear filters to see more results.",
    };
  }
  if (kind === "tab") {
    if (tab === "pending_approval") {
      return {
        title: "No quotations waiting for approval",
        body: "Your commercial approval queue is clear.",
      };
    }
    if (tab === "needs_attention") {
      return {
        title: "Nothing needs attention",
        body: "There are no quotation exceptions or customer actions requiring review.",
      };
    }
    if (tab === "sent") return { title: "No sent quotations.", body: "Offers waiting on the customer appear here." };
    if (tab === "accepted") return { title: "No accepted quotations.", body: "Customer-accepted offers appear here." };
    if (tab === "declined") return { title: "No declined quotations.", body: "Customer-declined offers appear here." };
    if (tab === "expired") return { title: "No expired quotations.", body: "Offers past their validity date appear here." };
  }
  return {
    title: "No quotations yet",
    body: "Your team's commercial offers will appear here.",
  };
}

function CommercialCell({
  row,
  permissions,
}: {
  row: CompanyQuotationRow;
  permissions: CompanyQuotationPermissions;
}) {
  const commercial = companyQuotationCommercialLabel(row, permissions.canSeeMarginPercent);
  return (
    <div className="min-w-0">
      <p
        className={cn(
          "truncate text-[11px] font-medium",
          commercial.tone === "danger" && "text-sales-danger",
          commercial.tone === "warning" && "text-sales-warning-fg",
          commercial.tone === "success" && "text-sales-success-fg",
          commercial.tone === "neutral" && "text-sales-text-secondary"
        )}
      >
        {commercial.primary}
      </p>
      {commercial.secondary ? (
        <p className="mt-0.5 truncate text-[10px] text-sales-text-muted">{commercial.secondary}</p>
      ) : row.discountPercent != null && row.discountPercent > 0 && row.marginHealth !== "healthy" ? (
        <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-sales-text-muted">
          {row.discountPercent}%
          {row.discountExceedsAuthority ? (
            <AlertTriangle size={10} className="text-sales-warning-fg" aria-label="Discount above authority" />
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

export function CompanyQuotationsTable({
  data,
  rows,
  tab,
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  emptyKind,
  loadError,
  searchQuery,
  selectedId,
  selectedIds,
  onToggleRow,
  onTogglePage,
  onSelect,
  onViewPdf,
  onEdit,
  onDuplicate,
  onRevise,
  onOpenDeal,
  onOpenCustomer,
  onOpenWorkspace,
  onExportSelected,
  onClearSearch,
  onClear,
  onRetry,
  onCreate,
}: {
  data: CompanyQuotationsPageData;
  rows: CompanyQuotationRow[];
  tab: CompanyQuotationTab;
  search: string;
  onSearchChange: (value: string) => void;
  filters: CompanyQuotationFilters;
  onFiltersChange: (filters: CompanyQuotationFilters) => void;
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  emptyKind: CompanyQuotationEmptyKind;
  loadError?: string | null;
  searchQuery: string;
  selectedId: string | null;
  selectedIds: Set<string>;
  onToggleRow: (id: string, checked: boolean) => void;
  onTogglePage: (checked: boolean) => void;
  onSelect: (id: string) => void;
  onViewPdf: (row: CompanyQuotationRow) => void;
  onEdit: (row: CompanyQuotationRow) => void;
  onDuplicate: (row: CompanyQuotationRow) => void;
  onRevise: (row: CompanyQuotationRow) => void;
  onOpenDeal: (row: CompanyQuotationRow) => void;
  onOpenCustomer: (row: CompanyQuotationRow) => void;
  onOpenWorkspace: (row: CompanyQuotationRow) => void;
  onExportSelected: () => void;
  onClearSearch: () => void;
  onClear: () => void;
  onRetry: () => void;
  onCreate: () => void;
}) {
  const allPageSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.id));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const empty = emptyCopy(tab, emptyKind, searchQuery);
  const approvalQueue = tab === "pending_approval";
  const permissions = data.permissions;

  return (
    <section
      className="min-w-0 max-w-full overflow-visible rounded-[14px] border border-sales-border bg-sales-surface shadow-sales-card"
      data-course-target="company-quotations-table"
    >
      <div className="flex min-w-0 flex-col gap-2 border-b border-sales-border-subtle px-3 py-3 sm:px-4 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            size={15}
            strokeWidth={1.8}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sales-text-muted"
          />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search quotations, customers or Deals..."
            className="h-9 w-full rounded-[8px] border border-sales-border bg-sales-surface pl-9 pr-3 text-[12px] text-sales-text-primary outline-none placeholder:text-sales-text-muted focus:border-sales-brand-border focus:shadow-[var(--sales-focus-ring)]"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <FiltersPopover data={data} filters={filters} onChange={onFiltersChange} />
          <DatePopover filters={filters} onChange={onFiltersChange} />
        </div>
      </div>

      {selectedIds.size > 0 ? (
        <div className="flex items-center justify-between gap-3 border-b border-sales-border-subtle bg-sales-surface-subtle px-4 py-2">
          <p className="text-[12px] font-medium text-sales-text-secondary">
            {selectedIds.size} selected
          </p>
          <button
            type="button"
            className="text-[12px] font-semibold text-sales-brand-fg hover:underline"
            onClick={onExportSelected}
          >
            Export selected
          </button>
        </div>
      ) : null}

      {rows.length > 0 && !loadError ? (
      <div className="hidden min-w-0 max-w-full overflow-x-auto lg:block">
        <table className="w-full min-w-[980px] border-collapse text-left">
          <thead className="bg-sales-surface-subtle">
            <tr className="h-10 border-b border-sales-border-subtle text-[10px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
              <th className="w-10 px-3 text-center">
                <span onClick={(event) => event.stopPropagation()}>
                  <Checkbox
                    checked={allPageSelected}
                    onCheckedChange={onTogglePage}
                    aria-label="Select this page"
                  />
                </span>
              </th>
              <th className="w-[14%] px-2">Quote</th>
              <th className="w-[16%] px-2">Customer / Deal</th>
              <th className="w-[13%] px-2">Salesperson</th>
              <th className="w-[10%] px-2">Value</th>
              {approvalQueue ? (
                <>
                  <th className="w-[8%] px-2">Discount</th>
                  {permissions.canSeeMargin ? <th className="w-[8%] px-2">Margin</th> : null}
                  <th className="w-[14%] px-2">Why approval</th>
                  <th className="w-[10%] px-2">Submitted</th>
                  <th className="w-[8%] px-2">Status</th>
                </>
              ) : (
                <>
                  <th className="w-[11%] px-2">Commercial</th>
                  <th className="w-[10%] px-2">Approval</th>
                  <th className="w-[10%] px-2">Customer</th>
                  <th className="w-[10%] px-2">Valid until</th>
                  <th className="w-[9%] px-2">Next action</th>
                </>
              )}
              <th className="w-10 px-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const selected = row.id === selectedId;
              const validity = formatQuoteValidity(row.validUntil, { status: row.effectiveStatus });
              const engagement = companyQuotationEngagement(row);
              return (
                <tr
                  key={row.id}
                  data-course-target="company-quotation-row"
                  className={cn(
                    "h-[74px] cursor-pointer border-b border-sales-border-subtle transition-colors last:border-b-0 hover:bg-sales-surface-hover",
                    selected && "bg-sales-brand-soft hover:bg-sales-brand-soft"
                  )}
                  onClick={() => onSelect(row.id)}
                  aria-selected={selected}
                >
                  <td className="relative px-3 text-center" onClick={(event) => event.stopPropagation()}>
                    {selected ? (
                      <span className="absolute inset-y-0 left-0 w-0.5 bg-sales-brand" aria-hidden />
                    ) : null}
                    <Checkbox
                      checked={selectedIds.has(row.id)}
                      onCheckedChange={(checked) => onToggleRow(row.id, checked)}
                      aria-label={`Select ${displayQuoteNumber(row)}`}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <p className="truncate text-[12px] font-semibold text-sales-text-primary">
                      {displayQuoteNumber(row)}
                    </p>
                    <p className="mt-0.5 text-[10px] text-sales-text-muted">Version {row.revisionNumber}</p>
                  </td>
                  <td className="px-2 py-2">
                    <p className="truncate text-[12px] font-medium text-sales-text-primary">{row.customerName}</p>
                    <p className="mt-0.5 truncate text-[10px] text-sales-text-muted">
                      {row.dealName || row.title}
                    </p>
                  </td>
                  <td className="px-2 py-2">
                    {row.owner ? (
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Avatar name={row.owner.name} src={row.owner.avatarUrl} size="xs" />
                        <span className="truncate text-[11px] text-sales-text-primary">{row.owner.name}</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-sales-text-muted">Unassigned</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-[12px] font-semibold tabular-nums text-sales-text-primary">
                    {formatQuoteAmount(row.amount, row.currency, {
                      draftUnset: row.effectiveStatus === "draft",
                    })}
                  </td>
                  {approvalQueue ? (
                    <>
                      <td className="px-2 py-2 text-[11px] tabular-nums text-sales-text-secondary">
                        <span className="inline-flex items-center gap-1">
                          {row.discountPercent != null ? `${row.discountPercent}%` : "—"}
                          {row.discountExceedsAuthority ? (
                            <AlertTriangle size={11} className="text-sales-warning-fg" aria-label="Above authority" />
                          ) : null}
                        </span>
                      </td>
                      {permissions.canSeeMargin ? (
                        <td className="px-2 py-2 text-[11px] tabular-nums text-sales-text-secondary">
                          {row.marginPercent != null ? `${row.marginPercent}%` : "—"}
                        </td>
                      ) : null}
                      <td className="px-2 py-2">
                        <p className="line-clamp-2 text-[11px] text-sales-text-secondary">
                          {row.approvalReasons[0] || (companyQuotationIsPendingApproval(row) ? "Approval required" : "—")}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-[10px] text-sales-text-secondary">
                        {relativeTime(row.approvalRequestedAt || row.updatedAt)}
                      </td>
                      <td className="px-2 py-2">
                        <Badge tone="warning" appearance="soft" className="!px-2 !py-0.5 !text-[10px]">
                          Pending
                        </Badge>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-2 py-2">
                        <CommercialCell row={row} permissions={permissions} />
                      </td>
                      <td className="px-2 py-2">
                        <Badge
                          tone={approvalTone(row.approvalStatus)}
                          appearance="soft"
                          className="!px-2 !py-0.5 !text-[10px]"
                        >
                          {companyQuotationApprovalLabel(row.approvalStatus)}
                        </Badge>
                      </td>
                      <td className="px-2 py-2">
                        <Badge
                          tone={engagementTone(engagement)}
                          appearance="soft"
                          className="!px-2 !py-0.5 !text-[10px]"
                        >
                          {companyQuotationEngagementLabel(engagement)}
                        </Badge>
                      </td>
                      <td className="px-2 py-2">
                        <p className="text-[11px] text-sales-text-primary">{validity.primary}</p>
                        {validity.secondary ? (
                          <p
                            className={cn(
                              "mt-0.5 text-[10px]",
                              validity.tone === "danger" && "text-sales-danger",
                              validity.tone === "warning" && "text-sales-warning-fg",
                              validity.tone === "ok" && "text-sales-text-muted"
                            )}
                          >
                            {validity.secondary.replace(/^in /, "").replace(/^Expires in /, "")}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 text-[11px] font-medium text-sales-text-secondary">
                        {companyQuotationNextAction(row)}
                      </td>
                    </>
                  )}
                  <td className="px-2 py-2 text-right" onClick={(event) => event.stopPropagation()}>
                    <RowMenu
                      row={row}
                      alignUp={index >= Math.max(4, rows.length - 3)}
                      alsoSells={permissions.alsoSells}
                      onView={() => onSelect(row.id)}
                      onPdf={() => onViewPdf(row)}
                      onEdit={() => onEdit(row)}
                      onDuplicate={() => onDuplicate(row)}
                      onRevise={() => onRevise(row)}
                      onOpenDeal={() => onOpenDeal(row)}
                      onOpenCustomer={() => onOpenCustomer(row)}
                      onOpenWorkspace={() => onOpenWorkspace(row)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      ) : null}

      {rows.length > 0 && !loadError ? (
      <div className="space-y-2 p-3 lg:hidden">
        {rows.map((row) => {
          const engagement = companyQuotationEngagement(row);
          const commercial = companyQuotationCommercialLabel(row, permissions.canSeeMarginPercent);
          return (
            <button
              type="button"
              key={row.id}
              data-course-target="company-quotation-row"
              className={cn(
                "w-full rounded-[12px] border border-sales-border bg-sales-surface p-3.5 text-left shadow-sales-card transition-colors hover:bg-sales-surface-hover",
                selectedId === row.id && "border-sales-brand-border bg-sales-brand-soft"
              )}
              onClick={() => onSelect(row.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-sales-text-primary">
                    {displayQuoteNumber(row)}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-sales-text-secondary">{row.customerName}</p>
                  {row.owner ? (
                    <p className="mt-0.5 truncate text-[11px] text-sales-text-muted">{row.owner.name}</p>
                  ) : null}
                </div>
                <p className="shrink-0 text-[13px] font-semibold tabular-nums text-sales-text-primary">
                  {formatQuoteAmount(row.amount, row.currency)}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-sales-border-subtle pt-3">
                <Badge tone={getQuoteStatusTone(row.effectiveStatus)} appearance="soft" className="!text-[10px]">
                  {formatQuoteStatus(row.effectiveStatus)}
                </Badge>
                <Badge tone={approvalTone(row.approvalStatus)} appearance="soft" className="!text-[10px]">
                  {companyQuotationApprovalLabel(row.approvalStatus)}
                </Badge>
                {commercial.tone !== "neutral" || commercial.primary !== "—" ? (
                  <span className="text-[10px] text-sales-text-muted">{commercial.primary}</span>
                ) : (
                  <span className="text-[10px] text-sales-text-muted">
                    {companyQuotationEngagementLabel(engagement)}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      ) : null}

      {loadError ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center px-6 py-12 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sales-neutral-100 text-sales-text-muted">
            <FileText size={20} strokeWidth={1.7} />
          </span>
          <h3 className="mt-3 text-[14px] font-semibold text-sales-text-primary">
            We couldn&apos;t load quotations.
          </h3>
          <p className="mt-1 max-w-sm text-[12px] text-sales-text-muted">
            Check your connection and try again.
          </p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center px-6 py-12 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sales-neutral-100 text-sales-text-muted">
            <FileText size={20} strokeWidth={1.7} />
          </span>
          <h3 className="mt-3 text-[14px] font-semibold text-sales-text-primary">{empty.title}</h3>
          <p className="mt-1 max-w-sm text-[12px] text-sales-text-muted">{empty.body}</p>
          {emptyKind === "none" && permissions.alsoSells ? (
            <Button variant="secondary" size="sm" className="mt-4" onClick={onCreate}>
              Create quotation
            </Button>
          ) : emptyKind === "search" ? (
            <Button variant="secondary" size="sm" className="mt-4" onClick={onClearSearch}>
              Clear search
            </Button>
          ) : emptyKind === "tab" ? (
            <Button variant="secondary" size="sm" className="mt-4" onClick={onClear}>
              View all quotations
            </Button>
          ) : emptyKind !== "none" ? (
            <Button variant="secondary" size="sm" className="mt-4" onClick={onClear}>
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : null}

      <footer className="flex min-h-[52px] flex-col items-center justify-between gap-3 border-t border-sales-border-subtle px-4 py-2.5 sm:flex-row">
        <p className="text-[11px] text-sales-text-muted">
          Showing {from}–{to} of {total}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous page"
              disabled={page <= 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-sales-text-muted hover:bg-sales-surface-hover disabled:opacity-35"
              onClick={() => onPageChange(Math.max(1, page - 1))}
            >
              <ChevronLeft size={15} />
            </button>
            {companyQuotationPageItems(page, pageCount).map((item, index) =>
              item === "ellipsis" ? (
                <span key={`ellipsis-${index}`} className="px-1 text-[11px] text-sales-text-muted">
                  …
                </span>
              ) : (
                <button
                  type="button"
                  key={item}
                  className={cn(
                    "relative inline-flex h-8 min-w-8 items-center justify-center rounded-[8px] px-2 text-[11px] font-medium text-sales-text-secondary",
                    page === item &&
                      "bg-sales-surface-subtle font-semibold text-sales-text-primary after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:rounded-full after:bg-sales-brand"
                  )}
                  onClick={() => onPageChange(item)}
                >
                  {item}
                </button>
              )
            )}
            <button
              type="button"
              aria-label="Next page"
              disabled={page >= pageCount}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-sales-text-muted hover:bg-sales-surface-hover disabled:opacity-35"
              onClick={() => onPageChange(Math.min(pageCount, page + 1))}
            >
              <ChevronRight size={15} />
            </button>
          </div>
          <select
            aria-label="Results per page"
            className="h-8 rounded-[8px] border border-sales-border bg-sales-surface px-2 text-[12px] text-sales-text-secondary"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {[COMPANY_QUOTATIONS_PAGE_SIZE, 25, 50].map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        </div>
      </footer>
    </section>
  );
}
