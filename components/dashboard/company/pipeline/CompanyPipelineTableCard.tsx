"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/ui/cn";
import {
  Avatar,
  Badge,
  Button,
  DataTableEl,
  DataTableHead,
  DataTableBody,
  DataTableRow,
  DataTableTh,
  DataTableTd,
  EmptyState,
  MenuSelect,
  PipelineStageBadge,
  SearchInput,
  Skeleton,
} from "@/components/sales/ui";
import { DEAL_STAGE_LABEL, formatDealStage } from "@/lib/sales/deals/display";
import {
  COMPANY_PIPELINE_PAGE_SIZE,
  COMPANY_PIPELINE_TABS,
  companyPipelineFiltersActive,
  groupKeyForRow,
  isClosedPipelineTab,
} from "@/lib/sales/company-pipeline-metrics";
import type {
  CompanyPipelineDealRow,
  CompanyPipelineFilters,
  CompanyPipelineGroupBy,
  CompanyPipelineOwnerOption,
  CompanyPipelineSort,
  CompanyPipelineSourceOption,
  CompanyPipelineTab,
  CompanyPipelineTabCounts,
} from "./types";
import { DEFAULT_COMPANY_PIPELINE_FILTERS } from "./types";

function StageBadge({ stage }: { stage: string }) {
  return (
    <PipelineStageBadge
      status={stage}
      label={DEAL_STAGE_LABEL[stage as keyof typeof DEAL_STAGE_LABEL] ?? formatDealStage(stage)}
      className="!px-2 !py-0.5 !text-[11px] !font-medium"
    />
  );
}

function NextWhen({ row }: { row: CompanyPipelineDealRow }) {
  if (!row.nextAction.hasNextAction) {
    return <span className="text-[11px] text-sales-text-muted">No next action</span>;
  }
  const urgency = row.nextAction.urgency;
  const color =
    urgency === "overdue"
      ? "text-sales-danger"
      : urgency === "today"
        ? "text-sales-warning-fg"
        : "text-sales-text-muted";
  return (
    <span className={cn("text-[11px]", color)} title={row.nextAction.at ?? undefined}>
      {row.nextAction.whenLabel}
    </span>
  );
}

