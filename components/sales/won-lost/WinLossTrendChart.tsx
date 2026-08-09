"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useSalesChartColors } from "@/lib/sales/use-sales-chart-colors";
import { ChartEmptyState, MenuSelect } from "@/components/sales/ui";
import type { WinLossTrendPoint, WonLostGranularity } from "@/lib/sales/outcomes";

export function WinLossTrendChart({
  data,
  granularity,
  onGranularityChange,
}: {
  data: WinLossTrendPoint[];
  granularity: WonLostGranularity;
  onGranularityChange: (g: WonLostGranularity) => void;
}) {
  const colors = useSalesChartColors();
  const has = data.some((d) => d.won > 0 || d.lost > 0);

  return (
    <div className="flex h-full min-h-[220px] flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[14px] font-semibold text-sales-text-primary">Win vs loss trend</h3>
        <MenuSelect
          aria-label="Trend granularity"
          size="sm"
          align="right"
          value={granularity}
          onChange={onGranularityChange}
          options={[
            { value: "weekly", label: "Weekly" },
            { value: "monthly", label: "Monthly" },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1">
        {!has ? (
          <ChartEmptyState
            title="No closed-deal trend yet"
            description="Your win/loss trend will appear as deals are closed."
            className="min-h-[160px]"
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%" minHeight={160}>
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 6" />
              <XAxis
                dataKey="label"
                tick={{ fill: colors.axis, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: colors.axis, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surfaceRaised,
                  color: colors.textPrimary,
                  boxShadow: "0 4px 12px rgba(16,24,40,0.08)",
                  fontSize: 12,
                }}
                labelFormatter={(label) =>
                  granularity === "weekly" ? `Week of ${label}` : String(label)
                }
              />
              <Legend
                verticalAlign="top"
                height={28}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, color: colors.textSecondary }}
              />
              <Line
                type="monotone"
                dataKey="won"
                name="Won"
                stroke={colors.success}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, fill: colors.success }}
              />
              <Line
                type="monotone"
                dataKey="lost"
                name="Lost"
                stroke={colors.danger}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, fill: colors.danger }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
