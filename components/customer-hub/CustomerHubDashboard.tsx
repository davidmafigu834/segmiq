"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock, Footprints, UserPlus } from "lucide-react";
import {
  healthClass,
  healthLabel,
  KNOWN_SOURCES,
  recentStatusClass,
  recentStatusLabel,
  SOURCE_DISPLAY,
  type NormalizedSource,
} from "@/lib/customer-hub/source-labels";
import type { HubObservation } from "@/lib/customer-hub/observations";

type StatsPayload = {
  pulse: {
    added_today: number;
    followups_due: number;
    quotations_sent_month: number;
    never_contacted: number;
  };
  sources: Array<{
    source: string;
    this_month: number;
    last_month: number;
    followed_up_pct: number;
    quoted_pct: number;
    converted_pct: number;
    health: string;
  }>;
  observations: HubObservation[];
  trend: Array<{ month: number; year: number; count: number; prior_count: number }>;
  recent: Array<{
    id: string;
    name: string;
    initials: string;
    source: string;
    created_at: string;
    salesperson_name: string | null;
    status: string;
  }>;
};

const serif = { fontFamily: "var(--font-instrument-serif)" } as const;

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(d / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function ObservationIcon({ type }: { type: HubObservation["type"] }) {
  if (type === "green") return <CheckCircle2 size={16} className="shrink-0 text-[var(--success)]" />;
  if (type === "amber") return <Clock size={16} className="shrink-0 text-[var(--warning)]" />;
  return <AlertTriangle size={16} className="shrink-0 text-[var(--error)]" />;
}

function FunnelBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-[var(--text-tertiary)]">{label}</span>
        <span className="font-medium text-[var(--text-secondary)]">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-quaternary)]">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-all"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}

