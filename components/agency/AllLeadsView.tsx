"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, Inbox, ListFilter, Search, SearchX } from "lucide-react";
import { format } from "date-fns";
import { ClientAvatar } from "@/components/ClientAvatar";
import { StatusPill } from "@/components/StatusPill";
import type { LeadSource } from "@/types";
import {
  filtersToSearchParams,
  type LeadFilters,
  type LeadListClient,
  type LeadListRow,
  type StatusCounts,
} from "@/lib/leads/all-leads";
import { isLeadSlow } from "@/lib/leadStatus";
import { formatCurrencyUsd, formatTimeAgo } from "@/lib/format";
import { Sheet } from "@/components/ui/Sheet";

type SalespersonOpt = { id: string; name: string; client_id: string | null };

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

function sourceLabel(s: LeadSource): string {
  if (s === "LANDING_PAGE") return "Landing";
  if (s === "FACEBOOK") return "Facebook";
  return "Manual";
}

function FilterPill({
  active,
  count,
  onClick,
  children,
  dotClass,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: ReactNode;
  dotClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
        active
          ? "border-ink-primary bg-ink-primary text-[var(--surface-canvas)]"
          : "border-border bg-transparent text-ink-secondary hover:bg-surface-card-alt"
      }`}
    >
      {dotClass ? <span className={`h-2 w-2 rounded-full ${dotClass}`} aria-hidden /> : null}
      {children}
      <span className="font-mono text-[11px] opacity-80">{count}</span>
    </button>
  );
}

function MultiDropdown({
  label,
  summary,
  children,
  onClear,
  onApply,
}: {
  label: string;
  summary: string;
  children: ReactNode;
  onClear: () => void;
  onApply: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn-ghost h-9 gap-1 px-3 text-[13px]"
      >
        {label}
        <span className="font-mono text-[11px] text-ink-tertiary">{summary}</span>
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 min-w-[220px] rounded-md border border-border bg-surface-card py-2 shadow-md">
          <div className="max-h-64 overflow-y-auto px-2">{children}</div>
          <div className="mt-2 flex justify-between gap-2 border-t border-border px-3 pt-2">
            <button type="button" className="text-xs text-ink-secondary hover:text-ink-primary" onClick={onClear}>
              Clear
            </button>
            <button type="button" className="text-xs font-medium text-ink-primary" onClick={() => { onApply(); setOpen(false); }}>
              Apply
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LastActivityCell({ row }: { row: LeadListRow }) {
  const sla = row.clients?.response_time_limit_hours ?? null;
  const hasCall = Boolean(row.last_call_at);
  const fu = row.follow_up_date;

  if (fu) {
    const d = new Date(fu);
    const label = !isNaN(d.getTime()) ? format(d, "MMM d") : fu;
    return (
      <div className="flex flex-wrap items-center gap-1">
        <span className="inline-flex items-center rounded-full bg-[var(--status-negotiating-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--status-negotiating-fg)]">
          Follow-up {label}
        </span>
      </div>
    );
  }

  if (hasCall && row.last_call_at) {
    return <span className="text-sm text-ink-secondary">Called {formatTimeAgo(row.last_call_at)}</span>;
  }

  const slow = isLeadSlow(row.status, row.created_at, sla);
  return (
    <div className="flex flex-col gap-1">
      <span className={`text-sm ${slow ? "text-[var(--status-lost-fg)]" : "text-ink-secondary"}`}>
        {formatTimeAgo(row.created_at)} since created
      </span>
      {slow ? (
        <span className="inline-flex w-fit rounded-full bg-[var(--status-lost-bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--status-lost-fg)]">
          Past SLA
        </span>
      ) : null}
    </div>
  );
}

const DEFAULT_FILTERS: Partial<LeadFilters> = {
  status: "all",
  clientIds: [],
  sources: [],
  assigneeIds: [],
  dateRange: "all",
  search: undefined,
  sortBy: "created_at",
  sortDir: "desc",
  page: 1,
};

function isDefaultFilters(f: LeadFilters): boolean {
  return (
    f.status === DEFAULT_FILTERS.status &&
    f.clientIds.length === 0 &&
    f.sources.length === 0 &&
    f.assigneeIds.length === 0 &&
    f.dateRange === "all" &&
    !(f.search?.trim()) &&
    f.sortBy === "created_at" &&
    f.sortDir === "desc" &&
    f.page === 1
  );
}

export function AllLeadsView({
  initialRows,
  totalCount,
  clients,
  salespeople,
  counts,
  filters,
  filterDescription,
}: {
  initialRows: LeadListRow[];
  totalCount: number;
  clients: LeadListClient[];
  salespeople: SalespersonOpt[];
  counts: StatusCounts;
  filters: LeadFilters;
  filterDescription: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const clientNameById = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients]);

  const filterKey = useMemo(() => filtersToSearchParams(filters).toString(), [filters]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filterKey]);

  const replaceUrl = useCallback(
    (next: LeadFilters) => {
      const p = filtersToSearchParams(next);
      const q = p.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  useEffect(() => {
    setSearchInput(filters.search ?? "");
  }, [filters.search]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const q = searchInput.trim();
      if (q === (filters.search ?? "")) return;
      replaceUrl({ ...filters, search: q || undefined, page: 1 });
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput, filters, replaceUrl]);

  const [draftClients, setDraftClients] = useState<string[]>(filters.clientIds);
  const [draftSources, setDraftSources] = useState<LeadSource[]>(filters.sources);
  const [draftAssignees, setDraftAssignees] = useState<string[]>(filters.assigneeIds);
  const [draftRange, setDraftRange] = useState<LeadFilters["dateRange"]>(filters.dateRange);
  const [draftFrom, setDraftFrom] = useState(filters.from ?? "");
  const [draftTo, setDraftTo] = useState(filters.to ?? "");

  useEffect(() => {
    setDraftClients(filters.clientIds);
    setDraftSources(filters.sources);
    setDraftAssignees(filters.assigneeIds);
    setDraftRange(filters.dateRange);
    setDraftFrom(filters.from ?? "");
    setDraftTo(filters.to ?? "");
  }, [filters]);

  const allSelected = initialRows.length > 0 && initialRows.every((r) => selectedIds.has(r.id));
  const someSelected = initialRows.some((r) => selectedIds.has(r.id));

  function toggleSelectAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(initialRows.map((r) => r.id)));
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function setStatus(s: LeadFilters["status"]) {
    replaceUrl({ ...filters, status: s, page: 1 });
  }

  function toggleSort(field: LeadFilters["sortBy"]) {
    if (filters.sortBy === field) {
      replaceUrl({ ...filters, sortDir: filters.sortDir === "asc" ? "desc" : "asc", page: 1 });
    } else {
      const defaultDir =
        field === "name" || field === "client" || field === "status" ? ("asc" as const) : ("desc" as const);
      replaceUrl({ ...filters, sortBy: field, sortDir: defaultDir, page: 1 });
    }
  }

  function clearAllFilters() {
    replaceUrl({
      ...filters,
      status: "all",
      clientIds: [],
      sources: [],
      assigneeIds: [],
      dateRange: "all",
      from: undefined,
      to: undefined,
      search: undefined,
      sortBy: "created_at",
      sortDir: "desc",
      page: 1,
    });
    setSearchInput("");
  }

  const hasActiveFilters = !isDefaultFilters(filters);

  const totalPages = Math.max(1, Math.ceil(totalCount / filters.pageSize));
  const startIndex = totalCount === 0 ? 0 : (filters.page - 1) * filters.pageSize + 1;
  const endIndex = Math.min(filters.page * filters.pageSize, totalCount);

  function exportHref(extra?: Record<string, string>) {
    const p = filtersToSearchParams(filters);
    if (extra) for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return `/api/leads/export?${p.toString()}`;
  }

  function handleExportCsv() {
    window.location.href = exportHref();
  }

  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignTo, setReassignTo] = useState("");
  const [reassignBusy, setReassignBusy] = useState(false);
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);

  async function handleBulkReassign() {
    if (!reassignTo || selectedIds.size === 0) return;
    setReassignBusy(true);
    try {
      const res = await fetch("/api/leads/bulk/reassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: Array.from(selectedIds), assigned_to_id: reassignTo }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(typeof j.error === "string" ? j.error : "Reassign failed");
        return;
      }
      setSelectedIds(new Set());
      setReassignOpen(false);
      router.refresh();
    } finally {
      setReassignBusy(false);
    }
  }

  function handleBulkExport() {
    if (selectedIds.size === 0) return;
    window.location.href = exportHref({ ids: Array.from(selectedIds).join(",") });
  }

  function openLead(id: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("lead", id);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }

  function SortableHeader({
    field,
    label,
    align = "left",
  }: {
    field: LeadFilters["sortBy"];
    label: string;
    align?: "left" | "right";
  }) {
    const active = filters.sortBy === field;
    return (
      <th
        className={`header-cell cursor-pointer select-none whitespace-nowrap py-3 text-[11px] font-mono uppercase tracking-wide text-ink-tertiary ${
          align === "right" ? "text-right" : "text-left"
        }`}
        onClick={() => toggleSort(field)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {active ? (filters.sortDir === "asc" ? "↑" : "↓") : null}
        </span>
      </th>
    );
  }

  const emptyFiltered = totalCount === 0 && hasActiveFilters;
  const emptyAll = totalCount === 0 && !hasActiveFilters;

  return (
    <div className="min-w-0 max-w-full pb-24">
      <header className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-tertiary">Agency / Leads</div>
            <h1 className="font-display text-3xl tracking-display text-ink-primary sm:text-4xl">All leads</h1>
            <p className="mt-2 break-words text-sm text-ink-secondary">
              {totalCount} {totalCount === 1 ? "lead" : "leads"} {filterDescription ? `· ${filterDescription}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleExportCsv}
              className="btn-secondary hidden h-9 items-center gap-2 px-3 text-[13px] md:inline-flex"
            >
              <Download className="h-4 w-4" strokeWidth={1.5} />
              Export CSV
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="btn-secondary flex h-11 w-11 items-center justify-center md:hidden"
              aria-label="Export CSV"
            >
              <Download className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      <div className="mb-3 flex min-w-0 gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] scrollbar-hide md:flex-wrap md:overflow-visible">
        <FilterPill active={filters.status === "all"} count={counts.total} onClick={() => setStatus("all")}>
          All
        </FilterPill>
        <FilterPill active={filters.status === "NEW"} count={counts.NEW} onClick={() => setStatus("NEW")} dotClass="bg-[var(--info)]">
          New
        </FilterPill>
        <FilterPill active={filters.status === "CONTACTED"} count={counts.CONTACTED} onClick={() => setStatus("CONTACTED")} dotClass="bg-[var(--success)]">
          Contacted
        </FilterPill>
        <FilterPill active={filters.status === "NEGOTIATING"} count={counts.NEGOTIATING} onClick={() => setStatus("NEGOTIATING")} dotClass="bg-amber-400">
          Negotiating
        </FilterPill>
        <FilterPill active={filters.status === "PROPOSAL_SENT"} count={counts.PROPOSAL_SENT} onClick={() => setStatus("PROPOSAL_SENT")} dotClass="bg-violet-500">
          Proposal
        </FilterPill>
        <FilterPill active={filters.status === "WON"} count={counts.WON} onClick={() => setStatus("WON")} dotClass="bg-lime-400">
          Won
        </FilterPill>
        <FilterPill active={filters.status === "LOST"} count={counts.LOST} onClick={() => setStatus("LOST")} dotClass="bg-ink-tertiary">
          Lost
        </FilterPill>
        <FilterPill active={filters.status === "NOT_QUALIFIED"} count={counts.NOT_QUALIFIED} onClick={() => setStatus("NOT_QUALIFIED")} dotClass="bg-ink-tertiary">
          Not qualified
        </FilterPill>
        <div className="mx-2 hidden w-px self-stretch bg-border sm:block" />
        <FilterPill active={filters.status === "uncontacted"} count={counts.uncontacted} onClick={() => setStatus("uncontacted")} dotClass="bg-[var(--status-lost-fg)]">
          Uncontacted
        </FilterPill>
      </div>

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-2">
        <button
          type="button"
          className="btn-ghost flex h-11 w-full shrink-0 items-center justify-center gap-2 px-3 text-[13px] md:hidden"
          onClick={() => setFiltersSheetOpen(true)}
        >
          <ListFilter className="h-4 w-4" strokeWidth={1.5} />
          Filters
        </button>

        <div className="hidden flex-wrap items-center gap-2 md:flex">
        <MultiDropdown
          label="Clients"
          summary={draftClients.length ? `${draftClients.length} selected` : "Any"}
          onClear={() => setDraftClients([])}
          onApply={() =>
            replaceUrl({
              ...filters,
              clientIds: draftClients,
              page: 1,
            })
          }
        >
          {clients.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2 px-1 py-1.5 text-[13px] hover:bg-surface-card-alt">
              <input
                type="checkbox"
                checked={draftClients.includes(c.id)}
                onChange={() =>
                  setDraftClients((prev) =>
                    prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                  )
                }
              />
              {c.name}
            </label>
          ))}
        </MultiDropdown>

        <MultiDropdown
          label="Source"
          summary={draftSources.length ? `${draftSources.length} selected` : "Any"}
          onClear={() => setDraftSources([])}
          onApply={() => replaceUrl({ ...filters, sources: draftSources, page: 1 })}
        >
          {(["FACEBOOK", "LANDING_PAGE", "MANUAL"] as const).map((s) => (
            <label key={s} className="flex cursor-pointer items-center gap-2 px-1 py-1.5 text-[13px] hover:bg-surface-card-alt">
              <input
                type="checkbox"
                checked={draftSources.includes(s)}
                onChange={() =>
                  setDraftSources((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
                }
              />
              {sourceLabel(s)}
            </label>
          ))}
        </MultiDropdown>

        <MultiDropdown
          label="Date"
          summary={
            draftRange === "all"
              ? "All time"
              : draftRange === "this_month"
                ? "This month"
                : draftRange === "last_month"
                  ? "Last month"
                  : draftRange === "90d"
                    ? "90d"
                    : "Custom"
          }
          onClear={() => {
            setDraftRange("all");
            setDraftFrom("");
            setDraftTo("");
          }}
          onApply={() =>
            replaceUrl({
              ...filters,
              dateRange: draftRange,
              from: draftRange === "custom" ? draftFrom || undefined : undefined,
              to: draftRange === "custom" ? draftTo || undefined : undefined,
              page: 1,
            })
          }
        >
          {(["all", "this_month", "last_month", "90d", "custom"] as const).map((r) => (
            <label key={r} className="flex cursor-pointer items-center gap-2 px-1 py-1.5 text-[13px] hover:bg-surface-card-alt">
              <input
                type="radio"
                name="dr"
                checked={draftRange === r}
                onChange={() => setDraftRange(r)}
              />
              {r === "all" ? "All time" : r === "this_month" ? "This month" : r === "last_month" ? "Last month" : r === "90d" ? "Last 90 days" : "Custom"}
            </label>
          ))}
          {draftRange === "custom" ? (
            <div className="mt-2 space-y-2 px-1">
              <input type="date" className="input-base h-8 w-full text-xs" value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)} />
              <input type="date" className="input-base h-8 w-full text-xs" value={draftTo} onChange={(e) => setDraftTo(e.target.value)} />
            </div>
          ) : null}
        </MultiDropdown>

        <MultiDropdown
          label="Assigned"
          summary={draftAssignees.length ? `${draftAssignees.length} selected` : "Any"}
          onClear={() => setDraftAssignees([])}
          onApply={() => replaceUrl({ ...filters, assigneeIds: draftAssignees, page: 1 })}
        >
          <label className="flex cursor-pointer items-center gap-2 px-1 py-1.5 text-[13px] hover:bg-surface-card-alt">
            <input
              type="checkbox"
              checked={draftAssignees.includes("__unassigned__")}
              onChange={() =>
                setDraftAssignees((prev) =>
                  prev.includes("__unassigned__") ? prev.filter((x) => x !== "__unassigned__") : [...prev, "__unassigned__"]
                )
              }
            />
            Unassigned
          </label>
          {salespeople.map((u) => (
            <label key={u.id} className="flex cursor-pointer items-center gap-2 px-1 py-1.5 text-[13px] hover:bg-surface-card-alt">
              <input
                type="checkbox"
                checked={draftAssignees.includes(u.id)}
                onChange={() =>
                  setDraftAssignees((prev) =>
                    prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id]
                  )
                }
              />
              {u.name}
            </label>
          ))}
        </MultiDropdown>
        </div>

        <div className="relative w-full min-w-0 md:ml-auto md:w-64 md:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" />
          <input
            type="search"
            inputMode="search"
            autoComplete="off"
            placeholder="Search by name, phone, email"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="input-base h-11 w-full pl-9 text-base md:h-9 md:text-sm"
          />
        </div>
      </div>

      <Sheet
        open={filtersSheetOpen}
        onClose={() => setFiltersSheetOpen(false)}
        title="Filters"
        footer={
          <div className="safe-bottom flex gap-2 p-4">
            <button
              type="button"
              className="btn-ghost h-11 flex-1 rounded-md border border-border text-sm"
              onClick={() => {
                setDraftClients([]);
                setDraftSources([]);
                setDraftAssignees([]);
                setDraftRange("all");
                setDraftFrom("");
                setDraftTo("");
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="btn-primary h-11 flex-1 text-sm"
              onClick={() => {
                replaceUrl({
                  ...filters,
                  clientIds: draftClients,
                  sources: draftSources,
                  assigneeIds: draftAssignees,
                  dateRange: draftRange,
                  from: draftRange === "custom" ? draftFrom || undefined : undefined,
                  to: draftRange === "custom" ? draftTo || undefined : undefined,
                  page: 1,
                });
                setFiltersSheetOpen(false);
              }}
            >
              Apply
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-6">
          <div>
            <div className="mb-2 font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">Clients</div>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {clients.map((c) => (
                <label key={c.id} className="flex min-h-11 cursor-pointer items-center gap-2 px-1 py-2 text-[13px] hover:bg-surface-card-alt">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border"
                    checked={draftClients.includes(c.id)}
                    onChange={() =>
                      setDraftClients((prev) =>
                        prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                      )
                    }
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">Source</div>
            <div className="space-y-1 rounded-md border border-border p-2">
              {(["FACEBOOK", "LANDING_PAGE", "MANUAL"] as const).map((s) => (
                <label key={s} className="flex min-h-11 cursor-pointer items-center gap-2 px-1 py-2 text-[13px] hover:bg-surface-card-alt">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border"
                    checked={draftSources.includes(s)}
                    onChange={() =>
                      setDraftSources((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
                    }
                  />
                  {sourceLabel(s)}
                </label>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">Date range</div>
            <div className="space-y-1 rounded-md border border-border p-2">
              {(["all", "this_month", "last_month", "90d", "custom"] as const).map((r) => (
                <label key={r} className="flex min-h-11 cursor-pointer items-center gap-2 px-1 py-2 text-[13px] hover:bg-surface-card-alt">
                  <input type="radio" name="sheet-dr" checked={draftRange === r} onChange={() => setDraftRange(r)} />
                  {r === "all"
                    ? "All time"
                    : r === "this_month"
                      ? "This month"
                      : r === "last_month"
                        ? "Last month"
                        : r === "90d"
                          ? "Last 90 days"
                          : "Custom"}
                </label>
              ))}
            </div>
            {draftRange === "custom" ? (
              <div className="mt-3 space-y-2">
                <input
                  type="date"
                  className="input-base h-11 w-full text-base"
                  value={draftFrom}
                  onChange={(e) => setDraftFrom(e.target.value)}
                />
                <input
                  type="date"
                  className="input-base h-11 w-full text-base"
                  value={draftTo}
                  onChange={(e) => setDraftTo(e.target.value)}
                />
              </div>
            ) : null}
          </div>
          <div>
            <div className="mb-2 font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">Assigned</div>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              <label className="flex min-h-11 cursor-pointer items-center gap-2 px-1 py-2 text-[13px] hover:bg-surface-card-alt">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border"
                  checked={draftAssignees.includes("__unassigned__")}
                  onChange={() =>
                    setDraftAssignees((prev) =>
                      prev.includes("__unassigned__") ? prev.filter((x) => x !== "__unassigned__") : [...prev, "__unassigned__"]
                    )
                  }
                />
                Unassigned
              </label>
              {salespeople.map((u) => (
                <label key={u.id} className="flex min-h-11 cursor-pointer items-center gap-2 px-1 py-2 text-[13px] hover:bg-surface-card-alt">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border"
                    checked={draftAssignees.includes(u.id)}
                    onChange={() =>
                      setDraftAssignees((prev) =>
                        prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id]
                      )
                    }
                  />
                  {u.name}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Sheet>

      {hasActiveFilters ? (
        <div className="mb-4 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <span className="text-xs text-ink-secondary">Active filters:</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {filters.clientIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="max-w-full truncate rounded-full border border-border bg-surface-card-alt px-2 py-0.5 text-left text-xs"
                  onClick={() => replaceUrl({ ...filters, clientIds: filters.clientIds.filter((c) => c !== id), page: 1 })}
                >
                  {clientNameById.get(id) ?? id} ×
                </button>
              ))}
              {filters.sources.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="rounded-full border border-border bg-surface-card-alt px-2 py-0.5 text-xs"
                  onClick={() => replaceUrl({ ...filters, sources: filters.sources.filter((x) => x !== s), page: 1 })}
                >
                  {sourceLabel(s)} ×
                </button>
              ))}
              {filters.assigneeIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="max-w-full truncate rounded-full border border-border bg-surface-card-alt px-2 py-0.5 text-left text-xs"
                  onClick={() => replaceUrl({ ...filters, assigneeIds: filters.assigneeIds.filter((x) => x !== id), page: 1 })}
                >
                  {id === "__unassigned__" ? "Unassigned" : salespeople.find((u) => u.id === id)?.name ?? id} ×
                </button>
              ))}
              {filters.search ? (
                <button
                  type="button"
                  className="max-w-full truncate rounded-full border border-border bg-surface-card-alt px-2 py-0.5 text-left text-xs"
                  onClick={() => {
                    setSearchInput("");
                    replaceUrl({ ...filters, search: undefined, page: 1 });
                  }}
                >
                  Search “{filters.search}” ×
                </button>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            className="shrink-0 self-start text-xs text-ink-secondary hover:text-ink-primary sm:pt-6 sm:text-right"
            onClick={clearAllFilters}
          >
            Clear all
          </button>
        </div>
      ) : null}

      {emptyFiltered ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <SearchX className="mb-4 h-10 w-10 text-ink-tertiary" strokeWidth={1.25} />
          <p className="font-medium text-ink-primary">No leads match your filters</p>
          <p className="mt-2 max-w-sm text-sm text-ink-secondary">Try adjusting your filters or clearing them.</p>
          <button type="button" className="btn-secondary mt-6 text-sm" onClick={clearAllFilters}>
            Clear filters
          </button>
        </div>
      ) : null}

      {emptyAll ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Inbox className="mb-4 h-10 w-10 text-ink-tertiary" strokeWidth={1.25} />
          <p className="font-medium text-ink-primary">No leads yet</p>
          <p className="mt-2 max-w-md text-sm text-ink-secondary">
            Leads appear here when they are captured from landing pages, Facebook, or created manually.
          </p>
        </div>
      ) : null}

      {!emptyFiltered && !emptyAll ? (
        <>
          <div className="space-y-2 lg:hidden">
            {initialRows.map((lead) => (
              <div
                key={lead.id}
                className="relative min-w-0 rounded-lg border border-border bg-surface-card"
              >
                <div
                  className="absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border"
                    checked={selectedIds.has(lead.id)}
                    onChange={() => toggleOne(lead.id)}
                    aria-label={`Select ${lead.name ?? "lead"}`}
                  />
                </div>
                <button
                  type="button"
                  className="w-full pl-12 pr-4 py-3 text-left active:bg-surface-card-alt"
                  onClick={() => openLead(lead.id)}
                >
                  <div className="break-words text-sm font-medium text-ink-primary">{lead.name || "—"}</div>
                  <div className="break-all font-mono text-xs text-ink-tertiary">{lead.phone || "—"}</div>
                  <div className="mt-2 flex min-w-0 items-center gap-2">
                    <ClientAvatar name={lead.clients?.name ?? "—"} size={20} src={lead.clients?.logo_url} />
                    <span className="min-w-0 truncate text-sm text-ink-secondary">{lead.clients?.name ?? "—"}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-x-3 gap-y-2 border-t border-border pt-3 sm:grid-cols-2">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">Source</div>
                      <div className="font-mono text-xs text-ink-primary">{sourceLabel(lead.source)}</div>
                    </div>
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">Budget</div>
                      <div className="font-mono text-sm text-ink-primary">{lead.budget || "—"}</div>
                    </div>
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">Status</div>
                      <div className="mt-0.5">
                        <StatusPill status={lead.status} />
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">Assigned</div>
                      <div className="mt-0.5 flex items-center gap-2">
                        {lead.assigned_to ? (
                          <>
                            <ClientAvatar name={lead.assigned_to.name} size={20} src={lead.assigned_to.avatar_url} />
                            <span className="text-sm">{firstName(lead.assigned_to.name)}</span>
                          </>
                        ) : (
                          <span className="text-xs text-ink-tertiary">Unassigned</span>
                        )}
                      </div>
                    </div>
                    <div className="col-span-full sm:col-span-2">
                      <div className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">Last activity</div>
                      <div className="mt-0.5 text-sm text-ink-secondary">
                        <LastActivityCell row={lead} />
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">Deal value</div>
                      <div className="font-mono text-sm tabular-nums text-ink-primary">
                        {lead.deal_value != null ? formatCurrencyUsd(lead.deal_value) : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">Created</div>
                      <div className="text-sm text-ink-secondary">{formatTimeAgo(lead.created_at)}</div>
                    </div>
                  </div>
                </button>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[960px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="w-10 py-3 pl-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected && !allSelected;
                      }}
                      onChange={toggleSelectAll}
                      aria-label="Select all on page"
                    />
                  </th>
                  <SortableHeader field="name" label="Name" />
                  <SortableHeader field="client" label="Client" />
                  <th className="header-cell py-3 text-[11px] font-mono uppercase tracking-wide text-ink-tertiary">Source</th>
                  <th className="header-cell py-3 text-[11px] font-mono uppercase tracking-wide text-ink-tertiary">Budget</th>
                  <th className="header-cell py-3 text-[11px] font-mono uppercase tracking-wide text-ink-tertiary">Status</th>
                  <th className="header-cell py-3 text-[11px] font-mono uppercase tracking-wide text-ink-tertiary">Assigned</th>
                  <SortableHeader field="last_activity" label="Last activity" />
                  <SortableHeader field="deal_value" label="Deal value" align="right" />
                  <SortableHeader field="created_at" label="Created" />
                </tr>
              </thead>
              <tbody>
                {initialRows.map((lead) => (
                  <tr
                    key={lead.id}
                    className="cursor-pointer border-b border-border hover:bg-surface-card-alt"
                    onClick={() => openLead(lead.id)}
                  >
                    <td className="py-3 pl-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border"
                        checked={selectedIds.has(lead.id)}
                        onChange={() => toggleOne(lead.id)}
                        aria-label={`Select ${lead.name ?? "lead"}`}
                      />
                    </td>
                    <td className="py-3">
                      <div className="text-sm font-medium text-ink-primary">{lead.name || "—"}</div>
                      <div className="font-mono text-xs text-ink-tertiary">{lead.phone || "—"}</div>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <ClientAvatar name={lead.clients?.name ?? "—"} size={20} src={lead.clients?.logo_url} />
                        <span className="text-sm">{lead.clients?.name ?? "—"}</span>
                      </div>
                    </td>
                    <td className="py-3 font-mono text-xs uppercase text-ink-secondary">{sourceLabel(lead.source)}</td>
                    <td className="py-3 font-mono text-sm text-ink-primary">{lead.budget || "—"}</td>
                    <td className="py-3">
                      <StatusPill status={lead.status} />
                    </td>
                    <td className="py-3">
                      {lead.assigned_to ? (
                        <div className="flex items-center gap-2">
                          <ClientAvatar name={lead.assigned_to.name} size={20} src={lead.assigned_to.avatar_url} />
                          <span className="text-sm">{firstName(lead.assigned_to.name)}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-ink-tertiary">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3">
                      <LastActivityCell row={lead} />
                    </td>
                    <td className="py-3 text-right font-mono text-sm tabular-nums text-ink-primary">
                      {lead.deal_value != null ? formatCurrencyUsd(lead.deal_value) : "—"}
                    </td>
                    <td className="py-3 text-sm text-ink-secondary">{formatTimeAgo(lead.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {!emptyFiltered && !emptyAll ? (
        <div className="mt-6 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
          <span className="text-sm text-ink-secondary">
            Showing {startIndex}–{endIndex} of {totalCount}
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={filters.page <= 1}
              className="btn-ghost text-sm disabled:opacity-40"
              onClick={() => replaceUrl({ ...filters, page: Math.max(1, filters.page - 1) })}
            >
              ← Prev
            </button>
            <span className="font-mono text-sm text-ink-secondary">
              Page {filters.page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={filters.page >= totalPages}
              className="btn-ghost text-sm disabled:opacity-40"
              onClick={() => replaceUrl({ ...filters, page: filters.page + 1 })}
            >
              Next →
            </button>
          </div>
        </div>
      ) : null}

      {selectedIds.size > 0 ? (
        <div className="safe-bottom fixed bottom-20 left-1/2 z-40 flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 flex-col items-stretch gap-2 rounded-2xl border border-border bg-surface-sidebar px-4 py-3 text-[var(--text-on-dark)] shadow-lg layout:bottom-6 sm:w-auto sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-3 sm:rounded-full sm:px-5">
          <span className="text-center text-sm sm:text-left">{selectedIds.size} selected</span>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <button type="button" className="min-h-11 flex-1 rounded-md px-3 text-sm hover:bg-white/10 sm:min-h-0 sm:flex-none" onClick={() => setReassignOpen(true)}>
              Reassign
            </button>
            <button type="button" className="min-h-11 flex-1 rounded-md px-3 text-sm hover:bg-white/10 sm:min-h-0 sm:flex-none" onClick={handleBulkExport}>
              Export selected
            </button>
            <button
              type="button"
              className="w-full text-xs text-[var(--text-on-dark-dim)] hover:text-[var(--text-on-dark)] sm:w-auto"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}

      {reassignOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-surface-overlay md:items-center md:justify-center md:px-4 md:py-8">
          <div className="flex h-full w-full flex-col border-border bg-surface-card md:h-auto md:max-h-[min(90vh,640px)] md:max-w-md md:rounded-lg md:border md:shadow-md">
            <div className="border-b border-border p-5 md:p-6">
            <h2 className="font-display text-lg text-ink-primary">Reassign {selectedIds.size} leads</h2>
            <p className="mt-2 text-sm text-ink-secondary">Choose an active salesperson. Each lead must belong to the same client as that salesperson.</p>
            <select className="input-base mt-4 h-11 w-full text-base md:h-10 md:text-sm" value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
              <option value="">Select…</option>
              {salespeople.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.client_id ? ` · ${clientNameById.get(u.client_id) ?? ""}` : ""}
                </option>
              ))}
            </select>
            </div>
            <div className="safe-bottom mt-auto flex justify-end gap-2 border-t border-border p-4 md:mt-6 md:border-t-0 md:p-6 md:pt-0">
              <button type="button" className="btn-ghost h-11 flex-1 text-sm md:h-9 md:flex-none" onClick={() => setReassignOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary h-11 flex-1 text-sm md:h-9 md:flex-none"
                disabled={!reassignTo || reassignBusy}
                onClick={() => void handleBulkReassign()}
              >
                {reassignBusy ? "Saving…" : "Apply"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
