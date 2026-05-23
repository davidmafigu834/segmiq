"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ResponsiveTable, type ResponsiveTableColumn } from "@/components/ui/ResponsiveTable";
import { ChevronDown } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { ClientAvatar } from "@/components/ClientAvatar";
import { LeadDetailPanel } from "@/app/sales/leads/LeadDetailPanel";
import { openLeadPanel } from "@/store/uiStore";
import type { ClientReportPayload } from "@/lib/client-report";
import type { ActivePipelineLead } from "@/lib/client-active-pipeline";
import { formatCompactCurrency, formatCurrencyUsd, formatDuration, formatTimeAgo } from "@/lib/format";
import { ClientReadOnlyKanban } from "./ClientReadOnlyKanban";

const FUNNEL_STAGES = [
  { key: "NEW" as const, label: "New", color: "#DBEAFE" },
  { key: "CONTACTED" as const, label: "Contacted", color: "#D1FAE5" },
  { key: "NEGOTIATING" as const, label: "Negotiating", color: "#FEF3C7" },
  { key: "PROPOSAL_SENT" as const, label: "Proposal", color: "#EDE9FE" },
  { key: "WON" as const, label: "Won", color: "#D4FF4F" },
];

function DeltaPill({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="inline-block text-xs opacity-70">First month tracked</span>;
  }
  if (value === 0) {
    return <span className="inline-block text-xs opacity-70">No change</span>;
  }
  const positive = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium ${
        positive ? "bg-black text-[var(--accent)]" : "bg-black/80 text-[var(--danger)]"
      }`}
    >
      {positive ? "↗" : "↘"} {positive ? "+" : ""}
      {Math.round(value)}% vs last month
    </span>
  );
}

function heroDeltaPct(
  pct: number,
  priorCount: number,
  currentCount: number
): number | null {
  if (priorCount === 0 && currentCount === 0) return null;
  return pct;
}

function sourceLabel(key: string): string {
  if (key === "FACEBOOK") return "Facebook";
  if (key === "LANDING_PAGE") return "Landing page";
  if (key === "MANUAL") return "Manual";
  return key;
}

function sourceColor(key: string): string {
  if (key === "FACEBOOK") return "var(--accent)";
  if (key === "LANDING_PAGE") return "var(--text-primary)";
  return "#9ca3af";
}

function SourceDonut({ bySource, totalLeads }: { bySource: ClientReportPayload["bySource"]; totalLeads: number }) {
  const data = useMemo(() => {
    const rows = [
      { name: "Facebook", key: "FACEBOOK" as const, value: bySource.FACEBOOK.leads, fill: "var(--accent)" },
      {
        name: "Landing page",
        key: "LANDING_PAGE" as const,
        value: bySource.LANDING_PAGE.leads,
        fill: "var(--text-primary)",
      },
      { name: "Manual", key: "MANUAL" as const, value: bySource.MANUAL.leads, fill: "#9ca3af" },
      { name: "Referral", key: "REFERRAL" as const, value: bySource.REFERRAL.leads, fill: "#a855f7" },
    ];
    return rows.filter((r) => r.value > 0);
  }, [bySource]);

  if (data.length === 0 || totalLeads === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg border border-border bg-surface-card-alt text-sm text-ink-secondary">
        No source mix this month
      </div>
    );
  }

  return (
    <div className="h-[200px] w-full max-w-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="58%"
            outerRadius="85%"
            paddingAngle={2}
            isAnimationActive={false}
          >
            {data.map((e) => (
              <Cell key={e.key} fill={e.fill} stroke="var(--surface-card)" />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function ResponseGauge({ avgMinutes, slaHours }: { avgMinutes: number | null; slaHours: number }) {
  if (avgMinutes === null) {
    return (
      <div className="py-8 text-center">
        <div className="font-display text-4xl text-ink-tertiary">—</div>
        <div className="mt-2 text-sm text-ink-secondary">No contacted leads yet this month</div>
      </div>
    );
  }
  const slaMinutes = slaHours * 60;
  const isWithinSLA = avgMinutes <= slaMinutes;
  const pct = Math.min((avgMinutes / slaMinutes) * 100, 100);

  return (
    <div>
      <div className="font-display text-5xl leading-none tracking-display">{formatDuration(avgMinutes)}</div>
      <div className="mt-1 text-sm text-ink-secondary">average first response</div>

      <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-border">
        <div
          className={`h-full rounded-full ${isWithinSLA ? "bg-[var(--accent)]" : "bg-[var(--danger)]"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-xs text-ink-tertiary">
        <span>0m</span>
        <span>
          SLA: {slaHours}h
        </span>
      </div>

      <p className="mt-4 text-sm text-ink-secondary">
        {isWithinSLA ? (
          <>
            You&apos;re beating your {slaHours}h target by {formatDuration(Math.max(0, slaMinutes - avgMinutes))}.
          </>
        ) : (
          <>
            You&apos;re over your {slaHours}h target by {formatDuration(Math.max(0, avgMinutes - slaMinutes))}. Leads
            are going cold.
          </>
        )}
      </p>
    </div>
  );
}

