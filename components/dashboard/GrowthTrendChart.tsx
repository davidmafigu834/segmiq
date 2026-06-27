"use client";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatCurrencyUsd } from "@/lib/format";

export type GrowthTrendPoint = {
  month: string;
  label: string;
  leads: number;
  won: number;
  revenue: number;
};

function compactCurrency(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1000) {
    return `$${Math.round(value / 1000)}K`;
  }
  return `$${Math.round(value)}`;
}

function TrendBadge({ pct }: { pct: number | null }) {
  if (pct === null) {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--text-tertiary)]">
        <Minus size={12} />
        No prior data
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
      {pct}% vs prior 3 mo
    </span>
  );
}

/** % change between the most recent half of the window and the prior half. */
function halfOverHalfPct(values: number[]): number | null {
  if (values.length < 2) return null;
  const mid = Math.floor(values.length / 2);
  const prior = values.slice(0, mid).reduce((s, v) => s + v, 0);
  const recent = values.slice(mid).reduce((s, v) => s + v, 0);
  if (prior === 0 && recent === 0) return null;
  if (prior === 0) return 100;
  return Math.round(((recent - prior) / prior) * 100);
}

export function GrowthTrendChart({ data }: { data: GrowthTrendPoint[] }) {
  const totals = useMemo(
    () => ({
      leads: data.reduce((s, d) => s + d.leads, 0),
      won: data.reduce((s, d) => s + d.won, 0),
      revenue: data.reduce((s, d) => s + d.revenue, 0),
    }),
    [data]
  );

  const trends = useMemo(
    () => ({
      leads: halfOverHalfPct(data.map((d) => d.leads)),
      won: halfOverHalfPct(data.map((d) => d.won)),
      revenue: halfOverHalfPct(data.map((d) => d.revenue)),
    }),
    [data]
  );

  const hasAny = totals.leads > 0 || totals.won > 0 || totals.revenue > 0;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
            Growth
          </p>
          <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">
            Last 6 months
          </h2>
        </div>
      </div>

      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-1 gap-3 min-[640px]:grid-cols-3">
        {(
          [
            {
              label: "Leads",
              value: String(totals.leads),
              trend: trends.leads,
            },
            {
              label: "Deals won",
              value: String(totals.won),
              trend: trends.won,
            },
            {
              label: "Revenue won",
              value: formatCurrencyUsd(totals.revenue),
              trend: trends.revenue,
            },
          ] as const
        ).map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] p-4"
          >
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
              {stat.label}
            </p>
            <p className="mb-1.5 font-display text-[28px] font-semibold leading-none text-[var(--text-primary)]">
              {stat.value}
            </p>
            <TrendBadge pct={stat.trend} />
          </div>
        ))}
      </div>

      {hasAny ? (
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                width={32}
                tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                width={48}
                tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => compactCurrency(Number(v))}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--surface-sidebar)",
                  border: "1px solid var(--surface-sidebar-border)",
                  borderRadius: 6,
                  color: "var(--text-on-dark)",
                  fontSize: 12,
                }}
                formatter={(value, name) => {
                  if (name === "Revenue won") {
                    return [formatCurrencyUsd(Number(value)), name];
                  }
                  return [Number(value), name as string];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                iconType="circle"
                iconSize={8}
              />
              <Bar
                yAxisId="left"
                dataKey="leads"
                name="Leads"
                fill="var(--accent)"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="won"
                name="Deals won"
                stroke="var(--success)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="revenue"
                name="Revenue won"
                stroke="var(--warning)"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-[200px] flex-col items-center justify-center text-center">
          <TrendingUp className="mb-3 h-7 w-7 text-[var(--text-disabled)]" />
          <p className="text-[13px] text-[var(--text-tertiary)]">
            Your growth trend will appear as leads and deals accumulate.
          </p>
        </div>
      )}
    </div>
  );
}
