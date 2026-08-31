"use client";

import { SalesBarChart } from "@/components/sales/ui/Charts";
import { MenuSelect } from "@/components/sales/ui";
import type { ReportGranularity } from "@/lib/sales/company-reports/range";
import type { ReportTimePoint } from "@/lib/sales/company-reports/types";
import { ReportChartCard } from "./ReportChartCard";

export function LeadsCreatedChart({
  series,
  granularity,
  onGranularity,
  error,
  onRetry,
}: {
  series: ReportTimePoint[];
  granularity: ReportGranularity;
  onGranularity: (value: ReportGranularity) => void;
  error?: string | null;
  onRetry?: () => void;
}) {
  const has = series.some((p) => p.current > 0);
  const chartData = series.map((p) => ({ label: p.label, value: p.current }));

  return (
    <ReportChartCard
      title="Leads Created Over Time"
      action={
        <MenuSelect
          size="sm"
          align="right"
          aria-label="Leads granularity"
          value={granularity}
          onChange={onGranularity}
          options={[
            { value: "day", label: "Daily" },
            { value: "week", label: "Weekly" },
            { value: "month", label: "Monthly" },
          ]}
        />
      }
      error={error}
      onRetry={onRetry}
      className="h-full min-h-[240px]"
      bodyClassName="flex min-h-0 flex-col overflow-hidden"
    >
      {!has ? (
        <div className="flex h-full min-h-0 flex-col items-center justify-center text-center">
          <p className="text-[13px] font-medium text-sales-text-primary">
            No Leads were captured during this period.
          </p>
        </div>
      ) : (
        <div className="relative h-full min-h-[160px] w-full" aria-label="Leads created over time">
          <SalesBarChart data={chartData} emptyTitle="No leads in this period" />
        </div>
      )}
    </ReportChartCard>
  );
}
