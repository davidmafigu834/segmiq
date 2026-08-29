"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CircleX,
  Columns3,
  Download,
  ExternalLink,
  History,
  ListFilter,
  MoreVertical,
  TrendingUp,
  Trophy,
} from "lucide-react";
import {
  Avatar,
  Button,
  Card,
  CardContent,
  DataTable,
  DataTableBody,
  DataTableEl,
  DataTableEmpty,
  DataTableHead,
  DataTableRow,
  DataTableTd,
  DataTableTh,
  EmptyState,
  IconButton,
  MenuSelect,
  PipelineStageBadge,
  SearchInput,
  SegmentedControl,
  Skeleton,
} from "@/components/sales/ui";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { ReportKpiCard } from "@/components/sales/reports/ReportKpiCard";
import { WinLossTrendChart } from "@/components/sales/won-lost/WinLossTrendChart";
import { OutcomeReasonsCard } from "@/components/sales/won-lost/OutcomeReasonsCard";
import { LeadDetailPanel } from "@/app/sales/leads/LeadDetailPanel";
import { openLeadPanel } from "@/store/uiStore";
import { formatDealCurrency } from "@/lib/sales/format";
import {
  buildWonLostCsv,
  dealMatchesSearch,
  formatCloseDate,
  formatOutcomeReason,
  WON_LOST_PERIODS,
  WON_LOST_SOURCES,
  type ClosedDealRow,
  type OutcomeTab,
  type WonLostGranularity,
  type WonLostPayload,
  type WonLostPeriodId,
  type WonLostSourceFilter,
} from "@/lib/sales/outcomes";
import type { LeadRow } from "@/types";
import { cn } from "@/lib/ui/cn";

const PAGE_SIZES = [10, 20, 50] as const;

function formatValueDisplay(
  value: number | null | undefined,
  currency: string
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return formatDealCurrency(value, { currency });
}

function toPanelLead(d: ClosedDealRow): LeadRow {
  const allowed: LeadRow["source"][] = [
    "LANDING_PAGE",
    "FACEBOOK",
    "MANUAL",
    "REFERRAL",
    "WHATSAPP_INBOUND",
    "WEBSITE",
    "FACEBOOK_AD",
  ];
  const raw = (d.source ?? "MANUAL").toUpperCase();
  const source = (allowed.includes(raw as LeadRow["source"]) ? raw : "MANUAL") as LeadRow["source"];
  return {
    id: d.id,
    client_id: d.clientId,
    assigned_to_id: null,
    contact_id: d.contactId,
    source,
    status: d.status,
    form_data: {},
    name: d.name,
    phone: d.phone,
    email: d.email,
    budget: null,
    project_type: d.projectType,
    timeline: null,
    magic_token: null,
    magic_token_expires_at: null,
    not_qualified_reason: null,
    lost_reason: d.reason,
    deal_value: d.dealValue,
    follow_up_date: null,
    facebook_lead_id: null,
    created_at: d.createdAt,
    updated_at: d.closeDate,
    score: null,
    score_updated_at: null,
    score_breakdown: null,
    is_stale: null,
    stale_since: null,
    is_convert_later_pick: null,
    convert_later_note: d.note,
    manual_priority: null,
  };
}

