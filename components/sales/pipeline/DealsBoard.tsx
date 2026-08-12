"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import {
  ChevronDown,
  Filter,
  Inbox,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { EmptyState, SegmentedControl, useSalesToast } from "@/components/sales/ui";
import {
  PipelineDealCard,
  type PipelineDealCardItem,
} from "@/components/sales/pipeline/PipelineDealCard";
import { DealDetailDrawer } from "@/components/sales/deals/DealDetailDrawer";
import {
  DEAL_ACTIVE_STAGES,
  DEAL_STAGE_ACCENT,
  DEAL_STAGE_LABEL,
  compareDealsByAttention,
  formatDealStage,
  getDealAttentionState,
  isDealActiveStage,
  isDealClosedStage,
  type DealActiveStage,
} from "@/lib/sales/deals";
import { formatLeadSource } from "@/lib/sales/leads-directory/format";
import type { DealRow } from "@/types";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { cn } from "@/lib/ui/cn";

export type DealBoardItem = PipelineDealCardItem;

const COLS = DEAL_ACTIVE_STAGES;
const INITIAL_VISIBLE = 6;

type ViewMode = "board" | "picks";
type ClosedFilter = "all" | "won" | "lost";

type BoardFilters = {
  stages: DealActiveStage[];
  atRisk: boolean;
  noNextAction: boolean;
  sources: string[];
  hasQuote: "any" | "yes" | "no";
};

const EMPTY_FILTERS: BoardFilters = {
  stages: [],
  atRisk: false,
  noNextAction: false,
  sources: [],
  hasQuote: "any",
};

