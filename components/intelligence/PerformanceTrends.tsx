"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type Snapshot = {
  week_start: string;
  week_end: string;
  new_leads: number;
  contact_rate_pct: number | null;
  avg_response_time_hours: number | null;
  assets_sent_total: number;
  stale_lead_pct: number | null;
  deals_won: number;
  avg_intent_score: number | null;
  leads_with_followup_pct: number | null;
  overdue_followups: number | null;
};

type Props = {
  clientId: string;
};

type TrendDir = "up" | "down" | "flat";

function getTrend(
  current: number | null,
  previous: number | null,
  higherIsBetter: boolean
): TrendDir {
  if (current === null || previous === null) return "flat";
  const diff = current - previous;
  if (Math.abs(diff) < 2) return "flat";
  if (higherIsBetter) return diff > 0 ? "up" : "down";
  return diff > 0 ? "down" : "up";
}

function TrendIcon({ dir }: { dir: TrendDir }) {
  if (dir === "up")
    return <TrendingUp size={12} className="text-[var(--success)]" />;
  if (dir === "down")
    return <TrendingDown size={12} className="text-[var(--error)]" />;
  return <Minus size={12} className="text-[var(--text-disabled)]" />;
}

function formatWeek(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function formatValue(value: number, suffix: string): string {
  if (value % 1 !== 0) return `${value.toFixed(1)}${suffix}`;
  return `${Math.round(value)}${suffix}`;
}

export function PerformanceTrends({ clientId }: Props) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/clients/${clientId}/performance`)
      .then((r) => r.json())
      .then((data: { snapshots?: Snapshot[] }) =>
        setSnapshots(data.snapshots ?? [])
      )
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5 mt-5">
        <div className="h-3 w-32 rounded bg-[var(--bg-quaternary)] animate-pulse mb-4" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-lg bg-[var(--bg-quaternary)] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (snapshots.length === 0) {
    return null;
  }

  const current = snapshots[0];
  const previous = snapshots[1] ?? null;

  const metrics: Array<{
    label: string;
    current: number | null;
    previous: number | null;
    suffix: string;
    higherIsBetter: boolean;
    target: number | null;
    formatFn?: (v: number) => string;
  }> = [
    {
      label: "Contact rate",
      current: current.contact_rate_pct,
      previous: previous?.contact_rate_pct ?? null,
      suffix: "%",
      higherIsBetter: true,
      target: 70,
    },
    {
      label: "Avg response",
      current: current.avg_response_time_hours,
      previous: previous?.avg_response_time_hours ?? null,
      suffix: "h",
      higherIsBetter: false,
      target: null,
      formatFn: (v: number) =>
        v < 1 ? `${Math.round(v * 60)}m` : `${v.toFixed(1)}h`,
    },
    {
      label: "Deals won",
      current: current.deals_won,
      previous: previous?.deals_won ?? null,
      suffix: "",
      higherIsBetter: true,
      target: null,
    },
    {
      label: "Stale leads",
      current: current.stale_lead_pct,
      previous: previous?.stale_lead_pct ?? null,
      suffix: "%",
      higherIsBetter: false,
      target: null,
    },
    {
      label: "Assets sent",
      current: current.assets_sent_total,
      previous: previous?.assets_sent_total ?? null,
      suffix: "",
      higherIsBetter: true,
      target: null,
    },
    {
      label: "Intent score",
      current: current.avg_intent_score,
      previous: previous?.avg_intent_score ?? null,
      suffix: "",
      higherIsBetter: true,
      target: null,
    },
  ];

  // Contact rate history for bar chart — oldest first
  const contactRateHistory = snapshots
    .slice(0, 6)
    .reverse()
    .map((s) => ({
      week: formatWeek(s.week_start),
      value: s.contact_rate_pct ?? 0,
    }));

  const maxContactRate = Math.max(
    ...contactRateHistory.map((d) => d.value),
    1
  );

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5 mt-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-0.5">
            Performance trends
          </p>
          <p className="text-[12px] text-[var(--text-tertiary)]">
            Week of {formatWeek(current.week_start)} vs prior week
          </p>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-3 min-[600px]:grid-cols-3 mb-6">
        {metrics.map((metric) => {
          const trend = getTrend(
            metric.current,
            metric.previous,
            metric.higherIsBetter
          );

          const displayValue =
            metric.current !== null
              ? metric.formatFn
                ? metric.formatFn(metric.current)
                : formatValue(metric.current, metric.suffix)
              : "—";

          const prevDisplay =
            metric.previous !== null
              ? metric.formatFn
                ? metric.formatFn(metric.previous)
                : formatValue(metric.previous, metric.suffix)
              : null;

          const belowTarget =
            metric.target !== null &&
            metric.current !== null &&
            metric.current < metric.target;

          return (
            <div
              key={metric.label}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] p-3"
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-1.5">
                {metric.label}
              </p>

              <div className="flex items-end gap-1.5 mb-1">
                <p
                  className="text-[24px] font-semibold leading-none"
                  style={{
                    fontFamily: "var(--font-instrument-serif)",
                    color: belowTarget
                      ? "var(--error)"
                      : "var(--text-primary)",
                  }}
                >
                  {displayValue}
                </p>
                <TrendIcon dir={trend} />
              </div>

              {prevDisplay && (
                <p className="text-[10px] text-[var(--text-tertiary)]">
                  was {prevDisplay}
                </p>
              )}

              {belowTarget && (
                <p className="text-[10px] text-[var(--error)] mt-0.5">
                  target {metric.target}
                  {metric.suffix}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Contact rate history bar chart */}
      {contactRateHistory.length >= 3 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-3">
            Contact rate — last {contactRateHistory.length} weeks
          </p>
          <div className="flex items-end gap-2 h-16">
            {contactRateHistory.map((d, i) => {
              const heightPct = Math.max(
                Math.round((d.value / Math.max(maxContactRate, 100)) * 100),
                4
              );
              const isLast = i === contactRateHistory.length - 1;
              const barColour = isLast
                ? "var(--accent)"
                : d.value >= 70
                ? "var(--success)"
                : d.value >= 40
                ? "var(--warning)"
                : "var(--error)";

              return (
                <div
                  key={d.week}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <div className="relative w-full flex items-end" style={{ height: 56 }}>
                    <div
                      className="w-full rounded-t transition-all duration-700"
                      style={{
                        height: `${heightPct}%`,
                        minHeight: 4,
                        background: barColour,
                        opacity: isLast ? 1 : 0.6,
                      }}
                    />
                  </div>
                  <p className="text-[9px] text-[var(--text-tertiary)] text-center whitespace-nowrap">
                    {d.week}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
