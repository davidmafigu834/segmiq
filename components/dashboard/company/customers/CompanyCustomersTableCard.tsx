"use client";

import { useEffect, useRef, useState } from "react";
import {
  BriefcaseBusiness,
  ChevronDown,
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
  DataTableActionsCell,
  DataTableBody,
  DataTableEl,
  DataTableEmptyPanel,
  DataTableFooter,
  DataTableHead,
  DataTableMobileItem,
  DataTableMobileList,
  DataTablePagination,
  DataTableRow,
  DataTableScroll,
  DataTableTabsBar,
  DataTableTd,
  DataTableTh,
  DataTableToolbar,
  DataTableToolbarGroup,
  DataTableWorkspace,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
      tone={row.customerType === "company" ? "success" : "info"}
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
  return (
    <div onClick={(event) => event.stopPropagation()}>
      <DropdownMenu align="end">
        <DropdownMenuTrigger
          aria-label={`More actions for ${row.name}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-sales-text-muted hover:bg-sales-surface-hover hover:text-sales-text-primary"
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal size={16} strokeWidth={1.8} />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48">
          <DropdownMenuItem onSelect={onView}>View Customer</DropdownMenuItem>
          {row.phone ? (
            <DropdownMenuItem icon={<Phone size={14} />} onSelect={onCall}>
              Call
            </DropdownMenuItem>
          ) : null}
          {row.phone ? (
            <DropdownMenuItem icon={<SiWhatsapp size={14} color="#25D366" />} onSelect={onWhatsApp}>
              WhatsApp
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem icon={<BriefcaseBusiness size={14} />} onSelect={onViewDeals}>
            View Deals ({row.totalDeals})
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
            Active Deals
          </p>
          <select
            className={selectClass}
            value={filters.activeDeals}
            onChange={(event) =>
              onChange({
                ...filters,
                activeDeals: event.target.value as CompanyCustomersFilters["activeDeals"],
              })
            }
          >
            <option value="all">All</option>
            <option value="yes">Has active Deals</option>
            <option value="no">No active Deals</option>
          </select>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
            Customer Value
          </p>
          <select
            className={selectClass}
            value={filters.customerValue}
            onChange={(event) =>
              onChange({
                ...filters,
                customerValue: event.target.value as CompanyCustomersFilters["customerValue"],
              })
            }
          >
            <option value="all">All</option>
            <option value="known">Recorded won value</option>
            <option value="not_recorded">Value not recorded</option>
          </select>
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => onChange(DEFAULT_COMPANY_CUSTOMERS_FILTERS)}
          >
            Reset filters
          </Button>
        </div>
      ) : null}
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
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

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
    <DataTableWorkspace className="min-h-[660px]">
      <DataTableTabsBar>
        {COMPANY_CUSTOMERS_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => onTabChange(item.id)}
            className={cn(
              "relative flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap px-1 text-[12px] font-medium text-sales-text-secondary transition-colors",
              tab === item.id &&
                "font-semibold text-sales-text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-sales-brand"
            )}
          >
            {item.label}
            <span className="rounded-full bg-sales-neutral-100 px-1.5 py-0.5 text-[10px] tabular-nums text-sales-text-muted">
              {tabCounts[item.id]}
            </span>
          </button>
        ))}
      </DataTableTabsBar>

      <DataTableToolbar>
        <DataTableToolbarGroup>
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder="Search customers…"
            className="min-w-0 w-full sm:w-[240px]"
          />
          <FiltersPopover filters={filters} onChange={onFiltersChange} />
        </DataTableToolbarGroup>
        <DataTableToolbarGroup align="end">
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
        </DataTableToolbarGroup>
      </DataTableToolbar>

      {empty ? (
        <DataTableEmptyPanel
          title={emptyTitle}
          description={emptyDescription}
          action={
            emptyKind === "none" ? (
              <Button size="sm" onClick={onAddCustomer}>
                Add Customer
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                onClick={emptyKind === "search" ? onClearSearch : onClearFilters}
              >
                Clear {emptyKind === "search" ? "search" : "filters"}
              </Button>
            )
          }
        />
      ) : (
        <>
          <DataTableScroll className="hidden min-w-0 flex-1 lg:block">
            <DataTableEl className="min-w-[940px]">
              <DataTableHead>
                <tr>
                  <DataTableTh>Customer</DataTableTh>
                  <DataTableTh>Type</DataTableTh>
                  <DataTableTh>Contact</DataTableTh>
                  <DataTableTh>Location</DataTableTh>
                  <DataTableTh>Owner</DataTableTh>
                  <DataTableTh>Last Interaction</DataTableTh>
                  <DataTableTh align="right">Active Deals</DataTableTh>
                  <DataTableTh align="right">Customer Value</DataTableTh>
                  <DataTableTh className="w-12">
                    <span className="sr-only">Actions</span>
                  </DataTableTh>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {rows.map((row) => (
                  <DataTableRow
                    key={row.id}
                    selected={row.id === selectedId}
                    clickable
                    density="comfortable"
                    onClick={() => onSelect(row.id)}
                  >
                    <DataTableTd className="min-w-[180px]">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={row.name} size="md" />
                        <div className="min-w-0">
                          <p className="truncate text-[12.5px] font-semibold text-sales-text-primary">
                            {row.name}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-sales-text-muted">
                            {row.industry ?? row.primaryContactName ?? row.source ?? "Customer"}
                          </p>
                        </div>
                      </div>
                    </DataTableTd>
                    <DataTableTd>
                      <CustomerTypeBadge row={row} />
                    </DataTableTd>
                    <DataTableTd className="min-w-[170px]">
                      <p className="text-[12px]">{row.phone ?? "—"}</p>
                      <p className="mt-0.5 max-w-[180px] truncate text-[11px] text-sales-text-muted">
                        {row.email ?? "No email"}
                      </p>
                    </DataTableTd>
                    <DataTableTd className="max-w-[150px] truncate text-[12px]">
                      {row.location ?? "Not recorded"}
                    </DataTableTd>
                    <DataTableTd>
                      {row.ownerId ? (
                        <div className="flex items-center gap-1.5">
                          <Avatar name={row.ownerName ?? "Owner"} src={row.ownerAvatarUrl} size="xs" />
                          <span className="max-w-[90px] truncate text-[12px]">{row.ownerName}</span>
                        </div>
                      ) : (
                        <span className="text-[12px] text-sales-text-muted">Unassigned</span>
                      )}
                    </DataTableTd>
                    <DataTableTd className="min-w-[130px]">
                      <p className="text-[12px]">{row.lastInteractionLabel}</p>
                      {row.lastInteractionChannel ? (
                        <p className="mt-0.5 text-[11px] text-sales-text-muted">
                          {row.lastInteractionChannel}
                        </p>
                      ) : null}
                    </DataTableTd>
                    <DataTableTd numeric>{row.activeDeals}</DataTableTd>
                    <DataTableTd
                      numeric
                      className="max-w-[145px] truncate font-medium"
                      title={row.customerValueLabel}
                    >
                      {row.customerValueLabel}
                    </DataTableTd>
                    <DataTableActionsCell>
                      <RowMenu
                        row={row}
                        onView={() => onSelect(row.id)}
                        onCall={() => onCall(row)}
                        onWhatsApp={() => onWhatsApp(row)}
                        onViewDeals={() => onViewDeals(row)}
                      />
                    </DataTableActionsCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTableEl>
          </DataTableScroll>

          <DataTableMobileList>
            {rows.map((row) => (
              <DataTableMobileItem
                key={row.id}
                selected={row.id === selectedId}
                onClick={() => onSelect(row.id)}
              >
                <div className="flex items-start gap-3">
                  <Avatar name={row.name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-sales-text-primary">
                          {row.name}
                        </p>
                        <p className="mt-0.5 truncate text-[12px] text-sales-text-muted">
                          {row.industry ?? row.primaryContactName ?? row.email ?? "Customer"}
                        </p>
                      </div>
                      <CustomerTypeBadge row={row} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                      <div>
                        <p className="text-[11px] text-sales-text-muted">Last interaction</p>
                        <p className="mt-0.5 text-sales-text-primary">{row.lastInteractionLabel}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-sales-text-muted">Active Deals</p>
                        <p className="mt-0.5 tabular-nums text-sales-text-primary">{row.activeDeals}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-sales-text-muted">Owner</p>
                        <p className="mt-0.5 truncate text-sales-text-primary">
                          {row.ownerName ?? "Unassigned"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-sales-text-muted">Customer Value</p>
                        <p className="mt-0.5 truncate font-medium tabular-nums text-sales-text-primary">
                          {row.customerValueLabel}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </DataTableMobileItem>
            ))}
          </DataTableMobileList>
        </>
      )}

      <DataTableFooter>
        <DataTablePagination
          page={page}
          pageCount={pageCount}
          onPageChange={onPageChange}
          summary={`Showing ${from} to ${to} of ${total} customers`}
          pageSizeControl={
            <MenuSelect
              value={String(pageSize)}
              onChange={(value) => onPageSizeChange(Number(value))}
              aria-label="Customers per page"
              size="sm"
              align="right"
              options={[
                { value: String(COMPANY_CUSTOMERS_PAGE_SIZE), label: `${COMPANY_CUSTOMERS_PAGE_SIZE} / page` },
                { value: "25", label: "25 / page" },
                { value: "50", label: "50 / page" },
              ]}
            />
          }
        />
      </DataTableFooter>
    </DataTableWorkspace>
  );
}
