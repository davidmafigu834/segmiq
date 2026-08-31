"use client";

import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Phone,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { cn } from "@/lib/ui/cn";
import {
  Avatar,
  Badge,
  Button,
  DataTableBody,
  DataTableEl,
  DataTableHead,
  DataTableRow,
  DataTableTd,
  DataTableTh,
  EmptyState,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  MenuSelect,
  SearchInput,
} from "@/components/sales/ui";
import { listingLabel } from "@/lib/real-estate/helpers";
import {
  VIEWING_COMPANY_PAGE_SIZE,
  VIEWING_COMPANY_TABS,
  viewingCompanyFiltersActive,
  viewingIsOverdue,
  viewingIsToday,
  viewingStatusLabel,
  viewingStatusTone,
  type ViewingCompanyFilters,
  type ViewingCompanySort,
  type ViewingCompanyTab,
} from "@/lib/real-estate/viewings";
import type { ViewingAgentOption, ViewingWorkspaceRow } from "./types";

function formatWhen(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "—", time: "—" };
  return {
    date: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
    time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  };
}

function StatusCell({ row }: { row: ViewingWorkspaceRow }) {
  const overdue = viewingIsOverdue(row.status, row.scheduled_at);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge tone={viewingStatusTone(row.status)} appearance="soft" className="!px-2 !py-0.5 !text-[11px]">
        {viewingStatusLabel(row.status)}
      </Badge>
      {overdue ? (
        <Badge tone="danger" appearance="soft" className="!px-2 !py-0.5 !text-[11px]">
          Overdue
        </Badge>
      ) : viewingIsToday(row.scheduled_at) && row.status === "scheduled" ? (
        <Badge tone="warning" appearance="soft" className="!px-2 !py-0.5 !text-[11px]">
          Today
        </Badge>
      ) : null}
    </div>
  );
}

