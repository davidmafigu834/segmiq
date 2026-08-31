"use client";

import { SalesLineChart } from "@/components/sales/ui/Charts";
import { MenuSelect } from "@/components/sales/ui";
import { useSalesChartColors } from "@/lib/sales/use-sales-chart-colors";
import type { ReportGranularity } from "@/lib/sales/company-reports/range";
import type { ReportTimePoint } from "@/lib/sales/company-reports/types";
import { ReportChartCard } from "./ReportChartCard";

export function RevenueWonChart({
  series,
  currency,
  granularity,
  onGranularity,
  error,
  onRetry,
}: {
  series: ReportTimePoint[];
  currency: string;
  granularity: ReportGranularity;
  onGranularity: (value: ReportGranularity) => void;
  error?: string | null;
  onRetry?: () => void;
}) {
  const colors = useSalesChartColors();
  const has = series.some((p) => p.current > 0 || p.previous > 0);

  return (
    <ReportChartCard
      title="Revenue Won Over Time"
      legend={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-sales-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full bg-sales-brand" aria-hidden />
            This period
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-px w-3 border-t border-dashed border-sales-text-muted" aria-hidden />
            Previous period
          </span>
        </div>
      }
      action={
        <MenuSelect
          size="sm"
          align="right"
          aria-label="Revenue granularity"
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
      className="h-full min-h-[260px]"
      bodyClassName="flex min-h-0 flex-col overflow-hidden"
    >
      {!has ? (
        <div className="flex h-full min-h-0 flex-col items-center justify-center text-center">
          <p className="text-[13px] font-medium text-sales-text-primary">
            No Deals were Won during this period.
          </p>
          <p className="mt-1 max-w-sm text-[12px] text-sales-text-muted">
            No Won revenue in this period yet.
          </p>
        </div>
      ) : (
        <div className="relative h-full min-h-[180px] w-full" aria-label="Revenue Won over time">
          <SalesLineChart
            data={series}
            dataKey="current"
            comparisonKey="previous"
            xKey="label"
            valueFormat="currency"
            currency={currency}
            primaryName="Revenue Won"
            comparisonName="Previous period"
            comparisonDashed
            comparisonColor={colors.textMuted}
          />
        </div>
      )}
    </ReportChartCard>
  );
}
