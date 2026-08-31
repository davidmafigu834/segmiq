"use client";

import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { SalesPerformanceTrendChart } from "@/components/sales/ui/Charts";
import { formatCurrencyUsd } from "@/lib/format";

export type GrowthTrendPoint = {
  month: string;
  label: string;
  leads: number;
  won: number;
  revenue: number;
};

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
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        label: d.label,
        leadsCreated: d.leads,
        dealsWon: d.won,
        revenue: d.revenue,
      })),
    [data]
  );

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
          <SalesPerformanceTrendChart data={chartData} />
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
