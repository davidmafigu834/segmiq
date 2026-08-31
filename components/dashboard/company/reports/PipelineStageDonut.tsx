"use client";

import { SalesDonutChart } from "@/components/sales/ui/Charts";
import { MenuSelect } from "@/components/sales/ui";
import { DEAL_STAGE_ACCENT } from "@/lib/sales/deals";
import { formatDealCurrency } from "@/lib/sales/format";
import type { PipelineStageSlice } from "@/lib/sales/company-reports/metrics";
import { ReportChartCard } from "./ReportChartCard";

export function PipelineStageDonut({
  slices,
  activeCount,
  currency,
  mode,
  onMode,
  error,
  onRetry,
  onStageClick,
}: {
  slices: PipelineStageSlice[];
  activeCount: number;
  currency: string;
  mode: "count" | "value";
  onMode: (mode: "count" | "value") => void;
  error?: string | null;
  onRetry?: () => void;
  onStageClick?: (stage: string) => void;
}) {
  const data = slices.map((s) => ({
    name: s.label,
    value: mode === "value" ? s.value : s.count,
    color: DEAL_STAGE_ACCENT[s.stage],
    stage: s.stage,
    raw: s,
  }));
  const empty = activeCount === 0 || data.length === 0;
  const totalValue = data.reduce((n, x) => n + x.raw.value, 0);

  return (
    <ReportChartCard
      title="Deals by Pipeline Stage"
      action={
        <MenuSelect
          size="sm"
          align="right"
          aria-label="Pipeline chart mode"
          value={mode}
          onChange={onMode}
          options={[
            { value: "count", label: "By Count" },
            { value: "value", label: "By Value" },
          ]}
        />
      }
      error={error}
      onRetry={onRetry}
      className="h-full min-h-[260px]"
      bodyClassName="flex min-h-0 flex-col overflow-hidden"
    >
      {empty ? (
        <div className="flex h-full min-h-0 flex-col items-center justify-center text-center">
          <p className="text-[13px] font-medium text-sales-text-primary">
            No active Deals in the Pipeline.
          </p>
        </div>
      ) : (
        <div className="flex h-full min-h-0 items-center gap-3 overflow-hidden">
          <div className="relative h-[132px] w-[132px] shrink-0 sm:h-[148px] sm:w-[148px]">
            <SalesDonutChart
              data={data.map((s) => ({ name: s.name, value: s.value, color: s.color }))}
              showLegend={false}
              centerLabel="Active Deals"
              centerValue={activeCount}
              onSliceClick={(slice) => {
                const match = data.find((d) => d.name === slice.name);
                if (match) onStageClick?.(match.stage);
              }}
            />
          </div>
          <ul className="min-w-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5" aria-label="Active Deal stages">
            {data.map((s) => (
              <li key={s.stage}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 text-left text-[12px]"
                  onClick={() => onStageClick?.(s.stage)}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-sales-text-secondary">{s.name}</span>
                  <span className="shrink-0 tabular-nums text-sales-text-primary">
                    {mode === "value"
                      ? formatDealCurrency(s.raw.value, { currency, compact: true })
                      : s.raw.count}
                  </span>
                  <span className="w-10 shrink-0 text-right tabular-nums text-sales-text-muted">
                    {mode === "value"
                      ? `${s.raw.value > 0 ? Math.round((s.raw.value / Math.max(1, totalValue)) * 100) : 0}%`
                      : `${Math.round(s.raw.pct)}%`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ReportChartCard>
  );
}
