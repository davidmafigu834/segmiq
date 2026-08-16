"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  FilePenLine,
  FilePlus2,
  FileText,
  Filter,
  MoreHorizontal,
  Rows3,
  Search,
  Send,
  SlidersHorizontal,
} from "lucide-react";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { Avatar, Badge, Button, Checkbox } from "@/components/sales/ui";
import {
  COMPANY_QUOTATIONS_PAGE_SIZE,
  COMPANY_QUOTATION_TABS,
  DEFAULT_COMPANY_QUOTATION_FILTERS,
  companyQuotationMoreFiltersActive,
  companyQuotationPageItems,
  companyQuotationSendLabel,
  type CompanyQuotationEmptyKind,
  type CompanyQuotationFilters,
  type CompanyQuotationsSort,
} from "@/lib/sales/company-quotations";
import {
  formatQuoteAmount,
  formatQuoteStatus,
  getQuoteStatusTone,
} from "@/lib/sales/quotes";
import { cn } from "@/lib/ui/cn";
import type {
  CompanyQuotationRow,
  CompanyQuotationTab,
  CompanyQuotationsPageData,
} from "./types";

export type QuotationDensity = "compact" | "comfortable";

function displayQuoteNumber(row: CompanyQuotationRow): string {
  if (!row.quoteNumber?.trim()) return "Draft";
  if (row.revisionNumber > 1 && !/-R\d+$/i.test(row.quoteNumber)) {
    return `${row.quoteNumber}-R${row.revisionNumber}`;
  }
  return row.quoteNumber;
}

function updatedLabel(value: string): string {
  const date = parseISO(value);
  if (Number.isNaN(date.getTime())) return "—";
  if (isToday(date)) return `Today, ${format(date, "h:mm a")}`;
  if (isYesterday(date)) return `Yesterday, ${format(date, "h:mm a")}`;
  return format(date, "MMM d, yyyy");
}

