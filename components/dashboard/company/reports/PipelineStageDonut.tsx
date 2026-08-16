"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { MenuSelect } from "@/components/sales/ui";
import { DEAL_STAGE_ACCENT } from "@/lib/sales/deals";
import { useSalesChartColors } from "@/lib/sales/use-sales-chart-colors";
import { formatDealCurrency } from "@/lib/sales/format";
import type { PipelineStageSlice } from "@/lib/sales/company-reports/metrics";
import { ReportChartCard } from "./ReportChartCard";
import { ReportTooltip } from "./ReportTooltip";

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
  const colors = useSalesChartColors();
  const data = slices.map((s) => ({
    ...s,
    chartValue: mode === "value" ? s.value : s.count,
    fill: DEAL_STAGE_ACCENT[s.stage],
  }));
  const empty = activeCount === 0 || data.length === 0;

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
      className="min-h-[275px] layout:min-h-[280px]"
    >
      {empty ? (
        <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center">
          <p className="text-[13px] font-medium text-sales-text-primary">
            No active Deals in the Pipeline.
          </p>
        </div>
      ) : (
        <div className="flex h-full min-h-[200px] flex-col items-center gap-4 sm:flex-row sm:items-center">
          <div className="relative h-[168px] w-[168px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="chartValue"
                  nameKey="label"
                  innerRadius="62%"
                  outerRadius="88%"
                  paddingAngle={2}
                  stroke={colors.surface}
                >
                  {data.map((s) => (
                    <Cell
                      key={s.stage}
                      fill={s.fill}
                      className={onStageClick ? "cursor-pointer" : undefined}
                      onClick={() => onStageClick?.(s.stage)}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    const row = payload?.[0]?.payload as (typeof data)[number] | undefined;
                    if (!row) return null;
                    return (
                      <ReportTooltip
                        active={active}
                        label={row.label}
                        rows={[
                          {
                            name: mode === "value" ? "Pipeline value" : "Deals",
                            value:
                              mode === "value"
                                ? formatDealCurrency(row.value, { currency })
                                : String(row.count),
                            color: row.fill,
                          },
                        ]}
                      />
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[20px] font-semibold tabular-nums leading-none text-sales-text-primary">
                {activeCount}
              </p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
                Active Deals
              </p>
            </div>
          </div>
          <ul className="min-w-0 flex-1 space-y-2" aria-label="Active Deal stages">
            {data.map((s) => (
              <li key={s.stage}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 text-left text-[12px]"
                  onClick={() => onStageClick?.(s.stage)}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.fill }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-sales-text-secondary">{s.label}</span>
                  <span className="shrink-0 tabular-nums text-sales-text-primary">
                    {mode === "value" ? formatDealCurrency(s.value, { currency, compact: true }) : s.count}
                  </span>
                  <span className="w-10 shrink-0 text-right tabular-nums text-sales-text-muted">
                    {mode === "value"
                      ? `${s.value > 0 ? Math.round((s.value / Math.max(1, data.reduce((n, x) => n + x.value, 0))) * 100) : 0}%`
                      : `${Math.round(s.pct)}%`}
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
