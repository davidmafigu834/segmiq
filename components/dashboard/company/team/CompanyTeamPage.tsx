"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CompanyKpiCard } from "../CompanyKpiCard";
import { CompanyWorkspaceShell } from "../CompanyWorkspaceShell";
import { CompanyDashboardHeader } from "../CompanyDashboardHeader";
import { CompanyTeamTableCard } from "./CompanyTeamTableCard";
import { CompanyTeamMemberPanel } from "./CompanyTeamMemberPanel";
import { CompanyTeamAnalyticsRow } from "./CompanyTeamAnalyticsRow";
import { CompanyTeamInviteDialog, useMediaQuery } from "./CompanyTeamInviteDialog";
import { SetGoalDialog } from "@/components/sales/goals/SetGoalDialog";
import { parseGoalPeriodKey } from "@/lib/sales/goals/period";
import {
  COMPANY_TEAM_PAGE_SIZE,
  companyTeamFiltersActive,
  matchesCompanyTeamFilters,
  matchesCompanyTeamSearch,
  matchesCompanyTeamTab,
} from "@/lib/sales/company-team-metrics";
import type {
  CompanyTeamFilters,
  CompanyTeamMemberOverview,
  CompanyTeamMemberTableRow,
  CompanyTeamPageData,
  CompanyTeamTab,
} from "./types";
import { DEFAULT_COMPANY_TEAM_FILTERS } from "./types";
import type { UserRole } from "@/types";