export function WonLostClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const outcomeParam = searchParams.get("outcome");
  const initialOutcome: OutcomeTab =
    outcomeParam === "won" || outcomeParam === "lost" || outcomeParam === "all"
      ? outcomeParam
      : "all";

  const [outcome, setOutcome] = useState<OutcomeTab>(initialOutcome);
  const [period, setPeriod] = useState<WonLostPeriodId>("this_month");
  const [source, setSource] = useState<WonLostSourceFilter>("all");
  const [granularityOverride, setGranularityOverride] = useState<WonLostGranularity | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(10);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [data, setData] = useState<WonLostPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  const setOutcomeUrl = useCallback(
    (next: OutcomeTab) => {
      setOutcome(next);
      setPage(1);
      setSelectedId(null);
      const sp = new URLSearchParams(searchParams.toString());
      if (next === "all") sp.delete("outcome");
      else sp.set("outcome", next);
      const q = sp.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({
        period,
        source,
        outcome,
      });
      if (granularityOverride) params.set("granularity", granularityOverride);
      const res = await fetch(`/api/sales/won-lost?${params}`);
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as WonLostPayload;
      setData(json);
    } catch {
      setError(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period, source, outcome, granularityOverride]);

  useEffect(() => {
    void load();
  }, [load]);

  const currency = data?.currency ?? "USD";

  const filteredDeals = useMemo(() => {
    if (!data) return [];
    let rows = data.deals;
    if (outcome === "won") rows = rows.filter((d) => d.status === "WON");
    if (outcome === "lost") rows = rows.filter((d) => d.status === "LOST");
    if (debouncedSearch.trim()) {
      rows = rows.filter((d) => dealMatchesSearch(d, debouncedSearch));
    }
    return rows;
  }, [data, outcome, debouncedSearch]);

  const pageCount = Math.max(1, Math.ceil(filteredDeals.length / pageSize));
  const pageSafe = Math.min(page, pageCount);
  const pageRows = filteredDeals.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);
  const showingFrom = filteredDeals.length === 0 ? 0 : (pageSafe - 1) * pageSize + 1;
  const showingTo = Math.min(pageSafe * pageSize, filteredDeals.length);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return filteredDeals.find((d) => d.id === selectedId) ?? data?.deals.find((d) => d.id === selectedId) ?? null;
  }, [selectedId, filteredDeals, data?.deals]);

  const panelLeads = useMemo(
    () => (data?.deals ?? []).map(toPanelLead),
    [data?.deals]
  );

  const exportCsv = () => {
    if (!filteredDeals.length) return;
    const csv = buildWonLostCsv(filteredDeals, { currency });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `segmiq-won-lost-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const mobileFilterCount =
    (period === "this_month" ? 0 : 1) + (source === "all" ? 0 : 1) + (search.trim() ? 1 : 0);

  const neverClosed = !loading && data && data.totals.closedAllTime === 0;
  const periodEmpty = !loading && data && data.deals.length === 0 && data.totals.closedAllTime > 0;

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, period, source, pageSize]);

  useEffect(() => {
    const onDoc = () => setMenuId(null);
    if (menuId) {
      document.addEventListener("click", onDoc);
      return () => document.removeEventListener("click", onDoc);
    }
  }, [menuId]);

  return (
    <div className="w-full space-y-4">
      {/* Tabs + filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 overflow-x-auto">
          <SegmentedControl
            aria-label="Outcome filter"
            value={outcome}
            onChange={setOutcomeUrl}
            options={[
              { value: "all", label: "All outcomes" },
              { value: "won", label: "Won" },
              { value: "lost", label: "Lost" },
            ]}
          />
        </div>
        <div className="hidden min-w-0 flex-wrap items-center gap-2 md:flex">
          <MenuSelect
            aria-label="Date range"
            value={period}
            onChange={(v) => {
              setPeriod(v);
              setGranularityOverride(null);
            }}
            options={WON_LOST_PERIODS.map((p) => ({ value: p.id, label: p.label }))}
          />
          <MenuSelect
            aria-label="Lead source"
            value={source}
            onChange={setSource}
            leadingIcon={<ListFilter size={14} strokeWidth={1.8} />}
            options={WON_LOST_SOURCES.map((s) => ({ value: s.id, label: s.label }))}
          />
          <div className="min-w-[200px] flex-1 sm:max-w-[260px]">
            <SearchInput
              placeholder="Search customer, deal, reason..."
              value={search}
              onChange={setSearch}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            className="min-w-0 flex-1 rounded-[10px] md:hidden"
            leftIcon={<ListFilter size={16} strokeWidth={1.8} />}
            onClick={() => setFiltersOpen(true)}
          >
            Filters
            {mobileFilterCount > 0 ? (
              <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-sales-brand px-1.5 text-[11px] font-semibold text-sales-brand-text">
                {mobileFilterCount}
              </span>
            ) : null}
          </Button>
          <Button
            variant="secondary"
            size="md"
            className="shrink-0 rounded-[10px]"
            leftIcon={<Download size={16} strokeWidth={1.8} />}
            onClick={exportCsv}
            disabled={!filteredDeals.length}
          >
            Export
          </Button>
        </div>
      </div>

      {filtersOpen ? (
        <div className="md:hidden">
          <PremiumSheet
            title="Filters"
            description="Date range, source, and search"
            onClose={() => setFiltersOpen(false)}
            footer={
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="ghost"
                  size="md"
                  disabled={mobileFilterCount === 0}
                  onClick={() => {
                    setPeriod("this_month");
                    setGranularityOverride(null);
                    setSource("all");
                    setSearch("");
                  }}
                >
                  Clear all
                </Button>
                <Button variant="primary" size="md" onClick={() => setFiltersOpen(false)}>
                  Show {filteredDeals.length} deals
                </Button>
              </div>
            }
          >
            <div className="space-y-4">
              <div>
                <p className="mb-1.5 text-[11px] font-medium text-sales-text-muted">Date range</p>
                <MenuSelect
                  aria-label="Date range"
                  value={period}
                  onChange={(v) => {
                    setPeriod(v);
                    setGranularityOverride(null);
                  }}
                  options={WON_LOST_PERIODS.map((p) => ({ value: p.id, label: p.label }))}
                />
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-medium text-sales-text-muted">Source</p>
                <MenuSelect
                  aria-label="Lead source"
                  value={source}
                  onChange={setSource}
                  options={WON_LOST_SOURCES.map((s) => ({ value: s.id, label: s.label }))}
                />
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-medium text-sales-text-muted">Search</p>
                <SearchInput
                  placeholder="Search customer, deal, reason..."
                  value={search}
                  onChange={setSearch}
                />
              </div>
            </div>
          </PremiumSheet>
        </div>
      ) : null}

      {loading && !data ? <WonLostSkeleton /> : null}

      {error && !data ? (
        <Card>
          <CardContent className="py-10">
            <EmptyState
              title="Couldn't load closed deals"
              description="Check your connection and try again."
              action={
                <Button variant="secondary" size="sm" onClick={() => void load()}>
                  Retry
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : null}

      {neverClosed ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={<Archive size={20} strokeWidth={1.8} />}
              title="No closed deals yet"
              description="Won and lost deals will appear here as you close opportunities."
              action={
                <Link
                  href="/sales/pipeline"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-sales-brand px-3.5 text-[13px] font-semibold text-sales-brand-text"
                >
                  <Columns3 size={16} strokeWidth={1.8} aria-hidden />
                  View pipeline
                </Link>
              }
            />
          </CardContent>
        </Card>
      ) : null}

      {data && !neverClosed ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <ReportKpiCard
              label="Won deals"
              value={String(data.kpis.wonDeals.value)}
              trend={data.kpis.wonDeals.trend}
              icon={Trophy}
              iconTint="bg-sales-success-soft text-sales-success-fg"
            />
            <ReportKpiCard
              label="Lost deals"
              value={String(data.kpis.lostDeals.value)}
              trend={data.kpis.lostDeals.trend}
              icon={CircleX}
              iconTint="bg-sales-danger-soft text-sales-danger"
            />
            <ReportKpiCard
              label="Win rate"
              value={
                data.kpis.winRate.value == null ? "—" : `${data.kpis.winRate.value}%`
              }
              trend={data.kpis.winRate.trend}
              icon={TrendingUp}
              iconTint="bg-sales-success-soft text-sales-success-fg"
              tip="Percentage of closed deals that were won."
            />
            <ReportKpiCard
              label="Revenue won"
              value={formatValueDisplay(data.kpis.revenueWon.value, currency)}
              trend={data.kpis.revenueWon.trend}
              icon={CircleDollarSign}
              iconTint="bg-sales-success-soft text-sales-success-fg"
            />
            <ReportKpiCard
              label="Lost value"
              value={formatValueDisplay(data.kpis.lostValue.value, currency)}
              trend={data.kpis.lostValue.trend}
              icon={CircleDollarSign}
              iconTint="bg-sales-danger-soft text-sales-danger"
              tip={
                data.kpis.lostValue.recordedCount < data.kpis.lostValue.lostCount
                  ? "Based on lost deals with a recorded value."
                  : "Total recorded value of lost opportunities."
              }
            />
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0 space-y-4">
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-sales-border-subtle px-4 py-3">
                  <h2 className="text-[14px] font-semibold text-sales-text-primary">Closed deals</h2>
                  {loading ? <Skeleton className="h-4 w-16" /> : null}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block">
                  <DataTable className="rounded-none border-0 shadow-none">
                    <DataTableEl>
                      <DataTableHead>
                        <tr>
                          <DataTableTh>Customer</DataTableTh>
                          <DataTableTh className="hidden min-[1366px]:table-cell">Project</DataTableTh>
                          <DataTableTh>Outcome</DataTableTh>
                          <DataTableTh className="text-right">Value</DataTableTh>
                          <DataTableTh>Close date</DataTableTh>
                          <DataTableTh className="hidden lg:table-cell">Source</DataTableTh>
                          <DataTableTh className="hidden xl:table-cell">Reason</DataTableTh>
                          <DataTableTh className="w-12 text-right">
                            <span className="sr-only">Actions</span>
                          </DataTableTh>
                        </tr>
                      </DataTableHead>
                      <DataTableBody>
                        {periodEmpty || filteredDeals.length === 0 ? (
                          <DataTableEmpty
                            colSpan={8}
                            title={
                              debouncedSearch.trim()
                                ? `No closed deals match “${debouncedSearch.trim()}”`
                                : outcome === "won"
                                  ? "No won deals for this period"
                                  : outcome === "lost"
                                    ? "No lost deals for this period"
                                    : "No closed deals for this period"
                            }
                            description={
                              debouncedSearch.trim()
                                ? "Try another customer, project or reason."
                                : outcome === "won"
                                  ? "Keep working your active opportunities."
                                  : outcome === "lost"
                                    ? "No loss analysis is available for the selected period."
                                    : "Try a wider date range or different source."
                            }
                          />
                        ) : (
                          pageRows.map((deal) => (
                            <DealTableRow
                              key={deal.id}
                              deal={deal}
                              currency={currency}
                              selected={selectedId === deal.id}
                              menuOpen={menuId === deal.id}
                              onSelect={() => setSelectedId(deal.id)}
                              onToggleMenu={(e) => {
                                e.stopPropagation();
                                setMenuId((id) => (id === deal.id ? null : deal.id));
                              }}
                              onViewLead={() => {
                                setMenuId(null);
                                openLeadPanel(deal.id);
                              }}
                              onOpenTimeline={() => {
                                setMenuId(null);
                                openLeadPanel(deal.id, "timeline");
                              }}
                            />
                          ))
                        )}
                      </DataTableBody>
                    </DataTableEl>
                  </DataTable>
                </div>

                {/* Mobile cards */}
                <div className="space-y-3 p-3 md:hidden">
                  {filteredDeals.length === 0 ? (
                    <EmptyState
                      size="compact"
                      title={
                        debouncedSearch.trim()
                          ? `No closed deals match “${debouncedSearch.trim()}”`
                          : "No closed deals for this period"
                      }
                      description={
                        debouncedSearch.trim()
                          ? "Try another customer, project or reason."
                          : undefined
                      }
                      action={
                        debouncedSearch.trim() ? (
                          <Button variant="ghost" size="sm" onClick={() => setSearch("")}>
                            Clear search
                          </Button>
                        ) : (
                          <Link
                            href="/sales/pipeline"
                            className="inline-flex h-8 items-center justify-center rounded-[8px] border border-sales-border-strong bg-sales-surface px-3 text-[12px] font-semibold text-sales-text-primary"
                          >
                            View pipeline
                          </Link>
                        )
                      }
                    />
                  ) : (
                    pageRows.map((deal) => (
                      <MobileDealCard
                        key={deal.id}
                        deal={deal}
                        currency={currency}
                        selected={selectedId === deal.id}
                        onSelect={() => setSelectedId(deal.id)}
                        onView={() => openLeadPanel(deal.id)}
                      />
                    ))
                  )}
                </div>

                {filteredDeals.length > 0 ? (
                  <div className="flex flex-col gap-3 border-t border-sales-border-subtle px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[12px] tabular-nums text-sales-text-secondary">
                      Showing {showingFrom} to {showingTo} of {filteredDeals.length} deals
                    </p>
                    <div className="flex items-center gap-1.5">
                      <IconButton
                        aria-label="Previous page"
                        size="sm"
                        disabled={pageSafe <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft strokeWidth={1.8} />
                      </IconButton>
                      {Array.from({ length: Math.min(pageCount, 5) }).map((_, i) => {
                        const n = i + 1;
                        const active = n === pageSafe;
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setPage(n)}
                            className={cn(
                              "inline-flex h-8 min-w-8 items-center justify-center rounded-[8px] text-[12px] font-semibold tabular-nums",
                              active
                                ? "bg-sales-brand text-sales-brand-text"
                                : "text-sales-text-secondary hover:bg-sales-surface-hover"
                            )}
                          >
                            {n}
                          </button>
                        );
                      })}
                      <IconButton
                        aria-label="Next page"
                        size="sm"
                        disabled={pageSafe >= pageCount}
                        onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                      >
                        <ChevronRight strokeWidth={1.8} />
                      </IconButton>
                      <MenuSelect
                        aria-label="Rows per page"
                        size="sm"
                        align="right"
                        className="ml-1"
                        value={String(pageSize) as "10" | "20" | "50"}
                        onChange={(v) => setPageSize(Number(v) as (typeof PAGE_SIZES)[number])}
                        options={PAGE_SIZES.map((n) => ({
                          value: String(n) as "10" | "20" | "50",
                          label: `${n} / page`,
                        }))}
                      />
                    </div>
                  </div>
                ) : null}
              </Card>

              <SelectedDealSnapshot
                deal={selected}
                currency={currency}
                onViewLead={() => selected && openLeadPanel(selected.id)}
                onOpenTimeline={() => selected && openLeadPanel(selected.id, "timeline")}
              />
            </div>

            {/* Right insights — stacks below table under xl */}
            <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
              <Card>
                <CardContent className="p-4">
                  <div className="h-[230px]">
                    <WinLossTrendChart
                      data={data.trend}
                      granularity={granularityOverride ?? data.meta.granularity}
                      onGranularityChange={setGranularityOverride}
                    />
                  </div>
                </CardContent>
              </Card>

              {outcome !== "won" ? (
                <Card>
                  <CardContent className="p-4">
                    <div className="min-h-[200px]">
                      <OutcomeReasonsCard
                        title="Why deals are lost"
                        rows={data.lostReasons.rows}
                        withReason={data.lostReasons.withReason}
                        total={data.lostReasons.totalLost}
                        tone="danger"
                        emptyTitle={
                          data.lostReasons.totalLost === 0
                            ? "No lost deals for this period"
                            : "No loss reasons recorded"
                        }
                        emptyDescription={
                          data.lostReasons.totalLost === 0
                            ? "No loss analysis is available for the selected period."
                            : "Capture a lost reason when closing a deal to build this insight."
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {outcome !== "lost" ? (
                <Card>
                  <CardContent className="p-4">
                    <div className="min-h-[200px]">
                      {!data.wonReasons.available ? (
                        <OutcomeReasonsCard
                          title="Why deals are won"
                          rows={[]}
                          withReason={0}
                          total={data.wonReasons.totalWon}
                          tone="success"
                          emptyTitle="Win reasons aren't being captured yet"
                          emptyDescription={data.meta.wonReasonsNote}
                        />
                      ) : (
                        <OutcomeReasonsCard
                          title="Why deals are won"
                          rows={data.wonReasons.rows}
                          withReason={data.wonReasons.withReason}
                          total={data.wonReasons.totalWon}
                          tone="success"
                          emptyTitle="No win reasons yet"
                          emptyDescription="Add a win reason when closing a deal to build this insight."
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </aside>
          </div>
        </>
      ) : null}

      <LeadDetailPanel leads={panelLeads} />
    </div>
  );
}

function DealTableRow({
  deal,
  currency,
  selected,
  menuOpen,
  onSelect,
  onToggleMenu,
  onViewLead,
  onOpenTimeline,
}: {
  deal: ClosedDealRow;
  currency: string;
  selected: boolean;
  menuOpen: boolean;
  onSelect: () => void;
  onToggleMenu: (e: React.MouseEvent) => void;
  onViewLead: () => void;
  onOpenTimeline: () => void;
}) {
  return (
    <DataTableRow
      selected={selected}
      className={cn(
        "cursor-pointer",
        selected && "bg-[#F3F7E8] ring-1 ring-inset ring-[rgba(160,205,40,0.35)]"
      )}
      onClick={onSelect}
      onDoubleClick={onViewLead}
    >
      <DataTableTd>
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={deal.name ?? "?"} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-sales-text-primary">
              {deal.name?.trim() || "Unnamed"}
            </p>
            {deal.phone ? (
              <p className="truncate font-mono text-[11px] text-sales-text-muted">{deal.phone}</p>
            ) : deal.projectType ? (
              <p className="truncate text-[11px] text-sales-text-muted">{deal.projectType}</p>
            ) : null}
          </div>
        </div>
      </DataTableTd>
      <DataTableTd className="hidden min-[1366px]:table-cell">
        <span className="text-[13px] text-sales-text-secondary">
          {deal.projectType?.trim() || "—"}
        </span>
      </DataTableTd>
      <DataTableTd>
        <PipelineStageBadge
          status={deal.status}
          label={deal.status === "WON" ? "WON" : "LOST"}
        />
      </DataTableTd>
      <DataTableTd className="text-right tabular-nums">
        {formatValueDisplay(deal.dealValue, currency)}
      </DataTableTd>
      <DataTableTd>
        <span className="whitespace-nowrap text-[13px] text-sales-text-secondary">
          {formatCloseDate(deal.closeDate)}
        </span>
      </DataTableTd>
      <DataTableTd className="hidden lg:table-cell">
        <span className="text-[13px] text-sales-text-secondary">{deal.sourceLabel}</span>
      </DataTableTd>
      <DataTableTd className="hidden max-w-[160px] xl:table-cell">
        <span className="block truncate text-[13px] text-sales-text-secondary" title={deal.reason ?? undefined}>
          {formatOutcomeReason(deal.reason)}
        </span>
      </DataTableTd>
      <DataTableTd className="text-right" onClick={(e) => e.stopPropagation()}>
        <div className="relative inline-flex justify-end">
          <IconButton aria-label="Row actions" size="sm" onClick={onToggleMenu}>
            <MoreVertical strokeWidth={1.8} />
          </IconButton>
          {menuOpen ? (
            <div className="absolute right-0 top-9 z-30 w-44 overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface py-1.5 shadow-[0_8px_24px_rgba(16,24,40,0.10)]">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
                onClick={onViewLead}
              >
                <ExternalLink size={14} strokeWidth={1.8} />
                View lead
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
                onClick={onOpenTimeline}
              >
                <History size={14} strokeWidth={1.8} />
                Open timeline
              </button>
            </div>
          ) : null}
        </div>
      </DataTableTd>
    </DataTableRow>
  );
}

function MobileDealCard({
  deal,
  currency,
  selected,
  onSelect,
  onView,
}: {
  deal: ClosedDealRow;
  currency: string;
  selected: boolean;
  onSelect: () => void;
  onView: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-[12px] border border-sales-border bg-sales-surface p-3.5 text-left shadow-sales-card",
        selected && "border-[rgba(160,205,40,0.5)] bg-[#F3F7E8]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={deal.name ?? "?"} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-sales-text-primary">
              {deal.name?.trim() || "Unnamed"}
            </p>
            {deal.projectType ? (
              <p className="truncate text-[12px] text-sales-text-muted">{deal.projectType}</p>
            ) : null}
          </div>
        </div>
        <PipelineStageBadge status={deal.status} label={deal.status === "WON" ? "WON" : "LOST"} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
        <div>
          <dt className="text-sales-text-muted">Value</dt>
          <dd className="font-medium tabular-nums text-sales-text-primary">
            {formatValueDisplay(deal.dealValue, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-sales-text-muted">Closed</dt>
          <dd className="font-medium text-sales-text-primary">{formatCloseDate(deal.closeDate)}</dd>
        </div>
        <div>
          <dt className="text-sales-text-muted">Source</dt>
          <dd className="font-medium text-sales-text-primary">{deal.sourceLabel}</dd>
        </div>
        <div>
          <dt className="text-sales-text-muted">Reason</dt>
          <dd className="font-medium text-sales-text-primary">{formatOutcomeReason(deal.reason)}</dd>
        </div>
      </dl>
      <div className="mt-3">
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={(e) => {
            e.stopPropagation();
            onView();
          }}
        >
          View deal
        </Button>
      </div>
    </button>
  );
}

function SelectedDealSnapshot({
  deal,
  currency,
  onViewLead,
  onOpenTimeline,
}: {
  deal: ClosedDealRow | null;
  currency: string;
  onViewLead: () => void;
  onOpenTimeline: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="mb-3 text-[14px] font-semibold text-sales-text-primary">
          Selected deal snapshot
        </h3>
        {!deal ? (
          <div className="rounded-[10px] border border-dashed border-sales-border bg-sales-surface-subtle px-4 py-8 text-center">
            <p className="text-[13px] font-medium text-sales-text-primary">Select a closed deal</p>
            <p className="mt-1 text-[12px] text-sales-text-muted">
              Review its outcome, reason and timeline here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={deal.name ?? "?"} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-sales-text-primary">
                    {deal.name?.trim() || "Unnamed"}
                  </p>
                  <p className="truncate text-[12px] text-sales-text-secondary">
                    {deal.projectType?.trim() || "No project type"}
                  </p>
                </div>
              </div>
              <PipelineStageBadge
                status={deal.status}
                label={deal.status === "WON" ? "WON" : "LOST"}
              />
            </div>

            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <dt className="text-[11px] text-sales-text-muted">Value</dt>
                <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-sales-text-primary">
                  {formatValueDisplay(deal.dealValue, currency)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-sales-text-muted">Source</dt>
                <dd className="mt-0.5 text-[13px] font-medium text-sales-text-primary">
                  {deal.sourceLabel}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-sales-text-muted">Closed on</dt>
                <dd className="mt-0.5 text-[13px] font-medium text-sales-text-primary">
                  {formatCloseDate(deal.closeDate)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-sales-text-muted">Reason</dt>
                <dd className="mt-0.5 text-[13px] font-medium text-sales-text-primary">
                  {formatOutcomeReason(deal.reason)}
                </dd>
              </div>
            </dl>

            {deal.note ? (
              <div className="rounded-[10px] border border-sales-border-subtle bg-sales-surface-subtle px-3 py-2.5">
                <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
                  Note
                </p>
                <p className="mt-1 text-[13px] text-sales-text-secondary">{deal.note}</p>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={onViewLead}>
                View lead
              </Button>
              <Button
                variant="primary"
                size="sm"
                rightIcon={<History size={14} strokeWidth={1.8} />}
                onClick={onOpenTimeline}
              >
                Open timeline
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WonLostSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[118px] rounded-[12px]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Skeleton className="h-[420px] rounded-[12px]" />
        <div className="space-y-4">
          <Skeleton className="h-[230px] rounded-[12px]" />
          <Skeleton className="h-[200px] rounded-[12px]" />
          <Skeleton className="h-[200px] rounded-[12px]" />
        </div>
      </div>
    </div>
  );
}
