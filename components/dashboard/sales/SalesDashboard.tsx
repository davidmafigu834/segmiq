"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { UserRole } from "@/types";
import { RetargetingBanners } from "@/components/sales/RetargetingBanner";
import { useSalesLogSheet } from "@/components/sales/SalesLogFab";
import { useAddHubSheet } from "@/components/sales/AddToHubSheet";
import type { RetargetingStatusView } from "@/lib/retargeting-shared";
import { buildPerformance } from "@/lib/sales/sales-dashboard-view";
import type { SalesDashboardData } from "@/lib/sales/get-sales-dashboard-data";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { DashboardHeader } from "./DashboardHeader";
import { KpiCard } from "./KpiCard";
import { PerformanceCard } from "./PerformanceCard";
import { RecentActivityCard } from "./RecentActivityCard";
import { SourceMixCard } from "./SourceMixCard";
import { TodaysFocusCard } from "./TodaysFocusCard";
import { LeadDealFunnelCard } from "./LeadDealFunnelCard";
import { ActivityTodayCard } from "./ActivityTodayCard";
import { PipelineSnapshotCard } from "./PipelineSnapshotCard";
import { AgentDailyWorkspace } from "@/components/real-estate/AgentDailyWorkspace";

/** Action-oriented KPIs stay elevated; the rest demote to a dense strip. */
const PRIMARY_KPI_IDS = new Set(["new-enquiries", "followups", "active-deals"]);

export type SalesDashboardProps = {
  data: SalesDashboardData;
  session: unknown;
  unreadNotifications: number;
  whatsappBadge: number;
  tasksBadge: number;
  isSolo: boolean;
  avatarUrl?: string | null;
};