function TeamSparkline({ values }: { values: number[] }) {
  const w = 60;
  const h = 24;
  const pad = 2;
  const max = Math.max(1, ...values);
  const denom = Math.max(1, values.length - 1);
  const pts = values
    .map((v, i) => {
      const x = pad + (i / denom) * (w - pad * 2);
      const y = h - pad - (v / max) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden>
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="var(--border)" strokeWidth={1} />
      <path d={pts} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ClientDashboardView({
  report,
  activeLeads,
}: {
  report: ClientReportPayload;
  activeLeads: ActivePipelineLead[];
}) {
  const [pipelineExpanded, setPipelineExpanded] = useState(false);
  const { comparison } = report;

  const maxFunnel = useMemo(
    () => Math.max(1, ...FUNNEL_STAGES.map((s) => report.pipeline[s.key])),
    [report.pipeline]
  );

  const panelLeads = useMemo(
    () =>
      activeLeads.map((l) => {
        const { assigneeName, ...rest } = l;
        void assigneeName;
        return rest;
      }),
    [activeLeads]
  );

  const leadsDelta = heroDeltaPct(report.deltas.leadsPct, comparison.priorLeads, report.headline.leads);
  const wonDelta = heroDeltaPct(report.deltas.wonCountPct, comparison.priorWonCount, report.headline.wonCount);
  const valueDelta = heroDeltaPct(report.deltas.wonValuePct, comparison.priorWonValue, report.headline.wonValue);

  type TeamRow = ClientReportPayload["team"][number];

  const teamColumns = useMemo<ResponsiveTableColumn<TeamRow>[]>(
    () => [
      {
        key: "rep",
        label: "Rep",
        mobilePrimary: true,
        render: (row) => (
          <div className="flex items-center gap-3">
            <ClientAvatar name={row.name} size="sm" />
            <span className="font-medium text-ink-primary">{row.name}</span>
          </div>
        ),
      },
      {
        key: "leads",
        label: "Leads",
        align: "right",
        render: (row) => <span className="tabular-nums">{row.leads}</span>,
      },
      {
        key: "contacted",
        label: "Contacted",
        align: "right",
        render: (row) => {
          const contactPct = row.leads > 0 ? Math.round((row.contacted / row.leads) * 100) : 0;
          return <span className="tabular-nums">{contactPct}%</span>;
        },
      },
      {
        key: "won",
        label: "Won",
        align: "right",
        render: (row) => <span className="tabular-nums">{row.won}</span>,
      },
      {
        key: "wonValue",
        label: "Won value",
        align: "right",
        render: (row) => <span className="tabular-nums">{formatCurrencyUsd(row.wonValue)}</span>,
      },
      {
        key: "avg",
        label: "Avg response",
        align: "right",
        render: (row) => (
          <span className="text-ink-secondary">
            {row.avgResponseMinutes != null ? `${Math.round(row.avgResponseMinutes)}m` : "—"}
          </span>
        ),
      },
      {
        key: "spark",
        label: "14d",
        align: "right",
        render: (row) => <TeamSparkline values={row.last14DaysLeads} />,
      },
    ],
    []
  );

  return (
    <div className="pb-16">
      {/* A — Hero */}
      <section
        className="grid min-h-[180px] grid-cols-1 overflow-hidden rounded-[10px] border border-black/10 md:grid-cols-[1.4fr_1fr_1fr]"
        style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
      >
        <div className="flex flex-col justify-center border-b border-black/15 px-6 py-6 md:border-b-0 md:border-r md:px-8 md:py-8 md:pr-8">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] opacity-70 md:mb-3 md:text-[11px]">
            Leads this month
          </div>
          <div className="mb-2 font-display text-[44px] font-normal leading-[0.9] tracking-display sm:text-[52px] md:mb-3 md:text-[80px]">
            {report.headline.leads}
          </div>
          <DeltaPill value={leadsDelta} />
        </div>
        <div className="flex flex-col justify-center border-b border-black/15 px-6 py-6 md:border-b-0 md:border-r md:px-8 md:py-8">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] opacity-70 md:mb-3 md:text-[11px]">Deals won</div>
          <div className="mb-2 font-display text-[40px] font-normal leading-[0.95] tracking-display md:mb-3 md:text-[52px]">
            {report.headline.wonCount}
          </div>
          <DeltaPill value={wonDelta} />
        </div>
        <div className="flex flex-col justify-center px-6 py-6 md:px-8 md:py-8 md:pl-8">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] opacity-70 md:mb-3 md:text-[11px]">Revenue won</div>
          <div className="mb-2 font-display text-[40px] font-normal leading-[0.95] tracking-display md:mb-3 md:text-[52px]">
            {formatCompactCurrency(report.headline.wonValue)}
          </div>
          <DeltaPill value={valueDelta} />
        </div>
      </section>

      {/* B — Funnel */}
      <section className="mt-12">
        <div className="mb-6 flex items-baseline justify-between border-b border-border pb-4">
          <div>
            <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-tertiary">01 / Pipeline</div>
            <h2 className="font-display text-2xl tracking-tight text-ink-primary">Where your leads are</h2>
          </div>
        </div>

        <div className="space-y-1.5">
          {FUNNEL_STAGES.map((stage) => {
            const count = report.pipeline[stage.key];
            const width = maxFunnel > 0 ? (count / maxFunnel) * 100 : 0;
            return (
              <div key={stage.key} className="relative">
                <div className="flex items-center gap-4">
                  <div className="w-24 shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-secondary sm:w-32 sm:text-[11px]">
                    {stage.label}
                  </div>
                  <div className="relative min-w-0 flex-1">
                    <div className="h-12 overflow-hidden rounded bg-surface-card-alt">
                      <div
                        className="h-full rounded transition-all"
                        style={{ width: `${width}%`, background: stage.color }}
                      />
                    </div>
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-end px-4">
                      <span className="font-display text-lg tabular-nums text-ink-primary">{count}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-sm text-ink-secondary">{report.pipelineCaption}</p>
      </section>

      {/* C — Sources + Response */}
      <section className="mt-12 grid gap-8 md:grid-cols-2">
        <div>
          <div className="mb-5">
            <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-tertiary">02 / Sources</div>
            <h2 className="font-display text-2xl tracking-tight text-ink-primary">Lead sources</h2>
          </div>
          <SourceDonut bySource={report.bySource} totalLeads={report.headline.leads} />
          <div className="mt-6 space-y-2">
            {(Object.keys(report.bySource) as (keyof ClientReportPayload["bySource"])[]).map((source) => {
              const data = report.bySource[source];
              const pct =
                report.headline.leads > 0 ? Math.round((data.leads / report.headline.leads) * 1000) / 10 : 0;
              return (
                <div key={source} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-ink-secondary">
                    <span className="h-2 w-2 rounded-full" style={{ background: sourceColor(source) }} />
                    {sourceLabel(source)}
                  </span>
                  <span className="font-mono-data text-ink-secondary">
                    {data.leads} leads · {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-5">
            <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-tertiary">03 / Response</div>
            <h2 className="font-display text-2xl tracking-tight text-ink-primary">Response speed</h2>
          </div>
          <ResponseGauge avgMinutes={report.headline.avgResponseMinutes} slaHours={report.client.responseTimeLimitHours} />
        </div>
      </section>

      {/* D — Team */}
      <section className="mt-12">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-tertiary">04 / Team</div>
            <h2 className="font-display text-2xl tracking-tight text-ink-primary">Your sales team</h2>
          </div>
          <Link href="/client/team" className="text-sm text-ink-secondary hover:text-ink-primary">
            View team analytics →
          </Link>
        </div>

        {report.team.length === 0 ? (
          <p className="text-sm text-ink-secondary">No active salespeople yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface-card p-2 md:border-0 md:bg-transparent md:p-0">
            <ResponsiveTable
              columns={teamColumns}
              rows={report.team}
              rowKey={(r) => r.userId}
              rowClassName={(row) =>
                report.team[0]?.userId === row.userId ? "bg-[rgba(212,255,79,0.08)]" : undefined
              }
            />
          </div>
        )}
      </section>

      {/* E — Recent wins */}
      <section className="mt-12">
        <div className="mb-6 border-b border-border pb-4">
          <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-tertiary">05 / Recent wins</div>
          <h2 className="font-display text-2xl tracking-tight text-ink-primary">Latest closures</h2>
        </div>

        {report.recentWins.length === 0 ? (
          <div className="py-12 text-center text-ink-secondary">No deals won yet this month. Keep pushing!</div>
        ) : (
          <ul className="divide-y divide-border">
            {report.recentWins.slice(0, 5).map((win) => (
              <li key={win.leadId} className="flex flex-wrap items-center justify-between gap-6 py-4">
                <div>
                  <div className="mb-0.5 font-display text-lg text-ink-primary">{win.leadName}</div>
                  <div className="text-sm text-ink-secondary">
                    Won by {win.salespersonName} · {formatTimeAgo(win.closedAt)}
                  </div>
                </div>
                {win.dealValue != null ? (
                  <div className="rounded px-3 py-1 font-mono text-sm font-medium text-accent-ink" style={{ background: "var(--accent)" }}>
                    +{formatCurrencyUsd(win.dealValue)}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* F — Collapsible Kanban */}
      <section className="mt-12">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-tertiary">06 / Active pipeline</div>
            <h2 className="font-display text-2xl tracking-tight text-ink-primary">{activeLeads.length} leads in motion</h2>
          </div>
          <button
            type="button"
            onClick={() => setPipelineExpanded((v) => !v)}
            className="flex items-center gap-1 text-sm text-ink-secondary hover:text-ink-primary"
          >
            {pipelineExpanded ? "Hide" : "Show"}{" "}
            <ChevronDown className={`h-4 w-4 transition ${pipelineExpanded ? "rotate-180" : ""}`} strokeWidth={1.5} />
          </button>
        </div>

        {pipelineExpanded ? (
          <ClientReadOnlyKanban
            leads={activeLeads}
            onOpenLead={(id) => {
              openLeadPanel(id);
            }}
          />
        ) : null}
      </section>

      <LeadDetailPanel leads={panelLeads} readOnly />
    </div>
  );
}