function VolumeTrendChart({ trend }: { trend: StatsPayload["trend"] }) {
  const max = Math.max(1, ...trend.flatMap((t) => [t.count, t.prior_count]));
  const barW = 14;
  const gap = 6;
  const groupW = barW * 2 + gap;
  const height = 72;
  const width = trend.length * (groupW + 12) + 8;

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height + 24} className="min-w-full">
        {trend.map((t, i) => {
          const x = i * (groupW + 12) + 8;
          const curH = (t.count / max) * height;
          const priorH = (t.prior_count / max) * height;
          return (
            <g key={`${t.year}-${t.month}`}>
              <rect
                x={x}
                y={height - priorH}
                width={barW}
                height={priorH}
                rx={2}
                className="fill-[var(--bg-quaternary)]"
              />
              <rect
                x={x + barW + gap}
                y={height - curH}
                width={barW}
                height={curH}
                rx={2}
                fill="#D4FF4F"
              />
              <text
                x={x + groupW / 2}
                y={height + 16}
                textAnchor="middle"
                className="fill-[var(--text-tertiary)] text-[10px]"
              >
                {MONTH_LABELS[t.month - 1]}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex gap-4 text-[11px] text-[var(--text-tertiary)]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-sm bg-[#D4FF4F]" /> This year
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-sm bg-[var(--bg-quaternary)]" /> Prior year
        </span>
      </div>
    </div>
  );
}

export function CustomerHubDashboard({
  onFilterChange,
}: {
  onFilterChange?: (filterKey: string | null) => void;
}) {
  const router = useRouter();
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [recentSource, setRecentSource] = useState<"all" | "walk_in" | "whatsapp" | "facebook">("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/manager/customer-hub/stats");
        if (!res.ok) throw new Error("fetch failed");
        const data = (await res.json()) as StatsPayload;
        if (!cancelled) {
          setStats(data);
          setFetchError(false);
        }
      } catch {
        if (!cancelled) {
          setStats(null);
          setFetchError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sourceCards = useMemo(() => {
    if (!stats) return [];
    const byKey = new Map(stats.sources.map((s) => [s.source, s]));
    return KNOWN_SOURCES.map((key) => {
      const row = byKey.get(key);
      return (
        row ?? {
          source: key,
          this_month: 0,
          last_month: 0,
          followed_up_pct: 0,
          quoted_pct: 0,
          converted_pct: 0,
          health: "healthy",
        }
      );
    });
  }, [stats]);

  const filteredRecent = useMemo(() => {
    if (!stats) return [];
    return stats.recent.filter((r) => {
      if (recentSource === "all") return true;
      if (recentSource === "walk_in") return r.source === "walk_in";
      if (recentSource === "whatsapp")
        return r.source === "whatsapp_inbound" || r.source === "whatsapp_saved";
      if (recentSource === "facebook") return r.source === "facebook";
      return true;
    });
  }, [stats, recentSource]);

  if (loading) {
    return <div className="ag-fade-in mb-8 shimmer h-48 rounded-xl" />;
  }

  if (fetchError || !stats) {
    return (
      <div className="ag-fade-in mb-8 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5">
        <p className="text-[13px] text-[var(--text-secondary)]">
          Dashboard stats could not be loaded. If you just applied the migration, run{" "}
          <code className="text-[var(--accent)]">052_customer_hub_stats.sql</code> in Supabase, then
          refresh.
        </p>
      </div>
    );
  }

  const pulseCards = [
    {
      label: "Added today",
      value: stats.pulse.added_today,
      sub: "Across all sources",
      urgent: false,
    },
    {
      label: "Follow-ups due",
      value: stats.pulse.followups_due,
      sub: "Today or overdue",
      urgent: stats.pulse.followups_due > 0,
    },
    {
      label: "Quotations sent",
      value: stats.pulse.quotations_sent_month,
      sub: "This month",
      urgent: false,
    },
    {
      label: "Never contacted",
      value: stats.pulse.never_contacted,
      sub: "Zero call logs ever",
      urgent: true,
    },
  ];

  return (
    <div className="mb-8 flex flex-col gap-6">
      {/* Section 1 — Pulse strip */}
      <div className="ag-fade-in grid grid-cols-2 gap-3 lg:grid-cols-4">
        {pulseCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5"
          >
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
              {card.label}
            </p>
            <p
              className="mt-2 text-[36px] leading-none text-[var(--text-primary)]"
              style={{
                ...serif,
                ...(card.urgent ? { color: "var(--error)" } : {}),
              }}
            >
              {card.value}
            </p>
            <p
              className={`mt-2 text-[12px] ${
                card.urgent ? "text-[var(--error)]" : "text-[var(--text-tertiary)]"
              }`}
            >
              {card.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Section 2 — Source breakdown */}
      <div className="ag-fade-in ag-delay-1 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sourceCards.map((row) => {
          const meta = SOURCE_DISPLAY[row.source as NormalizedSource] ?? SOURCE_DISPLAY.other;
          return (
            <div
              key={row.source}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: meta.dotColor }}
                  />
                  <span className="text-[14px] font-semibold text-[var(--text-primary)]">
                    {meta.label}
                  </span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase ${healthClass(row.health)}`}
                >
                  {healthLabel(row.health)}
                </span>
              </div>
              <div className="mb-4 flex gap-6">
                <div>
                  <p className="text-[11px] text-[var(--text-tertiary)]">This month</p>
                  <p className="text-[20px] leading-none text-[var(--text-primary)]" style={serif}>
                    {row.this_month}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[var(--text-tertiary)]">Last month</p>
                  <p className="text-[20px] leading-none text-[var(--text-secondary)]" style={serif}>
                    {row.last_month}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                <FunnelBar label="Followed up" pct={row.followed_up_pct} />
                <FunnelBar label="Quoted" pct={row.quoted_pct} />
                <FunnelBar label="Converted" pct={row.converted_pct} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Section 3 — Observations */}
      {stats.observations.length > 0 && (
        <div className="ag-fade-in ag-delay-2 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
            Intelligence observations
          </p>
          <ul className="flex flex-col gap-3">
            {stats.observations.map((obs) => (
              <li
                key={obs.filter_key}
                className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-quaternary)] px-3 py-2.5"
              >
                <ObservationIcon type={obs.type} />
                <p className="min-w-0 flex-1 text-[13px] leading-snug text-[var(--text-primary)]">
                  {obs.text}
                </p>
                <button
                  type="button"
                  onClick={() => onFilterChange?.(obs.filter_key)}
                  className="shrink-0 text-[12px] font-medium text-[var(--accent)] hover:underline"
                >
                  View
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Section 4 — Volume trend */}
      <div className="ag-fade-in ag-delay-3 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
          Volume trend
        </p>
        <p className="mb-4 text-[13px] text-[var(--text-secondary)]">
          Contacts added per month — last 6 months
        </p>
        <VolumeTrendChart trend={stats.trend} />
      </div>

      {/* Section 5 — Recent contacts */}
      <div className="ag-fade-in ag-delay-4 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
            Recent contacts
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["all", "All"],
                ["walk_in", "Walk-in"],
                ["whatsapp", "WhatsApp"],
                ["facebook", "Facebook"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setRecentSource(key)}
                className={`rounded-full border px-3 py-1 text-[12px] font-medium transition ${
                  recentSource === key
                    ? "border-[var(--accent)] bg-[rgba(212,255,79,0.08)] text-[var(--text-primary)]"
                    : "border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <ul className="flex flex-col">
          {filteredRecent.length === 0 ? (
            <li className="py-4 text-center text-[13px] text-[var(--text-tertiary)]">
              No contacts match this filter.
            </li>
          ) : (
            filteredRecent.map((row) => {
              const srcMeta =
                SOURCE_DISPLAY[row.source as NormalizedSource] ?? SOURCE_DISPLAY.other;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/client/contacts/${row.id}`)}
                    className="flex w-full items-center gap-3 border-b border-[var(--border)] px-1 py-3 text-left last:border-b-0 transition hover:bg-[var(--bg-tertiary)]"
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--border)] bg-[var(--bg-tertiary)] text-[12px] font-semibold text-[var(--text-secondary)]">
                      {row.initials || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
                          {row.name}
                        </span>
                        <span className="text-[11px] text-[var(--text-tertiary)]">{srcMeta.label}</span>
                      </div>
                      <div className="mt-0.5 text-[12px] text-[var(--text-tertiary)]">
                        {timeAgo(row.created_at)}
                        {row.salesperson_name ? ` · ${row.salesperson_name}` : " · Unassigned"}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${recentStatusClass(row.status)}`}
                    >
                      {recentStatusLabel(row.status)}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}

export function CustomerHubHeader({
  clientName,
  onOpenAdd,
  onOpenWalkIn,
}: {
  clientName?: string;
  onOpenAdd: () => void;
  onOpenWalkIn: () => void;
}) {
  return (
    <header className="mb-8 flex flex-col gap-6 layout:flex-row layout:items-baseline layout:justify-between">
      <div>
        <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
          {(clientName ? `${clientName} / ` : "") + "CUSTOMER HUB"}
        </div>
        <h1 className="font-display text-4xl tracking-tight text-[var(--text-primary)]">Overview</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Your pipeline at a glance — sources, follow-ups and intelligence.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenWalkIn}
          className="inline-flex shrink-0 items-center gap-2 self-start rounded-md border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-card-alt)] hover:text-[var(--text-primary)]"
        >
          <Footprints className="h-4 w-4" strokeWidth={1.5} />
          Walk-in
        </button>
        <button
          type="button"
          onClick={onOpenAdd}
          className="inline-flex shrink-0 items-center gap-2 self-start rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)]"
        >
          <UserPlus className="h-4 w-4" strokeWidth={1.5} />
          Add Contact
        </button>
      </div>
    </header>
  );
}
