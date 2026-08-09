"use client";

import { useCallback, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileText,
  Globe,
  ListFilter,
  MoreVertical,
  Phone,
  Plus,
  Target,
  Trophy,
  TrendingUp,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import { SiFacebook, SiWhatsapp } from "react-icons/si";
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
  LeadScoreBadge,
  MenuSelect,
  PipelineStageBadge,
  SearchInput,
  Skeleton,
  useSalesToast,
} from "@/components/sales/ui";
import { ReportKpiCard } from "@/components/sales/reports/ReportKpiCard";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { LeadDetailPanel } from "@/app/sales/leads/LeadDetailPanel";
import { openLeadPanel, useLeadPanel } from "@/store/uiStore";
import { AddToHubSheet } from "@/components/sales/AddToHubSheet";
import { LeadsBySourceCard } from "@/components/sales/leads-directory/LeadsBySourceCard";
import { LeadStageOverviewCard } from "@/components/sales/leads-directory/LeadStageOverviewCard";
import { HotLeadsCard } from "@/components/sales/leads-directory/HotLeadsCard";
import {
  formatLastContact,
  formatLeadName,
  formatLeadPhone,
  formatLeadScore,
  formatLeadStage,
  LEADS_INTENT_FILTERS,
  LEADS_PERIODS,
  LEADS_SOURCES,
  LEADS_STAGE_FILTERS,
  type AttentionFilter,
  type LeadDirectoryRow,
  type LeadsDirectoryPayload,
  type LeadsIntentFilter,
  type LeadsPeriodId,
  type LeadsSourceFilter,
  type LeadsStageFilter,
} from "@/lib/sales/leads-directory";
import { whatsappInboxHref } from "@/lib/leads/whatsapp-lead-display";
import { openWhatsAppAndLog } from "@/lib/whatsapp-opener";
import type { LeadRow } from "@/types";
import { cn } from "@/lib/ui/cn";

const PAGE_SIZES = [20, 50, 100] as const;

function SourceIcon({ sourceKey }: { sourceKey: string }) {
  if (sourceKey === "whatsapp") return <SiWhatsapp size={14} color="#25D366" aria-hidden />;
  if (sourceKey === "facebook") return <SiFacebook size={14} color="#2684FF" aria-hidden />;
  if (sourceKey === "website") return <Globe size={14} strokeWidth={1.8} className="text-[#8B5CF6]" />;
  if (sourceKey === "referral") return <UsersRound size={14} strokeWidth={1.8} className="text-[#F59E0B]" />;
  return <Globe size={14} strokeWidth={1.8} className="text-sales-text-muted" />;
}

function toPanelLead(row: LeadDirectoryRow): LeadRow {
  const allowed: LeadRow["source"][] = [
    "LANDING_PAGE",
    "FACEBOOK",
    "MANUAL",
    "REFERRAL",
    "WHATSAPP_INBOUND",
    "WEBSITE",
    "FACEBOOK_AD",
  ];
  const raw = (row.source ?? "MANUAL").toUpperCase();
  const source = (allowed.includes(raw as LeadRow["source"]) ? raw : "MANUAL") as LeadRow["source"];
  return {
    id: row.id,
    client_id: row.clientId,
    assigned_to_id: null,
    contact_id: null,
    source,
    status: row.status,
    form_data: row.formData ?? {},
    name: row.name,
    phone: row.phone,
    email: row.email,
    budget: row.budget,
    project_type: row.projectType,
    timeline: null,
    magic_token: null,
    magic_token_expires_at: null,
    not_qualified_reason: null,
    lost_reason: null,
    deal_value: null,
    follow_up_date: row.followUpDate,
    facebook_lead_id: null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    score: row.score,
    score_updated_at: null,
    score_breakdown: null,
    is_stale: row.isStale,
    stale_since: null,
    is_convert_later_pick: null,
    convert_later_note: null,
    manual_priority: null,
  };
}

