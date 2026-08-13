"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Globe,
  MoreHorizontal,
  Phone,
  UserRoundPlus,
} from "lucide-react";
import { SiFacebook, SiWhatsapp } from "react-icons/si";
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
  MenuSelect,
  SearchInput,
  Skeleton,
} from "@/components/sales/ui";
import {
  COMPANY_LEADS_PAGE_SIZE,
  COMPANY_LEADS_TABS,
  companyLeadLifecycleTone,
  companyLeadsFiltersActive,
} from "@/lib/sales/company-leads-metrics";
import type {
  CompanyLeadRow,
  CompanyLeadsFilters,
  CompanyLeadsOwnerOption,
  CompanyLeadsSort,
  CompanyLeadsSourceOption,
  CompanyLeadsTab,
  CompanyLeadsTabCounts,
} from "./types";
import { DEFAULT_COMPANY_LEADS_FILTERS } from "./types";

export function SourceBadge({
  sourceKey,
  sourceLabel,
  sourceRaw,
}: {
  sourceKey: string | null;
  sourceLabel: string | null;
  sourceRaw?: string | null;
}) {
  const label = sourceLabel ?? "Other";
  const raw = (sourceRaw ?? sourceKey ?? "").toLowerCase();
  let icon = <Globe size={12} strokeWidth={1.8} className="text-sales-text-muted" />;
  let tone = "bg-sales-neutral-100 text-sales-text-secondary";
  if (raw.includes("whatsapp") || sourceKey === "whatsapp") {
    icon = <SiWhatsapp size={12} color="#25D366" aria-hidden />;
    tone = "bg-[rgba(37,211,102,0.10)] text-[#15803D] dark:text-[#74DB8E]";
  } else if (raw.includes("facebook") || sourceKey === "facebook") {
    icon = <SiFacebook size={12} color="#1877F2" aria-hidden />;
    tone = "bg-[rgba(24,119,242,0.10)] text-[#1768C5] dark:text-[#79AEF7]";
  } else if (raw.includes("refer") || sourceKey === "referral") {
    icon = <UserRoundPlus size={12} strokeWidth={1.8} />;
    tone = "bg-[rgba(139,92,246,0.10)] text-[#6D3ED6] dark:text-[#B8A0F8]";
  } else if (raw.includes("walk") || raw.includes("phone")) {
    icon = <Phone size={12} strokeWidth={1.8} />;
    tone = "bg-[rgba(245,158,11,0.10)] text-[#B86705] dark:text-[#F6BB59]";
  } else if (raw.includes("web") || sourceKey === "website") {
    icon = <Globe size={12} strokeWidth={1.8} />;
    tone = "bg-[rgba(38,132,255,0.10)] text-[#1768C5] dark:text-[#79AEF7]";
  }
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 truncate rounded-[6px] px-1.5 py-1 text-[11px] font-medium",
        tone
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </span>
  );
}

function LifecycleBadge({ status, label }: { status: string; label: string }) {
  return (
    <Badge
      tone={companyLeadLifecycleTone(status)}
      appearance="soft"
      className="!px-2 !py-0.5 !text-[11px] !font-medium"
    >
      {label}
    </Badge>
  );
}

function ScoreCell({ score, intent }: { score: number | null; intent: string | null }) {
  if (score == null || !Number.isFinite(score)) {
    return <span className="text-[12px] text-sales-text-muted">—</span>;
  }
  const tone =
    intent === "hot"
      ? "bg-[rgba(34,197,94,0.11)] text-[#15803D] dark:text-[#74DB8E]"
      : intent === "warm"
        ? "bg-[rgba(245,158,11,0.11)] text-[#B86705] dark:text-[#F6BB59]"
        : "bg-[rgba(239,68,68,0.09)] text-[#C2413A] dark:text-[#F38B85]";
  return (
    <span
      className={cn(
        "inline-flex min-w-8 items-center justify-center rounded-[6px] px-2 py-1 text-[11px] font-semibold tabular-nums",
        tone
      )}
    >
      {Math.round(score)}
    </span>
  );
}

