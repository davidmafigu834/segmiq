"use client";

import { useCallback, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  FilePlus2,
  FileText,
  ListFilter,
  MoreVertical,
  Pencil,
  Send,
  TrendingUp,
} from "lucide-react";
import {
  Badge,
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
  SearchInput,
  Skeleton,
  useSalesToast,
} from "@/components/sales/ui";
import { ReportKpiCard } from "@/components/sales/reports/ReportKpiCard";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { QuotationBuilder } from "@/components/leads/QuotationBuilder";
import { LeadDetailPanel } from "@/app/sales/leads/LeadDetailPanel";
import { openLeadPanel } from "@/store/uiStore";
import {
  CreateQuoteDialog,
  type QuotationWithItems,
} from "@/components/sales/quotes/CreateQuoteDialog";
import { QuotePerformanceCard } from "@/components/sales/quotes/QuotePerformanceCard";
import { QuoteActivityCard } from "@/components/sales/quotes/QuoteActivityCard";
import {
  buildQuotesCsv,
  formatQuoteAmount,
  formatQuoteDate,
  formatQuoteNumber,
  formatQuoteStatus,
  formatQuoteValidity,
  formatRelativeDate,
  getQuoteStatusTone,
  quoteMatchesSearch,
  QUOTES_PERIODS,
  QUOTES_SOURCES,
  QUOTES_STATUS_FILTERS,
  type QuoteActivityItem,
  type QuoteListRow,
  type QuotesPayload,
  type QuotesPeriodId,
  type QuotesSourceFilter,
  type QuotesStatusFilter,
} from "@/lib/sales/quotes";
import type { LeadRow, QuotationStatus } from "@/types";
import { cn } from "@/lib/ui/cn";

const PAGE_SIZES = [10, 20, 50] as const;

function toPanelLead(q: QuoteListRow): LeadRow {
  const allowed: LeadRow["source"][] = [
    "LANDING_PAGE",
    "FACEBOOK",
    "MANUAL",
    "REFERRAL",
    "WHATSAPP_INBOUND",
    "WEBSITE",
    "FACEBOOK_AD",
  ];
  const raw = (q.source ?? "MANUAL").toUpperCase();
  const source = (allowed.includes(raw as LeadRow["source"]) ? raw : "MANUAL") as LeadRow["source"];
  return {
    id: q.leadId,
    client_id: q.clientId,
    assigned_to_id: null,
    contact_id: null,
    source,
    status: "PROPOSAL_SENT",
    form_data: {},
    name: q.customerName,
    phone: q.customerPhone,
    email: q.customerEmail,
    budget: null,
    project_type: q.projectType,
    timeline: null,
    magic_token: null,
    magic_token_expires_at: null,
    not_qualified_reason: null,
    lost_reason: null,
    deal_value: q.total,
    follow_up_date: null,
    facebook_lead_id: null,
    created_at: q.createdAt,
    updated_at: q.updatedAt,
    score: null,
    score_updated_at: null,
    score_breakdown: null,
    is_stale: null,
    stale_since: null,
    is_convert_later_pick: null,
    convert_later_note: null,
    manual_priority: null,
  };
}