export function CompanyTeamPage({
  data,
  unreadNotifications,
  notificationRole,
  userName,
  avatarUrl,
  companyLogoUrl,
  whatsappBadge = 0,
}: {
  data: CompanyTeamPageData;
  unreadNotifications: number;
  notificationRole: UserRole;
  userName: string;
  avatarUrl?: string | null;
  companyLogoUrl?: string | null;
  whatsappBadge?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const overlayPanel = useMediaQuery("(max-width: 1279px)");
  const stackedSplit = useMediaQuery("(max-width: 767px)");

  const [tab, setTab] = useState<CompanyTeamTab>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<CompanyTeamFilters>(DEFAULT_COMPANY_TEAM_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(COMPANY_TEAM_PAGE_SIZE);
  const [overview, setOverview] = useState<CompanyTeamMemberOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [goalRow, setGoalRow] = useState<CompanyTeamMemberTableRow | null>(null);

  const selectedId = searchParams.get("member");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 200);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (searchParams.get("invite") === "1" && data.canManageTeam) {
      setInviteOpen(true);
    }
  }, [searchParams, data.canManageTeam]);

  const filtered = useMemo(() => {
    return data.members.filter(
      (m) =>
        matchesCompanyTeamTab(tab, m) &&
        matchesCompanyTeamSearch(debouncedSearch, m) &&
        matchesCompanyTeamFilters(filters, m)
    );
  }, [data.members, tab, debouncedSearch, filters]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [tab, debouncedSearch, filters, pageSize]);

  const selectedRow = useMemo(
    () => data.members.find((m) => m.id === selectedId) ?? null,
    [data.members, selectedId]
  );

  const setMemberParam = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set("member", id);
      else params.delete("member");
      params.delete("invite");
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const loadOverview = useCallback(
    async (memberId: string) => {
      setOverviewLoading(true);
      setOverviewError(null);
      try {
        const qs = new URLSearchParams();
        if (data.clientId) qs.set("clientId", data.clientId);
        const res = await fetch(`/api/client/team/${memberId}?${qs}`);
        if (!res.ok) {
          setOverview(null);
          setOverviewError("Failed");
          return;
        }
        const json = (await res.json()) as CompanyTeamMemberOverview;
        setOverview(json);
      } catch {
        setOverview(null);
        setOverviewError("Failed");
      } finally {
        setOverviewLoading(false);
      }
    },
    [data.clientId]
  );

  useEffect(() => {
    if (!selectedId) {
      setOverview(null);
      setOverviewError(null);
      return;
    }
    if (!data.members.some((m) => m.id === selectedId)) {
      setMemberParam(null);
      return;
    }
    void loadOverview(selectedId);
  }, [selectedId, data.members, loadOverview, setMemberParam]);

  const emptyKind =
    data.emptyState.noTeam && tab === "all" && !debouncedSearch && !companyTeamFiltersActive(filters)
      ? "none"
      : filtered.length === 0
        ? debouncedSearch
          ? "search"
          : companyTeamFiltersActive(filters) || tab !== "all"
            ? "filters"
            : "none"
        : "rows";

  const panelOpen = Boolean(selectedId && selectedRow);

  async function deactivate(row: CompanyTeamMemberTableRow) {
    if (!window.confirm(`Deactivate ${row.name}? They will lose access to SegmiQ.`)) return;
    await fetch(`/api/clients/${data.clientId}/users/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: false }),
    });
    router.refresh();
  }

  const left = (
    <div className="min-w-0 space-y-4">
      <CompanyTeamTableCard
        rows={pageRows}
        total={filtered.length}
        tab={tab}
        onTabChange={setTab}
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFiltersChange={setFilters}
        page={safePage}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        selectedId={selectedId}
        onSelect={(id) => setMemberParam(id)}
        canManage={data.canManageTeam}
        canSetGoals={data.canSetGoals}
        canReassign={data.canReassignLeads}
        onViewProfile={(id) => router.push(`/client/team/${id}`)}
        onSetGoal={setGoalRow}
        onReassign={(id) => router.push(`/client/leads?assignedToId=${id}`)}
        onDeactivate={(row) => void deactivate(row)}
        onInvite={() => setInviteOpen(true)}
        emptyKind={emptyKind}
      />
      <CompanyTeamAnalyticsRow
        composition={data.composition}
        compositionTotal={data.compositionTotal}
        teamAvgPct={data.goalCoverage.teamAvgPct}
        coverageBuckets={data.goalCoverage.buckets}
        needingSupport={data.needingSupport}
        onSelectMember={(id) => setMemberParam(id)}
        onViewSupport={() => {
          setTab("all");
          setFilters({ ...DEFAULT_COMPANY_TEAM_FILTERS, attention: "needs_attention" });
        }}
        onViewComposition={() => {
          setTab("all");
          setFilters(DEFAULT_COMPANY_TEAM_FILTERS);
          setSearch("");
        }}
      />
    </div>
  );

  return (
    <CompanyWorkspaceShell
      companyName={data.clientName}
      companyLogoUrl={companyLogoUrl}
      userName={userName}
      avatarUrl={avatarUrl}
      unreadNotifications={unreadNotifications}
      notificationRole={notificationRole}
      whatsappBadge={whatsappBadge}
      businessType={data.businessType}
    >
      <CompanyDashboardHeader
        unreadNotifications={unreadNotifications}
        notificationRole={notificationRole}
        userName={userName}
        avatarUrl={avatarUrl}
        canAddLead
        breadcrumb={data.businessType === "real_estate" ? "Company / Agents" : "Company / Team"}
        title={data.businessType === "real_estate" ? "Agents" : "Team"}
        description={
          data.businessType === "real_estate"
            ? "Manage your agents, monitor performance, and coach where attention is needed."
            : "Manage your sales team, monitor performance, and coach where attention is needed."
        }
      />

      <div className="grid w-full grid-cols-2 gap-3 min-[900px]:grid-cols-3 xl:grid-cols-5">
        {data.kpis.map((item) => (
          <CompanyKpiCard key={item.id} item={item} />
        ))}
      </div>

      {panelOpen && !overlayPanel ? (
        <div className="grid grid-cols-1 items-stretch gap-4 transition-[grid-template-columns] duration-200 xl:grid-cols-[minmax(0,1fr)_minmax(400px,32%)] xl:gap-[18px]">
          {left}
          <div className="min-h-0 xl:sticky xl:top-0">
            <CompanyTeamMemberPanel
              row={selectedRow}
              overview={overview}
              loading={overviewLoading}
              error={overviewError}
              onRetry={() => selectedId && void loadOverview(selectedId)}
              onClose={() => setMemberParam(null)}
              onViewProfile={() => selectedId && router.push(`/client/team/${selectedId}`)}
              onReassign={() => selectedId && router.push(`/client/leads?assignedToId=${selectedId}`)}
              onSetGoal={() => selectedRow && setGoalRow(selectedRow)}
              onViewPipeline={() => router.push("/client/leads/pipeline")}
              canReassign={data.canReassignLeads}
              canSetGoals={data.canSetGoals}
              stacked={stackedSplit}
            />
          </div>
        </div>
      ) : (
        left
      )}

      {panelOpen && overlayPanel ? (
        <CompanyTeamMemberPanel
          row={selectedRow}
          overview={overview}
          loading={overviewLoading}
          error={overviewError}
          onRetry={() => selectedId && void loadOverview(selectedId)}
          onClose={() => setMemberParam(null)}
          onViewProfile={() => selectedId && router.push(`/client/team/${selectedId}`)}
          onReassign={() => selectedId && router.push(`/client/leads?assignedToId=${selectedId}`)}
          onSetGoal={() => selectedRow && setGoalRow(selectedRow)}
          onViewPipeline={() => router.push("/client/leads/pipeline")}
          canReassign={data.canReassignLeads}
          canSetGoals={data.canSetGoals}
          stacked={stackedSplit}
          overlay
        />
      ) : null}

      {inviteOpen ? (
        <CompanyTeamInviteDialog
          clientId={data.clientId}
          onClose={() => {
            setInviteOpen(false);
            const params = new URLSearchParams(searchParams.toString());
            params.delete("invite");
            const q = params.toString();
            router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
          }}
          onInvited={() => router.refresh()}
        />
      ) : null}

      {goalRow ? (
        <SetGoalDialog
          mode={goalRow.hasGoal ? "edit" : "create"}
          goalId={goalRow.goalId}
          initialPeriodKey={parseGoalPeriodKey(null)}
          initialTarget={goalRow.goalTarget ?? undefined}
          currency={goalRow.goalCurrency || data.currency}
          salespersonId={goalRow.id}
          onClose={() => setGoalRow(null)}
          onSuccess={() => {
            setGoalRow(null);
            if (selectedId) void loadOverview(selectedId);
            router.refresh();
          }}
        />
      ) : null}
    </CompanyWorkspaceShell>
  );
}
