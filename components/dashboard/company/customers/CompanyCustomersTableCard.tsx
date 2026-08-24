"use client";

import { useEffect, useRef, useState } from "react";
import {
  BriefcaseBusiness,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  MoreHorizontal,
  Phone,
  SlidersHorizontal,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { cn } from "@/lib/ui/cn";
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  DataTableBody,
  DataTableEl,
  DataTableHead,
  DataTableRow,
  DataTableTd,
  DataTableTh,
  EmptyState,
  MenuSelect,
  SearchInput,
} from "@/components/sales/ui";
import {
  COMPANY_CUSTOMERS_PAGE_SIZE,
  COMPANY_CUSTOMERS_TABS,
  companyCustomersFiltersActive,
} from "@/lib/sales/company-customers-metrics";
import type {
  CompanyCustomerRow,
  CompanyCustomersFilters,
  CompanyCustomersOwnerOption,
  CompanyCustomersSort,
  CompanyCustomersTab,
  CompanyCustomersTabCounts,
} from "./types";
import { DEFAULT_COMPANY_CUSTOMERS_FILTERS } from "./types";

function CustomerTypeBadge({ row }: { row: CompanyCustomerRow }) {
  return (
    <Badge
      tone={
        row.customerType === "company"
          ? "success"
          : "info"
      }
      appearance="soft"
      className="!px-2 !py-0.5 !text-[11px] !font-medium"
    >
      {row.customerTypeLabel}
    </Badge>
  );
}

