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
import { Trend } from "@/components/sales/ui/DataDisplay";
import { useSalesChartColors } from "@/lib/sales/use-sales-chart-colors";
import { formatDealValue } from "@/lib/sales/sales-dashboard-display";
import { CompanyDashCard, CompanyDashEmpty, PeriodChip } from "./CompanyDashCard";
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
    <CompanyDashCard
      title="Revenue trend"
      className="dashboard-panel--analytics"
      action={<PeriodChip>Last 6 months</PeriodChip>}
    >
      <div className="px-3 pb-3 pt-2.5 sm:px-4">
        {!hasHistory ? (
          <CompanyDashEmpty
            title="Revenue history will appear after Deals are Won"
            description="Won Deal value is the company revenue metric — not Pipeline or Quote totals."
          />
        ) : (
          <>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[24px] font-semibold tracking-[-0.04em] tabular-nums text-sales-text-primary">
                  {totalLabel}
                </p>
                <p className="mt-1 text-[12px] text-sales-text-muted">Revenue Won in this period</p>
              </div>
              {compare ? <Trend direction={compare.direction} label={compare.label} /> : null}
            </div>
            <div className="h-[128px] w-full" aria-label={`Revenue trend totaling ${totalLabel}`}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="companyRevenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colors.brand} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={colors.brand} stopOpacity={0.02} />
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
                    formatter={(value) => [formatDealValue(Number(value ?? 0)), "Revenue Won"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={colors.brand}
                    strokeWidth={2}
                    fill="url(#companyRevenueFill)"
                    dot={false}
                    activeDot={{ r: 4, fill: colors.brand, stroke: colors.surface }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </CompanyDashCard>
  );
}
