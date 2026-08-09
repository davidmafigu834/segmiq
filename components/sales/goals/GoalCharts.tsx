"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useSalesChartColors } from "@/lib/sales/use-sales-chart-colors";
import { formatDealCurrency } from "@/lib/sales/format";
import type { GoalProgressPoint, GoalWeeklyComparison } from "@/lib/sales/goals/types";

function fmtAxis(n: number, currency: string) {
  if (n >= 1000) {
    const k = n / 1000;
    const prefix = currency === "USD" || !currency ? "$" : "";
    return `${prefix}${k % 1 === 0 ? k : k.toFixed(1)}k`;
  }
  return formatDealCurrency(n, { currency, compact: true });
}

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
  const colors = useSalesChartColors();
  const chartData = series.map((p) => ({
    label: p.label,
    value: p.cumulative,
    dealsWon: p.dealsWon,
    dayRevenue: p.dayRevenue,
  }));
  const maxY = Math.max(target, ...chartData.map((d) => d.value), 1) * 1.05;

  return (
    <div className="h-full min-h-[160px] w-full" aria-label="Progress over time chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="goalProgressFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.brand} stopOpacity={0.28} />
              <stop offset="100%" stopColor={colors.brand} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 6" />
          <XAxis
            dataKey="label"
            tick={{ fill: colors.axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis
            tick={{ fill: colors.axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={42}
            domain={[0, maxY]}
            tickFormatter={(v) => fmtAxis(Number(v), currency)}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0]?.payload as {
                value: number;
                dealsWon: number;
              };
              return (
                <div
                  className="rounded-[12px] px-3 py-2 shadow-[0_4px_12px_rgba(16,24,40,0.08)]"
                  style={{
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.surfaceRaised,
                    color: colors.textPrimary,
                  }}
                >
                  <p className="text-[11px]" style={{ color: colors.textMuted }}>
                    {label}
                  </p>
                  <p
                    className="mt-1 text-[12px] font-semibold tabular-nums"
                    style={{ color: colors.textPrimary }}
                  >
                    Revenue won {formatDealCurrency(row.value, { currency })}
                  </p>
                  <p className="text-[12px]" style={{ color: colors.textSecondary }}>
                    Deals won {row.dealsWon}
                  </p>
                </div>
              );
            }}
          />
          {target > 0 ? (
            <ReferenceLine
              y={target}
              stroke={colors.axis}
              strokeDasharray="4 4"
              label={{
                value: `${fmtAxis(target, currency)} Target`,
                position: "insideTopRight",
                fill: colors.textSecondary,
                fontSize: 11,
              }}
            />
          ) : null}
          <Area
            type="monotone"
            dataKey="value"
            stroke={colors.brand}
            strokeWidth={2}
            fill="url(#goalProgressFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
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
  const data = slices.map((s) => ({
    name: s.label,
    value: s.value,
    key: s.key,
    pct: s.pct,
  }));
  return (
    <div className="relative mx-auto h-[140px] w-[140px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={46}
            outerRadius={64}
            paddingAngle={2}
            stroke="none"
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.key} fill={SOURCE_COLORS[d.key] ?? "var(--sales-text-muted)"} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[14px] font-semibold tabular-nums text-sales-text-primary">
          {formatDealCurrency(centerValue, { currency })}
        </span>
        <span className="text-[10px] text-sales-text-muted">achieved</span>
      </div>
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
  const colors = useSalesChartColors();
  return (
    <div className="h-[140px] w-full" aria-label="Weekly comparison chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={weeks} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={4}>
          <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 6" />
          <XAxis
            dataKey="label"
            tick={{ fill: colors.axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div
                  className="rounded-[12px] px-3 py-2 shadow-[0_4px_12px_rgba(16,24,40,0.08)]"
                  style={{
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.surfaceRaised,
                    color: colors.textPrimary,
                  }}
                >
                  <p className="text-[11px]" style={{ color: colors.textMuted }}>
                    {label}
                  </p>
                  {payload.map((p) => (
                    <p
                      key={String(p.dataKey)}
                      className="text-[12px] font-medium tabular-nums"
                      style={{ color: colors.textPrimary }}
                    >
                      {p.name}: {formatDealCurrency(Number(p.value) || 0, { currency })}
                    </p>
                  ))}
                </div>
              );
            }}
          />
          <Bar
            dataKey="thisMonth"
            name="This month"
            fill={colors.brand}
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
            isAnimationActive={false}
          />
          <Bar
            dataKey="lastMonth"
            name="Last month"
            fill={colors.border}
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export { SOURCE_COLORS };
