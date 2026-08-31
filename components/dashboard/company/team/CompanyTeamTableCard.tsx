"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Filter,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/ui/cn";
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  SearchInput,
  Skeleton,
  Tabs,
} from "@/components/sales/ui";
import { GoalBar } from "./GoalProgressRing";
import type {
  CompanyTeamAttention,
  CompanyTeamFilters,
  CompanyTeamMemberTableRow,
  CompanyTeamTab,
} from "./types";
import { DEFAULT_COMPANY_TEAM_FILTERS } from "./types";
import { COMPANY_TEAM_PAGE_SIZE, companyTeamFiltersActive } from "@/lib/sales/company-team-metrics";
import { useCompanyWorkspace } from "@/components/company/CompanyWorkspaceContext";
import { displayRoleColumn, displayTitleLabel } from "@/lib/terminology";

const TABS: { id: CompanyTeamTab; label: string }[] = [
  { id: "all", label: "All team" },
  { id: "salespeople", label: "Salespeople" },
  { id: "managers", label: "Managers" },
  { id: "inactive", label: "Inactive" },
];

function AttentionBadge({
  attention,
  label,
}: {
  attention: CompanyTeamAttention;
  label: string;
}) {
  const tone =
    attention === "needs_attention" ? "warning" : attention === "watch" ? "warning" : "success";
  return (
    <Badge tone={tone} appearance="soft">
      {label}
    </Badge>
  );
}

