"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { CompanyKpiCard } from "@/components/dashboard/company/CompanyKpiCard";
import { CompanyWorkspaceShell } from "@/components/dashboard/company/CompanyWorkspaceShell";
import { CompanyDashboardHeader } from "@/components/dashboard/company/CompanyDashboardHeader";
import { useMediaQuery } from "@/components/dashboard/company/team/CompanyTeamInviteDialog";
import { Button, MenuSelect, ToastProvider } from "@/components/sales/ui";
import {
  LEAD_SOURCE_DATE_PRESETS,
  leadSourceCompanyKpis,
  leadSourceMatchesSearch,
  leadSourceMatchesTab,
  leadSourceTabCounts,
  parseLeadSourceCompanyTab,
  parseLeadSourceDatePreset,
  sortLeadSourceRows,
  type LeadSourceCompanySort,
  type LeadSourceCompanyTab,
  type LeadSourceRow,
} from "@/lib/real-estate/lead-sources";
import type { UserRole } from "@/types";
import type { CompanyLeadSourcesPageData } from "./types";
import { LeadSourcesTableCard } from "./LeadSourcesTableCard";
import { LeadSourceDetailPanel } from "./LeadSourceDetailPanel";

type Props = {
  data: CompanyLeadSourcesPageData;
  unreadNotifications: number;
  notificationRole: UserRole;
  userName: string;
  avatarUrl?: string | null;
  companyLogoUrl?: string | null;
  whatsappBadge?: number;
};

export function CompanyLeadSourcesPage(props: Props) {
  return (
    <ToastProvider>
      <CompanyLeadSourcesWorkspace {...props} />
    </ToastProvider>
  );
}

