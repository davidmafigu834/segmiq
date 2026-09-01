"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { CompanyKpiCard } from "@/components/dashboard/company/CompanyKpiCard";
import { CompanyWorkspaceShell } from "@/components/dashboard/company/CompanyWorkspaceShell";
import { CompanyDashboardHeader } from "@/components/dashboard/company/CompanyDashboardHeader";
import { useMediaQuery } from "@/components/dashboard/company/team/CompanyTeamInviteDialog";
import { Button, useSalesToast } from "@/components/sales/ui";
import {
  DEFAULT_VIEWING_COMPANY_FILTERS,
  VIEWING_COMPANY_PAGE_SIZE,
  parseViewingCompanyTab,
  sortViewingCompanyRows,
  viewingCompanyFiltersActive,
  viewingCompanyKpis,
  viewingCompanyTabCounts,
  viewingMatchesCompanyFilters,
  viewingMatchesCompanyTab,
  viewingMatchesSearch,
  type ViewingCompanyFilters,
  type ViewingCompanySort,
  type ViewingCompanyTab,
} from "@/lib/real-estate/viewings";
import type { UserRole } from "@/types";
import type { CompanyViewingsPageData, ViewingWorkspaceRow } from "./types";
import { ViewingsTableCard } from "./ViewingsTableCard";
import { ViewingDetailPanel } from "./ViewingDetailPanel";
import { ScheduleViewingSheet } from "./ScheduleViewingSheet";

type CompanyViewingsPageProps = {
  data: CompanyViewingsPageData;
  unreadNotifications: number;
  notificationRole: UserRole;
  userName: string;
  avatarUrl?: string | null;
  companyLogoUrl?: string | null;
  whatsappBadge?: number;
};

