"use client";

import Link from "next/link";
import { KpiCard } from "@/components/dashboard/sales/KpiCard";
import { PipelineSnapshotCard } from "@/components/dashboard/sales/PipelineSnapshotCard";
import { CompanyDashboardHeader } from "./CompanyDashboardHeader";
import { CompanyFocusAreasCard } from "./CompanyFocusAreasCard";
import { CompanyTeamPerformanceCard } from "./CompanyTeamPerformanceCard";
import { CompanyFunnelCard } from "./CompanyFunnelCard";
import { CompanyLeadSourcesCard } from "./CompanyLeadSourcesCard";
import { CompanyDealsAtRiskCard } from "./CompanyDealsAtRiskCard";
import { CompanyRevenueTrendCard } from "./CompanyRevenueTrendCard";
import { CompanyRecentActivityCard } from "./CompanyRecentActivityCard";
import type { CompanySalesDashboardData } from "./types";
import type { UserRole } from "@/types";

export function CompanyDashboard({
  data,
  unreadNotifications,
  notificationRole,
}: {
  data: CompanySalesDashboardData;
  unreadNotifications: number;
  notificationRole: UserRole;
}) {
  return (
    <div className="sales-dashboard-premium flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-sales-bg text-sales-text-primary">
      <div className="sales-mobile-scroll min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-28 pt-3 sm:space-y-5 sm:px-6 layout:px-8 layout:py-6 layout:pb-10">
      <CompanyDashboardHeader
        unreadNotifications={unreadNotifications}
        notificationRole={notificationRole}
        canAddLead
      />

      {/* Mobile: Focus Areas first (actionable problems) */}
      <div className="layout:hidden">
        <CompanyFocusAreasCard
          signals={data.focusAreas}
          viewAllHref={data.focusAreasViewAllHref}
        />
      </div>

      {/* KPI row — 2 col mobile, 3 mid, 6 desktop */}
      <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-3 xl:grid-cols-6">
        {data.kpis.map((item) => (
          <KpiCard key={item.id} item={item} />
        ))}
      </div>

      {/* Desktop: Focus + Funnel */}
      <div className="hidden gap-4 layout:grid layout:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] layout:gap-5">
        <CompanyFocusAreasCard
          signals={data.focusAreas}
          viewAllHref={data.focusAreasViewAllHref}
        />
        <CompanyFunnelCard
          stages={data.funnel}
          conversionRate={data.conversionRate}
          conversionDefinition={data.conversionDefinition}
        />
      </div>

      {/* Team + Sources */}
      <div className="grid grid-cols-1 gap-4 layout:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] layout:gap-5">
        <CompanyTeamPerformanceCard
          rows={data.team}
          teamTotal={data.teamTotal}
          viewAllHref={data.teamViewAllHref}
        />
        <div className="space-y-4 layout:space-y-5">
          <div className="layout:hidden">
            <CompanyFunnelCard
              stages={data.funnel}
              conversionRate={data.conversionRate}
              conversionDefinition={data.conversionDefinition}
            />
          </div>
          <CompanyLeadSourcesCard sources={data.sources} empty={data.sourcesEmpty} />
        </div>
      </div>

      {/* Pipeline snapshot */}
      {data.hasActiveDeals ? (
        <PipelineSnapshotCard
          stages={data.pipelineSnapshot}
          viewAllHref="/client/leads/pipeline"
        />
      ) : (
        <div className="rounded-[14px] border border-sales-border bg-sales-surface px-5 py-8 text-center">
          <p className="text-[13px] font-medium text-sales-text-primary">No active Deals yet</p>
          <p className="mt-1 text-[12px] text-sales-text-muted">
            Qualified opportunities will appear here once your sales team creates Deals from Leads.
          </p>
          <Link
            href="/client/leads"
            className="mt-3 inline-flex min-h-11 items-center text-[13px] font-semibold text-sales-brand-fg hover:underline"
          >
            View Leads
          </Link>
        </div>
      )}

      {/* At risk + Revenue + Activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3 layout:gap-5">
        <CompanyDealsAtRiskCard
          items={data.atRiskDeals}
          total={data.atRiskTotal}
          viewAllHref={data.atRiskViewAllHref}
          hasActiveDeals={data.hasActiveDeals}
        />
        <CompanyRevenueTrendCard
          points={data.revenueTrend}
          totalLabel={data.revenueTotalLabel}
          compare={data.revenueTrendCompare}
          hasHistory={data.hasRevenueHistory}
        />
        <CompanyRecentActivityCard items={data.recentActivity} />
      </div>
      </div>
    </div>
  );
}