function RowMenu({
  row,
  canReassign,
  onView,
  onCall,
  onWhatsApp,
  onAssign,
  onSchedule,
  onCreateDeal,
  onOpenDeal,
  onNotQualified,
}: {
  row: CompanyLeadRow;
  canReassign: boolean;
  onView: () => void;
  onCall: () => void;
  onWhatsApp: () => void;
  onAssign: () => void;
  onSchedule: () => void;
  onCreateDeal: () => void;
  onOpenDeal: () => void;
  onNotQualified: () => void;
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

  const notQualified = row.lifecycle === "NOT_QUALIFIED";

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
              onView();
            }}
          >
            View Lead
          </button>
          {row.phone ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full px-3 py-2 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
              onClick={() => {
                setOpen(false);
                onCall();
              }}
            >
              Call
            </button>
          ) : null}
          {row.phone || String(row.sourceRaw ?? "").toUpperCase().includes("WHATSAPP") ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full px-3 py-2 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
              onClick={() => {
                setOpen(false);
                onWhatsApp();
              }}
            >
              Open WhatsApp
            </button>
          ) : null}
          {row.canModify ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full px-3 py-2 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
              onClick={() => {
                setOpen(false);
                onSchedule();
              }}
            >
              Schedule follow-up
            </button>
          ) : null}
          {canReassign ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full px-3 py-2 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
              onClick={() => {
                setOpen(false);
                onAssign();
              }}
            >
              Assign / Reassign
            </button>
          ) : null}
          {row.hasDeal ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full px-3 py-2 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
              onClick={() => {
                setOpen(false);
                onOpenDeal();
              }}
            >
              Open Deal
            </button>
          ) : row.canModify && !notQualified ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full px-3 py-2 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
              onClick={() => {
                setOpen(false);
                onCreateDeal();
              }}
            >
              Create Deal
            </button>
          ) : null}
          {row.canModify && !notQualified && !row.hasDeal ? (
            <>
              <div className="my-1 border-t border-sales-border-subtle" />
              <button
                type="button"
                role="menuitem"
                className="flex w-full px-3 py-2 text-left text-[13px] text-sales-danger hover:bg-sales-surface-hover"
                onClick={() => {
                  setOpen(false);
                  onNotQualified();
                }}
              >
                Mark Not Qualified
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
  filters: CompanyLeadsFilters;
  owners: CompanyLeadsOwnerOption[];
  sources: CompanyLeadsSourceOption[];
  onChange: (next: CompanyLeadsFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = companyLeadsFiltersActive(filters);

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
            Lifecycle
          </p>
          <select
            className={field}
            value={filters.lifecycle}
            onChange={(e) =>
              onChange({
                ...filters,
                lifecycle: e.target.value as CompanyLeadsFilters["lifecycle"],
              })
            }
          >
            <option value="all">All</option>
            <option value="NEW">New</option>
            <option value="CONTACTED">Contacted</option>
            <option value="QUALIFIED">Qualified</option>
            <option value="CONVERTED_TO_DEAL">Deal created</option>
            <option value="NOT_QUALIFIED">Not Qualified</option>
          </select>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
            Intent
          </p>
          <select
            className={field}
            value={filters.intent}
            onChange={(e) =>
              onChange({ ...filters, intent: e.target.value as CompanyLeadsFilters["intent"] })
            }
          >
            <option value="all">All</option>
            <option value="hot">Hot</option>
            <option value="warm">Warm</option>
            <option value="cold">Cold</option>
          </select>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
            First contact
          </p>
          <select
            className={field}
            value={filters.firstContact}
            onChange={(e) =>
              onChange({
                ...filters,
                firstContact: e.target.value as CompanyLeadsFilters["firstContact"],
              })
            }
          >
            <option value="all">All</option>
            <option value="contacted">Contacted</option>
            <option value="not_contacted">Not contacted yet</option>
          </select>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
            Deal
          </p>
          <select
            className={field}
            value={filters.hasDeal}
            onChange={(e) =>
              onChange({ ...filters, hasDeal: e.target.value as CompanyLeadsFilters["hasDeal"] })
            }
          >
            <option value="all">All</option>
            <option value="has_deal">Has Deal</option>
            <option value="no_deal">No Deal</option>
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
            Owner
          </p>
          <select
            className={field}
            value={filters.ownerId}
            onChange={(e) => onChange({ ...filters, ownerId: e.target.value })}
          >
            <option value="all">All owners</option>
            <option value="unassigned">Unassigned</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          {active ? (
            <button
              type="button"
              className="text-[12px] font-medium text-sales-brand-fg hover:underline"
              onClick={() => onChange(DEFAULT_COMPANY_LEADS_FILTERS)}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function pageWindow(page: number, pageCount: number, max = 5): number[] {
  if (pageCount <= max) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const start = Math.min(Math.max(1, page - 2), pageCount - max + 1);
  return Array.from({ length: max }, (_, i) => start + i);
}

function emptyCopy(
  tab: CompanyLeadsTab,
  kind: "none" | "search" | "filters" | "rows",
  searchQuery: string
): { title: string; body: string } {
  if (kind === "search") {
    return {
      title: `No Leads match “${searchQuery}”`,
      body: "Try a different name, phone, or email.",
    };
  }
  if (kind === "filters") {
    return { title: "No Leads match these filters.", body: "Clear filters to see more results." };
  }
  if (tab === "hot") {
    return { title: "No Hot Leads right now.", body: "High-intent enquiries will appear here." };
  }
  if (tab === "qualified") {
    return {
      title: "No qualified Leads yet.",
      body: "Continue contacting and qualifying enquiries to identify real Deals.",
    };
  }
  if (tab === "not_qualified") {
    return { title: "No Not Qualified Leads.", body: "Leads marked as not a genuine opportunity appear here." };
  }
  if (tab === "contacted") {
    return { title: "No contacted Leads.", body: "Leads with a first customer contact appear here." };
  }
  if (tab === "new") {
    return { title: "No new Leads.", body: "Fresh enquiries that have not been contacted yet appear here." };
  }
  return {
    title: "No Leads yet.",
    body: "New enquiries and manually added prospects will appear here.",
  };
}

export function CompanyLeadsTableCard({
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
  selectedIds,
  onToggleRow,
  onTogglePage,
  owners,
  sources,
  canReassign,
  onView,
  onCall,
  onWhatsApp,
  onAssign,
  onSchedule,
  onCreateDeal,
  onOpenDeal,
  onNotQualified,
  onClearSearch,
  onClearFilters,
  onAddLead,
  canAddLead,
  loading,
  emptyKind,
  searchQuery,
}: {
  rows: CompanyLeadRow[];
  total: number;
  tab: CompanyLeadsTab;
  tabCounts: CompanyLeadsTabCounts;
  onTabChange: (tab: CompanyLeadsTab) => void;
  search: string;
  onSearchChange: (q: string) => void;
  filters: CompanyLeadsFilters;
  onFiltersChange: (f: CompanyLeadsFilters) => void;
  sort: CompanyLeadsSort;
  onSortChange: (s: CompanyLeadsSort) => void;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (n: number) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  selectedIds: Set<string>;
  onToggleRow: (id: string, checked: boolean) => void;
  onTogglePage: (checked: boolean) => void;
  owners: CompanyLeadsOwnerOption[];
  sources: CompanyLeadsSourceOption[];
  canReassign: boolean;
  onView: (row: CompanyLeadRow) => void;
  onCall: (row: CompanyLeadRow) => void;
  onWhatsApp: (row: CompanyLeadRow) => void;
  onAssign: (row: CompanyLeadRow) => void;
  onSchedule: (row: CompanyLeadRow) => void;
  onCreateDeal: (row: CompanyLeadRow) => void;
  onOpenDeal: (row: CompanyLeadRow) => void;
  onNotQualified: (row: CompanyLeadRow) => void;
  onClearSearch: () => void;
  onClearFilters: () => void;
  onAddLead?: () => void;
  canAddLead?: boolean;
  loading?: boolean;
  emptyKind: "none" | "search" | "filters" | "rows";
  searchQuery: string;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const pageIds = rows.map((r) => r.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));
  const copy = emptyCopy(tab, emptyKind, searchQuery);

  return (
    <section
      className="overflow-hidden rounded-[14px] border border-sales-border bg-sales-surface shadow-sales-card"
      data-course-target="company-leads-table"
    >
      <div
        className="scrollbar-hide flex gap-4 overflow-x-auto overscroll-x-contain border-b border-sales-border-subtle px-4 sm:px-5"
        role="tablist"
        data-course-target="company-leads-tabs"
      >
        {COMPANY_LEADS_TABS.map((item) => {
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
        <div className="w-full sm:w-[220px]">
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder="Search Leads..."
            className="w-full"
          />
        </div>
        <FiltersPopover filters={filters} owners={owners} sources={sources} onChange={onFiltersChange} />
        <MenuSelect
          size="sm"
          aria-label="Source"
          value={filters.source}
          onChange={(v) => onFiltersChange({ ...filters, source: v })}
          options={[
            { value: "all", label: "Source" },
            ...sources.map((s) => ({ value: s.key, label: s.label })),
          ]}
        />
        <MenuSelect
          size="sm"
          aria-label="Owner"
          value={filters.ownerId}
          onChange={(v) => onFiltersChange({ ...filters, ownerId: v })}
          options={[
            { value: "all", label: "Owner" },
            { value: "unassigned", label: "Unassigned" },
            ...owners.map((o) => ({ value: o.id, label: o.name })),
          ]}
        />
        <MenuSelect
          size="sm"
          aria-label="Sort"
          value={sort}
          onChange={onSortChange}
          options={[
            { value: "newest", label: "Sort: Newest" },
            { value: "oldest", label: "Sort: Oldest" },
            { value: "score", label: "Sort: Lead score" },
            { value: "response_urgency", label: "Sort: Response urgency" },
            { value: "last_activity", label: "Sort: Last activity" },
            { value: "next_action", label: "Sort: Next action" },
          ]}
        />
      </div>

      {loading ? (
        <div className="hidden md:block">
          <DataTableEl>
            <DataTableHead>
              <tr>
                {Array.from({ length: 9 }).map((_, i) => (
                  <DataTableTh key={i}>
                    <Skeleton className="h-3 w-16" />
                  </DataTableTh>
                ))}
              </tr>
            </DataTableHead>
            <DataTableBody>
              {Array.from({ length: 8 }).map((_, i) => (
                <DataTableRow key={i} className="h-[60px]">
                  {Array.from({ length: 9 }).map((__, j) => (
                    <DataTableTd key={j}>
                      <Skeleton className="h-4 w-full" />
                    </DataTableTd>
                  ))}
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTableEl>
        </div>
      ) : emptyKind !== "rows" ? (
        <div className="px-4 py-12 sm:px-5">
          <EmptyState
            title={copy.title}
            description={copy.body}
            action={
              emptyKind === "search" ? (
                <Button variant="secondary" size="sm" onClick={onClearSearch}>
                  Clear search
                </Button>
              ) : emptyKind === "filters" ? (
                <Button variant="secondary" size="sm" onClick={onClearFilters}>
                  Clear filters
                </Button>
              ) : canAddLead && tab === "all" ? (
                <Button variant="primary" size="sm" onClick={onAddLead}>
                  Add Lead
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <DataTableEl className="min-w-[920px]">
              <DataTableHead>
                <tr className="bg-[#F9FAFB] dark:bg-[#0F120F]">
                  <DataTableTh className="w-10 px-4">
                    <div onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={allPageSelected}
                        aria-label="Select page"
                        onCheckedChange={(v) => onTogglePage(v)}
                      />
                    </div>
                  </DataTableTh>
                  <DataTableTh>Lead</DataTableTh>
                  <DataTableTh className="w-[120px]">Source</DataTableTh>
                  <DataTableTh className="hidden w-[160px] xl:table-cell">Contact</DataTableTh>
                  <DataTableTh className="w-[110px]">Status</DataTableTh>
                  <DataTableTh className="w-[100px]">Lead score</DataTableTh>
                  <DataTableTh className="w-[72px]">Owner</DataTableTh>
                  <DataTableTh className="hidden w-[130px] lg:table-cell">Created</DataTableTh>
                  <DataTableTh className="w-12" />
                </tr>
              </DataTableHead>
              <DataTableBody>
                {rows.map((row) => (
                  <DataTableRow
                    key={row.id}
                    selected={selectedId === row.id}
                    data-course-target="company-lead-row"
                    className={cn(
                      "h-[60px] cursor-pointer hover:bg-[#FAFBFC] dark:hover:bg-[#171B17]",
                      selectedId === row.id &&
                        "bg-[rgba(212,255,79,0.16)] hover:bg-[rgba(212,255,79,0.16)] dark:bg-[rgba(212,255,79,0.08)] dark:hover:bg-[rgba(212,255,79,0.08)]"
                    )}
                    onClick={() => onSelect(row.id)}
                  >
                    <DataTableTd className="px-4" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(row.id)}
                        aria-label={`Select ${row.identity}`}
                        onCheckedChange={(v) => onToggleRow(row.id, v)}
                      />
                    </DataTableTd>
                    <DataTableTd>
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={row.identity} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-sales-text-primary">
                            {row.identity}
                          </p>
                          {row.enquiryContext ? (
                            <p className="truncate text-[11px] text-sales-text-muted">
                              {row.enquiryContext}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </DataTableTd>
                    <DataTableTd>
                      <SourceBadge
                        sourceKey={row.sourceKey}
                        sourceLabel={row.sourceLabel}
                        sourceRaw={row.sourceRaw}
                      />
                    </DataTableTd>
                    <DataTableTd className="hidden xl:table-cell">
                      {row.phone || row.email ? (
                        <div className="min-w-0">
                          {row.phone ? (
                            <p className="truncate text-[12px] text-sales-text-primary">{row.phone}</p>
                          ) : null}
                          {row.email ? (
                            <p className="truncate text-[11px] text-sales-text-muted">{row.email}</p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-[12px] text-sales-text-muted">Contact not added</span>
                      )}
                    </DataTableTd>
                    <DataTableTd>
                      <LifecycleBadge status={row.lifecycle} label={row.lifecycleLabel} />
                    </DataTableTd>
                    <DataTableTd>
                      <ScoreCell score={row.leadScore} intent={row.intent} />
                    </DataTableTd>
                    <DataTableTd>
                      {row.ownerId ? (
                        <span title={row.ownerName ?? "Owner"}>
                          <Avatar
                            name={row.ownerName ?? "Owner"}
                            src={row.ownerAvatarUrl}
                            size="sm"
                          />
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-sales-warning-fg">Unassigned</span>
                      )}
                    </DataTableTd>
                    <DataTableTd className="hidden text-[12px] text-sales-text-secondary lg:table-cell">
                      {row.createdLabel}
                    </DataTableTd>
                    <DataTableTd onClick={(e) => e.stopPropagation()}>
                      <RowMenu
                        row={row}
                        canReassign={canReassign}
                        onView={() => onView(row)}
                        onCall={() => onCall(row)}
                        onWhatsApp={() => onWhatsApp(row)}
                        onAssign={() => onAssign(row)}
                        onSchedule={() => onSchedule(row)}
                        onCreateDeal={() => onCreateDeal(row)}
                        onOpenDeal={() => onOpenDeal(row)}
                        onNotQualified={() => onNotQualified(row)}
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
                  data-course-target="company-lead-row"
                  onClick={() => onSelect(row.id)}
                  className={cn(
                    "flex w-full flex-col gap-2.5 px-4 py-3.5 text-left",
                    selectedId === row.id &&
                      "bg-[rgba(212,255,79,0.16)] dark:bg-[rgba(212,255,79,0.08)]"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={row.identity} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-sales-text-primary">
                          {row.identity}
                        </p>
                        {row.enquiryContext ? (
                          <p className="truncate text-[11px] text-sales-text-muted">
                            {row.enquiryContext}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <LifecycleBadge status={row.lifecycle} label={row.lifecycleLabel} />
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[12px]">
                    <SourceBadge
                      sourceKey={row.sourceKey}
                      sourceLabel={row.sourceLabel}
                      sourceRaw={row.sourceRaw}
                    />
                    <ScoreCell score={row.leadScore} intent={row.intent} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {row.ownerId ? (
                        <>
                          <Avatar name={row.ownerName ?? "Owner"} src={row.ownerAvatarUrl} size="sm" />
                          <span className="text-[11px] text-sales-text-secondary">
                            {row.ownerName}
                          </span>
                        </>
                      ) : (
                        <span className="text-[11px] font-medium text-sales-warning-fg">Unassigned</span>
                      )}
                    </div>
                    <span className="text-[11px] text-sales-text-muted">{row.createdLabel}</span>
                  </div>
                  {row.nextAction.hasNextAction ? (
                    <p className="text-[11px] text-sales-text-muted">
                      {row.nextAction.label}
                      {row.nextAction.whenLabel ? ` · ${row.nextAction.whenLabel}` : ""}
                    </p>
                  ) : null}
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
              : `Showing ${from} to ${to} of ${total} Lead${total === 1 ? "" : "s"}`}
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
            {[COMPANY_LEADS_PAGE_SIZE, 25, 50].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {somePageSelected && canReassign ? (
        <div className="flex items-center justify-between gap-3 border-t border-sales-border-subtle bg-sales-surface-subtle px-4 py-2.5 sm:px-5">
          <p className="text-[12px] font-medium text-sales-text-secondary">
            {selectedIds.size} selected
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const first = rows.find((r) => selectedIds.has(r.id));
              if (first) onAssign(first);
            }}
          >
            Assign owner
          </Button>
        </div>
      ) : null}
    </section>
  );
}
