"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/types";
import { RetargetingBanners } from "@/components/sales/RetargetingBanner";
import { useSalesLogSheet } from "@/components/sales/SalesLogFab";
import { useAddHubSheet } from "@/components/sales/AddToHubSheet";
import type { RetargetingStatusView } from "@/lib/retargeting-shared";
import {
  buildPerformance,
  buildPipelineStages,
  buildPriorityTasks,
  buildRecentActivity,
  buildSalesKpis,
  type SalesDashboardRaw,
} from "@/lib/sales/sales-dashboard-view";
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
import { DashboardHeader } from "./DashboardHeader";
import { FollowUpBanner } from "./FollowUpBanner";
import { KpiCard } from "./KpiCard";
import { LeadSourcesCard } from "./LeadSourcesCard";
import { PerformanceCard } from "./PerformanceCard";
import { PipelineSummary } from "./PipelineSummary";
import { PrioritiesCard } from "./PrioritiesCard";
import { RecentActivityCard } from "./RecentActivityCard";

export type SalesDashboardProps = {
  data: SalesDashboardRaw & { retargetingStatuses?: RetargetingStatusView[] };
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
  const [now] = useState(() => new Date());
  const { collapsed, toggleCollapsed, width } = useSalesSidebarCollapsed();
  const { setQuickActionsOpen, quickActionsOpen } = useSalesMobileChrome();

  useEffect(() => {
    setMounted(true);
  }, []);

  const { openLogSheet, logSheetProps } = useSalesLogSheet();
  const { sheet } = logSheetProps(data.allActiveLeads);
  const { openAddHubSheet, addHubSheetProps } = useAddHubSheet();
  const { hubSheet } = addHubSheetProps(data.assignmentMode ?? "direct");

  const kpis = useMemo(() => buildSalesKpis(data, now), [data, now]);
  const priorities = useMemo(() => buildPriorityTasks(data, now, 6), [data, now]);
  const stages = useMemo(() => buildPipelineStages(data), [data]);
  const activity = useMemo(() => buildRecentActivity(data), [data]);
  const performance = useMemo(() => buildPerformance(data, now), [data, now]);

  const dueCount = data.numbers.followUpToday + data.numbers.callNow;
  const overdueCount = data.insights?.overdueFollowUps ?? 0;
  const priorityTotal =
    data.numbers.callNow + data.numbers.followUpToday + data.numbers.slipped;

  if (!mounted) {
    return <SalesDashboardSkeletonShell />;
  }

  return (
    <div
      className="sales-dashboard-premium flex h-full max-h-[100dvh] min-h-0 flex-col overflow-hidden bg-sales-bg text-sales-text-primary"
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

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden transition-[padding] duration-200 ease-out layout:pl-[var(--sales-sidebar-current-width)]">
        <div className="sales-mobile-scroll min-h-0 min-w-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 layout:px-8 layout:py-6">
          <DashboardHeader
            firstName={firstName}
            userName={fullName}
            avatarUrl={avatarUrl}
            unreadNotifications={unreadNotifications}
            notificationRole={notificationRole}
            onOpenLog={() => openLogSheet("")}
            onAddLead={openAddHubSheet}
          />

          {(data.retargetingStatuses?.length ?? 0) > 0 ? (
            <RetargetingBanners statuses={data.retargetingStatuses!} />
          ) : null}

          {data.numbers.totalActive === 0 ? (
            <div className="rounded-[14px] border border-sales-border bg-sales-surface p-5">
              <p className="text-[15px] font-semibold text-sales-text-primary">No leads assigned to you yet</p>
              <p className="mt-2 text-[13px] leading-relaxed text-sales-text-secondary">
                Your sales view only shows leads assigned to you. New enquiries will arrive via
                round-robin, or a manager can assign leads from the pipeline.
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

          <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-3 xl:grid-cols-5">
            {kpis.map((item) => (
              <KpiCard key={item.id} item={item} />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.9fr)]">
            <div className="min-w-0 space-y-5">
              <PrioritiesCard
                tasks={priorities}
                totalCount={priorityTotal || priorities.length}
                repName={fullName}
                onLog={openLogSheet}
              />
              <PerformanceCard performance={performance} />
              <PipelineSummary stages={stages} />
            </div>
            <div className="min-w-0 space-y-5">
              <LeadSourcesCard data={data} />
              <RecentActivityCard items={activity} />
            </div>
          </div>

          <FollowUpBanner dueCount={dueCount} overdueCount={overdueCount} />
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
        <SalesDashboardInner {...props} />
      </SalesMobileChromeProvider>
    </ToastProvider>
  );
}

function SalesDashboardSkeletonShell() {
  return (
    <div className="sales-dashboard-premium min-h-[100dvh] bg-sales-bg p-4 layout:pl-[228px] layout:p-6">
      <div className="shimmer mb-6 h-24 rounded-[14px]" />
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="shimmer h-[124px] rounded-[14px]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="shimmer h-[420px] rounded-[14px]" />
        <div className="shimmer h-[420px] rounded-[14px]" />
      </div>
    </div>
  );
}

export default SalesDashboard;