function RowMenu({
  row,
  canReassign,
  onViewDeal,
  onLogActivity,
  onSchedule,
  onChangeOwner,
  onChangeStage,
  onMarkWon,
  onMarkLost,
}: {
  row: CompanyPipelineDealRow;
  canReassign: boolean;
  onViewDeal: () => void;
  onLogActivity: () => void;
  onSchedule: () => void;
  onChangeOwner: () => void;
  onChangeStage: () => void;
  onMarkWon: () => void;
  onMarkLost: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closed = row.stage === "WON" || row.stage === "LOST";

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="More actions"
        title="More actions"
        className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-sales-text-muted hover:bg-sales-surface-hover hover:text-sales-text-primary"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <MoreHorizontal size={16} strokeWidth={1.8} />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-[10px] border border-sales-border bg-sales-surface py-1 shadow-sales-popover"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full px-3 py-2 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
            onClick={() => {
              setOpen(false);
              onViewDeal();
            }}
          >
            View Deal
          </button>
          {row.canModify && !closed ? (
            <>
              <button
                type="button"
                role="menuitem"
                className="flex w-full px-3 py-2 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
                onClick={() => {
                  setOpen(false);
                  onLogActivity();
                }}
              >
                Log Activity
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full px-3 py-2 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
                onClick={() => {
                  setOpen(false);
                  onSchedule();
                }}
              >
                Schedule Follow-up
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full px-3 py-2 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
                onClick={() => {
                  setOpen(false);
                  onChangeStage();
                }}
              >
                Change Stage
              </button>
            </>
          ) : null}
          {canReassign ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full px-3 py-2 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
              onClick={() => {
                setOpen(false);
                onChangeOwner();
              }}
            >
              Change Owner
            </button>
          ) : null}
          {row.canModify && !closed ? (
            <>
              <div className="my-1 border-t border-sales-border-subtle" />
              <button
                type="button"
                role="menuitem"
                className="flex w-full px-3 py-2 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
                onClick={() => {
                  setOpen(false);
                  onMarkWon();
                }}
              >
                Mark Won
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full px-3 py-2 text-left text-[13px] text-sales-danger hover:bg-sales-surface-hover"
                onClick={() => {
                  setOpen(false);
                  onMarkLost();
                }}
              >
                Mark Lost
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FiltersPopover({
  filters,
  owners,
  sources,
  onChange,
}: {
  filters: CompanyPipelineFilters;
  owners: CompanyPipelineOwnerOption[];
  sources: CompanyPipelineSourceOption[];
  onChange: (next: CompanyPipelineFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = companyPipelineFiltersActive(filters);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const field =
    "mb-3 h-9 w-full rounded-[8px] border border-sales-border-strong bg-sales-surface px-2 text-[13px] text-sales-text-primary";

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="secondary"
        size="sm"
        leftIcon={<Filter size={14} strokeWidth={1.8} />}
        rightIcon={<ChevronDown size={14} strokeWidth={1.8} />}
        onClick={() => setOpen((v) => !v)}
        className={active ? "border-sales-brand-border" : undefined}
      >
        Filters
      </Button>
      {open ? (
        <div className="absolute left-0 z-30 mt-2 w-[280px] rounded-[12px] border border-sales-border bg-sales-surface p-3 shadow-sales-popover sm:left-auto sm:right-0">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
            Owner
          </p>
          <select
            className={field}
            value={filters.ownerId}
            onChange={(e) => onChange({ ...filters, ownerId: e.target.value })}
          >
            <option value="all">All salespeople</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
            Deal health
          </p>
          <select
            className={field}
            value={filters.health}
            onChange={(e) =>
              onChange({ ...filters, health: e.target.value as CompanyPipelineFilters["health"] })
            }
          >
            <option value="all">All</option>
            <option value="on_track">On track</option>
            <option value="needs_attention">Needs attention</option>
            <option value="at_risk">At risk</option>
          </select>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
            Next action
          </p>
          <select
            className={field}
            value={filters.nextAction}
            onChange={(e) =>
              onChange({
                ...filters,
                nextAction: e.target.value as CompanyPipelineFilters["nextAction"],
              })
            }
          >
            <option value="all">All</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due today</option>
            <option value="week">Due this week</option>
            <option value="none">No next action</option>
          </select>
          {sources.length > 0 ? (
            <>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
                Source
              </p>
              <select
                className={field}
                value={filters.source}
                onChange={(e) => onChange({ ...filters, source: e.target.value })}
              >
                <option value="all">All sources</option>
                {sources.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
            Deal value
          </p>
          <div className="mb-3 flex gap-2">
            <input
              className="h-9 w-full rounded-[8px] border border-sales-border-strong bg-sales-surface px-2 text-[13px] text-sales-text-primary"
              placeholder="Min"
              inputMode="numeric"
              value={filters.valueMin}
              onChange={(e) => onChange({ ...filters, valueMin: e.target.value })}
            />
            <input
              className="h-9 w-full rounded-[8px] border border-sales-border-strong bg-sales-surface px-2 text-[13px] text-sales-text-primary"
              placeholder="Max"
              inputMode="numeric"
              value={filters.valueMax}
              onChange={(e) => onChange({ ...filters, valueMax: e.target.value })}
            />
          </div>
          {active ? (
            <button
              type="button"
              className="text-[12px] font-medium text-sales-brand-fg hover:underline"
              onClick={() => onChange(DEFAULT_COMPANY_PIPELINE_FILTERS)}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FilterChips({
  filters,
  owners,
  onChange,
}: {
  filters: CompanyPipelineFilters;
  owners: CompanyPipelineOwnerOption[];
  onChange: (next: CompanyPipelineFilters) => void;
}) {
  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (filters.ownerId !== "all") {
    const name = owners.find((o) => o.id === filters.ownerId)?.name ?? "Owner";
    chips.push({
      key: "owner",
      label: `Owner: ${name}`,
      clear: () => onChange({ ...filters, ownerId: "all" }),
    });
  }
  if (filters.health !== "all") {
    const label =
      filters.health === "at_risk"
        ? "At Risk"
        : filters.health === "needs_attention"
          ? "Needs attention"
          : "On track";
    chips.push({
      key: "health",
      label,
      clear: () => onChange({ ...filters, health: "all" }),
    });
  }
  if (filters.nextAction !== "all") {
    chips.push({
      key: "next",
      label:
        filters.nextAction === "none"
          ? "No Next Action"
          : filters.nextAction === "overdue"
            ? "Overdue"
            : filters.nextAction === "today"
              ? "Due today"
              : "Due this week",
      clear: () => onChange({ ...filters, nextAction: "all" }),
    });
  }
  if (filters.source !== "all") {
    chips.push({
      key: "source",
      label: `Source: ${filters.source}`,
      clear: () => onChange({ ...filters, source: "all" }),
    });
  }
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 px-4 pb-3 sm:px-5">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-sales-border bg-sales-surface-subtle px-2.5 py-0.5 text-[11px] text-sales-text-secondary hover:border-sales-border-strong"
          onClick={c.clear}
        >
          {c.label}
          <span aria-hidden>×</span>
        </button>
      ))}
    </div>
  );
}

function pageWindow(page: number, pageCount: number, max = 5): number[] {
  if (pageCount <= max) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const start = Math.min(Math.max(1, page - 2), pageCount - max + 1);
  return Array.from({ length: max }, (_, i) => start + i);
}

export function CompanyPipelineTableCard({
  rows,
  total,
  tab,
  tabCounts,
  onTabChange,
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  groupBy,
  onGroupByChange,
  sort,
  onSortChange,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  selectedId,
  onSelect,
  owners,
  sources,
  canReassign,
  onViewDeal,
  onLogActivity,
  onSchedule,
  onChangeOwner,
  onChangeStage,
  onMarkWon,
  onMarkLost,
  onClearSearch,
  onClearFilters,
  loading,
  emptyKind,
  searchQuery,
}: {
  rows: CompanyPipelineDealRow[];
  total: number;
  tab: CompanyPipelineTab;
  tabCounts: CompanyPipelineTabCounts;
  onTabChange: (tab: CompanyPipelineTab) => void;
  search: string;
  onSearchChange: (q: string) => void;
  filters: CompanyPipelineFilters;
  onFiltersChange: (f: CompanyPipelineFilters) => void;
  groupBy: CompanyPipelineGroupBy;
  onGroupByChange: (g: CompanyPipelineGroupBy) => void;
  sort: CompanyPipelineSort;
  onSortChange: (s: CompanyPipelineSort) => void;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (n: number) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  owners: CompanyPipelineOwnerOption[];
  sources: CompanyPipelineSourceOption[];
  canReassign: boolean;
  onViewDeal: (row: CompanyPipelineDealRow) => void;
  onLogActivity: (row: CompanyPipelineDealRow) => void;
  onSchedule: (row: CompanyPipelineDealRow) => void;
  onChangeOwner: (row: CompanyPipelineDealRow) => void;
  onChangeStage: (row: CompanyPipelineDealRow) => void;
  onMarkWon: (row: CompanyPipelineDealRow) => void;
  onMarkLost: (row: CompanyPipelineDealRow) => void;
  onClearSearch: () => void;
  onClearFilters: () => void;
  loading?: boolean;
  emptyKind: "none" | "search" | "filters" | "rows";
  searchQuery: string;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const closed = isClosedPipelineTab(tab);
  const grouped =
    groupBy === "none"
      ? [{ key: "all", label: "", rows }]
      : (() => {
          const map = new Map<string, { label: string; rows: CompanyPipelineDealRow[] }>();
          for (const row of rows) {
            const g = groupKeyForRow(row, groupBy);
            const cur = map.get(g.key) ?? { label: g.label, rows: [] };
            cur.rows.push(row);
            map.set(g.key, cur);
          }
          return [...map.entries()].map(([key, v]) => ({ key, label: v.label, rows: v.rows }));
        })();

  return (
    <section
      className="overflow-hidden rounded-[14px] border border-sales-border bg-sales-surface shadow-sales-card"
      data-course-target="company-pipeline-table"
    >
      <div
        className="scrollbar-hide flex gap-4 overflow-x-auto overscroll-x-contain border-b border-sales-border-subtle px-4 sm:px-5"
        role="tablist"
        data-course-target="company-pipeline-tabs"
      >
        {COMPANY_PIPELINE_TABS.map((item) => {
          const active = item.id === tab;
          const count = tabCounts[item.id];
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "relative h-11 shrink-0 whitespace-nowrap text-[13px] transition-colors duration-150",
                active
                  ? "font-semibold text-sales-text-primary"
                  : "font-medium text-sales-text-secondary hover:text-sales-text-primary"
              )}
            >
              {item.label}
              <span className="ml-1.5 tabular-nums text-sales-text-muted">{count}</span>
              {active ? (
                <span className="absolute inset-x-0 -bottom-px h-[3px] bg-sales-brand" aria-hidden />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 border-b border-sales-border-subtle px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-5">
        <div data-course-target="company-pipeline-search" className="w-full sm:w-[220px]">
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder="Search Deals..."
            className="w-full"
          />
        </div>
        <FiltersPopover
          filters={filters}
          owners={owners}
          sources={sources}
          onChange={onFiltersChange}
        />
        <MenuSelect
          size="sm"
          aria-label="Group by"
          value={groupBy}
          onChange={onGroupByChange}
          options={[
            { value: "stage", label: "Group by: Stage" },
            { value: "owner", label: "Group by: Owner" },
            { value: "none", label: "Group by: None" },
          ]}
        />
        <MenuSelect
          size="sm"
          aria-label="Sort"
          value={sort}
          onChange={onSortChange}
          options={[
            { value: "next_action", label: "Sort: Next action" },
            { value: "value", label: "Sort: Deal value" },
            { value: "expected_decision", label: "Sort: Expected decision" },
            { value: "newest", label: "Sort: Newest" },
            { value: "last_activity", label: "Sort: Last activity" },
            { value: "attention", label: "Sort: Attention" },
          ]}
        />
      </div>
      <FilterChips filters={filters} owners={owners} onChange={onFiltersChange} />

      {loading ? (
        <div className="hidden md:block">
          <table className="w-full">
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="h-[56px] border-b border-sales-border-subtle">
                  <td className="px-5 py-3" colSpan={8}>
                    <Skeleton className="h-8 w-full" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : emptyKind !== "rows" ? (
        <EmptyState
          title={
            emptyKind === "none"
              ? tab === "WON"
                ? "No Won Deals yet"
                : tab === "LOST"
                  ? "No Lost Deals yet"
                  : "No active Deals yet"
              : emptyKind === "search"
                ? `No Deals found for “${searchQuery}”`
                : "No Deals match these filters"
          }
          description={
            emptyKind === "none"
              ? tab === "all"
                ? "Qualified opportunities will appear here once your sales team creates Deals from Leads."
                : undefined
              : emptyKind === "search"
                ? "Try a different name, customer, or phone number."
                : "Adjust or clear filters to see more Deals."
          }
          action={
            emptyKind === "none" && tab === "all" ? (
              <Button variant="secondary" size="sm" onClick={() => (window.location.href = "/client/leads")}>
                View Leads
              </Button>
            ) : emptyKind === "search" ? (
              <Button variant="secondary" size="sm" onClick={onClearSearch}>
                Clear search
              </Button>
            ) : emptyKind === "filters" ? (
              <Button variant="secondary" size="sm" onClick={onClearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <DataTableEl>
              <DataTableHead>
                <tr>
                  <DataTableTh className="w-[22%] px-5">Deal</DataTableTh>
                  <DataTableTh className="w-[16%]">Customer</DataTableTh>
                  <DataTableTh className="w-[12%]">{closed ? "Outcome" : "Stage"}</DataTableTh>
                  <DataTableTh className="w-[12%] text-right">{tab === "WON" ? "Final Value" : "Deal Value"}</DataTableTh>
                  <DataTableTh className="hidden w-[12%] lg:table-cell">
                    {closed ? "Closed Date" : "Expected Decision"}
                  </DataTableTh>
                  <DataTableTh className="hidden w-[14%] xl:table-cell">
                    {tab === "LOST" ? "Lost Reason" : closed ? "Source" : "Next Action"}
                  </DataTableTh>
                  <DataTableTh className="w-[10%]">Owner</DataTableTh>
                  <DataTableTh className="w-10 px-2">
                    <span className="sr-only">More</span>
                  </DataTableTh>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {grouped.map((group) => (
                  <GroupRows
                    key={group.key}
                    label={group.label}
                    rows={group.rows}
                    tab={tab}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    canReassign={canReassign}
                    onViewDeal={onViewDeal}
                    onLogActivity={onLogActivity}
                    onSchedule={onSchedule}
                    onChangeOwner={onChangeOwner}
                    onChangeStage={onChangeStage}
                    onMarkWon={onMarkWon}
                    onMarkLost={onMarkLost}
                  />
                ))}
              </DataTableBody>
            </DataTableEl>
          </div>

          <ul className="divide-y divide-sales-border-subtle md:hidden">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  data-course-target="company-pipeline-row"
                  onClick={() => onSelect(row.id)}
                  className={cn(
                    "flex w-full flex-col gap-2.5 px-4 py-3.5 text-left",
                    selectedId === row.id &&
                      "bg-[rgba(212,255,79,0.16)] dark:bg-[rgba(212,255,79,0.08)]"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-sales-text-primary">
                        {row.dealName}
                      </p>
                      <p className="truncate text-[11px] text-sales-text-muted">
                        {row.customerName}
                        {row.customerLocation ? ` · ${row.customerLocation}` : ""}
                      </p>
                    </div>
                    <StageBadge stage={row.stage} />
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="font-semibold tabular-nums">{row.valueLabel}</span>
                    <NextWhen row={row} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar name={row.ownerName ?? "Unassigned"} src={row.ownerAvatarUrl} size="sm" />
                      <span className="text-[11px] text-sales-text-secondary">
                        {row.ownerName ?? "Unassigned"}
                      </span>
                    </div>
                    {row.atRisk || row.health !== "on_track" ? (
                      <Badge
                        tone={row.health === "at_risk" ? "danger" : "warning"}
                        appearance="soft"
                      >
                        {row.healthLabel}
                      </Badge>
                    ) : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {emptyKind === "rows" || loading ? (
        <div className="flex flex-col gap-2 border-t border-sales-border-subtle px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-[12px] text-sales-text-muted">
            {loading
              ? "Loading…"
              : `Showing ${from} to ${to} of ${total} Deal${total === 1 ? "" : "s"}`}
          </p>
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              aria-label="Previous page"
              disabled={page <= 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-sales-text-secondary hover:bg-sales-surface-hover disabled:opacity-40"
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            {pageWindow(page, pageCount).map((n) => (
              <button
                key={n}
                type="button"
                className={cn(
                  "inline-flex h-8 min-w-8 items-center justify-center rounded-[8px] px-2 text-[13px] font-medium",
                  n === page
                    ? "bg-sales-brand-soft font-semibold text-sales-text-primary"
                    : "text-sales-text-secondary hover:bg-sales-surface-hover"
                )}
                onClick={() => onPageChange(n)}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              aria-label="Next page"
              disabled={page >= pageCount}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-sales-text-secondary hover:bg-sales-surface-hover disabled:opacity-40"
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <select
            aria-label="Results per page"
            className="h-8 rounded-[8px] border border-sales-border bg-sales-surface px-2 text-[12px] text-sales-text-secondary"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {[COMPANY_PIPELINE_PAGE_SIZE, 25, 50].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </section>
  );
}

function GroupRows({
  label,
  rows,
  tab,
  selectedId,
  onSelect,
  canReassign,
  onViewDeal,
  onLogActivity,
  onSchedule,
  onChangeOwner,
  onChangeStage,
  onMarkWon,
  onMarkLost,
}: {
  label: string;
  rows: CompanyPipelineDealRow[];
  tab: CompanyPipelineTab;
  selectedId: string | null;
  onSelect: (id: string) => void;
  canReassign: boolean;
  onViewDeal: (row: CompanyPipelineDealRow) => void;
  onLogActivity: (row: CompanyPipelineDealRow) => void;
  onSchedule: (row: CompanyPipelineDealRow) => void;
  onChangeOwner: (row: CompanyPipelineDealRow) => void;
  onChangeStage: (row: CompanyPipelineDealRow) => void;
  onMarkWon: (row: CompanyPipelineDealRow) => void;
  onMarkLost: (row: CompanyPipelineDealRow) => void;
}) {
  const closed = isClosedPipelineTab(tab);
  return (
    <>
      {label ? (
        <tr className="bg-sales-surface-subtle">
          <td
            colSpan={8}
            className="px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted"
          >
            {label}
            <span className="ml-1.5 font-medium normal-case tracking-normal">{rows.length}</span>
          </td>
        </tr>
      ) : null}
      {rows.map((row) => (
        <DataTableRow
          key={row.id}
          selected={selectedId === row.id}
          data-course-target="company-pipeline-row"
          className={cn(
            "h-[56px] cursor-pointer hover:bg-[#FAFBFC] dark:hover:bg-[#171B17]",
            selectedId === row.id &&
              "bg-[rgba(212,255,79,0.16)] hover:bg-[rgba(212,255,79,0.16)] dark:bg-[rgba(212,255,79,0.08)] dark:hover:bg-[rgba(212,255,79,0.08)]"
          )}
          onClick={() => onSelect(row.id)}
        >
          <DataTableTd className="px-5">
            <p className="truncate text-[13px] font-semibold text-sales-text-primary">{row.dealName}</p>
            {row.category ? (
              <p className="truncate text-[11px] text-sales-text-muted">{row.category}</p>
            ) : null}
          </DataTableTd>
          <DataTableTd>
            <p className="truncate text-[13px] text-sales-text-primary">{row.customerName}</p>
            {row.customerLocation ? (
              <p className="truncate text-[11px] text-sales-text-muted">{row.customerLocation}</p>
            ) : null}
          </DataTableTd>
          <DataTableTd>
            <StageBadge stage={row.stage} />
          </DataTableTd>
          <DataTableTd className="text-right text-[13px] font-medium tabular-nums">
            {tab === "WON" && row.wonValue != null
              ? row.valueLabel
              : row.valueLabel}
          </DataTableTd>
          <DataTableTd className="hidden text-[13px] text-sales-text-secondary lg:table-cell">
            {closed ? row.closedAtLabel ?? "Not set" : row.expectedDecisionLabel}
          </DataTableTd>
          <DataTableTd className="hidden xl:table-cell">
            {tab === "LOST" ? (
              <span className="text-[13px] text-sales-text-secondary">
                {row.lostReason?.trim() || "Not added"}
              </span>
            ) : closed ? (
              <span className="text-[13px] text-sales-text-secondary">{row.sourceLabel ?? "—"}</span>
            ) : (
              <div data-course-target="company-pipeline-next-action">
                <p className="truncate text-[13px] text-sales-text-primary">
                  {row.nextAction.label || (row.nextAction.hasNextAction ? "Follow-up" : "—")}
                </p>
                <NextWhen row={row} />
              </div>
            )}
          </DataTableTd>
          <DataTableTd>
            <div className="flex items-center gap-2" title={row.ownerName ?? "Unassigned"}>
              <Avatar name={row.ownerName ?? "Unassigned"} src={row.ownerAvatarUrl} size="sm" />
              <span className="hidden truncate text-[12px] text-sales-text-secondary 2xl:inline">
                {row.ownerName?.split(" ")[0] ?? ""}
              </span>
            </div>
          </DataTableTd>
          <DataTableTd className="px-2" onClick={(e) => e.stopPropagation()}>
            <RowMenu
              row={row}
              canReassign={canReassign}
              onViewDeal={() => onViewDeal(row)}
              onLogActivity={() => onLogActivity(row)}
              onSchedule={() => onSchedule(row)}
              onChangeOwner={() => onChangeOwner(row)}
              onChangeStage={() => onChangeStage(row)}
              onMarkWon={() => onMarkWon(row)}
              onMarkLost={() => onMarkLost(row)}
            />
          </DataTableTd>
        </DataTableRow>
      ))}
    </>
  );
}