export function SalesLeadsClient({
  assignmentMode = "direct",
  repName = "",
}: {
  assignmentMode?: "direct" | "pool" | "round_robin";
  repName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useSalesToast();
  const panel = useLeadPanel();

  const [period, setPeriod] = useState<LeadsPeriodId>(
    (searchParams.get("period") as LeadsPeriodId) || "this_month"
  );
  const [source, setSource] = useState<LeadsSourceFilter>(
    (searchParams.get("source") as LeadsSourceFilter) || "all"
  );
  const [stage, setStage] = useState<LeadsStageFilter>(
    (searchParams.get("stage") as LeadsStageFilter) || "all"
  );
  const [intent, setIntent] = useState<LeadsIntentFilter>(
    (searchParams.get("intent") as LeadsIntentFilter) || "all"
  );
  const [attention, setAttention] = useState<AttentionFilter>(
    (searchParams.get("attention") as AttentionFilter) || "none"
  );
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [page, setPage] = useState(Number(searchParams.get("page") ?? "1") || 1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(20);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const [data, setData] = useState<LeadsDirectoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  /** Accumulated leads for LeadDetailPanel (must include opened row). */
  const [panelCache, setPanelCache] = useState<LeadDirectoryRow[]>([]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  const syncUrl = useCallback(
    (patch: Record<string, string | null>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "" || v === "all" || v === "none" || (k === "period" && v === "this_month") || (k === "page" && v === "1")) {
          if (k === "period" && v === "this_month") sp.delete(k);
          else if (k === "page" && v === "1") sp.delete(k);
          else if (v === "all" || v === "none" || v == null || v === "") sp.delete(k);
          else sp.set(k, v);
        } else {
          sp.set(k, v);
        }
      }
      // Preserve lead drawer param
      const lead = searchParams.get("lead");
      if (lead) sp.set("lead", lead);
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
        stage,
        intent,
        attention,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      const res = await fetch(`/api/sales/leads?${params}`);
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as LeadsDirectoryPayload;
      setData(json);
      setPanelCache((prev) => {
        const map = new Map(prev.map((r) => [r.id, r]));
        for (const r of json.leads) map.set(r.id, r);
        for (const h of json.hotLeads) map.set(h.id, h);
        return [...map.values()];
      });
    } catch {
      setError(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period, source, stage, intent, attention, page, pageSize, debouncedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, period, source, stage, intent, attention, pageSize]);

  useEffect(() => {
    const onDoc = () => setMenuId(null);
    if (menuId) {
      document.addEventListener("click", onDoc);
      return () => document.removeEventListener("click", onDoc);
    }
  }, [menuId]);

  // Deep-link ?lead=
  useEffect(() => {
    const leadId = searchParams.get("lead");
    if (!leadId) return;
    if (panelCache.some((l) => l.id === leadId) || data?.leads.some((l) => l.id === leadId)) {
      openLeadPanel(leadId);
    }
  }, [searchParams, panelCache, data?.leads]);

  const drawerFilterCount =
    (intent !== "all" ? 1 : 0) + (attention !== "none" ? 1 : 0);

  const panelLeads = useMemo(() => panelCache.map(toPanelLead), [panelCache]);

  const neverLeads = !loading && data && data.meta.allTimeCount === 0;
  const selectedId = panel.open ? panel.leadId : null;

  const pageCount = Math.max(1, Math.ceil((data?.meta.totalFiltered ?? 0) / pageSize));
  const currentPage = data?.meta.page ?? page;
  const showingFrom =
    !data || data.meta.totalFiltered === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const showingTo = Math.min(currentPage * pageSize, data?.meta.totalFiltered ?? 0);

  function openLead(id: string) {
    openLeadPanel(id);
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("lead", id);
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  }

  function closeLeadUrl() {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("lead");
    sp.delete("tab");
    const q = sp.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }

  function applyHotFilter() {
    setIntent("hot");
    setAttention("hot");
    setPage(1);
    syncUrl({ intent: "hot", attention: "hot", page: "1" });
  }

  function clearAdvanced() {
    setIntent("all");
    setAttention("none");
    syncUrl({ intent: null, attention: null });
  }

  async function messageWhatsApp(row: LeadDirectoryRow) {
    if (row.sourceKey === "whatsapp" || row.source === "WHATSAPP_INBOUND") {
      router.push(whatsappInboxHref(row.id));
      return;
    }
    if (!row.phone) {
      toast({ tone: "warning", title: "No phone number" });
      return;
    }
    await openWhatsAppAndLog({
      leadId: row.id,
      clientId: row.clientId,
      leadName: row.name,
      leadPhone: row.phone,
      repName,
      formData: row.formData,
      tier: "neutral",
    });
  }

  return (
    <div className="w-full space-y-4">
      {!neverLeads ? (
        <div className="flex items-center gap-2">
          <div className="hidden min-w-0 flex-1 flex-wrap items-center gap-2 md:flex">
          <MenuSelect
            aria-label="Lead source"
            value={source}
            onChange={(v) => {
              setSource(v);
              setPage(1);
              syncUrl({ source: v === "all" ? null : v, page: "1" });
            }}
            options={LEADS_SOURCES.map((s) => ({ value: s.id, label: s.label }))}
          />
          <MenuSelect
            aria-label="Stage"
            value={stage}
            onChange={(v) => {
              setStage(v);
              setPage(1);
              syncUrl({ stage: v === "all" ? null : v, page: "1" });
            }}
            options={LEADS_STAGE_FILTERS.map((s) => ({ value: s.id, label: s.label }))}
          />
          <MenuSelect
            aria-label="Date range"
            value={period}
            onChange={(v) => {
              setPeriod(v);
              setPage(1);
              syncUrl({ period: v, page: "1" });
            }}
            options={LEADS_PERIODS.map((p) => ({ value: p.id, label: p.label }))}
          />
          <div className="min-w-[180px] flex-1 basis-[180px] sm:max-w-[240px] sm:flex-none">
            <SearchInput
              placeholder="Search leads..."
              value={search}
              onChange={(v) => {
                setSearch(v);
                syncUrl({ search: v.trim() || null, page: "1" });
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
                <div className="absolute right-0 z-30 mt-2 w-72 space-y-3 rounded-[12px] border border-sales-border bg-sales-surface p-4 shadow-sales-popover">
                  <p className="text-[12px] font-semibold text-sales-text-primary">Advanced filters</p>
                  <div>
                    <p className="mb-1.5 text-[11px] font-medium text-sales-text-muted">Intent</p>
                    <MenuSelect
                      aria-label="Intent"
                      size="sm"
                      value={intent}
                      onChange={(v) => {
                        setIntent(v);
                        setPage(1);
                        syncUrl({ intent: v === "all" ? null : v, page: "1" });
                      }}
                      options={LEADS_INTENT_FILTERS.map((i) => ({ value: i.id, label: i.label }))}
                    />
                  </div>
                  <div>
                    <p className="mb-1.5 text-[11px] font-medium text-sales-text-muted">Attention</p>
                    <MenuSelect
                      aria-label="Attention"
                      size="sm"
                      value={attention}
                      onChange={(v) => {
                        setAttention(v);
                        setPage(1);
                        syncUrl({ attention: v === "none" ? null : v, page: "1" });
                      }}
                      options={[
                        { value: "none" as const, label: "Any" },
                        { value: "hot" as const, label: "Hot leads" },
                        { value: "never_contacted" as const, label: "Never contacted" },
                        { value: "stale" as const, label: "Stale" },
                        { value: "follow_up_overdue" as const, label: "Follow-up overdue" },
                      ]}
                    />
                  </div>
                  {drawerFilterCount > 0 ? (
                    <button
                      type="button"
                      className="text-[12px] font-medium text-sales-text-secondary underline-offset-2 hover:underline"
                      onClick={clearAdvanced}
                    >
                      Clear filters
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
          </div>
          <Button
            variant="secondary"
            size="md"
            className="h-10 min-w-0 flex-1 rounded-[10px] md:hidden"
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
            leftIcon={<Plus size={16} strokeWidth={1.8} />}
            onClick={() => setAddOpen(true)}
          >
            Add lead
          </Button>
        </div>
      ) : null}

      {filtersOpen ? (
        <div className="md:hidden">
          <PremiumSheet
            title="Filters"
            description="Source, stage, period, and attention"
            onClose={() => setFiltersOpen(false)}
            footer={
              drawerFilterCount > 0 || source !== "all" || stage !== "all" || search.trim() ? (
                <Button
                  variant="secondary"
                  size="md"
                  className="w-full"
                  onClick={() => {
                    clearAdvanced();
                    setSource("all");
                    setStage("all");
                    setSearch("");
                    setPage(1);
                    syncUrl({
                      source: null,
                      stage: null,
                      search: null,
                      intent: null,
                      attention: null,
                      page: "1",
                    });
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          >
            <div className="space-y-4">
              <div>
                <p className="mb-1.5 text-[11px] font-medium text-sales-text-muted">Source</p>
                <MenuSelect
                  aria-label="Lead source"
                  value={source}
                  onChange={(v) => {
                    setSource(v);
                    setPage(1);
                    syncUrl({ source: v === "all" ? null : v, page: "1" });
                  }}
                  options={LEADS_SOURCES.map((s) => ({ value: s.id, label: s.label }))}
                />
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-medium text-sales-text-muted">Stage</p>
                <MenuSelect
                  aria-label="Stage"
                  value={stage}
                  onChange={(v) => {
                    setStage(v);
                    setPage(1);
                    syncUrl({ stage: v === "all" ? null : v, page: "1" });
                  }}
                  options={LEADS_STAGE_FILTERS.map((s) => ({ value: s.id, label: s.label }))}
                />
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-medium text-sales-text-muted">Date range</p>
                <MenuSelect
                  aria-label="Date range"
                  value={period}
                  onChange={(v) => {
                    setPeriod(v);
                    setPage(1);
                    syncUrl({ period: v, page: "1" });
                  }}
                  options={LEADS_PERIODS.map((p) => ({ value: p.id, label: p.label }))}
                />
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-medium text-sales-text-muted">Search</p>
                <SearchInput
                  placeholder="Search leads..."
                  value={search}
                  onChange={(v) => {
                    setSearch(v);
                    syncUrl({ search: v.trim() || null, page: "1" });
                  }}
                />
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-medium text-sales-text-muted">Intent</p>
                <MenuSelect
                  aria-label="Intent"
                  value={intent}
                  onChange={(v) => {
                    setIntent(v);
                    setPage(1);
                    syncUrl({ intent: v === "all" ? null : v, page: "1" });
                  }}
                  options={LEADS_INTENT_FILTERS.map((i) => ({ value: i.id, label: i.label }))}
                />
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-medium text-sales-text-muted">Attention</p>
                <MenuSelect
                  aria-label="Attention"
                  value={attention}
                  onChange={(v) => {
                    setAttention(v);
                    setPage(1);
                    syncUrl({ attention: v === "none" ? null : v, page: "1" });
                  }}
                  options={[
                    { value: "none" as const, label: "Any" },
                    { value: "hot" as const, label: "Hot leads" },
                    { value: "never_contacted" as const, label: "Never contacted" },
                    { value: "stale" as const, label: "Stale" },
                    { value: "follow_up_overdue" as const, label: "Follow-up overdue" },
                  ]}
                />
              </div>
            </div>
          </PremiumSheet>
        </div>
      ) : null}

      {loading && !data ? <LeadsSkeleton /> : null}

      {error && !data ? (
        <Card>
          <CardContent className="py-10">
            <EmptyState
              title="Couldn't load your leads"
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

      {neverLeads ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={<UsersRound size={20} strokeWidth={1.8} />}
              title="No leads yet"
              description="New enquiries and captured leads will appear here."
              action={
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<Plus size={16} strokeWidth={1.8} />}
                  onClick={() => setAddOpen(true)}
                >
                  Add lead
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : null}

      {data && !neverLeads ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <ReportKpiCard
              label="Total leads"
              value={String(data.kpis.total.value)}
              trend={data.kpis.total.trend}
              icon={UsersRound}
              iconTint="bg-[#F4F3FF] text-[#8B5CF6]"
            />
            <ReportKpiCard
              label={data.kpis.newInPeriod.label}
              value={String(data.kpis.newInPeriod.value)}
              icon={UserRoundPlus}
              iconTint="bg-[#FFFAEB] text-[#F59E0B]"
            />
            <ReportKpiCard
              label="Hot leads"
              value={String(data.kpis.hot.value)}
              icon={Target}
              iconTint="bg-sales-danger-soft text-sales-danger"
              tip="Score ≥ 70 (SegmiQ Hot threshold)."
            />
            <ReportKpiCard
              label="Won deals"
              value={String(data.kpis.won.value)}
              trend={data.kpis.won.trend}
              icon={Trophy}
              iconTint="bg-sales-success-soft text-[#16A34A]"
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
                data.kpis.conversionRate.value == null ? "No closed deals yet" : undefined
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
                  <h2 className="text-[14px] font-semibold text-sales-text-primary">Leads</h2>
                  {loading ? <Skeleton className="h-4 w-16" /> : null}
                </div>

                <div className="hidden md:block">
                  <DataTable className="rounded-none border-0 shadow-none">
                    <DataTableEl>
                      <DataTableHead>
                        <tr>
                          <DataTableTh>Lead</DataTableTh>
                          <DataTableTh>Contact</DataTableTh>
                          <DataTableTh className="hidden min-[1366px]:table-cell">Company</DataTableTh>
                          <DataTableTh>Source</DataTableTh>
                          <DataTableTh>Stage</DataTableTh>
                          <DataTableTh className="hidden lg:table-cell">Intent</DataTableTh>
                          <DataTableTh className="hidden xl:table-cell">Last contact</DataTableTh>
                          <DataTableTh className="w-12 text-right">
                            <span className="sr-only">Actions</span>
                          </DataTableTh>
                        </tr>
                      </DataTableHead>
                      <DataTableBody>
                        {data.leads.length === 0 ? (
                          <DataTableEmpty
                            colSpan={8}
                            title={
                              debouncedSearch.trim()
                                ? `No leads match “${debouncedSearch.trim()}”`
                                : "No leads match these filters"
                            }
                            description={
                              debouncedSearch.trim()
                                ? "Try another name, phone number, company or project."
                                : "Try clearing one or more filters."
                            }
                          />
                        ) : (
                          data.leads.map((row) => (
                            <LeadTableRow
                              key={row.id}
                              row={row}
                              selected={selectedId === row.id}
                              menuOpen={menuId === row.id}
                              onToggleMenu={(e) => {
                                e.stopPropagation();
                                setMenuId((id) => (id === row.id ? null : row.id));
                              }}
                              onOpen={() => openLead(row.id)}
                              onWhatsApp={() => void messageWhatsApp(row)}
                              onCall={() => {
                                if (row.phone) window.location.href = `tel:${row.phone}`;
                              }}
                              onQuote={() => {
                                openLeadPanel(row.id, "quote");
                                const sp = new URLSearchParams(searchParams.toString());
                                sp.set("lead", row.id);
                                sp.set("tab", "quote");
                                router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
                              }}
                              onTimeline={() => {
                                openLeadPanel(row.id, "timeline");
                                const sp = new URLSearchParams(searchParams.toString());
                                sp.set("lead", row.id);
                                sp.set("tab", "timeline");
                                router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
                              }}
                            />
                          ))
                        )}
                      </DataTableBody>
                    </DataTableEl>
                  </DataTable>
                </div>

                <div className="space-y-3 p-3 md:hidden">
                  {data.leads.length === 0 ? (
                    <EmptyState
                      size="compact"
                      title="No leads match these filters"
                      description="Try clearing one or more filters."
                    />
                  ) : (
                    data.leads.map((row) => (
                      <MobileLeadCard
                        key={row.id}
                        row={row}
                        onOpen={() => openLead(row.id)}
                        onWhatsApp={() => void messageWhatsApp(row)}
                      />
                    ))
                  )}
                </div>

                {data.meta.totalFiltered > 0 ? (
                  <div className="flex flex-col gap-3 border-t border-sales-border-subtle px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[12px] text-sales-text-muted">
                      Showing {showingFrom} to {showingTo} of {data.meta.totalFiltered} leads
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
                            setPage(1);
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
                          disabled={page <= 1}
                          onClick={() => {
                            const p = Math.max(1, page - 1);
                            setPage(p);
                            syncUrl({ page: String(p) });
                          }}
                        >
                          <ChevronLeft strokeWidth={1.8} />
                        </IconButton>
                        {Array.from({ length: Math.min(pageCount, 5) }, (_, i) => {
                          let n = i + 1;
                          if (pageCount > 5) {
                            const start = Math.min(Math.max(page - 2, 1), pageCount - 4);
                            n = start + i;
                          }
                          return (
                            <button
                              key={n}
                              type="button"
                              onClick={() => {
                                setPage(n);
                                syncUrl({ page: String(n) });
                              }}
                              className={cn(
                                "flex h-8 min-w-[32px] items-center justify-center rounded-[8px] px-2 text-[12px] font-medium",
                                n === page
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
                          disabled={page >= pageCount}
                          onClick={() => {
                            const p = Math.min(pageCount, page + 1);
                            setPage(p);
                            syncUrl({ page: String(p) });
                          }}
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
              <LeadsBySourceCard
                slices={data.bySource.slices}
                total={data.bySource.total}
                loading={loading}
              />
              <LeadStageOverviewCard
                slices={data.byStage.slices}
                total={data.byStage.total}
                loading={loading}
              />
              <HotLeadsCard
                leads={data.hotLeads}
                loading={loading}
                onOpen={openLead}
                onViewAll={applyHotFilter}
              />
            </div>
          </div>
        </>
      ) : null}

      {addOpen ? (
        <AddToHubSheet
          assignmentMode={assignmentMode}
          mode="salesperson"
          onClose={() => setAddOpen(false)}
          onSuccess={() => {
            setAddOpen(false);
            toast({ tone: "success", title: "Lead added", description: "Your lead list was updated." });
            void load();
          }}
        />
      ) : null}

      <LeadDetailPanel
        leads={panelLeads}
        onLeadUpdated={() => void load()}
        onClose={closeLeadUrl}
      />
    </div>
  );
}

function LeadTableRow({
  row,
  selected,
  menuOpen,
  onToggleMenu,
  onOpen,
  onWhatsApp,
  onCall,
  onQuote,
  onTimeline,
}: {
  row: LeadDirectoryRow;
  selected: boolean;
  menuOpen: boolean;
  onToggleMenu: (e: MouseEvent) => void;
  onOpen: () => void;
  onWhatsApp: () => void;
  onCall: () => void;
  onQuote: () => void;
  onTimeline: () => void;
}) {
  const phone = formatLeadPhone(row.phone);
  const last = formatLastContact(row.lastContactAt);

  return (
    <DataTableRow
      className="h-[62px] cursor-pointer"
      selected={selected}
      onClick={onOpen}
    >
      <DataTableTd>
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={formatLeadName(row.name, row.phone)} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-sales-text-primary">
              {formatLeadName(row.name, row.phone)}
            </p>
            {row.projectType ? (
              <p className="mt-0.5 truncate text-[12px] text-sales-text-muted">{row.projectType}</p>
            ) : null}
          </div>
        </div>
      </DataTableTd>
      <DataTableTd>
        {phone ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] tabular-nums text-sales-text-secondary">{phone}</span>
            <IconButton
              aria-label="WhatsApp"
              size="sm"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                onWhatsApp();
              }}
            >
              <SiWhatsapp size={14} color="#25D366" />
            </IconButton>
            <IconButton
              aria-label="Call"
              size="sm"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                onCall();
              }}
            >
              <Phone size={14} strokeWidth={1.8} />
            </IconButton>
          </div>
        ) : (
          <span className="text-[13px] text-sales-text-muted">—</span>
        )}
      </DataTableTd>
      <DataTableTd className="hidden min-[1366px]:table-cell">
        <div className="min-w-0">
          <p className="truncate text-[13px] text-sales-text-primary">{row.company || "—"}</p>
          {row.contextLine && row.company ? (
            <p className="mt-0.5 truncate text-[12px] text-sales-text-muted">{row.contextLine}</p>
          ) : null}
        </div>
      </DataTableTd>
      <DataTableTd>
        <span className="inline-flex items-center gap-1.5 text-[13px] text-sales-text-secondary">
          <SourceIcon sourceKey={row.sourceKey} />
          {row.sourceLabel}
        </span>
      </DataTableTd>
      <DataTableTd>
        <PipelineStageBadge status={row.status} label={formatLeadStage(row.status)} />
      </DataTableTd>
      <DataTableTd className="hidden lg:table-cell">
        {row.score != null ? (
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold tabular-nums text-sales-text-primary">
              {formatLeadScore(row.score)}
            </span>
            <LeadScoreBadge score={row.score} />
          </div>
        ) : (
          <span className="text-[13px] text-sales-text-muted">—</span>
        )}
      </DataTableTd>
      <DataTableTd className="hidden xl:table-cell">
        <div>
          <p
            className={cn(
              "text-[13px]",
              last.never ? "font-medium text-[#B54708]" : "text-sales-text-secondary"
            )}
          >
            {last.primary}
          </p>
          {last.secondary ? (
            <p className="text-[11px] text-sales-text-muted">{last.secondary}</p>
          ) : null}
          {row.followUpOverdue ? (
            <p className="text-[11px] font-medium text-sales-danger">Follow-up overdue</p>
          ) : row.isStale ? (
            <p className="text-[11px] font-medium text-[#B54708]">Stale</p>
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
              <MenuItem icon={<ExternalLink size={14} />} label="Open lead" onClick={onOpen} />
              <MenuItem icon={<SiWhatsapp size={14} color="#25D366" />} label="Message on WhatsApp" onClick={onWhatsApp} />
              {phone ? <MenuItem icon={<Phone size={14} />} label="Call" onClick={onCall} /> : null}
              <MenuItem icon={<FileText size={14} />} label="Create quote" onClick={onQuote} />
              <MenuItem icon={<Clock3 size={14} />} label="View timeline" onClick={onTimeline} />
              <Link
                href={`/sales/leads?lead=${row.id}`}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
              >
                <ExternalLink size={14} strokeWidth={1.8} />
                Open in pipeline
              </Link>
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

function MobileLeadCard({
  row,
  onOpen,
  onWhatsApp,
}: {
  row: LeadDirectoryRow;
  onOpen: () => void;
  onWhatsApp: () => void;
}) {
  const phone = formatLeadPhone(row.phone);
  const last = formatLastContact(row.lastContactAt);
  return (
    <div className="rounded-[12px] border border-sales-border bg-sales-surface p-3.5 shadow-sales-card">
      <button type="button" onClick={onOpen} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar name={formatLeadName(row.name, row.phone)} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-sales-text-primary">
                {formatLeadName(row.name, row.phone)}
              </p>
              {phone ? (
                <p className="mt-0.5 text-[13px] tabular-nums text-sales-text-secondary">{phone}</p>
              ) : null}
              <p className="mt-0.5 truncate text-[12px] text-sales-text-muted">
                {[row.projectType, row.location || row.company].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            {row.score != null ? (
              <p className="text-[13px] font-semibold tabular-nums">
                {formatLeadScore(row.score)}{" "}
                <span className="font-medium text-sales-text-muted">{row.scoreLabel}</span>
              </p>
            ) : null}
            <div className="mt-1">
              <PipelineStageBadge status={row.status} label={formatLeadStage(row.status)} />
            </div>
          </div>
        </div>
        <p className="mt-2 text-[12px] text-sales-text-muted">
          Last contact · {last.primary}
        </p>
      </button>
      <div className="mt-3 flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="h-11 flex-1 rounded-[10px]"
          leftIcon={<SiWhatsapp size={14} color="#25D366" />}
          onClick={onWhatsApp}
        >
          WhatsApp
        </Button>
        {phone ? (
          <Button
            variant="secondary"
            size="sm"
            className="h-11 flex-1 rounded-[10px]"
            leftIcon={<Phone size={14} strokeWidth={1.8} />}
            onClick={() => {
              window.location.href = `tel:${phone}`;
            }}
          >
            Call
          </Button>
        ) : null}
        <Button variant="primary" size="sm" className="h-11 flex-1 rounded-[10px]" onClick={onOpen}>
          Open
        </Button>
      </div>
    </div>
  );
}

function LeadsSkeleton() {
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
          <Skeleton className="h-[220px] rounded-sales-xl" />
          <Skeleton className="h-[200px] rounded-sales-xl" />
          <Skeleton className="h-[220px] rounded-sales-xl" />
        </div>
      </div>
    </div>
  );
}
