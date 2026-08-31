"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import {
  SalesDonutChart,
  SalesMultiLineChart,
  SalesSparkline,
} from "@/components/sales/ui/Charts";
import { useSalesChartColors } from "@/lib/sales/use-sales-chart-colors";
import { ClientAvatar } from "@/components/ClientAvatar";
import type { ClientReportPayload } from "@/lib/client-report";
import { formatCurrencyUsd } from "@/lib/format";
import { ResponsiveTable, type ResponsiveTableColumn } from "@/components/ui/ResponsiveTable";

async function fetcher(url: string): Promise<ClientReportPayload> {
  const r = await fetch(url);
  if (!r.ok) {
    let msg = "Failed to load report";
    try {
      const j = (await r.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return r.json();
}

function formatDeltaPct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n}%`;
}

function formatAvgResponseHero(m: number | null): string {
  if (m == null) return "—";
  if (m < 60) return `${Math.round(m)}m`;
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  return min > 0 ? `${h}h ${min}m` : `${h}h`;
}

const FUNNEL: Array<{
  key: keyof ClientReportPayload["pipeline"];
  label: string;
  barVar: string;
}> = [
  { key: "NEW", label: "New", barVar: "--status-new-bg" },
  { key: "CONTACTED", label: "Contacted", barVar: "--status-contacted-bg" },
  { key: "NEGOTIATING", label: "Negotiating", barVar: "--status-negotiating-bg" },
  { key: "PROPOSAL_SENT", label: "Proposal", barVar: "--status-proposal-bg" },
  { key: "WON", label: "Won", barVar: "--accent" },
  { key: "LOST", label: "Lost", barVar: "--status-lost-bg" },
  { key: "NOT_QUALIFIED", label: "Not qualified", barVar: "--status-lost-bg" },
];

function HeroPill({ value }: { value: number }) {
  return (
    <span className="inline-block rounded-full border border-[var(--border)] bg-[var(--bg-tertiary)] px-2.5 py-0.5 font-mono text-[11px] font-medium text-[var(--text-secondary)]">
      {formatDeltaPct(value)} vs prior period
    </span>
  );
}

export function ClientReportsDashboard() {
  const colors = useSalesChartColors();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const key = qs ? `/api/reports/client?${qs}` : null;
  const { data, error, isLoading } = useSWR(key, fetcher, { revalidateOnFocus: false });

  const donutData = useMemo(() => {
    if (!data) return [];
    const rows = [
      { name: "Facebook", key: "FACEBOOK" as const, value: data.bySource.FACEBOOK.leads, fill: "var(--accent)" },
      {
        name: "Landing page",
        key: "LANDING_PAGE" as const,
        value: data.bySource.LANDING_PAGE.leads,
        fill: "var(--text-primary)",
      },
      { name: "Manual", key: "MANUAL" as const, value: data.bySource.MANUAL.leads, fill: "#9ca3af" },
      { name: "Referral", key: "REFERRAL" as const, value: data.bySource.REFERRAL.leads, fill: "#a855f7" },
    ];
    return rows.filter((r) => r.value > 0);
  }, [data]);

  const donutTotal = useMemo(() => donutData.reduce((s, r) => s + r.value, 0), [donutData]);

  const funnelMax = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, ...FUNNEL.map((f) => data.pipeline[f.key]));
  }, [data]);

  const limitMin = data ? data.client.responseTimeLimitHours * 60 : 0;
  const actualMin = data?.headline.avgResponseMinutes ?? null;
  const withinSla = actualMin != null && actualMin <= limitMin;
  const gaugePct =
    actualMin != null && limitMin > 0 ? Math.min(100, (actualMin / limitMin) * 100) : actualMin == null ? 0 : 100;

  if (!key) {
    return <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-8 text-[var(--text-secondary)]">Loading…</div>;
  }

  if (error) {
    return (
      <div className="rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger-fg)]">
        {error instanceof Error ? error.message : "Could not load report."}
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-2 min-[600px]:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="shimmer h-[100px] rounded-lg border border-[var(--border)]" />
          ))}
        </div>
        <div className="shimmer h-40 rounded-lg border border-[var(--border)]" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="shimmer h-64 rounded-lg border border-[var(--border)]" />
          <div className="shimmer h-64 rounded-lg border border-[var(--border)]" />
        </div>
      </div>
    );
  }

  const periodEyebrow = data.period.label.toUpperCase();

  return (
    <div className="ag-fade-in space-y-10 pb-16">
      <section className="grid min-w-0 grid-cols-1 gap-2 min-[600px]:grid-cols-3">
        {[
          { label: `Leads · ${periodEyebrow}`, value: String(data.headline.leads), delta: data.deltas.leadsPct },
          { label: "Deals won", value: String(data.headline.wonCount), delta: data.deltas.wonCountPct },
          {
            label: "Revenue won",
            value: formatCurrencyUsd(data.headline.wonValue),
            delta: data.deltas.wonValuePct,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] p-3.5 hover:border-[var(--border-hover)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
              {stat.label}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums leading-none text-[var(--text-primary)] sm:text-3xl">
              {stat.value}
            </p>
            <div className="mt-2">
              <HeroPill value={stat.delta} />
            </div>
          </div>
        ))}
      </section>

      <section>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">Pipeline</p>
        <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">Where your leads are</h2>
        <div className="mt-6 space-y-2">
          {FUNNEL.map((f) => {
            const count = data.pipeline[f.key];
            const w = Math.max(4, (count / funnelMax) * 100);
            return (
              <div key={f.key} className="flex items-stretch gap-3">
                <div className="flex w-24 shrink-0 items-center font-mono text-[10px] uppercase text-[var(--text-secondary)] sm:w-[140px] sm:text-[11px]">
                  {f.label}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className="flex h-12 items-center justify-end rounded-md pr-3"
                    style={{
                      width: `${w}%`,
                      background: `color-mix(in srgb, var(${f.barVar}) 55%, white)`,
                    }}
                  >
                    <span className="text-lg font-semibold tabular-nums text-[var(--text-primary)]">{count}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-[13px] text-[var(--text-secondary)]">
          {data.headline.leads === 0 ? <>No leads in this period yet.</> : data.pipelineCaption}
        </p>
      </section>

      {/* Row 3 — Source + Response */}
      <section className="grid gap-8 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-6">
          <p className="font-mono text-[11px] uppercase text-[var(--text-tertiary)]">Leads by source</p>
          {donutTotal === 0 ? (
            <p className="mt-8 text-sm text-[var(--text-secondary)]">No leads from tracked sources in this period.</p>
          ) : (
            <>
              <div className="mx-auto mt-4 h-[220px] w-full max-w-[280px]">
                <SalesDonutChart
                  data={donutData.map((e) => ({ name: e.name, value: e.value, color: e.fill }))}
                  showLegend={false}
                  centerLabel="Leads"
                  centerValue={donutTotal}
                />
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {[
                  { label: "Facebook", v: data.bySource.FACEBOOK.leads },
                  { label: "Landing page", v: data.bySource.LANDING_PAGE.leads },
                  { label: "Manual", v: data.bySource.MANUAL.leads },
                  { label: "Referral", v: data.bySource.REFERRAL.leads },
                ].map((row) => (
                  <li key={row.label} className="flex justify-between gap-4">
                    <span className="text-[var(--text-secondary)]">{row.label}</span>
                    <span className="font-mono-data tabular-nums text-[var(--text-primary)]">
                      {row.v}{" "}
                      <span className="text-[var(--text-tertiary)]">
                        ({donutTotal ? Math.round((row.v / donutTotal) * 1000) / 10 : 0}%)
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-6">
          <p className="font-mono text-[11px] uppercase text-[var(--text-tertiary)]">Response speed</p>
          <p className="mt-4 text-3xl font-semibold tabular-nums leading-none text-[var(--text-primary)]">
            {formatAvgResponseHero(actualMin)}
          </p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Average time to first call on new leads in this period.</p>
          <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full border border-[var(--border)] bg-transparent">
            <div
              className="h-full rounded-full transition-colors"
              style={{
                width: `${gaugePct}%`,
                backgroundColor: withinSla ? "var(--accent)" : "var(--danger)",
              }}
            />
          </div>
          <p className="mt-3 text-[13px] text-[var(--text-secondary)]">
            {actualMin == null ? (
              <>Not enough call data to measure response time in this period.</>
            ) : withinSla ? (
              <>
                Your target is {data.client.responseTimeLimitHours}h. You&apos;re averaging{" "}
                {(actualMin / 60).toFixed(1)}h
                {actualMin < limitMin ? (
                  <>
                    . You&apos;re beating your target by {((limitMin - actualMin) / 60).toFixed(1)}h.
                  </>
                ) : (
                  "."
                )}
              </>
            ) : (
              <>
                Your target is {data.client.responseTimeLimitHours}h. You&apos;re averaging {(actualMin / 60).toFixed(1)}
                h — above your SLA.
              </>
            )}
          </p>
        </div>
      </section>

      {/* Row 4 — Team */}
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">Team</p>
        <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">Your sales team</h2>
        {data.team.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--text-secondary)]">No active salespeople for this client.</p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-2 md:border-0 md:bg-transparent md:p-0">
            <ResponsiveTable
              columns={[
                {
                  key: "salesperson",
                  label: "Salesperson",
                  mobilePrimary: true,
                  render: (row: ClientReportPayload["team"][number]) => (
                    <div className="flex items-center gap-3">
                      <ClientAvatar name={row.name} size="sm" />
                      <span className="font-medium text-[var(--text-primary)]">{row.name}</span>
                    </div>
                  ),
                },
                {
                  key: "leads",
                  label: "Leads",
                  align: "right",
                  render: (row: ClientReportPayload["team"][number]) => <span className="tabular-nums">{row.leads}</span>,
                },
                {
                  key: "contacted",
                  label: "Contacted",
                  align: "right",
                  render: (row: ClientReportPayload["team"][number]) => (
                    <span className="tabular-nums">{row.contacted}</span>
                  ),
                },
                {
                  key: "won",
                  label: "Won",
                  align: "right",
                  render: (row: ClientReportPayload["team"][number]) => <span className="tabular-nums">{row.won}</span>,
                },
                {
                  key: "wonValue",
                  label: "Won value",
                  align: "right",
                  render: (row: ClientReportPayload["team"][number]) => (
                    <span className="tabular-nums">{formatCurrencyUsd(row.wonValue)}</span>
                  ),
                },
                {
                  key: "avg",
                  label: "Avg response",
                  align: "right",
                  render: (row: ClientReportPayload["team"][number]) => (
                    <span className="text-[var(--text-secondary)]">
                      {row.avgResponseMinutes != null ? `${Math.round(row.avgResponseMinutes)}m` : "—"}
                    </span>
                  ),
                },
                {
                  key: "spark",
                  label: "14d volume",
                  align: "right",
                  render: (row: ClientReportPayload["team"][number]) => {
                    const spark = row.last14DaysLeads.map((y, i) => ({ label: String(i), value: y }));
                    return (
                      <div className="inline-flex h-9 w-[88px] justify-end">
                        <SalesSparkline data={spark} height={36} color={colors.brand} />
                      </div>
                    );
                  },
                },
              ] as ResponsiveTableColumn<ClientReportPayload["team"][number]>[]}
              rows={data.team}
              rowKey={(row) => row.userId}
              rowClassName={(row) => (data.team[0]?.userId === row.userId ? "bg-[var(--accent-muted)]" : undefined)}
            />
          </div>
        )}
      </section>

      {/* Row 5 — Recent wins */}
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">Recent wins</p>
        <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">Latest closures</h2>
        {data.recentWins.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--text-secondary)]">
            No deals won in this period yet. Keep pushing!
          </p>
        ) : (
          <div className="mt-4 divide-y divide-border">
            {data.recentWins.map((w) => (
              <div key={w.leadId} className="flex flex-wrap items-start justify-between gap-4 py-4">
                <div>
                  <div className="text-[15px] font-semibold text-[var(--text-primary)]">{w.leadName}</div>
                  <div className="mt-1 text-sm text-[var(--text-secondary)]">
                    {w.dealValue != null ? formatCurrencyUsd(w.dealValue) : "—"} · {w.salespersonName} ·{" "}
                    {format(parseISO(w.closedAt), "MMM d, yyyy")}
                  </div>
                </div>
                {w.dealValue != null && (
                  <span className="shrink-0 rounded-full bg-surface-sidebar px-3 py-1 font-mono text-xs text-[var(--accent)]">
                    + {formatCurrencyUsd(w.dealValue)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Row 6 — Chart */}
      <section>
        <p className="font-mono text-[11px] uppercase text-[var(--text-tertiary)]">Trend</p>
        <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">Leads vs won</h2>
        <div className="mt-4 h-[220px] w-full">
          <SalesMultiLineChart
            data={data.leadsOverTime}
            xKey="date"
            labelFormatter={(d) => format(parseISO(String(d)), "MMM d, yyyy")}
            series={[
              { dataKey: "leads", name: "Leads", color: colors.textMuted },
              { dataKey: "won", name: "Won", color: colors.brand },
            ]}
            showLegend={false}
            emptyTitle="No trend data for this period"
          />
        </div>
      </section>
    </div>
  );
}
