"use client";

import useSWR from "swr";
import { usePermissions } from "@/hooks/usePermissions";
import { P } from "@/lib/auth/rbac/permissions";
import type { WeeklyReportListItem } from "@/lib/sales/weekly-team-report/types";
import { isGenerating } from "./weekly-report/format";
import { CompanyWeeklyReportCard } from "./weekly-report/CompanyWeeklyReportCard";

async function fetcher(url: string): Promise<{ reports: WeeklyReportListItem[]; latest: WeeklyReportListItem | null }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load weekly report");
  return res.json();
}

export function CompanyWeeklyReportCardContainer() {
  const { can } = usePermissions();
  const { data, error, isLoading, mutate } = useSWR("/api/reports/weekly?limit=4", fetcher, {
    revalidateOnFocus: false,
    refreshInterval: (current) => {
      const latest = current?.latest ?? current?.reports?.[0];
      return latest && isGenerating(latest.status) ? 4000 : 0;
    },
  });
  const latest = data?.latest ?? data?.reports?.[0] ?? null;
  const previousReadyId = data?.reports?.find((row) => row.id !== latest?.id && row.status === "ready")?.id ?? null;

  async function retry() {
    await fetch("/api/reports/weekly", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodStartDate: latest?.periodStartDate, force: true }),
    });
    window.setTimeout(() => void mutate(), 2000);
  }

  return (
    <CompanyWeeklyReportCard
      latest={latest}
      previousReadyId={previousReadyId}
      loading={isLoading}
      error={Boolean(error)}
      onRetry={() => void retry()}
      canGenerate={can(P.REPORTS_TEAM_GENERATE)}
      canDownload={can(P.REPORTS_TEAM_DOWNLOAD)}
    />
  );
}
