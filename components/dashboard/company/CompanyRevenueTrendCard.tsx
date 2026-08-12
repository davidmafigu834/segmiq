"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CardShell } from "@/components/dashboard/sales/KpiCard";
import { Trend } from "@/components/sales/ui/DataDisplay";
import { useSalesChartColors } from "@/lib/sales/use-sales-chart-colors";
import { formatDealValue } from "@/lib/sales/sales-dashboard-display";
import type { CompanyRevenuePoint } from "./types";
import type { SalesKpiItem } from "@/components/dashboard/sales/types";

export function CompanyRevenueTrendCard({
  points,
  totalLabel,
  compare,
  hasHistory,
}: {
  points: CompanyRevenuePoint[];
  totalLabel: string;
  compare?: SalesKpiItem["trend"];
  hasHistory: boolean;
}) {
  const colors = useSalesChartColors();

  return (
    <CardShell
      title="Revenue trend"
      action={<span className="text-[12px] font-medium text-sales-text-muted">Last 6 months</span>}
    >
      <div className="px-4 pb-4 pt-3 sm:px-5">
        {!hasHistory ? (
          <div className="flex min-h-[180px] flex-col items-center justify-center text-center">
            <p className="text-[13px] font-medium text-sales-text-primary">
              Revenue history will appear after Deals are Won.
            </p>
            <p className="mt-1 max-w-sm text-[12px] text-sales-text-muted">
              Won Deal value is the company revenue metric — not Pipeline or Quote totals.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-3">
              <p className="text-[22px] font-semibold tabular-nums tracking-[-0.03em] text-sales-text-primary">
                {totalLabel}
              </p>
              <p className="mt-1 text-[12px] text-sales-text-muted">
                Revenue Won during selected period
              </p>
              {compare ? (
                <div className="mt-1">
                  <Trend direction={compare.direction} label={compare.label} />
                </div>
              ) : null}
            </div>
            <div className="h-[180px] w-full" aria-label={`Revenue trend totaling ${totalLabel}`}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="companyRevenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D4FF4F" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#D4FF4F" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={colors.grid} vertical={false} strokeDasharray="3 6" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: colors.textMuted, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    width={48}
                    tick={{ fill: colors.textMuted, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) =>
                      Number(v) >= 1000 ? `$${Math.round(Number(v) / 1000)}k` : `$${v}`
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      background: colors.surfaceRaised,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 10,
                      color: colors.textPrimary,
                      fontSize: 12,
                    }}
                    formatter={(value) => [
                      formatDealValue(Number(value ?? 0)),
                      "Revenue Won",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#D4FF4F"
                    strokeWidth={2}
                    fill="url(#companyRevenueFill)"
                    dot={false}
                    activeDot={{ r: 4, fill: "#D4FF4F", stroke: colors.surface }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </CardShell>
  );
}
