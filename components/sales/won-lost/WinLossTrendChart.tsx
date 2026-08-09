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
import { SALES_COLORS } from "@/lib/sales/design-tokens";
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
              <CartesianGrid vertical={false} stroke={SALES_COLORS.borderSubtle} strokeDasharray="3 6" />
              <XAxis
                dataKey="label"
                tick={{ fill: SALES_COLORS.textMuted, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: SALES_COLORS.textMuted, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: `1px solid ${SALES_COLORS.border}`,
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
                wrapperStyle={{ fontSize: 12, color: SALES_COLORS.textSecondary }}
              />
              <Line
                type="monotone"
                dataKey="won"
                name="Won"
                stroke="#76C900"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, fill: "#76C900" }}
              />
              <Line
                type="monotone"
                dataKey="lost"
                name="Lost"
                stroke={SALES_COLORS.danger}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, fill: SALES_COLORS.danger }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
