"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { CompanySidebar } from "@/components/company/navigation/CompanySidebar";
import { CompanyMobileTopBar } from "@/components/company/navigation/CompanyMobileTopBar";
import { CompanyBottomNav } from "@/components/company/navigation/CompanyBottomNav";
import { useCompanySidebarCollapsed } from "@/lib/sales/navigation/use-company-sidebar-collapsed";
import { KpiCard } from "@/components/dashboard/sales/KpiCard";
import { PipelineSnapshotCard } from "@/components/dashboard/sales/PipelineSnapshotCard";
import { CompanyDashboardHeader } from "./CompanyDashboardHeader";
import { CompanyFocusAreasCard } from "./CompanyFocusAreasCard";
import { CompanyTeamCalendarCard } from "./CompanyTeamCalendarCard";
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
  userName,
  avatarUrl,
  companyLogoUrl,
  whatsappBadge = 0,
}: {
  data: CompanySalesDashboardData;
  unreadNotifications: number;
  notificationRole: UserRole;
  userName: string;
  avatarUrl?: string | null;
  companyLogoUrl?: string | null;
  whatsappBadge?: number;
}) {
  const [mounted, setMounted] = useState(false);
  const { collapsed, toggleCollapsed, width } = useCompanySidebarCollapsed();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="sales-dashboard-premium flex h-full min-h-0 flex-1 flex-col bg-sales-bg" />
    );
  }

  return (
    <div
      className="sales-dashboard-premium flex h-full max-h-[100dvh] min-h-0 flex-col overflow-hidden bg-sales-bg text-sales-text-primary"
      data-sidebar-collapsed={collapsed ? "true" : "false"}
      style={{ ["--sales-sidebar-current-width" as string]: `${width}px` } as CSSProperties}
    >
      <div className="hidden layout:contents">
        <CompanySidebar
          companyName={data.clientName}
          companyLogoUrl={companyLogoUrl}
          userName={userName}
          userRoleLabel="Company Manager"
          avatarUrl={avatarUrl}
          whatsappBadge={whatsappBadge}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
      </div>

      <CompanyMobileTopBar
        userName={userName}
        userRoleLabel="Company Manager"
        avatarUrl={avatarUrl}
        unreadNotifications={unreadNotifications}
        notificationRole={notificationRole}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden transition-[padding] duration-200 ease-out layout:pl-[var(--sales-sidebar-current-width)]">
        <div className="sales-mobile-scroll min-h-0 min-w-0 w-full max-w-none flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-4 pt-3 sm:space-y-5 sm:px-6 layout:px-8 layout:py-6">
          <CompanyDashboardHeader
            unreadNotifications={unreadNotifications}
            notificationRole={notificationRole}
            userName={userName}
            avatarUrl={avatarUrl}
            canAddLead
          />

          <div className="layout:hidden">
            <CompanyFocusAreasCard
              signals={data.focusAreas}
              viewAllHref={data.focusAreasViewAllHref}
            />
          </div>

          <div className="grid w-full grid-cols-2 gap-3 min-[900px]:grid-cols-3 xl:grid-cols-6">
            {data.kpis.map((item) => (
              <KpiCard key={item.id} item={item} />
            ))}
          </div>

          <div className="hidden layout:block">
            <CompanyFocusAreasCard
              signals={data.focusAreas}
              viewAllHref={data.focusAreasViewAllHref}
            />
          </div>

          <div className="grid w-full grid-cols-1 gap-4 layout:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] layout:gap-5">
            <CompanyTeamCalendarCard
              items={data.teamCalendar}
              overdueCount={data.teamCalendarOverdueCount}
            />
            <div className="hidden layout:block">
              <CompanyFunnelCard
                stages={data.funnel}
                conversionRate={data.conversionRate}
                conversionDefinition={data.conversionDefinition}
              />
            </div>
          </div>

          <div className="grid w-full grid-cols-1 gap-4 layout:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.95fr)] layout:gap-5">
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

          {data.hasActiveDeals ? (
            <PipelineSnapshotCard
              stages={data.pipelineSnapshot}
              viewAllHref="/client/leads/pipeline"
            />
          ) : (
            <div className="rounded-[14px] border border-sales-border bg-sales-surface px-5 py-8 text-center">
              <p className="text-[13px] font-medium text-sales-text-primary">No active Deals yet</p>
              <p className="mt-1 text-[12px] text-sales-text-muted">
                Qualified opportunities will appear here once your sales team creates Deals from
                Leads.
              </p>
              <Link
                href="/client/leads"
                className="mt-3 inline-flex min-h-11 items-center text-[13px] font-semibold text-sales-brand-fg hover:underline"
              >
                View Leads
              </Link>
            </div>
          )}

          <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3 layout:gap-5">
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

      <CompanyBottomNav whatsappBadge={whatsappBadge} />
    </div>
  );
}