export function CompanyViewingsPage({
  data,
  unreadNotifications,
  notificationRole,
  userName,
  avatarUrl,
  companyLogoUrl,
  whatsappBadge = 0,
}: CompanyViewingsPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useSalesToast();
  const overlayPanel = useMediaQuery("(max-width: 1279px)");
  const stackedSplit = useMediaQuery("(max-width: 767px)");

  const [rows, setRows] = useState(data.rows);
  const [tab, setTab] = useState<ViewingCompanyTab>(
    () => parseViewingCompanyTab(searchParams.get("tab")) ?? "upcoming"
  );
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<ViewingCompanyFilters>(() => {
    const agentId = searchParams.get("agentId");
    const feedback = searchParams.get("feedback");
    return {
      ...DEFAULT_VIEWING_COMPANY_FILTERS,
      ...(agentId ? { agentId } : {}),
      ...(feedback === "awaiting" || feedback === "recorded" ? { feedback } : {}),
    };
  });
  const [sort, setSort] = useState<ViewingCompanySort>("soonest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(VIEWING_COMPANY_PAGE_SIZE);
  const [busy, setBusy] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const selectedId = searchParams.get("viewing");

  useEffect(() => {
    setRows(data.rows);
  }, [data.rows]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const next = parseViewingCompanyTab(searchParams.get("tab"));
    if (next) setTab(next);
    const feedback = searchParams.get("feedback");
    if (feedback === "awaiting" || feedback === "recorded") {
      setFilters((prev) => (prev.feedback === feedback ? prev : { ...prev, feedback }));
    }
  }, [searchParams]);

  const setViewingParam = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set("viewing", id);
      else params.delete("viewing");
      const query = params.toString();
      const href = query ? `${pathname}?${query}` : pathname;
      if (id) router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const setTabParam = useCallback(
    (next: ViewingCompanyTab) => {
      setTab(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === "upcoming") params.delete("tab");
      else params.set("tab", next);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const kpis = useMemo(() => viewingCompanyKpis(rows), [rows]);
  const tabCounts = useMemo(() => viewingCompanyTabCounts(rows), [rows]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (row) =>
          viewingMatchesCompanyTab(row, tab) &&
          viewingMatchesSearch(row, debouncedSearch) &&
          viewingMatchesCompanyFilters(row, filters)
      ),
    [rows, tab, debouncedSearch, filters]
  );
  const sorted = useMemo(() => sortViewingCompanyRows(filtered, sort), [filtered, sort]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [tab, debouncedSearch, filters, sort, pageSize]);

  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId]
  );

  useEffect(() => {
    if (!selectedId) return;
    if (!rows.some((row) => row.id === selectedId)) {
      setViewingParam(null);
      return;
    }
    if (!filtered.some((row) => row.id === selectedId) && tab !== "all") setTabParam("all");
  }, [selectedId, rows, filtered, tab, setViewingParam, setTabParam]);

  function call(row: ViewingWorkspaceRow) {
    if (row.contact_phone) window.location.href = `tel:${row.contact_phone}`;
    else toast({ title: "No phone number is recorded for this buyer.", tone: "info" });
  }

  function whatsapp(row: ViewingWorkspaceRow) {
    const digits = row.contact_phone?.replace(/[^\d]/g, "") ?? "";
    if (digits) window.open(`https://wa.me/${digits}`, "_blank", "noopener,noreferrer");
    else toast({ title: "No WhatsApp number is recorded for this buyer.", tone: "info" });
  }

  async function patchViewing(
    id: string,
    body: Record<string, unknown>,
    successTitle: string
  ): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(`/api/clients/${data.clientId}/viewings?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast({ title: "Could not update this viewing.", tone: "error" });
        return false;
      }
      setRows((prev) =>
        prev.map((row) =>
          row.id === id
            ? {
                ...row,
                status: typeof body.status === "string" ? body.status : row.status,
                feedback_text:
                  body.feedback_text === undefined ? row.feedback_text : (body.feedback_text as string | null),
                feedback_sentiment:
                  body.feedback_sentiment === undefined
                    ? row.feedback_sentiment
                    : (body.feedback_sentiment as string | null),
              }
            : row
        )
      );
      toast({ title: successTitle, tone: "success" });
      return true;
    } finally {
      setBusy(false);
    }
  }

  const tabScoped = rows.filter((row) => viewingMatchesCompanyTab(row, tab));
  const emptyKind: "none" | "search" | "filters" | "rows" =
    tabScoped.length === 0 && !debouncedSearch.trim() && !viewingCompanyFiltersActive(filters)
      ? "none"
      : filtered.length === 0
        ? debouncedSearch.trim()
          ? "search"
          : "filters"
        : "rows";

  const table = (
    <ViewingsTableCard
      rows={paged}
      total={sorted.length}
      tab={tab}
      tabCounts={tabCounts}
      onTabChange={setTabParam}
      search={search}
      onSearchChange={setSearch}
      filters={filters}
      onFiltersChange={setFilters}
      sort={sort}
      onSortChange={setSort}
      page={safePage}
      pageSize={pageSize}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      selectedId={selectedId}
      onSelect={setViewingParam}
      agents={data.agents}
      onCall={call}
      onWhatsApp={whatsapp}
      onComplete={(row) => setViewingParam(row.id)}
      onClearSearch={() => setSearch("")}
      onClearFilters={() => setFilters(DEFAULT_VIEWING_COMPANY_FILTERS)}
      onSchedule={() => setScheduling(true)}
      emptyKind={emptyKind}
      searchQuery={debouncedSearch}
    />
  );

  const panel = selectedRow ? (
    <ViewingDetailPanel
      key={selectedRow.id}
      row={selectedRow}
      busy={busy}
      onClose={() => setViewingParam(null)}
      onCall={() => call(selectedRow)}
      onWhatsApp={() => whatsapp(selectedRow)}
      onComplete={(feedback) =>
        void patchViewing(
          selectedRow.id,
          {
            status: "completed",
            feedback_text: feedback?.text || null,
            feedback_sentiment: feedback?.sentiment || null,
          },
          "Viewing completed"
        )
      }
      onCancel={() => void patchViewing(selectedRow.id, { status: "cancelled" }, "Viewing cancelled")}
      onSaveFeedback={(feedback) =>
        void patchViewing(
          selectedRow.id,
          {
            feedback_text: feedback.text || null,
            feedback_sentiment: feedback.sentiment,
          },
          "Feedback saved"
        )
      }
      onOpenClient={() => router.push(`/client/contacts/${selectedRow.contact_id}`)}
      onOpenListing={() => router.push(`/client/listings/${selectedRow.listing_id}`)}
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
        breadcrumb="Company / Viewings"
        title="Viewings"
        description="Upcoming and completed property appointments across the team."
        primaryAction={
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus size={16} strokeWidth={1.8} />}
            onClick={() => setScheduling(true)}
          >
            Schedule viewing
          </Button>
        }
        titleActions={
          <Button
            variant="primary"
            size="md"
            className="layout:hidden"
            leftIcon={<Plus size={16} strokeWidth={1.8} />}
            onClick={() => setScheduling(true)}
          >
            Schedule viewing
          </Button>
        }
      />

      <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" data-course-target="company-viewings-kpis">
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

      {scheduling ? (
        <ScheduleViewingSheet
          clientId={data.clientId}
          listings={data.listings}
          agents={data.agents}
          onClose={() => setScheduling(false)}
          onCreated={(id) => {
            setScheduling(false);
            toast({ title: "Viewing scheduled", tone: "success" });
            router.refresh();
            setViewingParam(id);
          }}
        />
      ) : null}
    </CompanyWorkspaceShell>
  );
}
