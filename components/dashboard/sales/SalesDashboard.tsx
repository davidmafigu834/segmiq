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
import { CourseResumeCard } from "@/components/sales/training/CourseResumeCard";
import { DashboardHeader } from "./DashboardHeader";
import { KpiCard } from "./KpiCard";
import { PerformanceCard } from "./PerformanceCard";
import { RecentActivityCard } from "./RecentActivityCard";
import { SourceMixCard } from "./SourceMixCard";
import { TodaysFocusCard, TodaysSalesPlanStrip } from "./TodaysFocusCard";
import { NewEnquiriesCard } from "./NewEnquiriesCard";
import { DealsAttentionCard } from "./DealsAttentionCard";
import { LeadDealFunnelCard } from "./LeadDealFunnelCard";
import { ActivityTodayCard } from "./ActivityTodayCard";
import { PipelineSnapshotCard } from "./PipelineSnapshotCard";
import { AgentDailyWorkspace } from "@/components/real-estate/AgentDailyWorkspace";

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
  const goalProgressPct =
    data.goal?.hasGoal &&
    data.goal.targetValue != null &&
    data.goal.targetValue > 0 &&
    data.goal.achievedValue != null
      ? Math.min(100, Math.round((data.goal.achievedValue / data.goal.targetValue) * 100))
      : performance.hasTarget
        ? performance.progressPct
        : null;

  const prospectCommitment = data.plan?.progress.commitments.find((c) => c.kind === "NEW_PROSPECTS");
  const prospectProgress =
    prospectCommitment && prospectCommitment.target > 0
      ? { completed: prospectCommitment.completed, target: prospectCommitment.target }
      : null;

  const retargetingStatuses = (legacy.retargetingStatuses ?? []) as RetargetingStatusView[];

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
          <CourseResumeCard />
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

          <CourseResumeCard />

          {retargetingStatuses.length > 0 ? (
            <RetargetingBanners statuses={retargetingStatuses} />
          ) : null}

          {!data.hasAnyLeads && !data.hasAnyDeals ? (
            <div className="dashboard-panel overflow-hidden border-0 p-5 shadow-none">
              <p className="text-[15px] font-semibold text-sales-text-primary">
                No enquiries or Deals yet
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-sales-text-secondary">
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

          <div className="space-y-4 layout:hidden">
            <TodaysFocusCard
              focus={data.focus}
              coverage={data.coverage}
              goalProgressPct={goalProgressPct}
              prospectProgress={prospectProgress}
              error={data.planError}
              daysLeftLabel={data.goal?.daysLeftLabel}
              dailyFocusHeadline={data.goal?.dailyFocus?.headline}
              scheduleLine={data.plan?.schedule?.summary}
              schedule={data.plan?.schedule ?? null}
              enquiryCount={data.priorityEnquiries.length}
              dealCount={data.priorityDeals.length}
            />
            <TodaysSalesPlanStrip {...data.planSummary} />
          </div>

          <div className="dashboard-group relative z-[1] grid grid-cols-2 gap-3 min-[900px]:grid-cols-3 xl:grid-cols-6">
            {data.kpis.map((item) => (
              <KpiCard key={item.id} item={item} />
            ))}
          </div>

          <div className="hidden space-y-4 layout:block">
            <TodaysFocusCard
              focus={data.focus}
              coverage={data.coverage}
              goalProgressPct={goalProgressPct}
              prospectProgress={prospectProgress}
              error={data.planError}
              daysLeftLabel={data.goal?.daysLeftLabel}
              dailyFocusHeadline={data.goal?.dailyFocus?.headline}
              scheduleLine={data.plan?.schedule?.summary}
              schedule={data.plan?.schedule ?? null}
              enquiryCount={data.priorityEnquiries.length}
              dealCount={data.priorityDeals.length}
            />
          </div>

          <div className="w-full min-w-0 space-y-4 layout:space-y-5">
            <NewEnquiriesCard
              items={data.priorityEnquiries}
              emptyHint={
                data.priorityDeals.length > 0
                  ? "Focus on Deals requiring attention below."
                  : undefined
              }
            />
            <DealsAttentionCard items={data.priorityDeals} hasAnyDeals={data.hasAnyDeals} />
          </div>

          <PipelineSnapshotCard stages={data.pipelineSnapshot} />

          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 layout:gap-5">
            <LeadDealFunnelCard stages={data.funnel} />
            <ActivityTodayCard metrics={data.activityToday} />
            <SourceMixCard data={legacy} />
            <RecentActivityCard items={data.recentActivity} />
          </div>

          {performance.hasTarget ? <PerformanceCard performance={performance} /> : null}

          <div className="hidden layout:block">
            <TodaysSalesPlanStrip {...data.planSummary} />
          </div>
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
      <div className="shimmer mb-5 h-20 rounded-[14px]" />
      <div className="mb-4 grid grid-cols-2 gap-3 min-[900px]:grid-cols-3 xl:grid-cols-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="shimmer h-[118px] rounded-[14px]" />
        ))}
      </div>
      <div className="shimmer mb-4 h-[120px] rounded-[14px]" />
      <div className="mb-4 space-y-4">
        <div className="shimmer h-[220px] rounded-[14px]" />
        <div className="shimmer h-[280px] rounded-[14px]" />
        <div className="shimmer h-[140px] rounded-[14px]" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="shimmer h-[240px] rounded-[14px]" />
        ))}
      </div>
    </div>
  );
}

export default SalesDashboard;