function SelectFilter({
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
  return (
    <label className={cn("relative min-w-0", className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full appearance-none rounded-[8px] border border-sales-border bg-sales-surface py-0 pl-3 pr-8 text-[12px] font-medium text-sales-text-secondary outline-none transition-colors hover:border-sales-border-strong focus:border-sales-brand-border focus:shadow-[var(--sales-focus-ring)]"
      >
        <option value="all">{label}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        strokeWidth={1.8}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sales-text-muted"
        aria-hidden
      />
    </label>
  );
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

function MoreFilters({
  filters,
  onChange,
}: {
  filters: CompanyQuotationFilters;
  onChange: (filters: CompanyQuotationFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = companyQuotationMoreFiltersActive(filters);

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const field =
    "h-9 w-full rounded-[8px] border border-sales-border bg-sales-surface px-2.5 text-[12px] text-sales-text-primary outline-none focus:border-sales-brand-border";

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
        More Filters
        {active ? (
          <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-sales-brand px-1 text-[9px] font-bold text-sales-brand-text">
            {
              [
                filters.exceptionalStatus !== "all",
                filters.dealPresence !== "all",
                filters.amountMin !== "",
                filters.amountMax !== "",
                filters.dateFrom !== "",
                filters.dateTo !== "",
              ].filter(Boolean).length
            }
          </span>
        ) : null}
      </Button>
      {open ? (
        <div className="absolute left-0 top-11 z-40 w-[min(320px,calc(100vw-32px))] rounded-[12px] border border-sales-border bg-sales-surface p-4 shadow-sales-popover sm:left-auto sm:right-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[13px] font-semibold text-sales-text-primary">More filters</p>
            <button
              type="button"
              className="text-[12px] font-medium text-sales-brand-fg hover:underline"
              onClick={() => onChange({ ...DEFAULT_COMPANY_QUOTATION_FILTERS, ownerId: filters.ownerId, customerId: filters.customerId, dealId: filters.dealId })}
            >
              Clear
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2">
              <span className="mb-1 block text-[11px] font-medium text-sales-text-muted">Status</span>
              <select
                className={field}
                value={filters.exceptionalStatus}
                onChange={(event) =>
                  onChange({ ...filters, exceptionalStatus: event.target.value as "all" | "expired" })
                }
              >
                <option value="all">Any status</option>
                <option value="expired">Expired</option>
              </select>
            </label>
            <label className="col-span-2">
              <span className="mb-1 block text-[11px] font-medium text-sales-text-muted">Deal relationship</span>
              <select
                className={field}
                value={filters.dealPresence}
                onChange={(event) =>
                  onChange({
                    ...filters,
                    dealPresence: event.target.value as "all" | "with" | "without",
                  })
                }
              >
                <option value="all">All quotations</option>
                <option value="with">Has Deal</option>
                <option value="without">No Deal</option>
              </select>
            </label>
            <label>
              <span className="mb-1 block text-[11px] font-medium text-sales-text-muted">Minimum amount</span>
              <input
                type="number"
                min="0"
                className={field}
                placeholder="0"
                value={filters.amountMin}
                onChange={(event) => onChange({ ...filters, amountMin: event.target.value })}
              />
            </label>
            <label>
              <span className="mb-1 block text-[11px] font-medium text-sales-text-muted">Maximum amount</span>
              <input
                type="number"
                min="0"
                className={field}
                placeholder="Any"
                value={filters.amountMax}
                onChange={(event) => onChange({ ...filters, amountMax: event.target.value })}
              />
            </label>
            <label>
              <span className="mb-1 block text-[11px] font-medium text-sales-text-muted">Quote date from</span>
              <input
                type="date"
                className={field}
                value={filters.dateFrom}
                onChange={(event) => onChange({ ...filters, dateFrom: event.target.value })}
              />
            </label>
            <label>
              <span className="mb-1 block text-[11px] font-medium text-sales-text-muted">Quote date to</span>
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
  onView,
  onPdf,
  onEdit,
  onSend,
  onDuplicate,
  onRevise,
  onMarkAccepted,
  onMarkDeclined,
  onOpenDeal,
  onOpenCustomer,
}: {
  row: CompanyQuotationRow;
  alignUp: boolean;
  onView: () => void;
  onPdf: () => void;
  onEdit: () => void;
  onSend: () => void;
  onDuplicate: () => void;
  onRevise: () => void;
  onMarkAccepted: () => void;
  onMarkDeclined: () => void;
  onOpenDeal: () => void;
  onOpenCustomer: () => void;
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

  const isDraft = row.effectiveStatus === "draft";
  const canRevise = ["sent", "viewed", "rejected", "expired"].includes(row.effectiveStatus);
  const canOutcome = ["sent", "viewed"].includes(row.effectiveStatus);
  const sendLabel = companyQuotationSendLabel(row.effectiveStatus);

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
            "absolute right-0 z-40 w-52 overflow-hidden rounded-[10px] border border-sales-border bg-sales-surface py-1 shadow-sales-popover",
            alignUp ? "bottom-9" : "top-9"
          )}
          onClick={(event) => event.stopPropagation()}
        >
          {action(<ExternalLink />, "View quotation", onView)}
          {isDraft ? action(<FilePenLine />, "Edit", onEdit) : null}
          {sendLabel
            ? action(<Send />, sendLabel === "Send" ? "Send quotation" : "Send again", onSend)
            : null}
          {action(<Download />, "View PDF", onPdf)}
          {canRevise ? action(<FilePlus2 />, "Create revision", onRevise) : null}
          {action(<Copy />, "Duplicate", onDuplicate)}
          {canOutcome ? action(<FileText />, "Mark accepted", onMarkAccepted) : null}
          {canOutcome ? action(<FileText />, "Mark declined", onMarkDeclined) : null}
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
      body: "Try a different quotation number, Customer, Deal, or owner.",
    };
  }
  if (kind === "filters") {
    return {
      title: "No quotations match these filters.",
      body: "Clear filters to see more results.",
    };
  }
  if (kind === "tab") {
    if (tab === "draft") return { title: "No Draft quotations.", body: "Drafts you create will appear here." };
    if (tab === "sent") return { title: "No Sent quotations yet.", body: "Quotations delivered to customers appear here." };
    if (tab === "viewed") return { title: "No Viewed quotations.", body: "Quotes opened on a tracked public link appear here." };
    if (tab === "accepted") return { title: "No Accepted quotations.", body: "Customer-accepted quotes appear here." };
    if (tab === "declined") return { title: "No Declined quotations.", body: "Quotes declined by the customer appear here." };
  }
  return {
    title: "No quotations yet.",
    body: "Create your first quotation to send a professional offer to a customer.",
  };
}

export function CompanyQuotationsTable({
  data,
  rows,
  tab,
  onTabChange,
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  density,
  onDensityChange,
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  sort,
  onSortChange,
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
  onSend,
  onDuplicate,
  onRevise,
  onMarkAccepted,
  onMarkDeclined,
  onOpenDeal,
  onOpenCustomer,
  onExportSelected,
  onClearSearch,
  onClear,
  onRetry,
  onCreate,
}: {
  data: CompanyQuotationsPageData;
  rows: CompanyQuotationRow[];
  tab: CompanyQuotationTab;
  onTabChange: (tab: CompanyQuotationTab) => void;
  search: string;
  onSearchChange: (value: string) => void;
  filters: CompanyQuotationFilters;
  onFiltersChange: (filters: CompanyQuotationFilters) => void;
  density: QuotationDensity;
  onDensityChange: (density: QuotationDensity) => void;
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  sort: CompanyQuotationsSort;
  onSortChange: (sort: CompanyQuotationsSort) => void;
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
  onSend: (row: CompanyQuotationRow) => void;
  onDuplicate: (row: CompanyQuotationRow) => void;
  onRevise: (row: CompanyQuotationRow) => void;
  onMarkAccepted: (row: CompanyQuotationRow) => void;
  onMarkDeclined: (row: CompanyQuotationRow) => void;
  onOpenDeal: (row: CompanyQuotationRow) => void;
  onOpenCustomer: (row: CompanyQuotationRow) => void;
  onExportSelected: () => void;
  onClearSearch: () => void;
  onClear: () => void;
  onRetry: () => void;
  onCreate: () => void;
}) {
  const allPageSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.id));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const rowHeight = density === "compact" ? "h-[54px]" : "h-[62px]";
  const empty = emptyCopy(tab, emptyKind, searchQuery);
  const OwnerFilter = data.owners.length > 8 ? SearchableFilter : SelectFilter;

  return (
    <section
      className="min-w-0 max-w-full overflow-visible rounded-[14px] border border-sales-border bg-sales-surface shadow-sales-card"
      data-course-target="company-quotations-table"
    >
      <div
        className="overflow-x-auto border-b border-sales-border-subtle px-4 pt-1 sm:px-5"
        data-course-target="company-quotations-tabs"
      >
        <div className="flex min-w-max items-end gap-6">
          {COMPANY_QUOTATION_TABS.map((item) => (
            <button
              type="button"
              key={item.id}
              className={cn(
                "relative flex h-11 items-center gap-2 whitespace-nowrap text-[12px] font-medium text-sales-text-secondary",
                tab === item.id && "font-semibold text-sales-text-primary"
              )}
              onClick={() => onTabChange(item.id)}
            >
              {item.label}
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-sales-neutral-100 px-1.5 py-0.5 text-[10px] tabular-nums text-sales-text-secondary">
                {data.counts[item.id]}
              </span>
              {tab === item.id ? (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-sales-brand" />
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-2 border-b border-sales-border-subtle px-3 py-3 sm:px-4 xl:flex-row xl:items-center">
        <div className="relative min-w-0 flex-1 xl:max-w-[240px]">
          <Search
            size={15}
            strokeWidth={1.8}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sales-text-muted"
          />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search quotations..."
            className="h-9 w-full rounded-[8px] border border-sales-border bg-sales-surface pl-9 pr-3 text-[12px] text-sales-text-primary outline-none placeholder:text-sales-text-muted focus:border-sales-brand-border focus:shadow-[var(--sales-focus-ring)]"
          />
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 xl:flex xl:flex-1">
          <OwnerFilter
            className="xl:w-[132px]"
            value={filters.ownerId}
            onChange={(ownerId) => onFiltersChange({ ...filters, ownerId })}
            label="All Owners"
            options={data.owners.map((owner) => ({ id: owner.id, label: owner.name }))}
          />
          <SearchableFilter
            className="xl:w-[150px]"
            value={filters.customerId}
            onChange={(customerId) => onFiltersChange({ ...filters, customerId })}
            label="All Customers"
            options={data.customers}
          />
          <SearchableFilter
            className="xl:w-[132px]"
            value={filters.dealId}
            onChange={(dealId) => onFiltersChange({ ...filters, dealId })}
            label="All Deals"
            options={data.deals}
          />
          <MoreFilters filters={filters} onChange={onFiltersChange} />
        </div>
        <div className="hidden shrink-0 items-center rounded-[8px] border border-sales-border bg-sales-surface p-0.5 min-[1100px]:flex">
          <button
            type="button"
            title="Comfortable rows"
            aria-label="Comfortable rows"
            className={cn(
              "inline-flex h-7 w-8 items-center justify-center rounded-[6px] text-sales-text-muted",
              density === "comfortable" && "bg-sales-neutral-100 text-sales-text-primary"
            )}
            onClick={() => onDensityChange("comfortable")}
          >
            <SlidersHorizontal size={14} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            title="Compact rows"
            aria-label="Compact rows"
            className={cn(
              "inline-flex h-7 w-8 items-center justify-center rounded-[6px] text-sales-text-muted",
              density === "compact" && "bg-sales-neutral-100 text-sales-text-primary"
            )}
            onClick={() => onDensityChange("compact")}
          >
            <Rows3 size={15} strokeWidth={1.8} />
          </button>
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
        <table className="w-full min-w-[860px] border-collapse text-left">
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
              <th className="w-[18%] px-2">Quotation</th>
              <th className="w-[17%] px-2">Customer</th>
              <th className="hidden w-[17%] px-2 xl:table-cell">Deal</th>
              <th className="w-[12%] px-2">Amount</th>
              <th className="w-[10%] px-2">Status</th>
              <th className="w-[13%] px-2">Owner</th>
              <th className="w-[14%] px-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 uppercase tracking-[0.04em]"
                  onClick={() =>
                    onSortChange(sort === "updated_desc" ? "updated_asc" : "updated_desc")
                  }
                >
                  Updated
                  {sort === "updated_desc" ? (
                    <ChevronDown size={11} strokeWidth={2} />
                  ) : (
                    <ChevronUp size={11} strokeWidth={2} />
                  )}
                </button>
              </th>
              <th className="w-10 px-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const selected = row.id === selectedId;
              return (
                <tr
                  key={row.id}
                  data-course-target="company-quotation-row"
                  className={cn(
                    rowHeight,
                    "cursor-pointer border-b border-sales-border-subtle transition-colors last:border-b-0 hover:bg-sales-surface-hover",
                    selected && "bg-sales-brand-soft hover:bg-sales-brand-soft"
                  )}
                  onClick={() => onSelect(row.id)}
                  aria-selected={selected}
                >
                  <td className="px-3 text-center" onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(row.id)}
                      onCheckedChange={(checked) => onToggleRow(row.id, checked)}
                      aria-label={`Select ${displayQuoteNumber(row)}`}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sales-neutral-100 text-sales-text-secondary">
                        <FileText size={13} strokeWidth={1.8} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-semibold text-sales-text-primary">
                          {displayQuoteNumber(row)}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-sales-text-muted">
                          {row.title}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar name={row.customerName} size="xs" />
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-medium text-sales-text-primary">
                          {row.customerName}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-sales-text-muted">
                          {row.customerPhone || row.customerEmail || "No contact details"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-2 py-1.5 xl:table-cell">
                    {row.dealName ? (
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-medium text-sales-text-primary">
                          {row.dealName}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-sales-text-muted">
                          {row.dealValue != null
                            ? formatQuoteAmount(row.dealValue, row.currency)
                            : "Value pending"}
                        </p>
                      </div>
                    ) : (
                      <span className="text-[11px] text-sales-text-muted">No Deal</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-[11px] font-semibold tabular-nums text-sales-text-primary">
                    {formatQuoteAmount(row.amount, row.currency, {
                      draftUnset: row.effectiveStatus === "draft",
                    })}
                  </td>
                  <td className="px-2 py-1.5">
                    <Badge
                      tone={getQuoteStatusTone(row.effectiveStatus)}
                      appearance="soft"
                      className="!px-2 !py-0.5 !text-[10px]"
                    >
                      {formatQuoteStatus(row.effectiveStatus)}
                    </Badge>
                  </td>
                  <td className="px-2 py-1.5">
                    {row.owner ? (
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Avatar name={row.owner.name} src={row.owner.avatarUrl} size="xs" />
                        <span className="truncate text-[11px] text-sales-text-primary">
                          {row.owner.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-sales-text-muted">Unassigned</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-[10px] text-sales-text-secondary">
                    {updatedLabel(row.updatedAt)}
                  </td>
                  <td className="px-2 py-1.5 text-right" onClick={(event) => event.stopPropagation()}>
                    <RowMenu
                      row={row}
                      alignUp={index >= Math.max(4, rows.length - 3)}
                      onView={() => onSelect(row.id)}
                      onPdf={() => onViewPdf(row)}
                      onEdit={() => onEdit(row)}
                      onSend={() => onSend(row)}
                      onDuplicate={() => onDuplicate(row)}
                      onRevise={() => onRevise(row)}
                      onMarkAccepted={() => onMarkAccepted(row)}
                      onMarkDeclined={() => onMarkDeclined(row)}
                      onOpenDeal={() => onOpenDeal(row)}
                      onOpenCustomer={() => onOpenCustomer(row)}
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
        {rows.map((row) => (
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
                <p className="mt-0.5 truncate text-[12px] text-sales-text-secondary">
                  {row.customerName}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-sales-text-muted">
                  {row.dealName || row.title}
                </p>
                {row.owner ? (
                  <p className="mt-0.5 truncate text-[11px] text-sales-text-muted">{row.owner.name}</p>
                ) : null}
              </div>
              <Badge tone={getQuoteStatusTone(row.effectiveStatus)} appearance="soft">
                {formatQuoteStatus(row.effectiveStatus)}
              </Badge>
            </div>
            <div className="mt-3 flex items-end justify-between gap-3 border-t border-sales-border-subtle pt-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.04em] text-sales-text-muted">Amount</p>
                <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-sales-text-primary">
                  {formatQuoteAmount(row.amount, row.currency, {
                    draftUnset: row.effectiveStatus === "draft",
                  })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.04em] text-sales-text-muted">Updated</p>
                <p className="mt-0.5 text-[11px] text-sales-text-secondary">
                  {updatedLabel(row.updatedAt)}
                </p>
              </div>
            </div>
          </button>
        ))}
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
          {emptyKind === "none" ? (
            <Button variant="primary" size="sm" className="mt-4" onClick={onCreate}>
              New Quotation
            </Button>
          ) : emptyKind === "search" ? (
            <Button variant="secondary" size="sm" className="mt-4" onClick={onClearSearch}>
              Clear search
            </Button>
          ) : emptyKind === "tab" ? (
            <Button variant="secondary" size="sm" className="mt-4" onClick={onClear}>
              View all quotations
            </Button>
          ) : (
            <Button variant="secondary" size="sm" className="mt-4" onClick={onClear}>
              Clear filters
            </Button>
          )}
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
