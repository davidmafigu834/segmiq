"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatCurrencyUsd } from "@/lib/format";
import { MarketingHubTabs } from "./MarketingHubTabs";

type CampaignSummary = {
  campaignId: string;
  campaignName: string;
  status: string;
  messagesSent: number;
  replies: number;
  interested: number;
  quotationsIssued: number;
  dealsWon: number;
  pipelineValue: number;
  revenueWon: number;
  estimatedCost: number | null;
  returnOnSpend: number | null;
};

type SalespersonRow = {
  userId: string | null;
  name: string;
  replies: number;
  interested: number;
  dealsWon: number;
  pipelineValue: number;
  revenueWon: number;
};

type Reports = {
  totalRevenueWon: number;
  totalPipeline: number;
  totalCampaigns: number;
  totalReplies: number;
  totalInterested: number;
  avgOptOutRate: number;
  responsesAwaitingFollowUp: number;
  estimatedTotalSpend: number | null;
  bestCampaigns: CampaignSummary[];
  campaignSummaries: CampaignSummary[];
  bySalesperson: SalespersonRow[];
};

function fmtMoney(n: number | null | undefined) {
  if (n == null) return "—";
  return formatCurrencyUsd(n);
}

function fmtPct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function fmtRoas(n: number | null) {
  if (n == null) return "—";
  return `${n.toFixed(1)}x`;
}

export function MarketingReports({ clientId }: { clientId: string }) {
  const [reports, setReports] = useState<Reports | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/clients/${clientId}/marketing/reports`)
      .then((r) => r.json())
      .then((d) => setReports(d.reports ?? null))
      .finally(() => setLoading(false));
  }, [clientId]);

  return (
    <div>
      <MarketingHubTabs />

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Reports</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Campaign performance tied to quotations, pipeline, and revenue won.
        </p>
      </div>

      {loading ? (
        <div className="shimmer h-48 rounded-xl" />
      ) : !reports ? (
        <p className="text-sm text-[var(--text-tertiary)]">Unable to load reports.</p>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Revenue won" value={fmtMoney(reports.totalRevenueWon)} />
            <MetricCard label="Pipeline generated" value={fmtMoney(reports.totalPipeline)} />
            <MetricCard label="Campaign replies" value={String(reports.totalReplies)} />
            <MetricCard
              label="Est. spend"
              value={fmtMoney(reports.estimatedTotalSpend)}
              hint="Set cost per message in Settings"
            />
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <MetricCard label="Interested responses" value={String(reports.totalInterested)} />
            <MetricCard label="Avg opt-out rate" value={fmtPct(reports.avgOptOutRate)} />
            <MetricCard
              label="Awaiting follow-up"
              value={String(reports.responsesAwaitingFollowUp)}
            />
          </div>

          <section className="mb-8">
            <h3 className="mb-3 text-sm font-medium text-[var(--text-primary)]">
              Performance by salesperson
            </h3>
            {reports.bySalesperson.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)]">No attributed activity yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-[var(--surface-elevated)]">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-[var(--text-secondary)]">
                        Salesperson
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-[var(--text-secondary)]">
                        Replies
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-[var(--text-secondary)]">
                        Interested
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-[var(--text-secondary)]">
                        Won
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-[var(--text-secondary)]">
                        Pipeline
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-[var(--text-secondary)]">
                        Revenue
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {reports.bySalesperson.map((sp) => (
                      <tr key={sp.userId ?? sp.name}>
                        <td className="px-4 py-2 text-[var(--text-primary)]">{sp.name}</td>
                        <td className="px-4 py-2 text-[var(--text-secondary)]">{sp.replies}</td>
                        <td className="px-4 py-2 text-[var(--text-secondary)]">{sp.interested}</td>
                        <td className="px-4 py-2 text-[var(--text-secondary)]">{sp.dealsWon}</td>
                        <td className="px-4 py-2 text-right text-[var(--text-secondary)]">
                          {fmtMoney(sp.pipelineValue)}
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-[var(--text-primary)]">
                          {fmtMoney(sp.revenueWon)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-sm font-medium text-[var(--text-primary)]">All campaigns</h3>
            {reports.campaignSummaries.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)]">
                Complete a campaign to see attribution data here.
              </p>
            ) : (
              <div className="space-y-3">
                {reports.campaignSummaries.map((c) => (
                  <Link
                    key={c.campaignId}
                    href={`/client/marketing/campaigns/${c.campaignId}`}
                    className="block rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 hover:bg-[var(--surface-hover)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">{c.campaignName}</p>
                        <p className="mt-0.5 text-xs capitalize text-[var(--text-tertiary)]">
                          {c.status.replace(/_/g, " ")} · {c.messagesSent} sent · {c.replies} replies
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-[var(--success)]">
                          {fmtMoney(c.revenueWon)} won
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">
                          {fmtMoney(c.pipelineValue)} pipeline · ROAS {fmtRoas(c.returnOnSpend)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--text-secondary)]">
                      <span>{c.interested} interested</span>
                      <span>{c.quotationsIssued} quotations</span>
                      <span>{c.dealsWon} deals won</span>
                      {c.estimatedCost != null && (
                        <span>Cost {fmtMoney(c.estimatedCost)}</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--text-tertiary)]">{hint}</p>}
    </div>
  );
}
