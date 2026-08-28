"use client";

import { CompanyWorkspaceShell } from "./CompanyWorkspaceShell";
import { CompanyDashboardHeader } from "./CompanyDashboardHeader";
import { CompanyKpiCard } from "./CompanyKpiCard";
import { CompanyFocusAreasCard } from "./CompanyFocusAreasCard";
import { CompanyTeamCalendarCard } from "./CompanyTeamCalendarCard";
import { CompanyFunnelCard } from "./CompanyFunnelCard";
import { CompanyTeamPerformanceCard } from "./CompanyTeamPerformanceCard";
import { CompanyLeadSourcesCard } from "./CompanyLeadSourcesCard";
import { CompanyPipelineSnapshotCard } from "./CompanyPipelineSnapshotCard";
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
  return (
    <CompanyWorkspaceShell
      companyName={data.clientName}
      companyLogoUrl={companyLogoUrl}
      userName={userName}
      avatarUrl={avatarUrl}
      unreadNotifications={unreadNotifications}
      notificationRole={notificationRole}
      whatsappBadge={whatsappBadge}
    >
      <CompanyDashboardHeader
        unreadNotifications={unreadNotifications}
        notificationRole={notificationRole}
        userName={userName}
        avatarUrl={avatarUrl}
        canAddLead
      />

      <div className="layout:hidden">
        <CompanyFocusAreasCard signals={data.focusAreas} viewAllHref={data.focusAreasViewAllHref} />
      </div>

      <div className="dashboard-group relative z-[1] grid w-full grid-cols-2 gap-3 min-[900px]:grid-cols-3 xl:grid-cols-6">
        {data.kpis.map((item) => (
          <CompanyKpiCard key={item.id} item={item} />
        ))}
      </div>

      <div className="hidden layout:block">
        <CompanyFocusAreasCard signals={data.focusAreas} viewAllHref={data.focusAreasViewAllHref} />
      </div>

      <div className="grid w-full grid-cols-1 gap-4 layout:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] layout:gap-5">
        <CompanyTeamCalendarCard items={data.teamCalendar} overdueCount={data.teamCalendarOverdueCount} />
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

      <CompanyPipelineSnapshotCard stages={data.pipelineSnapshot} />

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
    </CompanyWorkspaceShell>
  );
}
