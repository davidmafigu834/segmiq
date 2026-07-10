"use client";

import { useState } from "react";
import { Target } from "lucide-react";
import { formatCurrencyUsd } from "@/lib/format";

export type ForecastCardData = {
  methodology: "stage";
  month: {
    forecastedValue: number;
    committed: number;
    bestCase: number;
    pipeline: number;
    dealCount: number;
  };
  quarter: {
    forecastedValue: number;
    committed: number;
    bestCase: number;
    pipeline: number;
    dealCount: number;
  };
  undated: {
    count: number;
    pipelineValue: number;
  };
  accuracyPct: number | null;
  accuracySampleSize: number;
};

type PeriodKey = "month" | "quarter";

function TierBars({
  committed,
  bestCase,
  pipeline,
  total,
}: {
  committed: number;
  bestCase: number;
  pipeline: number;
  total: number;
}) {
  const tiers = [
    { key: "Committed", value: committed, color: "var(--success)" },
    { key: "Best case", value: bestCase, color: "#C49A3C" },
    { key: "Pipeline", value: pipeline, color: "#4A7AB5" },
  ];
  const denom = total > 0 ? total : 1;

  return (
    <div className="space-y-2.5">
      {tiers.map((t) => (
        <div key={t.key}>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-[12px] text-[var(--text-secondary)]">{t.key}</span>
            <span className="font-mono text-[11px] tabular-nums text-[var(--text-tertiary)]">
              {formatCurrencyUsd(t.value)}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-quaternary)]">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${Math.min(100, (t.value / denom) * 100)}%`,
                background: t.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RevenueForecastCard({ data }: { data: ForecastCardData }) {
  const [period, setPeriod] = useState<PeriodKey>("month");
  const view = data[period];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 border-b border-[var(--border)]">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-0.5">
            Forecast
          </p>
          <h2 className="text-[18px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Target size={16} className="text-[var(--accent)] shrink-0" aria-hidden />
            Weighted pipeline
          </h2>
          <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">
            Stage-based close probability · live from open deals
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
            Deal amounts are rep estimates or quotation totals — forecast honesty depends on what was entered.
          </p>
        </div>
        <div className="flex rounded-lg border border-[var(--border)] p-0.5 bg-[var(--bg-tertiary)]">
          {(
            [
              { key: "month", label: "Month" },
              { key: "quarter", label: "Quarter" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setPeriod(opt.key)}
              className={`px-3 py-1 text-[12px] font-semibold rounded-md transition-colors ${
                period === opt.key
                  ? "bg-[var(--surface-card)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-5">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1">
              {period === "month" ? "This month" : "This quarter"}
            </p>
            <p className="font-display text-[32px] leading-none font-semibold text-[var(--text-primary)] tabular-nums">
              {formatCurrencyUsd(view.forecastedValue)}
            </p>
            <p className="mt-1.5 text-[12px] text-[var(--text-tertiary)]">
              {view.dealCount} dated deal{view.dealCount === 1 ? "" : "s"}
            </p>
          </div>
          {data.accuracyPct != null ? (
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1">
                Accuracy
              </p>
              <p className="font-display text-[24px] leading-none font-semibold text-[var(--success)] tabular-nums">
                {data.accuracyPct}%
              </p>
              <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                vs closed periods · {data.accuracySampleSize} samples
              </p>
            </div>
          ) : (
            <div className="text-right max-w-[180px]">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1">
                Accuracy
              </p>
              <p className="text-[12px] text-[var(--text-tertiary)] leading-snug">
                Builds after closed month/quarter snapshots
              </p>
            </div>
          )}
        </div>

        <TierBars
          committed={view.committed}
          bestCase={view.bestCase}
          pipeline={view.pipeline}
          total={view.forecastedValue}
        />

        {data.undated.count > 0 && (
          <p className="mt-4 pt-4 border-t border-[var(--border)] text-[12px] text-[var(--text-tertiary)]">
            {data.undated.count} undated open deal
            {data.undated.count === 1 ? "" : "s"} (
            {formatCurrencyUsd(data.undated.pipelineValue)} unweighted) excluded from
            forecast — set an expected close date to include them.
          </p>
        )}
      </div>
    </div>
  );
}
