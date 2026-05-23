"use client";

import Link from "next/link";
import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { PulseBar } from "@/components/dashboard/PulseBar";
import { buildReportPulseMetrics } from "@/components/reports/report-pulse-metrics";
import { ReportsVolumeChart } from "@/components/reports/ReportsVolumeChart";
import { ReportsReasonsChart } from "@/components/reports/ReportsReasonsChart";
import type { AgencyReport } from "@/lib/agency-report";
import { formatCurrencyUsd, formatDuration } from "@/lib/format";
import { ClientAvatar } from "@/components/ClientAvatar";
import type { LeadSource } from "@/types";
import { ResponsiveTable, type ResponsiveTableColumn } from "@/components/ui/ResponsiveTable";

const SOURCE_LABEL: Record<LeadSource, string> = {
  FACEBOOK: "Facebook",
  LANDING_PAGE: "Landing page",
  MANUAL: "Manual",
  REFERRAL: "Referral",
};

const SOURCE_DOT: Record<LeadSource, string> = {
  FACEBOOK: "bg-blue-500",
  LANDING_PAGE: "bg-[var(--accent)]",
  MANUAL: "bg-ink-tertiary",
  REFERRAL: "bg-purple-500",
};

async function fetcher(url: string): Promise<AgencyReport> {
  const r = await fetch(url);
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || "Failed to load report");
  }
  return r.json();
}

function SourceTable({ report }: { report: AgencyReport }) {
  const sources: LeadSource[] = ["FACEBOOK", "LANDING_PAGE", "MANUAL", "REFERRAL"];
  const rows = sources.map((s) => ({ s, ...report.bySource[s] }));
  const columns: ResponsiveTableColumn<(typeof rows)[number]>[] = [
    {
      key: "source",
      label: "Source",
      mobilePrimary: true,
      render: (r) => (
        <span className="inline-flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${SOURCE_DOT[r.s]}`} />
          {SOURCE_LABEL[r.s]}
        </span>
      ),
    },
    { key: "leads", label: "Leads", align: "right", render: (r) => <span className="tabular-nums">{r.leads}</span> },
    {
      key: "contacted",
      label: "Contacted",
      align: "right",
      render: (r) => <span className="tabular-nums">{r.contacted}</span>,
    },
    { key: "won", label: "Won", align: "right", render: (r) => <span className="tabular-nums">{r.won}</span> },
    {
      key: "wonValue",
      label: "Won value",
      align: "right",
      render: (r) => <span className="tabular-nums">{formatCurrencyUsd(r.wonValue)}</span>,
    },
    {
      key: "contactRate",
      label: "Contact rate",
      align: "right",
      render: (r) => <span className="tabular-nums">{r.contactRate}%</span>,
    },
    {
      key: "winRate",
      label: "Win rate",
      align: "right",
      render: (r) => <span className="tabular-nums">{r.winRate}%</span>,
    },
  ];

  return <ResponsiveTable columns={columns} rows={rows} rowKey={(r) => r.s} rowClassName={(r) => (r.leads === 0 ? "opacity-60" : undefined)} />;
}

function ClientLeaderboard({ rows }: { rows: AgencyReport["byClient"] }) {
  const columns: ResponsiveTableColumn<AgencyReport["byClient"][number]>[] = [
    {
      key: "client",
      label: "Client",
      mobilePrimary: true,
      render: (r) => (
        <Link href={`/dashboard/clients/${r.clientId}`} className="group flex items-center gap-3 hover:opacity-90">
          <ClientAvatar name={r.clientName} size="sm" />
          <div>
            <div className="font-medium text-ink-primary group-hover:underline">{r.clientName}</div>
            <div className="font-mono text-[11px] text-ink-tertiary">#{String(r.rank).padStart(2, "0")} · {r.industry}</div>
          </div>
        </Link>
      ),
    },
    { key: "leads", label: "Leads", align: "right", render: (r) => <span className="tabular-nums">{r.leads}</span> },
    {
      key: "contactRate",
      label: "Contact rate",
      align: "right",
      render: (r) => <span className="tabular-nums">{r.contactRate}%</span>,
    },
    { key: "won", label: "Won", align: "right", render: (r) => <span className="tabular-nums">{r.won}</span> },
    {
      key: "wonValue",
      label: "Won value",
      align: "right",
      render: (r) => <span className="tabular-nums">{formatCurrencyUsd(r.wonValue)}</span>,
    },
    {
      key: "avg",
      label: "Avg response",
      align: "right",
      render: (r) => <span className="text-ink-secondary">{formatDuration(r.avgResponseMinutes)}</span>,
    },
  ];

  return <ResponsiveTable columns={columns} rows={rows} rowKey={(r) => r.clientId} />;
}

