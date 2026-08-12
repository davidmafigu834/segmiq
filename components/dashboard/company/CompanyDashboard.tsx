"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu } from "lucide-react";
import { useCrmThemeOptional } from "@/components/CrmThemeProvider";
import { CompanySidebar } from "@/components/company/navigation/CompanySidebar";
import { useCompanySidebarCollapsed } from "@/lib/sales/navigation/use-company-sidebar-collapsed";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { SalesThemeToggle } from "@/components/sales/navigation/SalesThemeToggle";
import { SalesProfileMenu } from "@/components/sales/navigation/SalesProfileMenu";
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const { collapsed, toggleCollapsed, width } = useCompanySidebarCollapsed();
  const crmTheme = useCrmThemeOptional();
  const wordmarkSrc =
    crmTheme?.theme === "light" ? "/segmiq-wordmark-black.png" : "/segmiq-wordmark.png";

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
      <CompanySidebar
        companyName={data.clientName}
        companyLogoUrl={companyLogoUrl}
        userName={userName}
        userRoleLabel="Company Manager"
        avatarUrl={avatarUrl}
        whatsappBadge={whatsappBadge}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
      />

      {/* Mobile top bar */}
      <header className="sales-mobile-top-bar sticky top-0 z-[30] flex shrink-0 items-center justify-between gap-2 border-b border-sales-border-subtle bg-sales-surface/95 px-4 backdrop-blur-md layout:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] text-sales-text-secondary hover:bg-sales-surface-hover"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={20} strokeWidth={1.8} />
          </button>
          <Image
            src={wordmarkSrc}
            alt="SegmiQ"
            width={112}
            height={26}
            priority
            className="h-[26px] w-auto max-w-[112px] object-contain object-left"
          />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <div className="sd-search-wrap">
            <GlobalSearch role={notificationRole} />
          </div>
          <NotificationBell initialUnread={unreadNotifications} role={notificationRole} />
          <SalesThemeToggle size="mobile" />
          <SalesProfileMenu
            userName={userName}
            userRoleLabel="Company Manager"
            avatarUrl={avatarUrl}
            compact
          />
        </div>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden transition-[padding] duration-200 ease-out layout:pl-[var(--sales-sidebar-current-width)]">
        <div className="sales-mobile-scroll min-h-0 min-w-0 w-full max-w-none flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-28 pt-3 sm:space-y-5 sm:px-5 layout:px-6 layout:py-5 layout:pb-8 xl:px-7">
          <CompanyDashboardHeader
            unreadNotifications={unreadNotifications}
            notificationRole={notificationRole}
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

          <div className="hidden w-full gap-4 layout:grid layout:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.9fr)] layout:gap-5">
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
    </div>
  );
}
