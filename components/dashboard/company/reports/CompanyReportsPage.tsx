"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Tabs } from "@/components/sales/ui";
import { CompanyWorkspaceShell } from "@/components/dashboard/company/CompanyWorkspaceShell";
import { CompanyReportsHeader, DateRangeControl, FiltersControl } from "./CompanyReportsHeader";
import { ReportOverview } from "./ReportOverview";
import { ReportOverviewSkeleton } from "./ReportOverviewSkeleton";
import { ReportTabView } from "./ReportTabView";
import {
  COMPANY_REPORT_TABS,
  type CompanyReportPayload,
  type CompanyReportTab,
} from "@/lib/sales/company-reports/types";
import {
  defaultCompanyReportRange,
  parseIsoDate,
  suggestGranularity,
  type CompanyReportPresetId,
  type ReportGranularity,
} from "@/lib/sales/company-reports/range";
import type { UserRole } from "@/types";

async function fetcher(url: string): Promise<CompanyReportPayload> {
  const res = await fetch(url);
  if (!res.ok) {
    let msg = "Failed to load report";
    try {
      const json = (await res.json()) as { error?: string };
      if (json.error) msg = json.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json();
}

export function CompanyReportsPage({
  unreadNotifications,
  notificationRole,
  userName,
  avatarUrl,
  companyName,
  companyLogoUrl,
  whatsappBadge = 0,
  clientId,
}: {
  unreadNotifications: number;
  notificationRole: UserRole;
  userName: string;
  avatarUrl?: string | null;
  companyName?: string;
  companyLogoUrl?: string | null;
  whatsappBadge?: number;
  clientId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fallback = useMemo(() => defaultCompanyReportRange(), []);

  const tab = (COMPANY_REPORT_TABS.some((t) => t.id === searchParams.get("tab"))
    ? searchParams.get("tab")
    : "overview") as CompanyReportTab;
  const from = parseIsoDate(searchParams.get("from")) ?? fallback.from;
  const to = parseIsoDate(searchParams.get("to")) ?? fallback.to;
  const preset = (searchParams.get("preset") as CompanyReportPresetId) || fallback.preset;
  const ownerId = searchParams.get("ownerId") || null;
  const granularity = (searchParams.get("granularity") as ReportGranularity) || suggestGranularity(from, to);
  const [pipelineMode, setPipelineMode] = useState<"count" | "value">("count");

  const setParams = useCallback(
    (patch: Record<string, string | null>, replace = true) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (!value) next.delete(key);
        else next.set(key, value);
      }
      const href = next.toString() ? `${pathname}?${next.toString()}` : pathname;
      if (replace) router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    if (searchParams.get("from") && searchParams.get("to")) return;
    setParams({
      from: fallback.from.toISOString(),
      to: fallback.to.toISOString(),
      preset: fallback.preset,
      tab: tab || "overview",
    });
  }, [fallback.from, fallback.preset, fallback.to, searchParams, setParams, tab]);

  const qs = new URLSearchParams();
  qs.set("tab", tab);
  qs.set("from", from.toISOString());
  qs.set("to", to.toISOString());
  qs.set("granularity", granularity);
  if (ownerId) qs.set("ownerId", ownerId);
  if (clientId) qs.set("clientId", clientId);
  const key = `/api/reports/company?${qs.toString()}`;

  const { data, error, isLoading, isValidating, mutate } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
  });

  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  useEffect(() => {
    if (data?.generatedAt) setFetchedAt(new Date(data.generatedAt));
  }, [data?.generatedAt]);

  const owners = data && "owners" in data ? data.owners : [];

  function exportReport() {
    window.location.href = `/api/reports/company/export?${qs.toString()}`;
  }

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
      <div className="flex min-w-0 flex-col gap-4 overflow-x-hidden">
        <CompanyReportsHeader
        unreadNotifications={unreadNotifications}
        notificationRole={notificationRole}
        userName={userName}
        avatarUrl={avatarUrl}
        from={from}
        to={to}
        preset={preset}
        ownerId={ownerId}
        owners={owners}
        onRange={(nextFrom, nextTo, nextPreset) =>
          setParams({
            from: nextFrom.toISOString(),
            to: nextTo.toISOString(),
            preset: nextPreset,
            granularity: suggestGranularity(nextFrom, nextTo),
          })
        }
        onOwner={(id) => setParams({ ownerId: id })}
        onExport={exportReport}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={tab}
          onChange={(id) => setParams({ tab: id })}
          items={COMPANY_REPORT_TABS.map((t) => ({ id: t.id, label: t.label }))}
          className="min-w-0 flex-1 border-b-0"
        />
        <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <DateRangeControl
            from={from}
            to={to}
            preset={preset}
            onRange={(nextFrom, nextTo, nextPreset) =>
              setParams({
                from: nextFrom.toISOString(),
                to: nextTo.toISOString(),
                preset: nextPreset,
                granularity: suggestGranularity(nextFrom, nextTo),
              })
            }
          />
          <FiltersControl ownerId={ownerId} owners={owners} onOwner={(id) => setParams({ ownerId: id })} />
        </div>
      </div>

      {error && !data ? (
        <div className="rounded-[12px] border border-sales-danger/30 bg-sales-danger-soft px-4 py-3 text-sm text-sales-danger">
          {error instanceof Error ? error.message : "Could not load report."}
          <button type="button" className="ml-3 font-semibold underline" onClick={() => void mutate()}>
            Retry
          </button>
        </div>
      ) : null}

      {isLoading && !data ? <ReportOverviewSkeleton /> : null}

      {data?.tab === "overview" ? (
        <ReportOverview
          data={data}
          granularity={granularity}
          pipelineMode={pipelineMode}
          onGranularity={(g) => setParams({ granularity: g })}
          onPipelineMode={setPipelineMode}
          onRefresh={() => void mutate()}
          refreshing={isValidating}
          lastUpdated={fetchedAt}
          onOpenTeam={() => setParams({ tab: "team" })}
          onOpenLeads={() => setParams({ tab: "leads" })}
          onOpenPipeline={(stage) => {
            const params = stage ? `?stage=${encodeURIComponent(stage)}` : "";
            router.push(`/client/leads/pipeline${params}`);
          }}
          onRetry={() => void mutate()}
        />
      ) : null}

      {data && data.tab !== "overview" ? (
        <ReportTabView
          data={data}
          granularity={granularity}
          pipelineMode={pipelineMode}
          onGranularity={(g) => setParams({ granularity: g })}
          onPipelineMode={setPipelineMode}
          lastUpdated={fetchedAt}
          onRefresh={() => void mutate()}
          refreshing={isValidating}
        />
      ) : null}
      </div>
    </CompanyWorkspaceShell>
  );
}
