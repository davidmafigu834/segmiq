"use client";

import {
  SalesAreaChart,
  SalesComparisonBarChart,
  SalesDonutChart,
} from "@/components/sales/ui/Charts";
import { formatChartCurrency } from "@/lib/sales/chart-format";
import { formatDealCurrency } from "@/lib/sales/format";
import type { GoalProgressPoint, GoalWeeklyComparison } from "@/lib/sales/goals/types";

export function GoalProgressRing({
  pct,
  size = 168,
}: {
  pct: number;
  size?: number;
}) {
  const r = 58;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  const display = Math.round(pct);
  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${display}% of target achieved`}
    >
      <svg width={size} height={size} viewBox="0 0 140 140" aria-hidden>
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--sales-chart-track, var(--sales-border-subtle))" strokeWidth={10} />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="var(--sales-brand)"
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (clamped / 100) * c}
          transform="rotate(-90 70 70)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
        <span className="text-[28px] font-semibold leading-none tabular-nums tracking-[-0.03em] text-sales-text-primary">
          {display}%
        </span>
        <span className="mt-1 text-[12px] font-medium leading-snug text-sales-text-secondary">
          of target achieved
        </span>
      </div>
    </div>
  );
}

export function GoalProgressChart({
  series,
  target,
  currency,
}: {
  series: GoalProgressPoint[];
  target: number;
  currency: string;
}) {
  const chartData = series.map((p) => ({
    label: p.label,
    value: p.cumulative,
    dealsWon: p.dealsWon,
  }));

  return (
    <div className="h-full min-h-[160px] w-full" aria-label="Progress over time chart">
      <SalesAreaChart
        data={chartData}
        dataKey="value"
        xKey="label"
        valueFormat="currency"
        currency={currency}
        primaryName="Revenue won"
        referenceY={target > 0 ? target : undefined}
        referenceLabel={
          target > 0 ? `${formatChartCurrency(target, { currency, compact: true })} Target` : undefined
        }
        tooltipExtra={[{ dataKey: "dealsWon", label: "Deals won" }]}
        emptyTitle="No goal progress yet"
      />
    </div>
  );
}

const SOURCE_COLORS: Record<string, string> = {
  whatsapp: "#25D366",
  facebook: "#2684FF",
  referral: "#8B5CF6",
  website: "#F59E0B",
  manual: "#14B8A6",
  other: "var(--sales-text-muted)",
};

export function GoalSourceDonut({
  slices,
  centerValue,
  currency,
}: {
  slices: Array<{ key: string; label: string; value: number; pct: number }>;
  centerValue: number;
  currency: string;
}) {
  return (
    <div className="relative mx-auto h-[140px] w-[140px]">
      <SalesDonutChart
        data={slices.map((s) => ({
          name: s.label,
          value: s.value,
          color: SOURCE_COLORS[s.key] ?? "var(--sales-text-muted)",
        }))}
        showLegend={false}
        centerLabel="achieved"
        centerValue={formatDealCurrency(centerValue, { currency })}
      />
    </div>
  );
}

export function GoalComparisonBars({
  weeks,
  currency,
}: {
  weeks: GoalWeeklyComparison[];
  currency: string;
}) {
  const chartData = weeks.map((w) => ({
    label: w.label,
    primary: w.thisMonth,
    comparison: w.lastMonth,
  }));

  return (
    <div className="h-[140px] w-full" aria-label="Weekly comparison chart">
      <SalesComparisonBarChart
        data={chartData}
        primaryKey="primary"
        comparisonKey="comparison"
        primaryName="This month"
        comparisonName="Last month"
        valueFormat="currency"
        currency={currency}
        emptyTitle="No weekly comparison data"
      />
    </div>
  );
}

export { SOURCE_COLORS };