function RowMenu({
  row,
  onView,
  onCall,
  onWhatsApp,
  onViewDeals,
}: {
  row: CompanyCustomerRow;
  onView: () => void;
  onCall: () => void;
  onWhatsApp: () => void;
  onViewDeals: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const item =
    "flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover";
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={`More actions for ${row.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
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
          className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-[10px] border border-sales-border bg-sales-surface py-1 shadow-sales-popover"
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); onView(); }}>
            View Customer
          </button>
          {row.phone ? (
            <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); onCall(); }}>
              <Phone size={14} /> Call
            </button>
          ) : null}
          {row.phone ? (
            <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); onWhatsApp(); }}>
              <SiWhatsapp size={14} color="#25D366" /> WhatsApp
            </button>
          ) : null}
          <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); onViewDeals(); }}>
            <BriefcaseBusiness size={14} /> View Deals ({row.totalDeals})
          </button>
        </div>
      ) : null}
    </div>
  );
}

function FiltersPopover({
  filters,
  onChange,
}: {
  filters: CompanyCustomersFilters;
  onChange: (filters: CompanyCustomersFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = companyCustomersFiltersActive(filters);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const selectClass =
    "mb-3 h-9 w-full rounded-[8px] border border-sales-border-strong bg-sales-surface px-2 text-[13px] text-sales-text-primary";
  return (
    <div className="relative" ref={ref}>
      <Button
        variant="secondary"
        size="sm"
        leftIcon={<Filter size={14} />}
        rightIcon={<ChevronDown size={14} />}
        className={active ? "border-sales-brand-border" : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        Filters
      </Button>
      {open ? (
        <div className="absolute left-0 z-30 mt-2 w-[270px] rounded-[12px] border border-sales-border bg-sales-surface p-3 shadow-sales-popover">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">Active Deals</p>
          <select
            className={selectClass}
            value={filters.activeDeals}
            onChange={(event) => onChange({ ...filters, activeDeals: event.target.value as CompanyCustomersFilters["activeDeals"] })}
          >
            <option value="all">All</option>
            <option value="yes">Has active Deals</option>
            <option value="no">No active Deals</option>
          </select>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">Customer Value</p>
          <select
            className={selectClass}
            value={filters.customerValue}
            onChange={(event) => onChange({ ...filters, customerValue: event.target.value as CompanyCustomersFilters["customerValue"] })}
          >
            <option value="all">All</option>
            <option value="known">Recorded won value</option>
            <option value="not_recorded">Value not recorded</option>
          </select>
          <Button variant="ghost" size="sm" className="w-full" onClick={() => onChange(DEFAULT_COMPANY_CUSTOMERS_FILTERS)}>
            Reset filters
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function PageButtons({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (page: number) => void }) {
  const visible = Array.from({ length: pageCount }, (_, index) => index + 1).filter(
    (value) => pageCount <= 5 || value === 1 || value === pageCount || Math.abs(value - page) <= 1
  );
  return (
    <div className="flex items-center gap-1">
      <button type="button" aria-label="Previous page" disabled={page <= 1} className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-sales-border text-sales-text-secondary disabled:opacity-35" onClick={() => onChange(page - 1)}>
        <ChevronLeft size={14} />
      </button>
      {visible.map((value, index) => (
        <span key={value} className="contents">
          {index > 0 && value - visible[index - 1]! > 1 ? <span className="px-1 text-sales-text-muted">…</span> : null}
          <button
            type="button"
            aria-label={`Page ${value}`}
            aria-current={value === page ? "page" : undefined}
            className={cn(
              "h-8 min-w-8 rounded-[8px] border px-2 text-[12px] font-medium",
              value === page
                ? "border-sales-brand bg-sales-brand text-[#11170A]"
                : "border-sales-border bg-sales-surface text-sales-text-secondary hover:bg-sales-surface-hover"
            )}
            onClick={() => onChange(value)}
          >
            {value}
          </button>
        </span>
      ))}
      <button type="button" aria-label="Next page" disabled={page >= pageCount} className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-sales-border text-sales-text-secondary disabled:opacity-35" onClick={() => onChange(page + 1)}>
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

export function CompanyCustomersTableCard({
  rows,
  total,
  tab,
  tabCounts,
  onTabChange,
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  selectedId,
  onSelect,
  owners,
  onCall,
  onWhatsApp,
  onViewDeals,
  onClearSearch,
  onClearFilters,
  onAddCustomer,
  emptyKind,
  searchQuery,
}: {
  rows: CompanyCustomerRow[];
  total: number;
  tab: CompanyCustomersTab;
  tabCounts: CompanyCustomersTabCounts;
  onTabChange: (tab: CompanyCustomersTab) => void;
  search: string;
  onSearchChange: (value: string) => void;
  filters: CompanyCustomersFilters;
  onFiltersChange: (filters: CompanyCustomersFilters) => void;
  sort: CompanyCustomersSort;
  onSortChange: (sort: CompanyCustomersSort) => void;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  owners: CompanyCustomersOwnerOption[];
  onCall: (row: CompanyCustomerRow) => void;
  onWhatsApp: (row: CompanyCustomerRow) => void;
  onViewDeals: (row: CompanyCustomerRow) => void;
  onClearSearch: () => void;
  onClearFilters: () => void;
  onAddCustomer: () => void;
  emptyKind: "none" | "search" | "filters" | "rows";
  searchQuery: string;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const allChecked = rows.length > 0 && rows.every((row) => checked.has(row.id));

  const empty = emptyKind !== "rows";
  const emptyTitle =
    emptyKind === "search"
      ? `No Customers match “${searchQuery}”`
      : emptyKind === "filters"
        ? "No Customers match these filters"
        : "No Customers yet";
  const emptyDescription =
    emptyKind === "none"
      ? "Add your first Customer to start tracking relationships and Deals."
      : "Try changing your search or clearing the active filters.";

  return (
    <section className="flex min-h-[660px] min-w-0 flex-col overflow-hidden rounded-[14px] border border-sales-border bg-sales-surface shadow-sales-card">
      <div className="overflow-x-auto border-b border-sales-border-subtle px-3 pt-2 sm:px-4">
        <div className="flex min-w-max items-end gap-4">
          {COMPANY_CUSTOMERS_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={cn(
                "relative flex h-11 items-center gap-1.5 whitespace-nowrap px-1 text-[12px] font-medium text-sales-text-secondary",
                tab === item.id && "font-semibold text-sales-text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-sales-brand"
              )}
            >
              {item.label}
              <span className="rounded-full bg-sales-neutral-100 px-1.5 py-0.5 text-[10px] tabular-nums text-sales-text-muted">{tabCounts[item.id]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-b border-sales-border-subtle p-3 sm:p-4 xl:flex-row xl:items-center">
        <SearchInput value={search} onChange={onSearchChange} placeholder="Search customers…" className="min-w-0 flex-1 xl:max-w-[260px]" />
        <div className="flex min-w-0 flex-wrap gap-2">
          <FiltersPopover filters={filters} onChange={onFiltersChange} />
          <MenuSelect
            value={filters.customerType}
            onChange={(value) => onFiltersChange({ ...filters, customerType: value })}
            aria-label="Customer type"
            options={[
              { value: "all", label: "Customer Type" },
              { value: "company", label: "Companies" },
              { value: "individual", label: "Individuals" },
            ]}
          />
          <MenuSelect
            value={filters.ownerId}
            onChange={(value) => onFiltersChange({ ...filters, ownerId: value })}
            aria-label="Relationship owner"
            options={[
              { value: "all", label: "Owner" },
              { value: "unassigned", label: "Unassigned" },
              ...owners.map((owner) => ({ value: owner.id, label: owner.name })),
            ]}
          />
          <MenuSelect
            value={sort}
            onChange={onSortChange}
            aria-label="Sort Customers"
            align="right"
            options={[
              { value: "recent_interaction", label: "Sort: Recent interaction" },
              { value: "customer_asc", label: "Customer A–Z" },
              { value: "customer_desc", label: "Customer Z–A" },
              { value: "value_desc", label: "Value: High to low" },
              { value: "value_asc", label: "Value: Low to high" },
              { value: "deals_desc", label: "Most active Deals" },
              { value: "customer_since", label: "Newest Customers" },
            ]}
          />
          <Button variant="secondary" size="sm" aria-label="Table display settings" className="!px-3">
            <SlidersHorizontal size={15} />
          </Button>
        </div>
      </div>

      {empty ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            action={
              emptyKind === "none" ? (
                <Button size="sm" onClick={onAddCustomer}>Add Customer</Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={emptyKind === "search" ? onClearSearch : onClearFilters}>Clear {emptyKind === "search" ? "search" : "filters"}</Button>
              )
            }
          />
        </div>
      ) : (
        <>
          <div className="hidden min-w-0 flex-1 overflow-x-auto lg:block">
            <DataTableEl className="min-w-[940px]">
              <DataTableHead>
                <tr>
                  <DataTableTh className="w-11 !px-3"><Checkbox checked={allChecked} aria-label="Select page" onCheckedChange={(isChecked) => setChecked(isChecked ? new Set(rows.map((row) => row.id)) : new Set())} /></DataTableTh>
                  <DataTableTh>Customer</DataTableTh>
                  <DataTableTh>Type</DataTableTh>
                  <DataTableTh>Contact</DataTableTh>
                  <DataTableTh>Location</DataTableTh>
                  <DataTableTh>Owner</DataTableTh>
                  <DataTableTh>Last Interaction</DataTableTh>
                  <DataTableTh className="text-right">Active Deals</DataTableTh>
                  <DataTableTh className="text-right">Customer Value</DataTableTh>
                  <DataTableTh className="w-12">Actions</DataTableTh>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {rows.map((row) => (
                  <DataTableRow key={row.id} selected={row.id === selectedId} className="h-[62px] cursor-pointer" onClick={() => onSelect(row.id)}>
                    <DataTableTd className="!px-3" onClick={(event) => event.stopPropagation()}><Checkbox checked={checked.has(row.id)} aria-label={`Select ${row.name}`} onCheckedChange={(isChecked) => setChecked((previous) => { const next = new Set(previous); if (isChecked) next.add(row.id); else next.delete(row.id); return next; })} /></DataTableTd>
                    <DataTableTd className="min-w-[180px]">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={row.name} size="md" />
                        <div className="min-w-0">
                          <p className="truncate text-[12.5px] font-semibold text-sales-text-primary">{row.name}</p>
                          <p className="mt-0.5 truncate text-[11px] text-sales-text-muted">{row.industry ?? row.primaryContactName ?? row.source ?? "Customer"}</p>
                        </div>
                      </div>
                    </DataTableTd>
                    <DataTableTd><CustomerTypeBadge row={row} /></DataTableTd>
                    <DataTableTd className="min-w-[170px]"><p className="text-[12px]">{row.phone ?? "—"}</p><p className="mt-0.5 max-w-[180px] truncate text-[11px] text-sales-text-muted">{row.email ?? "No email"}</p></DataTableTd>
                    <DataTableTd className="max-w-[150px] truncate text-[12px]">{row.location ?? "Not recorded"}</DataTableTd>
                    <DataTableTd>{row.ownerId ? <div className="flex items-center gap-1.5"><Avatar name={row.ownerName ?? "Owner"} src={row.ownerAvatarUrl} size="xs" /><span className="max-w-[90px] truncate text-[12px]">{row.ownerName}</span></div> : <span className="text-[12px] text-sales-text-muted">Unassigned</span>}</DataTableTd>
                    <DataTableTd className="min-w-[130px]"><p className="text-[12px]">{row.lastInteractionLabel}</p>{row.lastInteractionChannel ? <p className="mt-0.5 text-[11px] text-sales-text-muted">{row.lastInteractionChannel}</p> : null}</DataTableTd>
                    <DataTableTd className="text-right tabular-nums">{row.activeDeals}</DataTableTd>
                    <DataTableTd className="max-w-[145px] truncate text-right text-[12px] font-medium tabular-nums" title={row.customerValueLabel}>{row.customerValueLabel}</DataTableTd>
                    <DataTableTd onClick={(event) => event.stopPropagation()}><RowMenu row={row} onView={() => onSelect(row.id)} onCall={() => onCall(row)} onWhatsApp={() => onWhatsApp(row)} onViewDeals={() => onViewDeals(row)} /></DataTableTd>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTableEl>
          </div>

          <div className="divide-y divide-sales-border-subtle lg:hidden">
            {rows.map((row) => (
              <button key={row.id} type="button" onClick={() => onSelect(row.id)} className={cn("w-full p-4 text-left transition-colors hover:bg-sales-surface-hover", row.id === selectedId && "bg-sales-brand-soft")}>
                <div className="flex items-start gap-3">
                  <Avatar name={row.name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-[14px] font-semibold text-sales-text-primary">{row.name}</p><p className="mt-0.5 truncate text-[12px] text-sales-text-muted">{row.industry ?? row.primaryContactName ?? row.email ?? "Customer"}</p></div><CustomerTypeBadge row={row} /></div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]"><div><p className="text-[11px] text-sales-text-muted">Last interaction</p><p className="mt-0.5 text-sales-text-primary">{row.lastInteractionLabel}</p></div><div><p className="text-[11px] text-sales-text-muted">Active Deals</p><p className="mt-0.5 tabular-nums text-sales-text-primary">{row.activeDeals}</p></div><div><p className="text-[11px] text-sales-text-muted">Owner</p><p className="mt-0.5 truncate text-sales-text-primary">{row.ownerName ?? "Unassigned"}</p></div><div><p className="text-[11px] text-sales-text-muted">Customer Value</p><p className="mt-0.5 truncate font-medium tabular-nums text-sales-text-primary">{row.customerValueLabel}</p></div></div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="mt-auto flex flex-col gap-3 border-t border-sales-border-subtle px-3 py-3 text-[11px] text-sales-text-muted sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <span>Showing {total === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} customers</span>
        <div className="flex flex-wrap items-center gap-3"><PageButtons page={page} pageCount={pageCount} onChange={onPageChange} /><MenuSelect value={String(pageSize)} onChange={(value) => onPageSizeChange(Number(value))} aria-label="Customers per page" size="sm" align="right" options={[{ value: String(COMPANY_CUSTOMERS_PAGE_SIZE), label: `${COMPANY_CUSTOMERS_PAGE_SIZE} / page` }, { value: "25", label: "25 / page" }, { value: "50", label: "50 / page" }]} /></div>
      </div>
    </section>
  );
}