function SalesDashboardInner({
  data,
  session,
  unreadNotifications,
  whatsappBadge,
  tasksBadge,
  isSolo,
  avatarUrl,
}: SalesDashboardProps) {
  const s = session as {
    user?: { name?: string | null };
    role?: UserRole;
  } | null;
  const fullName = s?.user?.name ?? "there";
  const firstName = fullName.split(" ")[0] ?? "there";
  const notificationRole = (s?.role ?? "SALESPERSON") as UserRole;

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const legacy = data.legacy;
  const { openLogSheet, logSheetProps } = useSalesLogSheet();
  const { sheet } = logSheetProps(legacy.allActiveLeads);
  const { openAddHubSheet } = useAddHubSheet();
  const isRealEstate = Boolean(data.realEstate && data.clientId);
  const roleLabel = isRealEstate ? "Agent" : "Sales Executive";

  const performance = {
    ...buildPerformance(legacy),
    daysLeftLabel: data.goal?.daysLeftLabel ?? null,
  };

  const retargetingStatuses = (legacy.retargetingStatuses ?? []) as RetargetingStatusView[];
  const planQueue = data.plan?.queue ?? [];
  const planProgress = data.plan?.progress ?? null;

  const matchedPrimary = data.kpis.filter((item) => PRIMARY_KPI_IDS.has(item.id));
  const primaryKpis = matchedPrimary.length > 0 ? matchedPrimary : data.kpis.slice(0, 3);
  const secondaryKpis =
    matchedPrimary.length > 0
      ? data.kpis.filter((item) => !PRIMARY_KPI_IDS.has(item.id))
      : data.kpis.slice(3);

  if (!mounted) {
    return <SalesDashboardSkeletonShell />;
  }

  return (
    <SalesAppShell
      userName={fullName}
      userRoleLabel={roleLabel}
      avatarUrl={avatarUrl}
      unreadNotifications={unreadNotifications}
      notificationRole={notificationRole}
      whatsappBadge={whatsappBadge}
      tasksBadge={tasksBadge}
      isSolo={isSolo}
      assignmentMode={legacy.assignmentMode ?? "direct"}
      showDefaultHeader={false}
      onLogCall={() => openLogSheet("")}
      realEstate={isRealEstate}
    >
      {isRealEstate ? (
        <>
          <DashboardHeader
            firstName={firstName}
            userName={fullName}
            avatarUrl={avatarUrl}
            unreadNotifications={unreadNotifications}
            notificationRole={notificationRole}
            onOpenLog={() => openLogSheet("")}
            onAddLead={openAddHubSheet}
            description="Here's what needs attention across your inquiries and viewings today."
            userRoleLabel={roleLabel}
            realEstate
          />
          <AgentDailyWorkspace clientId={data.clientId!} data={data.realEstate!} />
        </>
      ) : (
        <>
          <DashboardHeader
            firstName={firstName}
            userName={fullName}
            avatarUrl={avatarUrl}
            unreadNotifications={unreadNotifications}
            notificationRole={notificationRole}
            onOpenLog={() => openLogSheet("")}
            onAddLead={openAddHubSheet}
          />

          {retargetingStatuses.length > 0 ? (
            <RetargetingBanners statuses={retargetingStatuses} />
          ) : null}

          {!data.hasAnyLeads && !data.hasAnyDeals ? (
            <div className="dashboard-panel dashboard-panel--attention overflow-hidden border-0 p-5 shadow-none">
              <p className="text-[15px] font-semibold text-sales-text-primary">
                No enquiries or Deals yet
              </p>
              <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-sales-text-secondary">
                New enquiries will appear here when assigned to you. Qualify them into Deals when a
                genuine commercial opportunity is confirmed.
                {s?.role === "CLIENT_MANAGER" ? (
                  <>
                    {" "}
                    <Link href="/client/dashboard" className="font-medium text-sales-brand-fg hover:underline">
                      Return to the manager portal
                    </Link>{" "}
                    for full team visibility.
                  </>
                ) : null}
              </p>
            </div>
          ) : null}

          {/* Focus first — work queue before metrics */}
          <div className="space-y-4">
            <TodaysFocusCard
              focus={data.focus}
              queue={planQueue}
              progress={planProgress}
              error={data.planError}
              clientId={data.clientId}
              onAddProspect={openAddHubSheet}
              fallbackEnquiries={data.priorityEnquiries}
              fallbackDeals={data.priorityDeals}
            />
          </div>

          <div className="dashboard-group relative z-[1] space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {primaryKpis.map((item) => (
                <KpiCard key={item.id} item={item} />
              ))}
            </div>
            {secondaryKpis.length > 0 ? (
              <div className="dashboard-kpi-secondary-strip">
                {secondaryKpis.map((item) => (
                  <KpiCard key={item.id} item={item} variant="secondary" />
                ))}
              </div>
            ) : null}
          </div>

          <PipelineSnapshotCard stages={data.pipelineSnapshot} />

          {/* Asymmetric analytics: primary funnel + stacked secondary */}
          <div className="grid grid-cols-1 items-start gap-4 layout:grid-cols-12 layout:gap-5">
            <div className="min-w-0 layout:col-span-7">
              <LeadDealFunnelCard stages={data.funnel} />
            </div>
            <div className="flex min-w-0 flex-col gap-4 layout:col-span-5 layout:gap-5">
              <ActivityTodayCard metrics={data.activityToday} />
              <SourceMixCard data={legacy} />
            </div>
            <div className="min-w-0 layout:col-span-12">
              <RecentActivityCard items={data.recentActivity} />
            </div>
          </div>

          {performance.hasTarget ? <PerformanceCard performance={performance} /> : null}
        </>
      )}

      {sheet}
    </SalesAppShell>
  );
}

export function SalesDashboard(props: SalesDashboardProps) {
  return <SalesDashboardInner {...props} />;
}

function SalesDashboardSkeletonShell() {
  return (
    <div className="sales-dashboard-premium min-h-[100dvh] bg-sales-bg p-4 layout:pl-[228px] layout:p-6">
      <div className="shimmer mb-5 h-20 rounded-[10px]" />
      <div className="shimmer mb-4 h-[220px] rounded-[10px]" />
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="shimmer h-[96px] rounded-[10px]" />
        ))}
      </div>
      <div className="shimmer mb-4 h-14 rounded-[8px]" />
      <div className="shimmer mb-4 h-[140px] rounded-[10px]" />
      <div className="grid grid-cols-1 gap-4 layout:grid-cols-12">
        <div className="shimmer h-[240px] rounded-[10px] layout:col-span-7" />
        <div className="flex flex-col gap-4 layout:col-span-5">
          <div className="shimmer h-[140px] rounded-[10px]" />
          <div className="shimmer h-[140px] rounded-[10px]" />
        </div>
      </div>
    </div>
  );
}

export default SalesDashboard;
