"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/types";
import { RetargetingBanners } from "@/components/sales/RetargetingBanner";
import { useSalesLogSheet } from "@/components/sales/SalesLogFab";
import { useAddHubSheet } from "@/components/sales/AddToHubSheet";
import type { RetargetingStatusView } from "@/lib/retargeting-shared";
import { buildPerformance } from "@/lib/sales/sales-dashboard-view";
import type { SalesDashboardData } from "@/lib/sales/get-sales-dashboard-data";
import { useSalesSidebarCollapsed } from "@/lib/sales/navigation/use-sales-sidebar-collapsed";
import { SalesSidebar } from "@/components/sales/navigation/SalesSidebar";
import { SalesMobileTopBar } from "@/components/sales/navigation/SalesMobileTopBar";
import { SalesBottomNav } from "@/components/sales/navigation/SalesBottomNav";
import {
  SalesMoreSheet,
  SalesMobileQuickActionsSheet,
} from "@/components/sales/navigation/SalesMoreSheet";
import {
  SalesMobileChromeProvider,
  useSalesMobileChrome,
} from "@/components/sales/navigation/SalesMobileChromeContext";
import { ToastProvider } from "@/components/sales/ui/Toast";
import { GuidedCourseMount } from "@/components/sales/training/GuidedCourseMount";
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
import { SegmiQDotWave } from "@/components/dashboard/company/SegmiQDotWave";

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
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const { collapsed, toggleCollapsed, width } = useSalesSidebarCollapsed();
  const { setQuickActionsOpen, quickActionsOpen } = useSalesMobileChrome();

  useEffect(() => {
    setMounted(true);
  }, []);

  const legacy = data.legacy;
  const { openLogSheet, logSheetProps } = useSalesLogSheet();
  const { sheet } = logSheetProps(legacy.allActiveLeads);
  const { openAddHubSheet, addHubSheetProps } = useAddHubSheet();
  const { hubSheet } = addHubSheetProps(legacy.assignmentMode ?? "direct");

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
    <div
      className="sales-dashboard-premium dashboard-shell flex h-full max-h-[100dvh] min-h-0 flex-col overflow-hidden bg-sales-bg text-sales-text-primary"
      data-sidebar-collapsed={collapsed ? "true" : "false"}
      style={{ ["--sales-sidebar-current-width" as string]: `${width}px` } as CSSProperties}
    >
      <div className="hidden layout:contents">
        <SalesSidebar
          userName={fullName}
          userRoleLabel="Sales Executive"
          avatarUrl={avatarUrl}
          isSolo={isSolo}
          whatsappBadge={whatsappBadge}
          tasksBadge={tasksBadge}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
      </div>

      <SalesMobileTopBar
        isSolo={isSolo}
        userName={fullName}
        userRoleLabel="Sales Executive"
        avatarUrl={avatarUrl}
        unreadNotifications={unreadNotifications}
        notificationRole={notificationRole}
      />

      <div className="dashboard-canvas flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden transition-[padding] duration-200 ease-out layout:pl-[var(--sales-sidebar-current-width)]">
        <div className="relative min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain sales-mobile-scroll px-4 pb-4 pt-3 sm:px-6 layout:px-8 layout:py-6">
          <SegmiQDotWave />
          <div className="relative space-y-3 sm:space-y-3">
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
                      Return to the manager dashboard
                    </Link>{" "}
                    for full team visibility.
                  </>
                ) : null}
              </p>
            </div>
          ) : null}

          {/* Mobile: Today's Focus + Plan first */}
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
            />
            <TodaysSalesPlanStrip {...data.planSummary} />
          </div>

          <div className="dashboard-group relative z-[1] grid grid-cols-2 gap-3 min-[900px]:grid-cols-3 xl:grid-cols-6">
            {data.kpis.map((item) => (
              <KpiCard key={item.id} item={item} />
            ))}
          </div>

          {/* Desktop Today's Focus */}
          <div className="hidden layout:block">
            <TodaysFocusCard
              focus={data.focus}
              coverage={data.coverage}
              goalProgressPct={goalProgressPct}
              prospectProgress={prospectProgress}
              error={data.planError}
              daysLeftLabel={data.goal?.daysLeftLabel}
              dailyFocusHeadline={data.goal?.dailyFocus?.headline}
              scheduleLine={data.plan?.schedule?.summary}
            />
          </div>

          {/* Action tables — full width so columns can breathe */}
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

          {/* Pipeline snapshot — full width under action work */}
          <PipelineSnapshotCard stages={data.pipelineSnapshot} />

          {/* Intelligence / analytics — own row so they never squeeze tables */}
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
        </div>
        </div>
      </div>

      <SalesBottomNav isSolo={isSolo} whatsappBadge={whatsappBadge} tasksBadge={tasksBadge} />
      <SalesMoreSheet isSolo={isSolo} onQuickActions={() => setQuickActionsOpen(true)} />
      <SalesMobileQuickActionsSheet
        open={quickActionsOpen}
        onClose={() => setQuickActionsOpen(false)}
        onAddLead={() => openAddHubSheet()}
        onLogCall={() => openLogSheet("")}
        onCreateQuote={() => router.push("/sales/quotes")}
        onSchedule={() => router.push("/sales/calendar")}
      />

      {sheet}
      {hubSheet}
    </div>
  );
}

export function SalesDashboard(props: SalesDashboardProps) {
  return (
    <ToastProvider>
      <SalesMobileChromeProvider>
        <GuidedCourseMount isSolo={props.isSolo}>
          <SalesDashboardInner {...props} />
        </GuidedCourseMount>
      </SalesMobileChromeProvider>
    </ToastProvider>
  );
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
