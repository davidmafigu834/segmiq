"use client";

import { useEffect, useState } from "react";
import { Brain, TrendingUp, MapPin, Tag, Zap, BarChart2 } from "lucide-react";

type Summary = {
  totalProcessed: number;
  avgIntentScore: number;
  intentDistribution: Record<string, number>;
  urgencyDistribution: Record<string, number>;
  topTags: Array<{ tag: string; count: number }>;
  topLocations: Array<{ location: string; count: number }>;
};

type Snapshot = {
  week_start: string;
  weekly_insight: string;
  total_leads: number;
  high_intent_leads: number;
  avg_intent_score: number;
};

type Props = {
  clientId: string;
};

function formatCategory(cat: string): string {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatTag(tag: string): string {
  return tag.replace(/_/g, " ");
}

const URGENCY_COLOURS: Record<string, string> = {
  immediate: "var(--error)",
  soon: "var(--warning)",
  planning: "#60a5fa",
  exploring: "var(--text-tertiary)",
};

export function ClientIntelligenceOverview({ clientId }: Props) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/clients/${clientId}/intelligence?weeks=4`)
      .then((r) => r.json())
      .then((data: { summary?: Summary; snapshots?: Snapshot[] }) => {
        if (cancelled) return;
        setSummary(data.summary ?? null);
        setSnapshots(data.snapshots ?? []);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5 mt-5">
        <div className="h-4 w-32 rounded bg-[var(--bg-quaternary)] animate-pulse mb-4" />
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

  if (!summary || summary.totalProcessed === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5 mt-5">
        <div className="flex items-center gap-2 mb-3">
          <Brain size={16} className="text-[var(--text-disabled)]" />
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
            Lead intelligence
          </p>
        </div>
        <p className="text-[13px] text-[var(--text-tertiary)]">
          Intelligence data will appear here as leads come in and are processed.
          Data builds over time.
        </p>
      </div>
    );
  }

  const topIntents = Object.entries(summary.intentDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const maxIntentCount = Math.max(...topIntents.map(([, c]) => c), 1);

  const topUrgencies = Object.entries(summary.urgencyDistribution).sort(
    (a, b) => b[1] - a[1]
  );

  const maxUrgencyCount = Math.max(...topUrgencies.map(([, c]) => c), 1);

  const latestSnapshot = snapshots[0] ?? null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5 mt-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <div className="w-6 h-6 rounded-md bg-[rgba(212,255,79,0.1)] border border-[rgba(212,255,79,0.2)] flex items-center justify-center">
          <Brain size={13} className="text-[var(--accent)]" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
            Lead intelligence
          </p>
          <p className="text-[12px] text-[var(--text-tertiary)]">
            Last 4 weeks · {summary.totalProcessed} leads analysed
          </p>
        </div>
      </div>

      {/* Latest weekly insight */}
      {latestSnapshot?.weekly_insight && (
        <div className="rounded-lg border border-[rgba(212,255,79,0.15)] bg-[rgba(212,255,79,0.04)] p-4 mb-5">
          <div className="flex items-center gap-1.5 mb-2">
            <Zap size={11} className="text-[var(--accent)]" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--accent)]">
              Latest insight
            </p>
          </div>
          <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
            {latestSnapshot.weekly_insight}
          </p>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          {
            label: "Avg intent score",
            value: summary.avgIntentScore,
            icon: TrendingUp,
            colour:
              summary.avgIntentScore >= 60
                ? "var(--success)"
                : summary.avgIntentScore >= 40
                ? "var(--warning)"
                : "var(--error)",
            isText: false,
          },
          {
            label: "Top location",
            value: summary.topLocations[0]?.location ?? "—",
            icon: MapPin,
            colour: "#60a5fa",
            isText: true,
          },
          {
            label: "Top intent",
            value: topIntents[0] ? formatCategory(topIntents[0][0]) : "—",
            icon: BarChart2,
            colour: "var(--accent)",
            isText: true,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] p-3"
          >
            <div className="flex items-center gap-1.5 mb-2">
              <stat.icon size={11} style={{ color: stat.colour }} />
              <p className="text-[9px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
                {stat.label}
              </p>
            </div>
            <p
              className={`font-semibold leading-tight ${
                stat.isText ? "text-[13px]" : "text-[24px]"
              }`}
              style={{
                fontFamily: stat.isText
                  ? "inherit"
                  : "var(--font-instrument-serif)",
                color: stat.colour,
              }}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Two column — intents + urgency */}
      <div className="grid grid-cols-1 gap-4 min-[700px]:grid-cols-2 mb-5">
        {/* Intent categories */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-3">
            Intent categories
          </p>
          <div className="flex flex-col gap-2">
            {topIntents.map(([category, count]) => {
              const pct = Math.round((count / maxIntentCount) * 100);
              return (
                <div key={category} className="flex items-center gap-3">
                  <span className="text-[11px] font-medium text-[var(--text-tertiary)] w-[130px] truncate shrink-0">
                    {formatCategory(category)}
                  </span>
                  <div className="flex-1 h-[4px] rounded-full bg-[var(--bg-quaternary)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span
                    className="text-[14px] font-semibold text-[var(--text-primary)] w-5 text-right shrink-0"
                    style={{ fontFamily: "var(--font-instrument-serif)" }}
                  >
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Urgency breakdown */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-3">
            Urgency signals
          </p>
          <div className="flex flex-col gap-2">
            {topUrgencies.map(([urgency, count]) => {
              const colour =
                URGENCY_COLOURS[urgency] ?? "var(--text-disabled)";
              const pct = Math.round((count / maxUrgencyCount) * 100);
              const label =
                urgency.charAt(0).toUpperCase() + urgency.slice(1);
              return (
                <div key={urgency} className="flex items-center gap-3">
                  <span className="text-[11px] font-medium text-[var(--text-tertiary)] w-[80px] shrink-0">
                    {label}
                  </span>
                  <div className="flex-1 h-[4px] rounded-full bg-[var(--bg-quaternary)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-[width] duration-700"
                      style={{ width: `${pct}%`, background: colour }}
                    />
                  </div>
                  <span
                    className="text-[14px] font-semibold text-[var(--text-primary)] w-5 text-right shrink-0"
                    style={{ fontFamily: "var(--font-instrument-serif)" }}
                  >
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top tags */}
      {summary.topTags.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-2">
            Common signals
          </p>
          <div className="flex flex-wrap gap-1.5">
            {summary.topTags.map(({ tag, count }) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border border-[var(--border)] bg-[var(--bg-tertiary)] text-[11px] font-medium text-[var(--text-secondary)]"
              >
                <Tag size={9} className="text-[var(--text-tertiary)]" />
                {formatTag(tag)}
                <span className="text-[var(--text-tertiary)]">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
