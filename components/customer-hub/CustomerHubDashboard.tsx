"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock } from "lucide-react";
import {
  healthClass,
  healthLabel,
  KNOWN_SOURCES,
  normalizeContactSourceKey,
  SOURCE_DISPLAY,
  type NormalizedSource,
} from "@/lib/customer-hub/source-labels";
import type { OverviewRecentContact } from "@/lib/customer-hub/contact-list-types";
import type { HubObservation } from "@/lib/customer-hub/observations";
import { VolumeTrendChart } from "@/components/customer-hub/VolumeTrendChart";
import {
  ContactMemoryCard,
} from "@/components/customer-hub/ContactMemoryCard";

const DISPLAY_RECENT = 6;

type StatsPayload = {
  relationship: {
    total: number;
    customers: number;
    pipeline: number;
    aware: number;
    cold: number;
  };
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
  recent: OverviewRecentContact[];
};

const serif = { fontFamily: "var(--font-instrument-serif)" } as const;

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

function HubMemoryBanner({ total }: { total: number }) {
  return (
    <div className="ag-fade-in rounded-xl border border-[var(--border)] bg-[var(--surface-card)] px-5 py-4">
      <p className="text-[13px] text-[var(--text-secondary)]">
        Your business knows{" "}
        <span className="font-semibold text-[var(--text-primary)]" style={serif}>
          {total.toLocaleString()}
        </span>{" "}
        {total === 1 ? "person" : "people"} in SegmiQ — every source, every stage, kept with the company.
      </p>
    </div>
  );
}

function RelationshipStrip({
  relationship,
}: {
  relationship: StatsPayload["relationship"];
}) {
  const cards = [
    {
      label: "Cold",
      value: relationship.cold,
      sub: "No contact yet",
      href: "/client/contacts?lifecycle=cold",
    },
    {
      label: "Aware",
      value: relationship.aware,
      sub: "Engaged, not in pipeline",
      href: "/client/contacts?lifecycle=aware",
    },
    {
      label: "Pipeline",
      value: relationship.pipeline,
      sub: "Active deals",
      href: "/client/leads/pipeline",
    },
    {
      label: "Customers",
      value: relationship.customers,
      sub: "Won business",
      href: "/client/customers",
    },
  ] as const;

  return (
    <div className="ag-fade-in grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <Link
          key={card.label}
          href={card.href}
          className="group rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5 transition hover:border-[var(--border-hover)]"
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
            {card.label}
          </p>
          <p
            className="mt-2 text-[36px] leading-none text-[var(--text-primary)] transition group-hover:text-[var(--accent)]"
            style={serif}
          >
            {card.value}
          </p>
          <p className="mt-2 text-[12px] text-[var(--text-tertiary)]">{card.sub}</p>
        </Link>
      ))}
    </div>
  );
}

export function CustomerHubDashboard({
  onFilterChange,
}: {
  onFilterChange?: (filterKey: string | null) => void;
}) {
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
    return stats.recent
      .filter((r) => {
        const key = normalizeContactSourceKey(r.source);
        if (recentSource === "all") return true;
        if (recentSource === "walk_in") return key === "walk_in";
        if (recentSource === "whatsapp") {
          return key === "whatsapp_inbound" || key === "whatsapp_saved";
        }
        if (recentSource === "facebook") return key === "facebook";
        return true;
      })
      .slice(0, DISPLAY_RECENT);
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
      <HubMemoryBanner total={stats.relationship?.total ?? 0} />

      <RelationshipStrip
        relationship={
          stats.relationship ?? { total: 0, customers: 0, pipeline: 0, aware: 0, cold: 0 }
        }
      />

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
      <div className="ag-fade-in ag-delay-3 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
              Volume trend
            </p>
            <h2 className="mt-1 text-[18px] font-semibold text-[var(--text-primary)]">
              Contacts added per month
            </h2>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              Last 6 months — this year vs the same months last year
            </p>
          </div>
        </div>
        <VolumeTrendChart trend={stats.trend} />
      </div>

      {/* Section 5 — Latest contacts */}
      <div className="ag-fade-in ag-delay-4 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
              Latest contacts
            </p>
            <h2 className="mt-1 text-[18px] font-semibold text-[var(--text-primary)]">
              New & active
            </h2>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              Recently added — follow-ups and outreach gaps highlighted
            </p>
          </div>
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

        {filteredRecent.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-quaternary)] py-8 text-center text-[13px] text-[var(--text-tertiary)]">
            No contacts match this filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {filteredRecent.map((contact) => (
              <ContactMemoryCard
                key={contact.id}
                contact={contact}
                compact
                attentionStatus={contact.attentionStatus}
              />
            ))}
          </div>
        )}

        <div className="mt-5 flex justify-end border-t border-[var(--border)] pt-4">
          <Link
            href="/client/contacts"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--accent)] transition hover:underline"
          >
            View all contacts
            <ArrowRight size={14} strokeWidth={2} />
          </Link>
        </div>
      </div>
    </div>
  );
}

/** @deprecated Use CustomerHubPageHeader */
export { CustomerHubPageHeader as CustomerHubHeader } from "@/components/customer-hub/CustomerHubPageHeader";
