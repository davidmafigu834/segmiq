"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type VolumeTrendPoint = {
  month: number;
  year: number;
  count: number;
  prior_count: number;
};

function monthLabel(month: number, year: number) {
  return `${MONTH_LABELS[month - 1] ?? "?"} '${String(year).slice(-2)}`;
}

function YoYBadge({ pct }: { pct: number | null }) {
  if (pct === null) {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--text-tertiary)]">
        <Minus size={12} />
        No prior-year data
      </span>
    );
  }
  const up = pct > 0;
  const flat = pct === 0;
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  const cls = flat
    ? "text-[var(--text-tertiary)]"
    : up
      ? "text-[var(--success)]"
      : "text-[var(--error)]";
  return (
    <span className={`inline-flex items-center gap-1 text-[12px] font-semibold ${cls}`}>
      <Icon size={12} />
      {up ? "+" : ""}
      {pct}% vs same months last year
    </span>
  );
}

export function VolumeTrendChart({ trend }: { trend: VolumeTrendPoint[] }) {
  const chartData = useMemo(
    () =>
      trend.map((t) => ({
        label: monthLabel(t.month, t.year),
        thisYear: t.count,
        priorYear: t.prior_count,
      })),
    [trend]
  );

  const totals = useMemo(
    () => ({
      thisYear: trend.reduce((s, t) => s + t.count, 0),
      priorYear: trend.reduce((s, t) => s + t.prior_count, 0),
    }),
    [trend]
  );

  const yoyPct = useMemo(() => {
    if (totals.priorYear === 0) return totals.thisYear > 0 ? 100 : null;
    return Math.round(((totals.thisYear - totals.priorYear) / totals.priorYear) * 100);
  }, [totals]);

  const hasAny = totals.thisYear > 0 || totals.priorYear > 0;
  const peakMonth = useMemo(() => {
    if (!trend.length) return null;
    const best = [...trend].sort((a, b) => b.count - a.count)[0];
    if (!best || best.count === 0) return null;
    return monthLabel(best.month, best.year);
  }, [trend]);

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-quaternary)] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
            Added (6 mo)
          </p>
          <p
            className="mt-1 text-[32px] leading-none text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-instrument-serif)" }}
          >
            {totals.thisYear.toLocaleString()}
          </p>
          <div className="mt-2">
            <YoYBadge pct={yoyPct} />
          </div>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-quaternary)] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
            Same period last year
          </p>
          <p
            className="mt-1 text-[32px] leading-none text-[var(--text-secondary)]"
            style={{ fontFamily: "var(--font-instrument-serif)" }}
          >
            {totals.priorYear.toLocaleString()}
          </p>
          <p className="mt-2 text-[12px] text-[var(--text-tertiary)]">Month-for-month comparison</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-quaternary)] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
            Best month
          </p>
          <p
            className="mt-1 text-[32px] leading-none text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-instrument-serif)" }}
          >
            {peakMonth ?? "—"}
          </p>
          <p className="mt-2 text-[12px] text-[var(--text-tertiary)]">Highest intake this window</p>
        </div>
      </div>

      {hasAny ? (
        <div className="h-[min(320px,42vw)] min-h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 12, right: 4, bottom: 4, left: -8 }} barGap={4}>
              <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="4 4" />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--text-tertiary)", fontSize: 12 }}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={false}
                dy={8}
              />
              <YAxis
                width={36}
                tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={{
                  backgroundColor: "var(--surface-sidebar)",
                  border: "1px solid var(--surface-sidebar-border)",
                  borderRadius: 8,
                  color: "var(--text-on-dark)",
                  fontSize: 12,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                }}
                formatter={(value, name) => [
                  Number(value).toLocaleString(),
                  name === "thisYear" ? "This year" : "Prior year",
                ]}
                labelFormatter={(label) => label}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                iconType="circle"
                iconSize={8}
                formatter={(value) => (value === "thisYear" ? "This year" : "Prior year")}
              />
              <Bar
                dataKey="priorYear"
                name="priorYear"
                fill="var(--bg-quaternary)"
                stroke="var(--border)"
                strokeWidth={1}
                radius={[6, 6, 0, 0]}
                maxBarSize={48}
              />
              <Bar
                dataKey="thisYear"
                name="thisYear"
                fill="var(--accent)"
                radius={[6, 6, 0, 0]}
                maxBarSize={48}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-quaternary)] px-6 text-center">
          <p className="text-[14px] font-medium text-[var(--text-secondary)]">No contacts added yet</p>
          <p className="mt-1 max-w-sm text-[13px] text-[var(--text-tertiary)]">
            As people enter your hub — walk-ins, WhatsApp, imports — this chart fills in automatically.
          </p>
        </div>
      )}
    </div>
  );
}
