"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MenuSelect } from "@/components/sales/ui";
import { useSalesChartColors } from "@/lib/sales/use-sales-chart-colors";
import { formatDealCurrency } from "@/lib/sales/format";
import { formatAxisMoney } from "@/lib/sales/company-reports/metrics";
import type { ReportGranularity } from "@/lib/sales/company-reports/range";
import type { ReportTimePoint } from "@/lib/sales/company-reports/types";
import { ReportChartCard } from "./ReportChartCard";
import { ReportTooltip } from "./ReportTooltip";

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
          <div className="absolute inset-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={colors.grid} vertical={false} strokeDasharray="3 6" />
              <XAxis
                dataKey="label"
                tick={{ fill: colors.axis, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis
                width={44}
                tick={{ fill: colors.axis, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatAxisMoney(Number(v), currency)}
              />
              <Tooltip
                content={({ active, label, payload }) => (
                  <ReportTooltip
                    active={active}
                    label={String(label ?? "")}
                    rows={(payload ?? []).map((p) => ({
                      name: String(p.name ?? ""),
                      value: formatDealCurrency(Number(p.value ?? 0), { currency }),
                      color: String(p.color ?? colors.brand),
                    }))}
                  />
                )}
              />
              <Line
                type="monotone"
                dataKey="previous"
                name="Previous period"
                stroke={colors.textMuted}
                strokeWidth={1.6}
                strokeDasharray="5 4"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="current"
                name="Revenue Won"
                stroke={colors.brand}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: colors.brand, stroke: colors.surface }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
          </div>
        </div>
      )}
    </ReportChartCard>
  );
}
