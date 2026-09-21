"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Button, SegmentedControl, Skeleton, useSalesToast } from "@/components/sales/ui";
import { CompanyWorkspaceShell } from "@/components/dashboard/company/CompanyWorkspaceShell";
import { CompanyDashboardHeader } from "@/components/dashboard/company/CompanyDashboardHeader";
import { P } from "@/lib/auth/rbac/permissions";
import { usePermissions } from "@/hooks/usePermissions";
import type { UserRole } from "@/types";
import type { WeeklyReportListItem } from "@/lib/sales/weekly-team-report/types";
import { LatestReportCard } from "./LatestReportCard";
import { ReportHistoryList } from "./ReportHistoryList";
import { isGenerating } from "./format";
import { GenerationProgress } from "./ReportStatus";

async function fetcher(url: string): Promise<{ reports: WeeklyReportListItem[] }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load reports");
  return res.json();
}

export function WeeklyReportsHistoryClient({
  unreadNotifications,
  notificationRole,
  userName,
  avatarUrl,
  companyName,
  companyLogoUrl,
  whatsappBadge = 0,
}: {
  unreadNotifications: number;
  notificationRole: UserRole;
  userName: string;
  avatarUrl?: string | null;
  companyName?: string;
  companyLogoUrl?: string | null;
  whatsappBadge?: number;
}) {
  const { can } = usePermissions();
  const { toast } = useSalesToast();
  const { data, error, isLoading, mutate } = useSWR("/api/reports/weekly", fetcher, {
    revalidateOnFocus: false,
    refreshInterval: (current) => {
      const latest = current?.reports?.[0];
      return latest && isGenerating(latest.status) ? 4000 : 0;
    },
  });
  const [generating, setGenerating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "ready" | "active" | "failed">("all");

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/reports/weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.status === 403) {
        toast({ title: "You do not have permission to generate this report", tone: "error" });
        return;
      }
      if (!res.ok) {
        toast({ title: "Report generation failed", tone: "error" });
        return;
      }
      toast({ title: "Report generation started", tone: "info" });
      setTimeout(() => void mutate(), 2500);
    } finally {
      setGenerating(false);
    }
  }

  const reports = data?.reports ?? [];
  const latest = reports[0] ?? null;
  const history = reports.slice(latest && latest.status === "ready" ? 1 : 0);
  const filtered = useMemo(() => {
    return history.filter((report) => {
      if (statusFilter === "ready") return report.status === "ready";
      if (statusFilter === "failed") return report.status === "failed";
      if (statusFilter === "active") return isGenerating(report.status);
      return true;
    });
  }, [history, statusFilter]);

  return (
    <CompanyWorkspaceShell
      companyName={companyName}
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
        canAddLead={false}
        breadcrumb="Company / Reports / Weekly"
        title="Weekly team reports"
        description="A weekly management review of sales performance, pipeline health and opportunities requiring attention."
        primaryAction={
          can(P.REPORTS_TEAM_GENERATE) ? (
            <Button variant="secondary" size="md" loading={generating} onClick={() => void generate()}>
              Generate report
            </Button>
          ) : undefined
        }
      />

      <div className="px-4 pb-10 layout:px-6">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : error ? (
          <p className="text-[14px] text-sales-danger-fg">Could not load weekly reports.</p>
        ) : reports.length === 0 ? (
          <div className="max-w-xl py-8">
            <p className="text-[16px] font-semibold text-sales-text-primary">No weekly reports yet</p>
            <p className="mt-2 text-[14px] leading-relaxed text-sales-text-secondary">
              SegmiQ prepares the previous Monday to Sunday briefing automatically. You can also generate one now if the week has already closed.
            </p>
          </div>
        ) : (
          <>
            {latest && latest.status === "ready" ? (
              <LatestReportCard report={latest} canDownload={can(P.REPORTS_TEAM_DOWNLOAD)} />
            ) : latest && isGenerating(latest.status) ? (
              <div className="rounded-[10px] border border-sales-border-subtle px-5 py-5">
                <p className="text-[12px] font-medium text-sales-text-muted">{latest.periodLabel}</p>
                <div className="mt-3">
                  <GenerationProgress status={latest.status} />
                </div>
              </div>
            ) : latest ? (
              <LatestReportCard report={latest} canDownload={can(P.REPORTS_TEAM_DOWNLOAD)} />
            ) : null}

            {history.length > 0 ? (
              <>
                <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[13px] text-sales-text-muted">Glance across previous weeks without opening every document.</p>
                  <SegmentedControl
                    aria-label="Filter reports"
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={[
                      { value: "all", label: "All" },
                      { value: "ready", label: "Ready" },
                      { value: "active", label: "Generating" },
                      { value: "failed", label: "Failed" },
                    ]}
                  />
                </div>
                <ReportHistoryList reports={filtered} canDownload={can(P.REPORTS_TEAM_DOWNLOAD)} />
              </>
            ) : null}
          </>
        )}
      </div>
    </CompanyWorkspaceShell>
  );
}