function CompanyLeadSourcesWorkspace({
  data,
  unreadNotifications,
  notificationRole,
  userName,
  avatarUrl,
  companyLogoUrl,
  whatsappBadge = 0,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const overlayPanel = useMediaQuery("(max-width: 1279px)");
  const stackedSplit = useMediaQuery("(max-width: 767px)");

  const [rows, setRows] = useState(data.rows);
  const [funnel, setFunnel] = useState(data.funnel);
  const [rangeLabel, setRangeLabel] = useState(data.rangeLabel);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<LeadSourceCompanyTab>(
    () => parseLeadSourceCompanyTab(searchParams.get("tab")) ?? "all"
  );
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<LeadSourceCompanySort>("inquiries_desc");
  const preset = parseLeadSourceDatePreset(searchParams.get("preset") ?? data.preset);
  const selectedId = searchParams.get("channel");

  useEffect(() => {
    setRows(data.rows);
    setFunnel(data.funnel);
    setRangeLabel(data.rangeLabel);
  }, [data.rows, data.funnel, data.rangeLabel]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const next = parseLeadSourceCompanyTab(searchParams.get("tab"));
    if (next) setTab(next);
  }, [searchParams]);

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (!value) params.delete(key);
        else params.set(key, value);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const lastPreset = useRef(data.preset);

  useEffect(() => {
    if (lastPreset.current === preset) return;
    lastPreset.current = preset;
    if (preset === data.preset) {
      setRows(data.rows);
      setFunnel(data.funnel);
      setRangeLabel(data.rangeLabel);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/clients/${data.clientId}/marketing/attribution?preset=${encodeURIComponent(preset)}`)
      .then((res) => res.json())
      .then((json: { sources?: LeadSourceRow[]; kpis?: CompanyLeadSourcesPageData["funnel"]; range?: { label?: string }; rates?: { inquiryToAccepted?: number | null } }) => {
        if (cancelled) return;
        const k = json.kpis;
        setRows(json.sources ?? []);
        setFunnel({
          inquiries: k?.inquiries ?? 0,
          qualified: k?.qualified ?? 0,
          viewings: k?.viewings ?? 0,
          offers: k?.offers ?? 0,
          accepted: k?.accepted ?? 0,
          conversion: json.rates?.inquiryToAccepted ?? null,
        });
        setRangeLabel(json.range?.label ?? "This month");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [preset, data.clientId, data.preset, data.rows, data.funnel, data.rangeLabel]);

  const kpis = useMemo(() => leadSourceCompanyKpis(funnel), [funnel]);
  const tabCounts = useMemo(() => leadSourceTabCounts(rows), [rows]);
  const filtered = useMemo(
    () => rows.filter((row) => leadSourceMatchesTab(row.sourceType, tab) && leadSourceMatchesSearch(row, debouncedSearch)),
    [rows, tab, debouncedSearch]
  );
  const sorted = useMemo(() => sortLeadSourceRows(filtered, sort), [filtered, sort]);
  const selectedRow = useMemo(
    () => rows.find((row) => row.sourceType === selectedId) ?? null,
    [rows, selectedId]
  );

  useEffect(() => {
    if (!selectedId) return;
    if (!rows.some((row) => row.sourceType === selectedId)) {
      setParams({ channel: null });
      return;
    }
    if (!filtered.some((row) => row.sourceType === selectedId) && tab !== "all") {
      setTab("all");
      setParams({ tab: null });
    }
  }, [selectedId, rows, filtered, tab, setParams]);

  const emptyKind: "none" | "search" | "rows" =
    rows.filter((row) => leadSourceMatchesTab(row.sourceType, tab)).length === 0 && !debouncedSearch.trim()
      ? "none"
      : sorted.length === 0
        ? "search"
        : "rows";

  const table = (
    <LeadSourcesTableCard
      rows={sorted}
      tab={tab}
      tabCounts={tabCounts}
      onTabChange={(next) => {
        setTab(next);
        setParams({ tab: next === "all" ? null : next });
      }}
      search={search}
      onSearchChange={setSearch}
      sort={sort}
      onSortChange={setSort}
      selectedId={selectedId}
      onSelect={(id) => setParams({ channel: id })}
      emptyKind={emptyKind}
      searchQuery={debouncedSearch}
      onClearSearch={() => setSearch("")}
      rangeLabel={loading ? "Updating…" : rangeLabel}
    />
  );

  const panel = selectedRow ? (
    <LeadSourceDetailPanel
      key={selectedRow.sourceType}
      row={selectedRow}
      rangeLabel={rangeLabel}
      onClose={() => setParams({ channel: null })}
      onViewInquiries={() => router.push("/client/leads")}
      onOpenMarketing={() => router.push("/client/marketing")}
      overlay={overlayPanel}
      stacked={stackedSplit}
    />
  ) : null;

  return (
    <CompanyWorkspaceShell
      companyName={data.clientName}
      companyLogoUrl={companyLogoUrl}
      userName={userName}
      avatarUrl={avatarUrl}
      unreadNotifications={unreadNotifications}
      notificationRole={notificationRole}
      whatsappBadge={whatsappBadge}
      businessType="real_estate"
      hideMobileChrome={stackedSplit && Boolean(selectedId)}
    >
      <CompanyDashboardHeader
        unreadNotifications={unreadNotifications}
        notificationRole={notificationRole}
        userName={userName}
        avatarUrl={avatarUrl}
        canAddLead={false}
        breadcrumb="Company / Lead Sources"
        title="Lead sources"
        description="Where inquiries came from, and whether they progressed to qualification, viewing and offer."
        primaryAction={
          <Button
            variant="primary"
            size="md"
            rightIcon={<ArrowUpRight size={15} strokeWidth={1.8} />}
            onClick={() => router.push("/client/leads")}
          >
            View inquiries
          </Button>
        }
        titleActions={
          <div className="flex flex-wrap items-center gap-2">
            <MenuSelect
              value={preset}
              onChange={(value) => setParams({ preset: value === "this_month" ? null : value })}
              aria-label="Date range"
              options={LEAD_SOURCE_DATE_PRESETS.map((item) => ({ value: item.id, label: item.label }))}
            />
            <Button
              variant="primary"
              size="md"
              className="layout:hidden"
              rightIcon={<ArrowUpRight size={15} strokeWidth={1.8} />}
              onClick={() => router.push("/client/leads")}
            >
              View inquiries
            </Button>
          </div>
        }
      />

      <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" data-course-target="company-lead-sources-kpis">
        {kpis.map((item) => (
          <CompanyKpiCard key={item.id} item={item} />
        ))}
      </div>

      {selectedId && !overlayPanel ? (
        <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,30%)]">
          {table}
          <div className="min-h-0 xl:sticky xl:top-0">{panel}</div>
        </div>
      ) : (
        table
      )}

      {selectedId && overlayPanel ? panel : null}
    </CompanyWorkspaceShell>
  );
}
