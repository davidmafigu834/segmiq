"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DollarSign, Megaphone, MessageCircle, Plus, Route, TrendingUp, Trophy } from "lucide-react";
import { formatCurrencyUsd } from "@/lib/format";
import { MarketingHubTabs } from "./MarketingHubTabs";

type Overview = {
  activeCampaigns: number;
  activeJourneys: number;
  pendingApproval: number;
  responsesAwaitingFollowUp: number;
  totalCampaigns: number;
  revenueWon: number;
  pipelineValue: number;
  estimatedSpend: number | null;
  avgOptOutRate: number;
  recentCampaigns: {
    id: string;
    name: string;
    status: string;
    stats: Record<string, number>;
    created_at: string;
    revenueWon?: number;
    replies?: number;
  }[];
  bestCampaign: { id: string; name: string; revenueWon: number } | null;
};

export function MarketingOverview({ clientId }: { clientId: string }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/clients/${clientId}/marketing/overview`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setOverview(data.overview ?? null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return (
    <div>
      <MarketingHubTabs />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Marketing Hub</h2>
          <p className="mt-1 max-w-xl text-sm text-[var(--text-secondary)]">
            Turn customer data into targeted WhatsApp campaigns — and every reply into a sales opportunity.
          </p>
        </div>
        <Link
          href="/client/marketing/campaigns/new"
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          New campaign
        </Link>
      </div>

      {loading ? (
        <div className="shimmer h-32 rounded-xl" />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatCard
              icon={DollarSign}
              label="Revenue won"
              value={formatCurrencyUsd(overview?.revenueWon ?? 0)}
            />
            <StatCard
              icon={TrendingUp}
              label="Pipeline generated"
              value={formatCurrencyUsd(overview?.pipelineValue ?? 0)}
            />
            <StatCard
              icon={MessageCircle}
              label="Responses awaiting follow-up"
              value={String(overview?.responsesAwaitingFollowUp ?? 0)}
            />
            <StatCard
              icon={Megaphone}
              label="Active campaigns"
              value={String(overview?.activeCampaigns ?? 0)}
            />
            <Link href="/client/marketing/journeys" className="block">
              <StatCard
                icon={Route}
                label="Active journeys"
                value={String(overview?.activeJourneys ?? 0)}
              />
            </Link>
          </div>

          {overview?.bestCampaign && overview.bestCampaign.revenueWon > 0 && (
            <div className="mb-6 rounded-xl border border-[var(--border)] bg-[rgba(212,255,79,0.06)] p-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
                <Trophy className="h-4 w-4 text-[var(--accent)]" />
                Best-performing campaign
              </div>
              <Link
                href={`/client/marketing/campaigns/${overview.bestCampaign.id}`}
                className="mt-1 inline-block text-sm font-semibold text-[var(--text-primary)] hover:underline"
              >
                {overview.bestCampaign.name} — {formatCurrencyUsd(overview.bestCampaign.revenueWon)} won
              </Link>
            </div>
          )}

          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--text-primary)]">Recent campaigns</h3>
            <Link
              href="/client/marketing/reports"
              className="text-xs text-[var(--accent)] hover:underline"
            >
              View all reports
            </Link>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            {(overview?.recentCampaigns ?? []).length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[var(--text-tertiary)]">
                No campaigns yet. Create your first WhatsApp campaign to reach your CRM audience.
              </div>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {(overview?.recentCampaigns ?? []).map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/client/marketing/campaigns/${c.id}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-[var(--surface-hover)]"
                    >
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{c.name}</p>
                        <p className="text-xs text-[var(--text-tertiary)]">
                          {c.replies ?? 0} replies
                          {(c.revenueWon ?? 0) > 0
                            ? ` · ${formatCurrencyUsd(c.revenueWon)} won`
                            : ""}
                        </p>
                      </div>
                      <StatusBadge status={c.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-2 flex items-center gap-2 text-[var(--text-tertiary)]">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-[var(--surface-elevated)] text-[var(--text-secondary)]",
    pending_approval: "bg-[rgba(245,166,35,0.12)] text-[var(--warning)]",
    scheduled: "bg-[rgba(245,166,35,0.12)] text-[var(--warning)]",
    sending: "bg-[rgba(61,214,140,0.12)] text-[var(--success)]",
    completed: "bg-[rgba(61,214,140,0.12)] text-[var(--success)]",
    paused: "bg-[rgba(245,166,35,0.12)] text-[var(--warning)]",
    cancelled: "bg-[rgba(255,68,68,0.12)] text-[var(--error)]",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${colors[status] ?? colors.draft}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