function matchesSearch(item: DealBoardItem, q: string): boolean {
  const hay = [
    item.customerName,
    item.customerPhone,
    item.customerCompany,
    item.deal.name,
    item.deal.service_summary,
    item.deal.location,
    item.latestQuote?.quote_number,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function parseStageParam(raw: string | null): DealActiveStage | null {
  if (!raw) return null;
  return isDealActiveStage(raw) ? raw : null;
}

function filtersActive(f: BoardFilters): boolean {
  return (
    f.stages.length > 0 ||
    f.atRisk ||
    f.noNextAction ||
    f.sources.length > 0 ||
    f.hasQuote !== "any"
  );
}

function applyFilters(item: DealBoardItem, f: BoardFilters, now: Date): boolean {
  if (f.stages.length && !f.stages.includes(item.deal.stage as DealActiveStage)) {
    return false;
  }
  const att = getDealAttentionState(item.deal, now);
  if (f.atRisk && !att.atRisk) return false;
  if (f.noNextAction && item.deal.next_action_at) return false;
  if (f.sources.length) {
    const key = formatLeadSource(item.leadSource).key;
    if (!f.sources.includes(key)) return false;
  }
  if (f.hasQuote === "yes" && item.quoteCount === 0) return false;
  if (f.hasQuote === "no" && item.quoteCount > 0) return false;
  return true;
}

export function DealsBoard({
  initialItems,
  initialTab = "active",
  initialStage = null,
  repName = "",
}: {
  initialItems: DealBoardItem[];
  initialTab?: "active" | "closed";
  initialStage?: DealActiveStage | null;
  repName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useSalesToast();
  const stageFromUrl = parseStageParam(searchParams.get("stage")) ?? initialStage;
  const dealFromUrl = searchParams.get("deal");
  const isNarrow = useMediaQuery("(max-width: 900px)");
  const isMobileDrawer = useMediaQuery("(max-width: 767px)");

  const [items, setItems] = useState(initialItems);
  const [tab, setTab] = useState<"active" | "closed">(initialTab);
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filters, setFilters] = useState<BoardFilters>(() =>
    stageFromUrl
      ? { ...EMPTY_FILTERS, stages: [stageFromUrl] }
      : EMPTY_FILTERS
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const [closedFilter, setClosedFilter] = useState<ClosedFilter>("all");
  const [mobileCol, setMobileCol] = useState<DealActiveStage>(stageFromUrl ?? "QUALIFIED");
  const [selectedDealId, setSelectedDealId] = useState<string | null>(dealFromUrl);
  const [visibleByCol, setVisibleByCol] = useState<Record<DealActiveStage, number>>({
    QUALIFIED: INITIAL_VISIBLE,
    SCOPING: INITIAL_VISIBLE,
    PROPOSAL_SENT: INITIAL_VISIBLE,
    NEGOTIATING: INITIAL_VISIBLE,
  });

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 280);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const next = parseStageParam(searchParams.get("stage"));
    if (next) {
      setFilters((f) => ({ ...f, stages: [next] }));
      setMobileCol(next);
      setTab("active");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!dealFromUrl) return;
    if (!items.some((it) => it.deal.id === dealFromUrl)) return;
    setSelectedDealId(dealFromUrl);
  }, [dealFromUrl, items]);

  const setDealQuery = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set("deal", id);
      else params.delete("deal");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const openDeal = useCallback(
    (id: string) => {
      setSelectedDealId(id);
      setDealQuery(id);
    },
    [setDealQuery]
  );

  const closeDeal = useCallback(() => {
    setSelectedDealId(null);
    setDealQuery(null);
  }, [setDealQuery]);

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("stage");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const filtered = useMemo(() => {
    const now = new Date();
    return items.filter((it) => {
      const closed = isDealClosedStage(it.deal.stage);
      if (tab === "active" && closed) return false;
      if (tab === "closed" && !closed) return false;
      if (tab === "closed") {
        if (closedFilter === "won" && it.deal.stage !== "WON") return false;
        if (closedFilter === "lost" && it.deal.stage !== "LOST") return false;
      }
      if (tab === "active" && !applyFilters(it, filters, now)) return false;
      if (debouncedQuery && !matchesSearch(it, debouncedQuery)) return false;
      return true;
    });
  }, [items, tab, debouncedQuery, filters, closedFilter]);

  const enrichedActive = useMemo(() => {
    const now = new Date();
    return filtered
      .filter((it) => isDealActiveStage(it.deal.stage))
      .map((it) => {
        const att = getDealAttentionState(it.deal, now);
        return { item: it, urgency: att.urgency, att };
      })
      .sort((a, b) =>
        compareDealsByAttention(
          { deal: a.item.deal, urgency: a.urgency },
          { deal: b.item.deal, urgency: b.urgency }
        )
      );
  }, [filtered]);

  const byColumn = useMemo(() => {
    const map: Record<DealActiveStage, typeof enrichedActive> = {
      QUALIFIED: [],
      SCOPING: [],
      PROPOSAL_SENT: [],
      NEGOTIATING: [],
    };
    for (const row of enrichedActive) {
      map[row.item.deal.stage as DealActiveStage].push(row);
    }
    return map;
  }, [enrichedActive]);

  const picks = useMemo(
    () =>
      enrichedActive.filter(
        (r) => r.att.needsAttention && (r.att.atRisk || r.urgency >= 50 || r.att.badge)
      ),
    [enrichedActive]
  );

  const closedItems = useMemo(
    () => filtered.filter((it) => isDealClosedStage(it.deal.stage)),
    [filtered]
  );

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    for (const s of filters.stages) {
      chips.push({
        key: `stage-${s}`,
        label: DEAL_STAGE_LABEL[s],
        clear: () =>
          setFilters((f) => ({ ...f, stages: f.stages.filter((x) => x !== s) })),
      });
    }
    if (filters.atRisk) {
      chips.push({
        key: "at-risk",
        label: "At Risk",
        clear: () => setFilters((f) => ({ ...f, atRisk: false })),
      });
    }
    if (filters.noNextAction) {
      chips.push({
        key: "no-next",
        label: "No Next Action",
        clear: () => setFilters((f) => ({ ...f, noNextAction: false })),
      });
    }
    for (const src of filters.sources) {
      chips.push({
        key: `src-${src}`,
        label: src.charAt(0).toUpperCase() + src.slice(1),
        clear: () =>
          setFilters((f) => ({
            ...f,
            sources: f.sources.filter((x) => x !== src),
          })),
      });
    }
    if (filters.hasQuote === "yes") {
      chips.push({
        key: "quote-yes",
        label: "Has Quote",
        clear: () => setFilters((f) => ({ ...f, hasQuote: "any" })),
      });
    }
    if (filters.hasQuote === "no") {
      chips.push({
        key: "quote-no",
        label: "No Quote",
        clear: () => setFilters((f) => ({ ...f, hasQuote: "any" })),
      });
    }
    return chips;
  }, [filters]);

  const onMoved = useCallback((deal: DealRow) => {
    setItems((prev) =>
      prev.map((it) => (it.deal.id === deal.id ? { ...it, deal } : it))
    );
  }, []);

  const onDragEnd = useCallback(
    async (result: DropResult) => {
      if (!result.destination) return;
      const from = result.source.droppableId as DealActiveStage;
      const to = result.destination.droppableId as DealActiveStage;
      if (from === to) return;
      const dealId = result.draggableId;
      const prev = items;
      setItems((cur) =>
        cur.map((it) =>
          it.deal.id === dealId ? { ...it, deal: { ...it.deal, stage: to } } : it
        )
      );
      const res = await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: to }),
      });
      if (!res.ok) {
        setItems(prev);
        toast({
          tone: "error",
          title: "We couldn't move this Deal. Try again.",
        });
        return;
      }
      const json = (await res.json().catch(() => ({}))) as { deal?: DealRow };
      if (json.deal) onMoved(json.deal);
    },
    [items, onMoved, toast]
  );

  const selectedSeed = useMemo(() => {
    if (!selectedDealId) return null;
    const it = items.find((x) => x.deal.id === selectedDealId);
    if (!it) return null;
    return {
      deal: it.deal,
      customerName: it.customerName,
      customerPhone: it.customerPhone,
      customerCompany: it.customerCompany,
      leadSource: it.leadSource,
      leadScore: it.leadScore,
      commercial: it.commercial,
    };
  }, [selectedDealId, items]);

  // Close drawer when switching to closed if selected deal no longer in set
  useEffect(() => {
    if (!selectedDealId) return;
    const still = filtered.some((it) => it.deal.id === selectedDealId);
    if (!still && tab === "closed") {
      closeDeal();
    }
  }, [tab, filtered, selectedDealId, closeDeal]);

  const drawerOpen = Boolean(selectedDealId);
  // Reserve space for the docked right sidebar so the board stays usable beside it.
  const boardPad = drawerOpen && !isMobileDrawer ? "pr-[400px]" : "";

  const hasActiveDeals = items.some((it) => isDealActiveStage(it.deal.stage));
  const searchNoMatch =
    Boolean(debouncedQuery) && filtered.length === 0 && hasActiveDeals && tab === "active";
  const filterNoMatch =
    !debouncedQuery &&
    filtersActive(filters) &&
    filtered.length === 0 &&
    hasActiveDeals &&
    tab === "active";

  const toolbar = (
    <div className="mb-5 flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-end gap-0 border-b border-sales-border">
          {(
            [
              { value: "active", label: "Active" },
              { value: "closed", label: "Closed" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setTab(opt.value);
                if (opt.value === "closed") setViewMode("board");
              }}
              className={cn(
                "relative -mb-px min-h-9 px-3 pb-2.5 text-[13px] font-semibold transition-colors",
                tab === opt.value
                  ? "text-sales-text-primary"
                  : "text-sales-text-secondary hover:text-sales-text-primary"
              )}
            >
              {opt.label}
              {tab === opt.value ? (
                <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-sales-brand" />
              ) : null}
            </button>
          ))}
        </div>

        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          {tab === "active" ? (
            <SegmentedControl
              aria-label="Board view"
              value={viewMode}
              onChange={(v) => setViewMode(v as ViewMode)}
              options={[
                { value: "board", label: "Board" },
                {
                  value: "picks",
                  label: "Picks",
                  badge: picks.length > 0 ? picks.length : undefined,
                },
              ]}
            />
          ) : (
            <SegmentedControl
              aria-label="Closed filter"
              value={closedFilter}
              onChange={(v) => setClosedFilter(v as ClosedFilter)}
              options={[
                { value: "all", label: "All" },
                { value: "won", label: "Won" },
                { value: "lost", label: "Lost" },
              ]}
            />
          )}

          <label className="relative block min-w-0 flex-1 sm:max-w-[min(100%,17rem)]">
            <span className="sr-only">Search deals</span>
            <Search
              size={15}
              strokeWidth={1.8}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sales-text-muted"
              aria-hidden
            />
            <input
              type="search"
              placeholder="Search Deals, customers..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 w-full rounded-[10px] border border-sales-border bg-sales-surface py-2 pl-9 pr-3 text-[13px] text-sales-text-primary outline-none transition-[border-color,box-shadow] placeholder:text-sales-text-muted focus:border-sales-border-strong focus:ring-2 focus:ring-sales-brand/40"
              aria-label="Search deals"
            />
          </label>

          {tab === "active" ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setFilterOpen((v) => !v)}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-[10px] border px-3 text-[13px] font-medium transition-colors",
                  filtersActive(filters)
                    ? "border-sales-brand-border bg-sales-brand-soft text-sales-text-primary"
                    : "border-sales-border bg-sales-surface text-sales-text-label hover:border-sales-border-strong hover:bg-sales-surface-hover"
                )}
              >
                <Filter className="h-3.5 w-3.5" strokeWidth={1.8} />
                Filter & search
                <ChevronDown className="h-3.5 w-3.5 text-sales-text-muted" />
              </button>
              {filterOpen ? (
                <div className="absolute right-0 z-30 mt-1.5 w-[min(100vw-2rem,20rem)] rounded-sales-lg border border-sales-border bg-sales-surface-raised p-3.5 shadow-sales-popover">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
                    Stage
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {COLS.map((s) => {
                      const on = filters.stages.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() =>
                            setFilters((f) => ({
                              ...f,
                              stages: on
                                ? f.stages.filter((x) => x !== s)
                                : [...f.stages, s],
                            }))
                          }
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                            on
                              ? "bg-sales-neutral-900 text-white dark:bg-sales-brand dark:text-sales-brand-text"
                              : "bg-sales-neutral-100 text-sales-text-secondary hover:bg-sales-surface-hover"
                          )}
                        >
                          {DEAL_STAGE_LABEL[s]}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-3.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
                    Attention
                  </p>
                  <div className="mt-2 space-y-2">
                    <label className="flex items-center gap-2 text-[12px] text-sales-text-primary">
                      <input
                        type="checkbox"
                        className="rounded border-sales-border-strong"
                        checked={filters.atRisk}
                        onChange={(e) =>
                          setFilters((f) => ({ ...f, atRisk: e.target.checked }))
                        }
                      />
                      At Risk
                    </label>
                    <label className="flex items-center gap-2 text-[12px] text-sales-text-primary">
                      <input
                        type="checkbox"
                        className="rounded border-sales-border-strong"
                        checked={filters.noNextAction}
                        onChange={(e) =>
                          setFilters((f) => ({
                            ...f,
                            noNextAction: e.target.checked,
                          }))
                        }
                      />
                      No Next Action
                    </label>
                  </div>
                  <p className="mt-3.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
                    Quote status
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(
                      [
                        { v: "any", l: "Any" },
                        { v: "yes", l: "Has Quote" },
                        { v: "no", l: "No Quote" },
                      ] as const
                    ).map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() => setFilters((f) => ({ ...f, hasQuote: o.v }))}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                          filters.hasQuote === o.v
                            ? "bg-sales-neutral-900 text-white dark:bg-sales-brand dark:text-sales-brand-text"
                            : "bg-sales-neutral-100 text-sales-text-secondary"
                        )}
                      >
                        {o.l}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3.5 flex justify-between gap-2 border-t border-sales-border pt-3">
                    <button
                      type="button"
                      className="text-[12px] font-medium text-sales-text-secondary hover:text-sales-text-primary"
                      onClick={() => {
                        clearFilters();
                        setFilterOpen(false);
                      }}
                    >
                      Clear all
                    </button>
                    <button
                      type="button"
                      className="rounded-sales-sm bg-sales-neutral-900 px-3 py-1.5 text-[12px] font-semibold text-white dark:bg-sales-brand dark:text-sales-brand-text"
                      onClick={() => setFilterOpen(false)}
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {activeFilterChips.length > 0 && tab === "active" ? (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilterChips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={c.clear}
              className="inline-flex items-center gap-1 rounded-full border border-sales-border bg-sales-surface px-2.5 py-1 text-[11px] font-medium text-sales-text-label hover:border-sales-border-strong"
            >
              {c.label}
              <X className="h-3 w-3 text-sales-text-muted" />
            </button>
          ))}
          <button
            type="button"
            onClick={clearFilters}
            className="text-[11px] font-semibold text-sales-text-secondary hover:text-sales-text-primary"
          >
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  );

  function renderCard(it: DealBoardItem, dragProps?: Record<string, unknown>) {
    return (
      <div {...dragProps}>
        <PipelineDealCard
          item={it}
          compact={isNarrow}
          selected={selectedDealId === it.deal.id}
          repName={repName}
          onOpen={openDeal}
          onMoved={onMoved}
          onSchedule={(id) => router.push(`/sales/calendar?deal=${id}`)}
        />
      </div>
    );
  }

  const drawer = (
    <DealDetailDrawer
      dealId={selectedDealId}
      open={drawerOpen}
      seed={selectedSeed}
      repName={repName}
      onClose={closeDeal}
      onDealUpdated={onMoved}
    />
  );

  if (tab === "closed") {
    return (
      <div className={cn("relative w-full min-w-0 transition-[padding] duration-200", boardPad)}>
        {toolbar}
        {closedItems.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-4 w-4" strokeWidth={1.5} />}
            title={
              debouncedQuery
                ? `No Deals match “${query.trim()}”`
                : "No closed Deals yet"
            }
            description={
              debouncedQuery
                ? "Try another name, phone, or Quote number."
                : "Deals you Win or Lose will appear here."
            }
            action={
              debouncedQuery ? (
                <button
                  type="button"
                  className="text-[13px] font-medium text-sales-info-fg"
                  onClick={() => setQuery("")}
                >
                  Clear search
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-hidden rounded-sales-lg border border-sales-border bg-sales-surface shadow-sales-card">
            <ul className="divide-y divide-sales-border">
              {closedItems.map((it) => (
                <li key={it.deal.id}>
                  <button
                    type="button"
                    onClick={() => openDeal(it.deal.id)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-sales-surface-hover"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-sales-text-primary">
                        {it.deal.name}
                      </p>
                      <p className="truncate text-[12px] text-sales-text-secondary">
                        {it.customerName || "Customer"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span
                        className={cn(
                          "inline-flex rounded-sales-xs px-2 py-0.5 text-[11px] font-medium",
                          it.deal.stage === "WON"
                            ? "bg-sales-success-soft text-sales-success-fg"
                            : "bg-sales-danger-soft text-sales-danger-fg"
                        )}
                      >
                        {formatDealStage(it.deal.stage)}
                      </span>
                      <p className="mt-1 text-[12px] tabular-nums text-sales-text-secondary">
                        {it.commercial.display}
                      </p>
                      {it.deal.stage === "LOST" && it.deal.lost_reason ? (
                        <p className="mt-0.5 max-w-[10rem] truncate text-[11px] text-sales-text-muted">
                          {it.deal.lost_reason}
                        </p>
                      ) : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {drawer}
      </div>
    );
  }

  if (viewMode === "picks") {
    return (
      <div className={cn("relative w-full min-w-0 transition-[padding] duration-200", boardPad)}>
        {toolbar}
        {picks.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-4 w-4" strokeWidth={1.5} />}
            title="No priority Deals need attention right now."
            description="Your active Deals have clear next actions."
          />
        ) : (
          <ul className="space-y-2.5">
            {picks.map(({ item: it, att }) => (
              <li key={it.deal.id}>
                <button
                  type="button"
                  onClick={() => openDeal(it.deal.id)}
                  className={cn(
                    "w-full rounded-[12px] border border-sales-border bg-sales-surface p-4 text-left shadow-sales-card transition-[border-color,box-shadow] hover:border-sales-border-strong hover:shadow-sales-card-hover",
                    selectedDealId === it.deal.id &&
                      "border-sales-brand-border bg-sales-brand-soft"
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-sales-text-primary">
                        {it.deal.name}
                        {it.customerName ? (
                          <span className="font-medium text-sales-text-secondary">
                            {" "}
                            — {it.customerName}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-[12px] text-sales-text-secondary">
                        {formatDealStage(it.deal.stage)}
                        {" · "}
                        <span className="font-semibold tabular-nums text-sales-text-primary">
                          {it.commercial.kind === "pending"
                            ? "Value pending"
                            : it.commercial.display}
                        </span>
                      </p>
                      <p
                        className="mt-1 text-[12px] text-sales-text-secondary"
                        data-course-target="pipeline-next-action"
                      >
                        {it.deal.next_action_at
                          ? `${it.deal.next_action_label || "Follow up"} · ${new Date(
                              it.deal.next_action_at
                            ).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}`
                          : "No next action scheduled"}
                      </p>
                    </div>
                    {att.badge ? (
                      <span className="rounded-sales-xs bg-sales-danger-soft px-2 py-0.5 text-[11px] font-medium text-sales-danger-fg">
                        {att.badge}
                      </span>
                    ) : null}
                  </div>
                  {att.reason ? (
                    <div className="mt-3 rounded-sales-md bg-sales-surface-subtle px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
                        Why now
                      </p>
                      <p className="mt-0.5 text-[12px] text-sales-text-label">{att.reason}</p>
                    </div>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
        {drawer}
      </div>
    );
  }

  if (searchNoMatch || filterNoMatch || enrichedActive.length === 0) {
    return (
      <div className={cn("relative w-full min-w-0", boardPad)}>
        {toolbar}
        <EmptyState
          icon={<Inbox className="h-4 w-4" strokeWidth={1.5} />}
          title={
            searchNoMatch
              ? `No Deals match “${query.trim()}”`
              : filterNoMatch
                ? "No Deals match these filters."
                : "No active Deals yet"
          }
          description={
            searchNoMatch || filterNoMatch
              ? "Adjust your search or filters to see more Deals."
              : "Qualified opportunities will appear here once you create a Deal from a Lead."
          }
          action={
            searchNoMatch ? (
              <button
                type="button"
                className="text-[13px] font-medium text-sales-info-fg"
                onClick={() => setQuery("")}
              >
                Clear search
              </button>
            ) : filterNoMatch ? (
              <button
                type="button"
                className="text-[13px] font-medium text-sales-info-fg"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            ) : (
              <Link
                href="/sales/call-now"
                className="inline-flex min-h-11 items-center rounded-sales-md bg-sales-neutral-900 px-4 text-[13px] font-semibold text-white dark:bg-sales-brand dark:text-sales-brand-text"
              >
                View Leads
              </Link>
            )
          }
        />
        {drawer}
      </div>
    );
  }

  if (isNarrow) {
    return (
      <div className={cn("relative w-full min-w-0", boardPad)}>
        {toolbar}
        <div className="space-y-3" data-course-target="pipeline-board">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {COLS.map((col) => (
              <button
                key={col}
                type="button"
                data-course-target={`pipeline-stage-${col.toLowerCase().replace(/_/g, "-")}`}
                onClick={() => setMobileCol(col)}
                className={cn(
                  "min-h-10 shrink-0 rounded-full px-3 text-[12px] font-medium transition-colors",
                  mobileCol === col
                    ? "bg-sales-brand-soft text-sales-text-primary ring-1 ring-sales-brand-border"
                    : "border border-sales-border bg-sales-surface text-sales-text-secondary"
                )}
              >
                {DEAL_STAGE_LABEL[col]} · {byColumn[col].length}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {byColumn[mobileCol].length === 0 ? (
              <p className="py-8 text-center text-[13px] text-sales-text-muted">
                No Deals in {DEAL_STAGE_LABEL[mobileCol]}.
              </p>
            ) : (
              byColumn[mobileCol].map(({ item: it }) => (
                <div key={it.deal.id}>{renderCard(it)}</div>
              ))
            )}
          </div>
        </div>
        {drawer}
      </div>
    );
  }

  return (
    <div className={cn("relative w-full min-w-0 transition-[padding] duration-200", boardPad)}>
      {toolbar}
      <DragDropContext onDragEnd={(r) => void onDragEnd(r)}>
        <div className="grid grid-cols-4 gap-3" data-course-target="pipeline-board">
          {COLS.map((col) => {
            const rows = byColumn[col];
            const visible = visibleByCol[col];
            const shown = rows.slice(0, visible);
            const remaining = Math.max(0, rows.length - shown.length);
            return (
              <div
                key={col}
                className="min-w-0"
                data-course-target={`pipeline-stage-${col.toLowerCase().replace(/_/g, "-")}`}
              >
                <div
                  className="mb-2.5 flex items-center justify-between gap-2 border-t-[2px] px-0.5 pt-2"
                  style={{ borderColor: DEAL_STAGE_ACCENT[col] }}
                >
                  <div className="flex items-center gap-2">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-secondary">
                      {DEAL_STAGE_LABEL[col]}
                    </h3>
                    <span className="rounded-sales-xs bg-sales-neutral-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-sales-text-label">
                      {rows.length}
                    </span>
                  </div>
                </div>
                <Droppable droppableId={col}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "min-h-[12rem] space-y-2.5 rounded-sales-md p-0.5 transition-colors duration-150",
                        snapshot.isDraggingOver && "bg-sales-brand-soft/40 ring-1 ring-sales-brand-border/40"
                      )}
                    >
                      {shown.length === 0 ? (
                        <p className="px-2 py-6 text-center text-[12px] text-sales-text-muted">
                          No Deals in {DEAL_STAGE_LABEL[col]}.
                        </p>
                      ) : null}
                      {shown.map(({ item: it }, index) => (
                        <Draggable key={it.deal.id} draggableId={it.deal.id} index={index}>
                          {(drag, dragSnap) => (
                            <div
                              ref={drag.innerRef}
                              {...drag.draggableProps}
                              {...drag.dragHandleProps}
                              className={cn(
                                dragSnap.isDragging && "shadow-sales-popover"
                              )}
                            >
                              <PipelineDealCard
                                item={it}
                                selected={selectedDealId === it.deal.id}
                                repName={repName}
                                onOpen={openDeal}
                                onMoved={onMoved}
                                onSchedule={(id) =>
                                  router.push(`/sales/calendar?deal=${id}`)
                                }
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {remaining > 0 ? (
                        <button
                          type="button"
                          className="w-full rounded-sales-md py-2 text-center text-[12px] font-semibold text-sales-text-secondary hover:bg-sales-surface-hover hover:text-sales-text-primary"
                          onClick={() =>
                            setVisibleByCol((v) => ({
                              ...v,
                              [col]: v[col] + INITIAL_VISIBLE,
                            }))
                          }
                        >
                          +{remaining} more Deal{remaining === 1 ? "" : "s"}
                        </button>
                      ) : null}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
      {drawer}
    </div>
  );
}