function RowMenu({
  row,
  canManage,
  canSetGoals,
  canReassign,
  onViewProfile,
  onSetGoal,
  onReassign,
  onDeactivate,
}: {
  row: CompanyTeamMemberTableRow;
  canManage: boolean;
  canSetGoals: boolean;
  canReassign: boolean;
  onViewProfile: () => void;
  onSetGoal: () => void;
  onReassign: () => void;
  onDeactivate: () => void;
}) {
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu align="end">
        <DropdownMenuTrigger
          aria-label={`Actions for ${row.name}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-sales-text-muted hover:bg-sales-surface-hover hover:text-sales-text-primary"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal size={16} strokeWidth={1.8} />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48">
          <DropdownMenuItem onSelect={onViewProfile}>View profile</DropdownMenuItem>
          {canSetGoals ? (
            <DropdownMenuItem onSelect={onSetGoal}>
              {row.hasGoal ? "Edit Goal" : "Set Goal"}
            </DropdownMenuItem>
          ) : null}
          {canReassign ? (
            <DropdownMenuItem onSelect={onReassign}>Reassign Leads</DropdownMenuItem>
          ) : null}
          {canManage && row.isActive ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={onDeactivate}>
                Deactivate
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function FiltersPopover({
  filters,
  onChange,
}: {
  filters: CompanyTeamFilters;
  onChange: (next: CompanyTeamFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = companyTeamFiltersActive(filters);

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
        <div className="absolute right-0 z-30 mt-2 w-64 rounded-[12px] border border-sales-border bg-sales-surface p-3 shadow-sales-popover">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
            Attention
          </p>
          <select
            className="mb-3 h-9 w-full rounded-[8px] border border-sales-border-strong bg-sales-surface px-2 text-[13px] text-sales-text-primary"
            value={filters.attention}
            onChange={(e) =>
              onChange({ ...filters, attention: e.target.value as CompanyTeamFilters["attention"] })
            }
          >
            <option value="all">All</option>
            <option value="on_track">On track</option>
            <option value="watch">Watch</option>
            <option value="needs_attention">Needs attention</option>
          </select>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
            Goal
          </p>
          <select
            className="mb-3 h-9 w-full rounded-[8px] border border-sales-border-strong bg-sales-surface px-2 text-[13px] text-sales-text-primary"
            value={filters.goal}
            onChange={(e) =>
              onChange({ ...filters, goal: e.target.value as CompanyTeamFilters["goal"] })
            }
          >
            <option value="all">All</option>
            <option value="has">Has Goal</option>
            <option value="none">No Goal</option>
          </select>
          <Checkbox
            label="Follow-ups due"
            checked={filters.followUpsDue}
            onCheckedChange={(v) => onChange({ ...filters, followUpsDue: v })}
          />
          <Checkbox
            label="Deals at risk"
            checked={filters.dealsAtRisk}
            onCheckedChange={(v) => onChange({ ...filters, dealsAtRisk: v })}
          />
          {active ? (
            <button
              type="button"
              className="mt-2 text-[12px] font-medium text-sales-brand-fg hover:underline"
              onClick={() => onChange(DEFAULT_COMPANY_TEAM_FILTERS)}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function CompanyTeamTableCard({
  rows,
  total,
  tab,
  onTabChange,
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  selectedId,
  onSelect,
  canManage,
  canSetGoals,
  canReassign,
  onViewProfile,
  onSetGoal,
  onReassign,
  onDeactivate,
  onInvite,
  loading,
  emptyKind,
}: {
  rows: CompanyTeamMemberTableRow[];
  total: number;
  tab: CompanyTeamTab;
  onTabChange: (tab: CompanyTeamTab) => void;
  search: string;
  onSearchChange: (q: string) => void;
  filters: CompanyTeamFilters;
  onFiltersChange: (f: CompanyTeamFilters) => void;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (n: number) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  canManage: boolean;
  canSetGoals: boolean;
  canReassign: boolean;
  onViewProfile: (id: string) => void;
  onSetGoal: (row: CompanyTeamMemberTableRow) => void;
  onReassign: (id: string) => void;
  onDeactivate: (row: CompanyTeamMemberTableRow) => void;
  onInvite: () => void;
  loading?: boolean;
  emptyKind: "none" | "search" | "filters" | "rows";
}) {
  const { businessType, terminology } = useCompanyWorkspace();
  const tabs = TABS.map((item) =>
    item.id === "salespeople"
      ? { ...item, label: terminology.salesperson.plural }
      : item.id === "all"
        ? { ...item, label: businessType === "real_estate" ? "All agents" : "All team" }
        : item
  );
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <DataTableWorkspace>
      <DataTableTabsBar className="border-b-0 px-4 sm:px-5">
        <Tabs
          items={tabs}
          value={tab}
          onChange={(id) => onTabChange(id as CompanyTeamTab)}
          className="min-w-0 flex-1 border-b-0"
        />
      </DataTableTabsBar>

      <DataTableToolbar className="px-4 sm:px-5">
        <DataTableToolbarGroup>
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder={
              businessType === "real_estate" ? "Search agents..." : "Search team members..."
            }
            className="w-full sm:w-[240px]"
          />
          <FiltersPopover filters={filters} onChange={onFiltersChange} />
        </DataTableToolbarGroup>
      </DataTableToolbar>

      {loading ? (
        <DataTableScroll className="hidden md:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-sales-border-subtle bg-sales-surface-subtle">
                {Array.from({ length: 9 }).map((_, i) => (
                  <th key={i} className="px-3 py-2.5">
                    <Skeleton className="h-3 w-16" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="h-[52px] border-b border-sales-border-subtle">
                  <td className="px-5 py-3" colSpan={9}>
                    <Skeleton className="h-8 w-full" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableScroll>
      ) : emptyKind !== "rows" ? (
        <DataTableEmptyPanel
          title={
            emptyKind === "none"
              ? businessType === "real_estate"
                ? "No agents yet."
                : "No team members yet."
              : emptyKind === "search"
                ? businessType === "real_estate"
                  ? "No agents match this search."
                  : "No team members match this search."
                : businessType === "real_estate"
                  ? "No agents match these filters."
                  : "No team members match these filters."
          }
          description={
            emptyKind === "none"
              ? businessType === "real_estate"
                ? "Add agents to begin managing inquiries and viewings in SegmiQ."
                : "Add your sales team to begin managing Deals and Goals in SegmiQ."
              : undefined
          }
          action={
            emptyKind === "none" && canManage ? (
              <Button variant="primary" size="sm" onClick={onInvite}>
                {businessType === "real_estate" ? "Add agent" : "Add team member"}
              </Button>
            ) : emptyKind === "search" ? (
              <Button variant="secondary" size="sm" onClick={() => onSearchChange("")}>
                Clear search
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onFiltersChange(DEFAULT_COMPANY_TEAM_FILTERS)}
              >
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <>
          <DataTableScroll className="hidden md:block">
            <DataTableEl className="min-w-[860px]">
              <DataTableHead>
                <tr>
                  <DataTableTh className="w-[24%] px-5">Team member</DataTableTh>
                  <DataTableTh className="w-[12%]">Role</DataTableTh>
                  <DataTableTh className="hidden w-[9%] text-right lg:table-cell">Active Deals</DataTableTh>
                  <DataTableTh className="w-[12%] text-right">Pipeline Value</DataTableTh>
                  <DataTableTh className="hidden w-[9%] text-right xl:table-cell">Deals Won</DataTableTh>
                  <DataTableTh className="hidden w-[10%] text-right xl:table-cell">Follow-ups Due</DataTableTh>
                  <DataTableTh className="w-[15%]">Goal Progress</DataTableTh>
                  <DataTableTh className="w-[9%]">Attention</DataTableTh>
                  <DataTableTh className="w-10 px-2">
                    <span className="sr-only">More</span>
                  </DataTableTh>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {rows.map((row) => (
                  <DataTableRow
                    key={row.id}
                    selected={selectedId === row.id}
                    clickable
                    onClick={() => onSelect(row.id)}
                  >
                    <DataTableTd className="px-5">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={row.name} src={row.avatarUrl} size="md" />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-sales-text-primary">
                            {row.name}
                          </p>
                          <p className="truncate text-[11px] text-sales-text-muted">
                            {displayTitleLabel(row.titleLabel, businessType)}
                          </p>
                        </div>
                      </div>
                    </DataTableTd>
                    <DataTableTd className="text-[13px] text-sales-text-secondary">
                      {displayRoleColumn(row.roleColumn, businessType)}
                    </DataTableTd>
                    <DataTableTd className="hidden text-right tabular-nums lg:table-cell">
                      {row.activeDeals}
                    </DataTableTd>
                    <DataTableTd className="text-right tabular-nums">{row.pipelineValueLabel}</DataTableTd>
                    <DataTableTd className="hidden text-right tabular-nums xl:table-cell">
                      {row.dealsWon}
                    </DataTableTd>
                    <DataTableTd className="hidden text-right xl:table-cell">
                      <span
                        className={cn(
                          "tabular-nums",
                          row.overdueFollowUps > 0
                            ? "font-semibold text-sales-warning-fg"
                            : "text-sales-text-primary"
                        )}
                      >
                        {row.followUpsDue}
                      </span>
                    </DataTableTd>
                    <DataTableTd>
                      {row.hasGoal && row.goalProgressPct != null ? (
                        <GoalBar pct={row.goalProgressPct} label={`${row.name} goal progress`} />
                      ) : (
                        <span className="text-[12px] text-sales-text-muted">No Goal</span>
                      )}
                    </DataTableTd>
                    <DataTableTd>
                      <AttentionBadge attention={row.attention} label={row.attentionLabel} />
                    </DataTableTd>
                    <DataTableActionsCell className="px-2">
                      <RowMenu
                        row={row}
                        canManage={canManage}
                        canSetGoals={canSetGoals}
                        canReassign={canReassign}
                        onViewProfile={() => onViewProfile(row.id)}
                        onSetGoal={() => onSetGoal(row)}
                        onReassign={() => onReassign(row.id)}
                        onDeactivate={() => onDeactivate(row)}
                      />
                    </DataTableActionsCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTableEl>
          </DataTableScroll>

          <DataTableMobileList className="md:hidden">
            {rows.map((row) => (
              <DataTableMobileItem
                key={row.id}
                selected={selectedId === row.id}
                onClick={() => onSelect(row.id)}
                className="flex flex-col gap-3 px-4 py-4"
              >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={row.name} src={row.avatarUrl} size="md" />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-sales-text-primary">
                          {row.name}
                        </p>
                        <p className="truncate text-[11px] text-sales-text-muted">{row.titleLabel}</p>
                      </div>
                    </div>
                    <AttentionBadge attention={row.attention} label={row.attentionLabel} />
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-[12px]">
                    <div>
                      <dt className="text-sales-text-muted">Active Deals</dt>
                      <dd className="font-semibold tabular-nums">{row.activeDeals}</dd>
                    </div>
                    <div>
                      <dt className="text-sales-text-muted">Pipeline Value</dt>
                      <dd className="font-semibold tabular-nums">{row.pipelineValueLabel}</dd>
                    </div>
                    <div>
                      <dt className="text-sales-text-muted">Deals Won</dt>
                      <dd className="font-semibold tabular-nums">{row.dealsWon}</dd>
                    </div>
                    <div>
                      <dt className="text-sales-text-muted">Follow-ups Due</dt>
                      <dd
                        className={cn(
                          "font-semibold tabular-nums",
                          row.overdueFollowUps > 0 && "text-sales-warning-fg"
                        )}
                      >
                        {row.followUpsDue}
                      </dd>
                    </div>
                  </dl>
                  {row.hasGoal && row.goalProgressPct != null ? (
                    <GoalBar pct={row.goalProgressPct} />
                  ) : (
                    <span className="text-[12px] text-sales-text-muted">No Goal</span>
                  )}
              </DataTableMobileItem>
            ))}
          </DataTableMobileList>
        </>
      )}

      {emptyKind === "rows" || loading ? (
        <DataTableFooter className="px-4 sm:px-5">
          <DataTablePagination
            page={page}
            pageCount={pageCount}
            onPageChange={onPageChange}
            summary={loading ? "Loading…" : `Showing ${from} to ${to} of ${total} results`}
            pageSizeControl={
              <select
                aria-label="Results per page"
                className="h-8 rounded-[8px] border border-sales-border bg-sales-surface px-2 text-[12px] text-sales-text-secondary"
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
              >
                {[COMPANY_TEAM_PAGE_SIZE, 25, 50].map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </select>
            }
          />
        </DataTableFooter>
      ) : null}
    </DataTableWorkspace>
  );
}
