"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SALES_COLORS } from "@/lib/sales/design-tokens";
import { ChartEmptyState } from "@/components/sales/ui/Charts";
import { formatDealCurrency } from "@/lib/sales/format";

export function PerformanceTrendChart({
  data,
  currency = "USD",
}: {
  data: Array<{ label: string; leadsCreated: number; dealsWon: number; revenue: number }>;
  currency?: string;
}) {
  const has =
    data.some((d) => d.leadsCreated > 0 || d.dealsWon > 0 || d.revenue > 0);
  if (!has) {
    return (
      <ChartEmptyState
        title="No performance data for this period"
        description="Try a wider date range."
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={SALES_COLORS.borderSubtle} strokeDasharray="3 6" />
        <XAxis
          dataKey="label"
          tick={{ fill: SALES_COLORS.textMuted, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="left"
          tick={{ fill: SALES_COLORS.textMuted, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={32}
          allowDecimals={false}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fill: SALES_COLORS.textMuted, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={44}
          tickFormatter={(v) =>
            Math.abs(v) >= 1000
              ? `$${Math.round(v / 1000)}k`
              : `$${Math.round(v)}`
          }
        />
        <Tooltip
          contentStyle={{
            borderRadius: 12,
            border: `1px solid ${SALES_COLORS.border}`,
            boxShadow: "0 4px 12px rgba(16,24,40,0.08)",
            fontSize: 12,
          }}
          formatter={(value, name) => {
            const n = typeof value === "number" ? value : Number(value);
            const label = String(name ?? "");
            if (label === "Revenue") {
              return [formatDealCurrency(Number.isFinite(n) ? n : 0, { currency }), label];
            }
            return [Number.isFinite(n) ? n : 0, label];
          }}
        />
        <Bar
          yAxisId="left"
          dataKey="leadsCreated"
          name="Leads created"
          fill={SALES_COLORS.brand}
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="dealsWon"
          name="Deals won"
          stroke={SALES_COLORS.info}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3 }}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="revenue"
          name="Revenue"
          stroke={SALES_COLORS.purple}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
