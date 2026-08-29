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
  Checkbox,
  DataTableEl,
  DataTableHead,
  DataTableBody,
  DataTableRow,
  DataTableTh,
  DataTableTd,
  EmptyState,
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
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        aria-label={`Actions for ${row.name}`}
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
              onViewProfile();
            }}
          >
            View profile
          </button>
          {canSetGoals ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full px-3 py-2 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
              onClick={() => {
                setOpen(false);
                onSetGoal();
              }}
            >
              {row.hasGoal ? "Edit Goal" : "Set Goal"}
            </button>
          ) : null}
          {canReassign ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full px-3 py-2 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
              onClick={() => {
                setOpen(false);
                onReassign();
              }}
            >
              Reassign Leads
            </button>
          ) : null}
          {canManage && row.isActive ? (
            <>
              <div className="my-1 border-t border-sales-border-subtle" />
              <button
                type="button"
                role="menuitem"
                className="flex w-full px-3 py-2 text-left text-[13px] text-sales-danger hover:bg-sales-surface-hover"
                onClick={() => {
                  setOpen(false);
                  onDeactivate();
                }}
              >
                Deactivate
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
    <section className="overflow-hidden workspace-card rounded-[14px] border border-sales-border bg-sales-surface shadow-sales-card">
      <div className="flex flex-col gap-3 border-b border-sales-border-subtle px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <Tabs
          items={tabs}
          value={tab}
          onChange={(id) => onTabChange(id as CompanyTeamTab)}
          className="min-w-0 flex-1 border-b-0"
        />
        <div className="flex shrink-0 items-center gap-2">
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder={
              businessType === "real_estate" ? "Search agents..." : "Search team members..."
            }
            className="w-full sm:w-[220px]"
          />
          <FiltersPopover filters={filters} onChange={onFiltersChange} />
        </div>
      </div>

      {loading ? (
        <div className="hidden md:block">
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
        </div>
      ) : emptyKind !== "rows" ? (
        <EmptyState
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
          <div className="hidden overflow-x-auto md:block">
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
                    className={cn(
                      "h-[52px] cursor-pointer sm:h-[52px]",
                      selectedId === row.id && "bg-[rgba(212,255,79,0.16)] dark:bg-[rgba(212,255,79,0.08)]"
                    )}
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
                    <DataTableTd className="px-2" onClick={(e) => e.stopPropagation()}>
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
                    </DataTableTd>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTableEl>
          </div>

          <ul className="divide-y divide-sales-border-subtle md:hidden">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => onSelect(row.id)}
                  className={cn(
                    "flex w-full flex-col gap-3 px-4 py-4 text-left",
                    selectedId === row.id && "bg-[rgba(212,255,79,0.16)] dark:bg-[rgba(212,255,79,0.08)]"
                  )}
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
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {emptyKind === "rows" || loading ? (
        <div className="flex flex-col gap-2 border-t border-sales-border-subtle px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-[12px] text-sales-text-muted">
            {loading ? "Loading…" : `Showing ${from} to ${to} of ${total} results`}
          </p>
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              aria-label="Previous page"
              disabled={page <= 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-sales-text-secondary disabled:opacity-40 hover:bg-sales-surface-hover"
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(3, pageCount) }, (_, i) => {
              const n = pageCount <= 3 ? i + 1 : Math.min(Math.max(1, page - 1), pageCount - 2) + i;
              return (
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
              );
            })}
            <button
              type="button"
              aria-label="Next page"
              disabled={page >= pageCount}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-sales-text-secondary disabled:opacity-40 hover:bg-sales-surface-hover"
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
            {[COMPANY_TEAM_PAGE_SIZE, 25, 50].map((n) => (
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