export function SalesQuotesClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useSalesToast();

  const statusParam = searchParams.get("status");
  const periodParam = searchParams.get("period");
  const searchParam = searchParams.get("search");

  const initialStatus: QuotesStatusFilter =
    statusParam && QUOTES_STATUS_FILTERS.some((s) => s.id === statusParam)
      ? (statusParam as QuotesStatusFilter)
      : "all";
  const initialPeriod: QuotesPeriodId =
    periodParam && QUOTES_PERIODS.some((p) => p.id === periodParam)
      ? (periodParam as QuotesPeriodId)
      : "this_month";

  const [period, setPeriod] = useState<QuotesPeriodId>(initialPeriod);
  const [status, setStatus] = useState<QuotesStatusFilter>(initialStatus);
  const [source, setSource] = useState<QuotesSourceFilter>("all");
  const [search, setSearch] = useState(searchParam ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchParam ?? "");
  const [needsFollowUpOnly, setNeedsFollowUpOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(10);
  const [menuId, setMenuId] = useState<string | null>(null);

  const [data, setData] = useState<QuotesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<{
    quotation: QuotationWithItems;
    leadPhone: string | null;
  } | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  const syncUrl = useCallback(
    (next: { status?: QuotesStatusFilter; period?: QuotesPeriodId; search?: string }) => {
      const sp = new URLSearchParams(searchParams.toString());
      const st = next.status ?? status;
      const pe = next.period ?? period;
      const se = next.search ?? search;
      if (st === "all") sp.delete("status");
      else sp.set("status", st);
      if (pe === "this_month") sp.delete("period");
      else sp.set("period", pe);
      if (!se.trim()) sp.delete("search");
      else sp.set("search", se.trim());
      const q = sp.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams, status, period, search]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({ period, source, status });
      const res = await fetch(`/api/sales/quotes?${params}`);
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as QuotesPayload;
      setData(json);
    } catch {
      setError(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period, source, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, period, source, status, pageSize, needsFollowUpOnly]);

  useEffect(() => {
    const onDoc = () => setMenuId(null);
    if (menuId) {
      document.addEventListener("click", onDoc);
      return () => document.removeEventListener("click", onDoc);
    }
  }, [menuId]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data.quotes;
    if (debouncedSearch.trim()) {
      rows = rows.filter((q) => quoteMatchesSearch(q, debouncedSearch));
    }
    if (needsFollowUpOnly) {
      rows = rows.filter((q) => q.needsFollowUp);
    }
    return rows;
  }, [data, debouncedSearch, needsFollowUpOnly]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(page, pageCount);
  const pageRows = filtered.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);
  const showingFrom = filtered.length === 0 ? 0 : (pageSafe - 1) * pageSize + 1;
  const showingTo = Math.min(pageSafe * pageSize, filtered.length);

  const drawerFilterCount = needsFollowUpOnly ? 1 : 0;

  const panelLeads = useMemo(() => {
    if (!data) return [];
    const byLead = new Map<string, QuoteListRow>();
    for (const q of data.quotes) {
      if (!byLead.has(q.leadId)) byLead.set(q.leadId, q);
    }
    for (const c of data.createCandidates) {
      if (!byLead.has(c.id)) {
        byLead.set(c.id, {
          id: `lead-${c.id}`,
          leadId: c.id,
          clientId: c.clientId,
          quoteNumber: null,
          revisionNumber: 1,
          status: "draft",
          effectiveStatus: "draft",
          customerName: c.name,
          customerPhone: c.phone,
          customerEmail: null,
          customerSecondary: null,
          projectType: c.projectType,
          total: null,
          currency: data.currency,
          sentAt: null,
          validUntil: null,
          viewedAt: null,
          acceptedAt: null,
          respondedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          publicToken: null,
          preparedByName: null,
          source: null,
          sourceKey: "other",
          sourceLabel: "Other",
          needsFollowUp: false,
          expiresSoon: false,
          isExpired: false,
        });
      }
    }
    return [...byLead.values()].map(toPanelLead);
  }, [data]);

  const neverQuoted = !loading && data && data.meta.allTimeCount === 0;
  const periodEmpty =
    !loading && data && data.meta.allTimeCount > 0 && data.quotes.length === 0 && !debouncedSearch;

  async function openQuote(quoteId: string, leadPhone?: string | null) {
    try {
      const res = await fetch(`/api/quotations/${quoteId}`);
      const json = (await res.json()) as { quotation?: QuotationWithItems; error?: string };
      if (!res.ok || !json.quotation) {
        toast({ tone: "error", title: "Couldn't open quote", description: json.error });
        return;
      }
      setEditing({
        quotation: json.quotation,
        leadPhone: leadPhone ?? json.quotation.customer_phone,
      });
    } catch {
      toast({ tone: "error", title: "Couldn't open quote" });
    }
  }

  async function downloadPdf(quoteId: string, quoteNumber: string | null) {
    try {
      const res = await fetch(`/api/quotations/${quoteId}/pdf`);
      if (!res.ok) throw new Error("fail");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${quoteNumber || "quotation"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ tone: "success", title: "PDF downloaded" });
    } catch {
      toast({ tone: "error", title: "Couldn't download PDF" });
    }
  }

  async function setQuoteStatus(quoteId: string, next: QuotationStatus) {
    try {
      const res = await fetch(`/api/quotations/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error("fail");
      toast({
        tone: "success",
        title: next === "accepted" ? "Quote accepted" : next === "rejected" ? "Quote declined" : "Quote updated",
        description:
          next === "accepted"
            ? "Customer acceptance has been recorded."
            : next === "rejected"
              ? "Decline has been recorded."
              : "Your changes were saved.",
      });
      void load();
    } catch {
      toast({ tone: "error", title: "Couldn't update quote" });
    }
  }

  async function duplicateQuote(quoteId: string, leadPhone: string | null) {
    try {
      const res = await fetch(`/api/quotations/${quoteId}/duplicate`, { method: "POST" });
      const json = (await res.json()) as { quotation?: QuotationWithItems; error?: string };
      if (!res.ok || !json.quotation) throw new Error(json.error ?? "fail");
      setEditing({ quotation: json.quotation, leadPhone });
      toast({ tone: "success", title: "Quote duplicated", description: "A new draft was created." });
      void load();
    } catch {
      toast({ tone: "error", title: "Couldn't duplicate quote" });
    }
  }

  async function reviseQuote(quoteId: string, leadPhone: string | null) {
    try {
      const res = await fetch(`/api/quotations/${quoteId}/revise`, { method: "POST" });
      const json = (await res.json()) as { quotation?: QuotationWithItems; error?: string };
      if (!res.ok || !json.quotation) throw new Error(json.error ?? "fail");
      setEditing({ quotation: json.quotation, leadPhone });
      toast({ tone: "success", title: "Revision started", description: "Edit and send the revised quote." });
      void load();
    } catch {
      toast({ tone: "error", title: "Couldn't create revision" });
    }
  }

  function copyLink(token: string | null) {
    if (!token) {
      toast({ tone: "warning", title: "No public link", description: "Send the quote first to generate a link." });
      return;
    }
    const link = `${window.location.origin}/quote/${token}`;
    void navigator.clipboard.writeText(link).then(() => {
      toast({ tone: "success", title: "Link copied" });
    });
  }

  function exportCsv() {
    if (!filtered.length) return;
    const csv = buildQuotesCsv(filtered, { currency: data?.currency });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `segmiq-quotations-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onActivityOpen(item: QuoteActivityItem) {
    void openQuote(item.quoteId);
  }

  if (editing) {
    const q = editing.quotation;
    const readOnly = q.status !== "draft";
    return (
      <div className="w-full">
        <QuotationBuilder
          quotation={q}
          clientId={q.client_id}
          leadPhone={editing.leadPhone}
          readOnly={readOnly}
          onSaved={(updated) => setEditing({ quotation: updated, leadPhone: editing.leadPhone })}
          onSent={() => {
            setEditing(null);
            toast({
              tone: "success",
              title: "Quote sent",
              description: q.customer_name
                ? `Quotation sent to ${q.customer_name}.`
                : "Quotation was sent.",
            });
            void load();
          }}
          onClose={() => {
            setEditing(null);
            void load();
          }}
          onRevise={
            readOnly
              ? () => void reviseQuote(q.id, editing.leadPhone)
              : undefined
          }
          onDuplicate={() => void duplicateQuote(q.id, editing.leadPhone)}
        />
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {!neverQuoted ? (
        <>
          {/* Header actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              className="h-10 min-w-0 flex-1 rounded-[10px] md:hidden md:flex-none"
              leftIcon={<ListFilter size={16} strokeWidth={1.8} />}
              onClick={() => setFiltersOpen(true)}
            >
              Filters
              {drawerFilterCount > 0 ? (
                <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-sales-brand px-1.5 text-[11px] font-semibold text-sales-brand-text">
                  {drawerFilterCount}
                </span>
              ) : null}
            </Button>
            <Button
              variant="primary"
              size="md"
              className="h-10 shrink-0 rounded-[10px] md:ml-auto"
              leftIcon={<FilePlus2 size={16} strokeWidth={1.8} />}
              onClick={() => setCreateOpen(true)}
            >
              Create quote
            </Button>
          </div>

          {/* Filters */}
          <div className="hidden flex-col gap-3 md:flex lg:flex-row lg:h-10 lg:items-center lg:gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <MenuSelect
                aria-label="Date range"
                value={period}
                onChange={(v) => {
                  setPeriod(v);
                  syncUrl({ period: v });
                }}
                options={QUOTES_PERIODS.map((p) => ({ value: p.id, label: p.label }))}
              />
              <MenuSelect
                aria-label="Status"
                value={status}
                onChange={(v) => {
                  setStatus(v);
                  setPage(1);
                  syncUrl({ status: v });
                }}
                options={QUOTES_STATUS_FILTERS.map((s) => ({ value: s.id, label: s.label }))}
              />
              <MenuSelect
                aria-label="Lead source"
                value={source}
                onChange={setSource}
                leadingIcon={<ListFilter size={14} strokeWidth={1.8} />}
                options={QUOTES_SOURCES.map((s) => ({ value: s.id, label: s.label }))}
              />
              <div className="min-w-[180px] flex-1 sm:max-w-[240px]">
                <SearchInput
                  placeholder="Search quotes..."
                  value={search}
                  onChange={(v) => {
                    setSearch(v);
                    syncUrl({ search: v });
                  }}
                />
              </div>
              <div className="relative">
                <Button
                  variant="secondary"
                  size="md"
                  className="h-10 shrink-0 rounded-[10px]"
                  leftIcon={<ListFilter size={16} strokeWidth={1.8} />}
                  onClick={() => setFiltersOpen((o) => !o)}
                >
                  Filters
                  {drawerFilterCount > 0 ? (
                    <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-sales-brand px-1.5 text-[11px] font-semibold text-sales-brand-text">
                      {drawerFilterCount}
                    </span>
                  ) : null}
                </Button>
                {filtersOpen ? (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-20"
                      aria-label="Close filters"
                      onClick={() => setFiltersOpen(false)}
                    />
                    <div className="absolute right-0 z-30 mt-2 w-64 rounded-[12px] border border-sales-border bg-sales-surface p-4 shadow-sales-popover">
                      <p className="text-[12px] font-semibold text-sales-text-primary">Advanced filters</p>
                      <label className="mt-3 flex cursor-pointer items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={needsFollowUpOnly}
                          onChange={(e) => setNeedsFollowUpOnly(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-sales-border text-sales-brand-fg"
                        />
                        <span>
                          <span className="block text-[13px] font-medium text-sales-text-primary">
                            Needs follow-up
                          </span>
                          <span className="mt-0.5 block text-[11px] text-sales-text-muted">
                            Pending quotes sent 3+ days ago with no response
                          </span>
                        </span>
                      </label>
                      {drawerFilterCount > 0 ? (
                        <button
                          type="button"
                          className="mt-3 text-[12px] font-medium text-sales-text-secondary underline-offset-2 hover:underline"
                          onClick={() => setNeedsFollowUpOnly(false)}
                        >
                          Clear filters
                        </button>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
              <Button
                variant="secondary"
                size="md"
                className="h-10 shrink-0 rounded-[10px]"
                leftIcon={<Download size={16} strokeWidth={1.8} />}
                onClick={exportCsv}
                disabled={!filtered.length}
              >
                Export
              </Button>
            </div>
          </div>

          {filtersOpen ? (
            <div className="md:hidden">
              <PremiumSheet
                title="Filters"
                description="Period, status, source, and search"
                onClose={() => setFiltersOpen(false)}
              >
                <div className="space-y-4">
                  <div>
                    <p className="mb-1.5 text-[11px] font-medium text-sales-text-muted">Date range</p>
                    <MenuSelect
                      aria-label="Date range"
                      value={period}
                      onChange={(v) => {
                        setPeriod(v);
                        syncUrl({ period: v });
                      }}
                      options={QUOTES_PERIODS.map((p) => ({ value: p.id, label: p.label }))}
                    />
                  </div>
                  <div>
                    <p className="mb-1.5 text-[11px] font-medium text-sales-text-muted">Status</p>
                    <MenuSelect
                      aria-label="Status"
                      value={status}
                      onChange={(v) => {
                        setStatus(v);
                        setPage(1);
                        syncUrl({ status: v });
                      }}
                      options={QUOTES_STATUS_FILTERS.map((s) => ({ value: s.id, label: s.label }))}
                    />
                  </div>
                  <div>
                    <p className="mb-1.5 text-[11px] font-medium text-sales-text-muted">Source</p>
                    <MenuSelect
                      aria-label="Lead source"
                      value={source}
                      onChange={setSource}
                      options={QUOTES_SOURCES.map((s) => ({ value: s.id, label: s.label }))}
                    />
                  </div>
                  <div>
                    <p className="mb-1.5 text-[11px] font-medium text-sales-text-muted">Search</p>
                    <SearchInput
                      placeholder="Search quotes..."
                      value={search}
                      onChange={(v) => {
                        setSearch(v);
                        syncUrl({ search: v });
                      }}
                    />
                  </div>
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={needsFollowUpOnly}
                      onChange={(e) => setNeedsFollowUpOnly(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-sales-border text-sales-brand-fg"
                    />
                    <span>
                      <span className="block text-[13px] font-medium text-sales-text-primary">
                        Needs follow-up
                      </span>
                      <span className="mt-0.5 block text-[11px] text-sales-text-muted">
                        Pending quotes sent 3+ days ago with no response
                      </span>
                    </span>
                  </label>
                </div>
              </PremiumSheet>
            </div>
          ) : null}
        </>
      ) : null}

      {loading && !data ? <QuotesSkeleton /> : null}

      {error && !data ? (
        <Card>
          <CardContent className="py-10">
            <EmptyState
              title="Couldn't load quotations"
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

      {neverQuoted ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={<FileText size={20} strokeWidth={1.8} />}
              title="No quotations yet"
              description="Create your first quote and send it directly to a customer."
              action={
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<FilePlus2 size={16} strokeWidth={1.8} />}
                  onClick={() => setCreateOpen(true)}
                >
                  Create quote
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : null}

      {data && !neverQuoted ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <ReportKpiCard
              label="Total quotes"
              value={String(data.kpis.total.value)}
              trend={data.kpis.total.trend}
              icon={FileText}
              iconTint="bg-[#F4F3FF] text-[#8B5CF6]"
            />
            <ReportKpiCard
              label="Pending"
              value={String(data.kpis.pending.value)}
              supporting={
                data.kpis.pending.pctOfTotal != null
                  ? `${data.kpis.pending.pctOfTotal}% of total quotes`
                  : undefined
              }
              icon={Clock3}
              iconTint="bg-[#FFFAEB] text-[#F59E0B]"
              tip="Sent or viewed quotes awaiting a customer response."
            />
            <ReportKpiCard
              label="Accepted"
              value={String(data.kpis.accepted.value)}
              trend={data.kpis.accepted.trend}
              icon={CircleCheck}
              iconTint="bg-sales-success-soft text-[#16A34A]"
            />
            <ReportKpiCard
              label="Declined"
              value={String(data.kpis.declined.value)}
              trend={data.kpis.declined.trend}
              icon={CircleX}
              iconTint="bg-sales-danger-soft text-sales-danger"
              tip="Fewer declines is better — trends flip colour accordingly."
            />
            <ReportKpiCard
              label="Conversion rate"
              value={
                data.kpis.conversionRate.value == null
                  ? "—"
                  : `${data.kpis.conversionRate.value}%`
              }
              trend={data.kpis.conversionRate.trend}
              supporting={
                data.kpis.conversionRate.value == null ? "No quote outcomes yet" : undefined
              }
              icon={TrendingUp}
              iconTint="bg-sales-success-soft text-[#16A34A]"
              tip={data.kpis.conversionRate.formula}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
            <div className="min-w-0 space-y-4">
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-sales-border-subtle px-4 py-3">
                  <h2 className="text-[14px] font-semibold text-sales-text-primary">Quotations</h2>
                  {loading ? <Skeleton className="h-4 w-16" /> : null}
                </div>

                <div className="hidden md:block">
                  <DataTable className="rounded-none border-0 shadow-none">
                    <DataTableEl>
                      <DataTableHead>
                        <tr>
                          <DataTableTh>Quote</DataTableTh>
                          <DataTableTh>Customer</DataTableTh>
                          <DataTableTh className="hidden min-[1366px]:table-cell">Project</DataTableTh>
                          <DataTableTh className="text-right">Amount</DataTableTh>
                          <DataTableTh>Status</DataTableTh>
                          <DataTableTh className="hidden lg:table-cell">Sent on</DataTableTh>
                          <DataTableTh className="hidden xl:table-cell">Valid until</DataTableTh>
                          <DataTableTh className="w-12 text-right">
                            <span className="sr-only">Actions</span>
                          </DataTableTh>
                        </tr>
                      </DataTableHead>
                      <DataTableBody>
                        {periodEmpty || filtered.length === 0 ? (
                          <DataTableEmpty
                            colSpan={8}
                            title={
                              debouncedSearch.trim()
                                ? `No quotes match “${debouncedSearch.trim()}”`
                                : needsFollowUpOnly
                                  ? "No quotations need follow-up"
                                  : periodEmpty
                                    ? "No quotations for this period"
                                    : "No quotations match these filters"
                            }
                            description={
                              debouncedSearch.trim()
                                ? "Try another customer, quote number or project."
                                : "Try another status, date range or customer."
                            }
                          />
                        ) : (
                          pageRows.map((quote) => (
                            <QuoteTableRow
                              key={quote.id}
                              quote={quote}
                              menuOpen={menuId === quote.id}
                              onToggleMenu={(e) => {
                                e.stopPropagation();
                                setMenuId((id) => (id === quote.id ? null : quote.id));
                              }}
                              onOpen={() => void openQuote(quote.id, quote.customerPhone)}
                              onDownload={() => void downloadPdf(quote.id, quote.quoteNumber)}
                              onCopyLink={() => copyLink(quote.publicToken)}
                              onDuplicate={() => void duplicateQuote(quote.id, quote.customerPhone)}
                              onRevise={() => void reviseQuote(quote.id, quote.customerPhone)}
                              onMarkAccepted={() => void setQuoteStatus(quote.id, "accepted")}
                              onMarkDeclined={() => void setQuoteStatus(quote.id, "rejected")}
                              onOpenLead={() => openLeadPanel(quote.leadId)}
                              onOpenCustomer={() => openLeadPanel(quote.leadId, "details")}
                            />
                          ))
                        )}
                      </DataTableBody>
                    </DataTableEl>
                  </DataTable>
                </div>

                {/* Mobile cards */}
                <div className="space-y-3 p-3 md:hidden">
                  {periodEmpty || filtered.length === 0 ? (
                    <EmptyState
                      size="compact"
                      title={
                        debouncedSearch.trim()
                          ? `No quotes match “${debouncedSearch.trim()}”`
                          : "No quotations match these filters"
                      }
                      description="Try another status, date range or customer."
                    />
                  ) : (
                    pageRows.map((quote) => (
                      <MobileQuoteCard
                        key={quote.id}
                        quote={quote}
                        onOpen={() => void openQuote(quote.id, quote.customerPhone)}
                      />
                    ))
                  )}
                </div>

                {filtered.length > 0 ? (
                  <div className="flex flex-col gap-3 border-t border-sales-border-subtle px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[12px] text-sales-text-muted">
                      Showing {showingFrom} to {showingTo} of {filtered.length} quotes
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <MenuSelect
                        aria-label="Rows per page"
                        size="sm"
                        value={String(pageSize)}
                        onChange={(v) => {
                          const next = Number(v);
                          if ((PAGE_SIZES as readonly number[]).includes(next)) {
                            setPageSize(next as (typeof PAGE_SIZES)[number]);
                          }
                        }}
                        options={PAGE_SIZES.map((n) => ({
                          value: String(n),
                          label: `${n} / page`,
                        }))}
                      />
                      <div className="flex items-center gap-1">
                        <IconButton
                          aria-label="Previous page"
                          size="sm"
                          disabled={pageSafe <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                          <ChevronLeft strokeWidth={1.8} />
                        </IconButton>
                        {Array.from({ length: Math.min(pageCount, 5) }, (_, i) => {
                          let n = i + 1;
                          if (pageCount > 5) {
                            const start = Math.min(Math.max(pageSafe - 2, 1), pageCount - 4);
                            n = start + i;
                          }
                          return (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setPage(n)}
                              className={cn(
                                "flex h-8 min-w-[32px] items-center justify-center rounded-[8px] px-2 text-[12px] font-medium",
                                n === pageSafe
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
                      </div>
                    </div>
                  </div>
                ) : null}
              </Card>
            </div>

            <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
              <QuotePerformanceCard
                period={period}
                onPeriodChange={(v) => {
                  setPeriod(v);
                  syncUrl({ period: v });
                }}
                slices={data.performance.slices}
                total={data.performance.total}
                emptyReason={data.performance.emptyReason}
                loading={loading}
              />
              <QuoteActivityCard
                items={data.activity}
                loading={loading}
                onOpen={onActivityOpen}
              />
              {data.meta.hasTemplates ? (
                <Card className="border-[rgba(160,205,40,0.35)] bg-[rgba(212,255,79,0.12)]">
                  <CardContent className="p-5">
                    <p className="text-[14px] font-semibold text-sales-text-primary">
                      Need a quote faster?
                    </p>
                    <p className="mt-1.5 text-[13px] text-sales-text-secondary">
                      Use saved quote templates to create consistent quotations faster.
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-3 h-9 rounded-[10px] bg-sales-surface"
                      leftIcon={<FilePlus2 size={14} strokeWidth={1.8} />}
                      onClick={() => setCreateOpen(true)}
                    >
                      Create from template
                    </Button>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      <CreateQuoteDialog
        open={createOpen}
        candidates={data?.createCandidates ?? []}
        hasTemplates={data?.meta.hasTemplates ?? false}
        onClose={() => setCreateOpen(false)}
        onCreated={(quotation, leadPhone) => {
          setEditing({ quotation, leadPhone });
          toast({
            tone: "success",
            title: "Quote created",
            description: "Draft saved — add line items and send when ready.",
          });
          void load();
        }}
      />

      <LeadDetailPanel leads={panelLeads} onLeadUpdated={() => void load()} />
    </div>
  );
}

function QuoteTableRow({
  quote,
  menuOpen,
  onToggleMenu,
  onOpen,
  onDownload,
  onCopyLink,
  onDuplicate,
  onRevise,
  onMarkAccepted,
  onMarkDeclined,
  onOpenLead,
  onOpenCustomer,
}: {
  quote: QuoteListRow;
  menuOpen: boolean;
  onToggleMenu: (e: MouseEvent) => void;
  onOpen: () => void;
  onDownload: () => void;
  onCopyLink: () => void;
  onDuplicate: () => void;
  onRevise: () => void;
  onMarkAccepted: () => void;
  onMarkDeclined: () => void;
  onOpenLead: () => void;
  onOpenCustomer: () => void;
}) {
  const validity = formatQuoteValidity(quote.validUntil, {
    status: quote.effectiveStatus,
  });
  const canRevise =
    quote.effectiveStatus === "sent" ||
    quote.effectiveStatus === "viewed" ||
    quote.effectiveStatus === "rejected" ||
    quote.effectiveStatus === "expired";
  const canMarkOutcome =
    quote.effectiveStatus === "sent" || quote.effectiveStatus === "viewed";

  return (
    <DataTableRow className="h-[64px] cursor-pointer" onClick={onOpen}>
      <DataTableTd>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-sales-text-primary">
            {formatQuoteNumber(quote.quoteNumber, quote.revisionNumber)}
          </p>
          {quote.needsFollowUp ? (
            <p className="mt-0.5 text-[11px] font-medium text-[#B54708]">Needs follow-up</p>
          ) : quote.expiresSoon ? (
            <p className="mt-0.5 text-[11px] font-medium text-[#B54708]">Due soon</p>
          ) : null}
        </div>
      </DataTableTd>
      <DataTableTd>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-sales-text-primary">
            {quote.customerName?.trim() || "—"}
          </p>
          {quote.customerSecondary ? (
            <p className="mt-0.5 truncate text-[12px] text-sales-text-muted">
              {quote.customerSecondary}
            </p>
          ) : null}
        </div>
      </DataTableTd>
      <DataTableTd className="hidden min-[1366px]:table-cell">
        <span className="text-[13px] text-sales-text-secondary">
          {quote.projectType?.trim() || "—"}
        </span>
      </DataTableTd>
      <DataTableTd className="text-right tabular-nums">
        <span className="text-[13px] font-medium text-sales-text-primary">
          {formatQuoteAmount(quote.total, quote.currency, {
            draftUnset: quote.effectiveStatus === "draft",
          })}
        </span>
      </DataTableTd>
      <DataTableTd>
        <Badge tone={getQuoteStatusTone(quote.effectiveStatus)} appearance="soft">
          {formatQuoteStatus(quote.effectiveStatus)}
        </Badge>
      </DataTableTd>
      <DataTableTd className="hidden lg:table-cell">
        {quote.sentAt ? (
          <div>
            <p className="whitespace-nowrap text-[13px] text-sales-text-secondary">
              {formatQuoteDate(quote.sentAt)}
            </p>
            <p className="text-[11px] text-sales-text-muted">{formatRelativeDate(quote.sentAt)}</p>
          </div>
        ) : (
          <span className="text-[13px] text-sales-text-muted">Not sent</span>
        )}
      </DataTableTd>
      <DataTableTd className="hidden xl:table-cell">
        <div>
          <p className="whitespace-nowrap text-[13px] text-sales-text-secondary">{validity.primary}</p>
          {validity.secondary ? (
            <p
              className={cn(
                "text-[11px]",
                validity.tone === "danger"
                  ? "text-sales-danger"
                  : validity.tone === "warning"
                    ? "text-[#B54708]"
                    : "text-sales-text-muted"
              )}
            >
              {validity.secondary}
            </p>
          ) : null}
        </div>
      </DataTableTd>
      <DataTableTd className="text-right" onClick={(e) => e.stopPropagation()}>
        <div className="relative inline-flex justify-end">
          <IconButton aria-label="Row actions" size="sm" onClick={onToggleMenu}>
            <MoreVertical strokeWidth={1.8} />
          </IconButton>
          {menuOpen ? (
            <div className="absolute right-0 top-9 z-30 w-48 overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface py-1.5 shadow-[0_8px_24px_rgba(16,24,40,0.10)]">
              <MenuItem icon={<ExternalLink size={14} />} label="View quote" onClick={onOpen} />
              {quote.effectiveStatus === "draft" ? (
                <MenuItem icon={<Pencil size={14} />} label="Edit quote" onClick={onOpen} />
              ) : null}
              {quote.effectiveStatus === "draft" ? (
                <MenuItem icon={<Send size={14} />} label="Send quote" onClick={onOpen} />
              ) : null}
              <MenuItem icon={<Download size={14} />} label="Download PDF" onClick={onDownload} />
              <MenuItem icon={<Copy size={14} />} label="Copy link" onClick={onCopyLink} />
              {canRevise ? (
                <MenuItem icon={<FilePlus2 size={14} />} label="Create revised quote" onClick={onRevise} />
              ) : null}
              <MenuItem icon={<Copy size={14} />} label="Duplicate" onClick={onDuplicate} />
              {canMarkOutcome ? (
                <>
                  <MenuItem icon={<CircleCheck size={14} />} label="Mark accepted" onClick={onMarkAccepted} />
                  <MenuItem icon={<CircleX size={14} />} label="Mark declined" onClick={onMarkDeclined} />
                </>
              ) : null}
              <MenuItem icon={<ExternalLink size={14} />} label="Open lead" onClick={onOpenLead} />
              <MenuItem icon={<ExternalLink size={14} />} label="Open customer" onClick={onOpenCustomer} />
            </div>
          ) : null}
        </div>
      </DataTableTd>
    </DataTableRow>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

function MobileQuoteCard({ quote, onOpen }: { quote: QuoteListRow; onOpen: () => void }) {
  const validity = formatQuoteValidity(quote.validUntil, { status: quote.effectiveStatus });
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-[12px] border border-sales-border bg-sales-surface p-3.5 text-left shadow-sales-card"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-sales-text-primary">
            {formatQuoteNumber(quote.quoteNumber, quote.revisionNumber)}
          </p>
          <p className="mt-0.5 truncate text-[13px] text-sales-text-secondary">
            {quote.customerName?.trim() || "—"}
          </p>
          {quote.projectType ? (
            <p className="truncate text-[12px] text-sales-text-muted">{quote.projectType}</p>
          ) : null}
        </div>
        <Badge tone={getQuoteStatusTone(quote.effectiveStatus)}>
          {formatQuoteStatus(quote.effectiveStatus)}
        </Badge>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
        <div>
          <dt className="text-sales-text-muted">Amount</dt>
          <dd className="font-medium tabular-nums text-sales-text-primary">
            {formatQuoteAmount(quote.total, quote.currency, {
              draftUnset: quote.effectiveStatus === "draft",
            })}
          </dd>
        </div>
        <div>
          <dt className="text-sales-text-muted">Sent</dt>
          <dd className="text-sales-text-primary">
            {quote.sentAt ? formatQuoteDate(quote.sentAt) : "Not sent"}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-sales-text-muted">Valid until</dt>
          <dd
            className={cn(
              "text-sales-text-primary",
              validity.tone === "danger" && "text-sales-danger",
              validity.tone === "warning" && "text-[#B54708]"
            )}
          >
            {validity.primary}
            {validity.secondary ? ` · ${validity.secondary}` : ""}
          </dd>
        </div>
      </dl>
    </button>
  );
}

function QuotesSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[118px] rounded-sales-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
        <Skeleton className="h-[420px] rounded-sales-xl" />
        <div className="space-y-4">
          <Skeleton className="h-[230px] rounded-sales-xl" />
          <Skeleton className="h-[200px] rounded-sales-xl" />
        </div>
      </div>
    </div>
  );
}