function RowMenu({
  row,
  onView,
  onCall,
  onWhatsApp,
  onComplete,
}: {
  row: ViewingWorkspaceRow;
  onView: () => void;
  onCall: () => void;
  onWhatsApp: () => void;
  onComplete: () => void;
}) {
  return (
    <div onClick={(event) => event.stopPropagation()}>
      <DropdownMenu align="end">
        <DropdownMenuTrigger
          aria-label={`More actions for ${row.contact_name ?? "viewing"}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-sales-text-muted hover:bg-sales-surface-hover hover:text-sales-text-primary"
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal size={16} strokeWidth={1.8} />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48">
          <DropdownMenuItem onSelect={onView}>View viewing</DropdownMenuItem>
          {row.contact_phone ? (
            <DropdownMenuItem icon={<Phone size={14} />} onSelect={onCall}>
              Call
            </DropdownMenuItem>
          ) : null}
          {row.contact_phone ? (
            <DropdownMenuItem icon={<SiWhatsapp size={14} color="#25D366" />} onSelect={onWhatsApp}>
              WhatsApp
            </DropdownMenuItem>
          ) : null}
          {row.status === "scheduled" ? (
            <DropdownMenuItem onSelect={onComplete}>Mark completed</DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function PageButtons({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (page: number) => void }) {
  const visible = Array.from({ length: pageCount }, (_, index) => index + 1).filter(
    (value) => pageCount <= 5 || value === 1 || value === pageCount || Math.abs(value - page) <= 1
  );
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Previous page"
        disabled={page <= 1}
        className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-sales-border text-sales-text-secondary disabled:opacity-35"
        onClick={() => onChange(page - 1)}
      >
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
      <button
        type="button"
        aria-label="Next page"
        disabled={page >= pageCount}
        className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-sales-border text-sales-text-secondary disabled:opacity-35"
        onClick={() => onChange(page + 1)}
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

export function ViewingsTableCard({
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
  agents,
  onCall,
  onWhatsApp,
  onComplete,
  onClearSearch,
  onClearFilters,
  onSchedule,
  emptyKind,
  searchQuery,
}: {
  rows: ViewingWorkspaceRow[];
  total: number;
  tab: ViewingCompanyTab;
  tabCounts: Record<ViewingCompanyTab, number>;
  onTabChange: (tab: ViewingCompanyTab) => void;
  search: string;
  onSearchChange: (value: string) => void;
  filters: ViewingCompanyFilters;
  onFiltersChange: (filters: ViewingCompanyFilters) => void;
  sort: ViewingCompanySort;
  onSortChange: (sort: ViewingCompanySort) => void;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  agents: ViewingAgentOption[];
  onCall: (row: ViewingWorkspaceRow) => void;
  onWhatsApp: (row: ViewingWorkspaceRow) => void;
  onComplete: (row: ViewingWorkspaceRow) => void;
  onClearSearch: () => void;
  onClearFilters: () => void;
  onSchedule: () => void;
  emptyKind: "none" | "search" | "filters" | "rows";
  searchQuery: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const empty = emptyKind !== "rows";
  const emptyTitle =
    emptyKind === "search"
      ? `No viewings match “${searchQuery}”`
      : emptyKind === "filters"
        ? "No viewings match these filters"
        : tab === "upcoming"
          ? "No upcoming viewings"
          : "No viewings in this list";
  const emptyDescription =
    emptyKind === "none"
      ? "Schedule a viewing from an inquiry or use Schedule viewing. Appointments will appear here."
      : "Try changing your search or clearing the active filters.";

  return (
    <section className="flex min-h-[660px] min-w-0 flex-col overflow-hidden workspace-card rounded-[14px] border border-sales-border bg-sales-surface shadow-sales-card">
      <div className="flex flex-col gap-3 border-b border-sales-border-subtle px-3 py-3 sm:px-4">
        <div
          className="scrollbar-hide flex min-w-0 gap-4 overflow-x-auto overscroll-x-contain"
          role="tablist"
          aria-label="Viewing lists"
        >
          {VIEWING_COMPANY_TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "relative flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap px-1 text-[13px] transition-colors duration-150",
                  active
                    ? "font-semibold text-sales-text-primary"
                    : "font-medium text-sales-text-secondary hover:text-sales-text-primary"
                )}
              >
                {item.label}
                <span className="tabular-nums text-sales-text-muted">{tabCounts[item.id]}</span>
                {active ? (
                  <span className="absolute inset-x-0 -bottom-px h-[3px] bg-sales-brand" aria-hidden />
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder="Search buyer, property, agent…"
            className="min-w-0 w-full sm:w-[240px]"
          />
          <MenuSelect
            value={filters.agentId}
            onChange={(value) => onFiltersChange({ ...filters, agentId: value })}
            aria-label="Agent"
            options={[
              { value: "all", label: "All agents" },
              { value: "unassigned", label: "Unassigned" },
              ...agents.map((agent) => ({ value: agent.id, label: agent.name })),
            ]}
          />
          <MenuSelect
            value={filters.feedback}
            onChange={(value) => onFiltersChange({ ...filters, feedback: value as ViewingCompanyFilters["feedback"] })}
            aria-label="Feedback"
            options={[
              { value: "all", label: "Feedback" },
              { value: "awaiting", label: "Awaiting notes" },
              { value: "recorded", label: "Notes recorded" },
            ]}
          />
          <MenuSelect
            value={sort}
            onChange={onSortChange}
            aria-label="Sort viewings"
            align="right"
            options={[
              { value: "soonest", label: "Sort: Soonest" },
              { value: "latest", label: "Latest first" },
              { value: "buyer_asc", label: "Buyer A–Z" },
              { value: "property_asc", label: "Property A–Z" },
            ]}
          />
          {viewingCompanyFiltersActive(filters) ? (
            <Button variant="ghost" size="sm" onClick={onClearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      {empty ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={<CalendarClock className="h-4 w-4" strokeWidth={1.6} />}
            title={emptyTitle}
            description={emptyDescription}
            action={
              emptyKind === "none" ? (
                <Button size="sm" onClick={onSchedule}>
                  Schedule viewing
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
        </div>
      ) : (
        <>
          <div className="hidden min-w-0 flex-1 overflow-x-auto lg:block">
            <DataTableEl className="min-w-[920px]">
              <DataTableHead>
                <tr>
                  <DataTableTh>Property</DataTableTh>
                  <DataTableTh>Buyer</DataTableTh>
                  <DataTableTh>When</DataTableTh>
                  <DataTableTh>Status</DataTableTh>
                  <DataTableTh>Agent</DataTableTh>
                  <DataTableTh className="w-12">Actions</DataTableTh>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {rows.map((row) => {
                  const when = formatWhen(row.scheduled_at);
                  const property = listingLabel({
                    address: row.listing_address,
                    suburb: row.listing_suburb,
                  });
                  return (
                    <DataTableRow
                      key={row.id}
                      selected={row.id === selectedId}
                      className="h-[62px] cursor-pointer"
                      onClick={() => onSelect(row.id)}
                    >
                      <DataTableTd className="min-w-[200px]">
                        <p className="truncate text-[13px] font-semibold text-sales-text-primary">{property}</p>
                        <p className="mt-0.5 truncate text-[11px] text-sales-text-muted">
                          {row.listing_suburb ?? "Suburb not set"}
                        </p>
                      </DataTableTd>
                      <DataTableTd className="min-w-[160px]">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Avatar name={row.contact_name ?? "Buyer"} size="md" />
                          <div className="min-w-0">
                            <p className="truncate text-[12.5px] font-semibold text-sales-text-primary">
                              {row.contact_name ?? "Buyer"}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-sales-text-muted">
                              {row.contact_phone ?? "No phone"}
                            </p>
                          </div>
                        </div>
                      </DataTableTd>
                      <DataTableTd className="min-w-[130px]">
                        <p className="text-[12px] text-sales-text-primary">{when.date}</p>
                        <p className="mt-0.5 tabular-nums text-[11px] text-sales-text-muted">{when.time}</p>
                      </DataTableTd>
                      <DataTableTd>
                        <StatusCell row={row} />
                      </DataTableTd>
                      <DataTableTd>
                        {row.agent_name ? (
                          <div className="flex items-center gap-1.5">
                            <Avatar name={row.agent_name} size="xs" />
                            <span className="max-w-[110px] truncate text-[12px]">{row.agent_name}</span>
                          </div>
                        ) : (
                          <span className="text-[12px] text-sales-text-muted">Unassigned</span>
                        )}
                      </DataTableTd>
                      <DataTableTd onClick={(event) => event.stopPropagation()}>
                        <RowMenu
                          row={row}
                          onView={() => onSelect(row.id)}
                          onCall={() => onCall(row)}
                          onWhatsApp={() => onWhatsApp(row)}
                          onComplete={() => onComplete(row)}
                        />
                      </DataTableTd>
                    </DataTableRow>
                  );
                })}
              </DataTableBody>
            </DataTableEl>
          </div>

          <div className="divide-y divide-sales-border-subtle lg:hidden">
            {rows.map((row) => {
              const when = formatWhen(row.scheduled_at);
              const property = listingLabel({
                address: row.listing_address,
                suburb: row.listing_suburb,
              });
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => onSelect(row.id)}
                  className={cn(
                    "w-full p-4 text-left transition-colors hover:bg-sales-surface-hover",
                    row.id === selectedId && "bg-sales-brand-soft"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Avatar name={row.contact_name ?? "Buyer"} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold text-sales-text-primary">{property}</p>
                          <p className="mt-0.5 truncate text-[12px] text-sales-text-muted">
                            {row.contact_name ?? "Buyer"}
                          </p>
                        </div>
                        <StatusCell row={row} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                        <div>
                          <p className="text-[11px] text-sales-text-muted">When</p>
                          <p className="mt-0.5 text-sales-text-primary">
                            {when.date} · {when.time}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-sales-text-muted">Agent</p>
                          <p className="mt-0.5 truncate text-sales-text-primary">{row.agent_name ?? "Unassigned"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="mt-auto flex flex-col gap-3 border-t border-sales-border-subtle px-3 py-3 text-[11px] text-sales-text-muted sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <span>
          Showing {total === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}{" "}
          viewings
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <PageButtons page={page} pageCount={pageCount} onChange={onPageChange} />
          <MenuSelect
            value={String(pageSize)}
            onChange={(value) => onPageSizeChange(Number(value))}
            aria-label="Viewings per page"
            size="sm"
            align="right"
            options={[
              { value: String(VIEWING_COMPANY_PAGE_SIZE), label: `${VIEWING_COMPANY_PAGE_SIZE} / page` },
              { value: "25", label: "25 / page" },
              { value: "50", label: "50 / page" },
            ]}
          />
        </div>
      </div>
    </section>
  );
}