function SalesLeaderboard({ rows }: { rows: AgencyReport["bySalesperson"] }) {
  const columns: ResponsiveTableColumn<AgencyReport["bySalesperson"][number]>[] = [
    {
      key: "salesperson",
      label: "Salesperson",
      mobilePrimary: true,
      render: (r) => (
        <div className="flex items-center gap-3">
          <ClientAvatar name={r.name} size="sm" />
          <div>
            <div className="font-medium text-ink-primary">{r.name}</div>
            <span className="inline-block rounded-sm bg-surface-card-alt px-2 py-0.5 font-mono text-[10px] text-ink-tertiary">
              {r.clientName}
            </span>
          </div>
        </div>
      ),
    },
    { key: "leads", label: "Leads", align: "right", render: (r) => <span className="tabular-nums">{r.leads}</span> },
    {
      key: "contacted",
      label: "Contacted",
      align: "right",
      render: (r) => <span className="tabular-nums">{r.contacted}</span>,
    },
    { key: "won", label: "Won", align: "right", render: (r) => <span className="tabular-nums">{r.won}</span> },
    {
      key: "wonValue",
      label: "Won value",
      align: "right",
      render: (r) => <span className="tabular-nums">{formatCurrencyUsd(r.wonValue)}</span>,
    },
    { key: "winRate", label: "Win rate", align: "right", render: (r) => <span className="tabular-nums">{r.winRate}%</span> },
    {
      key: "avg",
      label: "Avg response",
      align: "right",
      render: (r) => <span className="text-ink-secondary">{formatDuration(r.avgResponseMinutes)}</span>,
    },
  ];

  return <ResponsiveTable columns={columns} rows={rows} rowKey={(r) => r.userId} />;
}

export function ReportsDashboard() {
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const key = qs.includes("from") && qs.includes("to") ? `/api/reports/agency?${qs}` : null;

  const { data, error, isLoading } = useSWR<AgencyReport>(key, fetcher);

  if (!key) {
    return <p className="text-sm text-ink-secondary">Loading report range…</p>;
  }

  if (isLoading && !data) {
    return <div className="h-48 animate-pulse rounded-lg bg-surface-card-alt" />;
  }

  if (error) {
    return (
      <p className="text-sm text-[var(--danger-fg)]" role="alert">
        {error instanceof Error ? error.message : "Could not load report"}
      </p>
    );
  }

  if (!data) return null;

  if (data.totals.leads === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface-card py-20 text-center">
        <BarChart3 className="mx-auto h-12 w-12 text-ink-tertiary" strokeWidth={1.25} aria-hidden />
        <h2 className="mt-4 font-display text-xl text-ink-primary">No data for this period</h2>
        <p className="mt-2 max-w-sm text-sm text-ink-secondary">
          Try expanding your date range or removing filters.
        </p>
      </div>
    );
  }

  const pulse = buildReportPulseMetrics(data);

  return (
    <div className="space-y-10">
      <PulseBar metrics={pulse} />

      <section className="border border-border bg-surface-card p-6">
        <div className="mb-4 flex flex-col gap-2 layout:flex-row layout:items-start layout:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-tertiary">01 / Volume</p>
            <h2 className="font-display text-[22px] text-ink-primary">Leads over time</h2>
          </div>
          <div className="flex flex-wrap gap-4 font-mono text-[11px] text-ink-secondary">
            <span className="inline-flex items-center gap-2">
              <span className="h-0.5 w-6 bg-[#9498A1]" />
              Leads
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-6 rounded-sm bg-[var(--accent)] opacity-50" />
              Contacted
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-0.5 w-6 bg-ink-primary" />
              Won
            </span>
          </div>
        </div>
        <ReportsVolumeChart byDay={data.byDay} />
      </section>

      <div className="grid grid-cols-1 gap-8 layout:grid-cols-2">
        <section className="border border-border bg-surface-card p-6">
          <h3 className="font-display text-lg text-ink-primary">By source</h3>
          <div className="mt-4">
            <SourceTable report={data} />
          </div>
        </section>
        <section className="border border-border bg-surface-card p-6">
          <h3 className="font-display text-lg text-ink-primary">Why deals don&apos;t close</h3>
          <p className="mt-1 text-xs text-ink-tertiary">Lost + not qualified reasons (cohort)</p>
          <div className="mt-4">
            {data.byNotQualifiedReason.length === 0 ? (
              <p className="text-sm text-ink-secondary">No reasons recorded.</p>
            ) : (
              <ReportsReasonsChart rows={data.byNotQualifiedReason} />
            )}
          </div>
          <Link
            href="/dashboard/leads?status=not_qualified"
            className="mt-4 inline-block text-sm text-ink-secondary underline hover:text-ink-primary"
          >
            View all not-qualified leads →
          </Link>
        </section>
      </div>

      <section>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-tertiary">02 / Portfolio</p>
        <h2 className="font-display text-[22px] text-ink-primary">Client performance</h2>
        <div className="mt-6 border border-border bg-surface-card p-6">
          <ClientLeaderboard rows={data.byClient} />
        </div>
      </section>

      <section>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-tertiary">03 / Team</p>
        <h2 className="font-display text-[22px] text-ink-primary">Top performers</h2>
        <p className="mt-1 text-xs text-ink-tertiary">Win rate · minimum 5 contacted leads</p>
        <div className="mt-6 border border-border bg-surface-card p-6">
          {data.bySalesperson.length === 0 ? (
            <p className="text-sm text-ink-secondary">No salespeople meet the minimum contacted threshold.</p>
          ) : (
            <SalesLeaderboard rows={data.bySalesperson} />
          )}
        </div>
      </section>
    </div>
  );
}
