"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { format, parseISO } from "date-fns";
import { X } from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader, SegmentedTabs } from "@/components/ui";
import { PulseBar } from "@/components/dashboard/PulseBar";
import type { LegacyPulseMetric } from "@/components/dashboard/PulseBar";
import { ClientAvatar } from "@/components/ClientAvatar";
import type { ClientTeamReportPayload, TeamPeriodId } from "@/lib/client-team-report";
import { formatCurrencyUsd } from "@/lib/format";

async function fetcher(url: string): Promise<ClientTeamReportPayload> {
  const r = await fetch(url);
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "Failed to load team");
  }
  return r.json();
}

function formatResp(m: number | null): string {
  if (m == null) return "—";
  if (m < 60) return `${Math.round(m)}m`;
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  return min > 0 ? `${h}h ${min}m` : `${h}h`;
}

const PERIODS: { id: TeamPeriodId; label: string }[] = [
  { id: "this_month", label: "This Month" },
  { id: "last_month", label: "Last Month" },
  { id: "last_90", label: "90 Days" },
];

function scoreDotClass(tier: string): string {
  switch (tier) {
    case "performing":
      return "bg-[var(--success)]";
    case "needs_attention":
      return "bg-[var(--warning)]";
    default:
      return "bg-[var(--danger)]";
  }
}

export function ClientTeamDashboard({
  clientName,
  previewClientId,
}: {
  clientName: string;
  previewClientId?: string;
}) {
  const [period, setPeriod] = useState<TeamPeriodId>("this_month");
  const [modalUserId, setModalUserId] = useState<string | null>(null);
  const [modalTab, setModalTab] = useState<"performance" | "pipeline" | "activity">("performance");

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("period", period);
    if (previewClientId) p.set("clientId", previewClientId);
    return p.toString();
  }, [period, previewClientId]);

  const { data, error, isLoading } = useSWR(`/api/reports/client/team?${qs}`, fetcher, {
    revalidateOnFocus: false,
  });

  const pulseMetrics: LegacyPulseMetric[] = useMemo(() => {
    if (!data) return [];
    const a = data.teamAggregate;
    return [
      {
        eyebrow: "Win rate",
        value: `${a.winRate}%`,
        delta: "Closed won ÷ (won + lost)",
        deltaPositive: true,
      },
      {
        eyebrow: "Avg response",
        value: formatResp(a.avgResponseMinutes),
        delta: "First call, selected period",
        deltaPositive: true,
      },
      {
        eyebrow: "Active pipeline",
        value: formatCurrencyUsd(a.activePipelineValue),
        delta: "Negotiating + proposal",
        deltaPositive: true,
      },
      {
        eyebrow: "Overdue follow-ups",
        value: String(a.overdueFollowUps),
        delta: a.overdueFollowUps > 0 ? "Needs action" : "Clear",
        deltaPositive: a.overdueFollowUps === 0,
      },
    ];
  }, [data]);

  const selectedMember = data?.team.find((t) => t.userId === modalUserId);

  const chartRows = selectedMember
    ? selectedMember.trend.leadsByWeek.map((l, i) => ({
        week: l.week.slice(5),
        leads: l.count,
        wins: selectedMember.trend.wonByWeek[i]?.count ?? 0,
      }))
    : [];

  return (
    <div className="min-w-0 w-full max-w-full overflow-x-hidden pb-16">
      <PageHeader
        className="mb-6 ag-fade-in"
        eyebrow={`${clientName} / Team`}
        title="Your team"
        description={
          data
            ? `${data.team.length} salespeople · ${data.teamAggregate.winRate}% win rate · ${formatCurrencyUsd(data.teamAggregate.totalWonValue)} won ${data.period.label.toLowerCase()}`
            : "Loading team metrics…"
        }
        actions={
          <SegmentedTabs
            aria-label="Report period"
            tabs={PERIODS.map((p) => ({ value: p.id, label: p.label }))}
            value={period}
            onValueChange={(v) => setPeriod(v as TeamPeriodId)}
          />
        }
      />

      {error ? (
        <div className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger-fg)]">
          {error instanceof Error ? error.message : "Error"}
        </div>
      ) : null}

      {isLoading && !data ? (
        <div className="shimmer h-48 rounded-lg border border-[var(--border)]" />
      ) : data ? (
        <>
          <div className="ag-fade-in ag-delay-1">
            <PulseBar metrics={pulseMetrics} />
          </div>

          <div className="ag-fade-in ag-delay-2 mt-10 grid gap-4 md:grid-cols-2 layout:grid-cols-3">
            {data.team.map((m) => (
              <button
                key={m.userId}
                type="button"
                onClick={() => {
                  setModalUserId(m.userId);
                  setModalTab("performance");
                }}
                className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5 text-left transition-colors hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-sm)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <ClientAvatar name={m.name} size="lg" />
                    <div>
                      <div className="text-[18px] font-semibold leading-tight text-[var(--text-primary)]">{m.name}</div>
                      <div className="mt-1 font-mono text-[11px] text-[var(--text-tertiary)]">
                        SALES · Joined {format(parseISO(m.joinedAt), "MMM yyyy")}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-right">
                    <span className={`h-2 w-2 rounded-full ${scoreDotClass(m.score.tier)}`} />
                    <span className="max-w-[120px] text-[11px] font-medium text-[var(--text-secondary)]">{m.score.label}</span>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">Leads</div>
                    <div className="mt-1 text-[20px] font-semibold tabular-nums text-[var(--text-primary)]">
                      {m.currentStats.thisMonthLeads}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">Won</div>
                    <div className="mt-1 text-[20px] font-semibold tabular-nums text-[var(--text-primary)]">
                      {m.currentStats.thisMonthWon}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">Won value</div>
                    <div className="mt-1 text-[20px] font-semibold tabular-nums text-[var(--text-primary)]">
                      {formatCurrencyUsd(m.currentStats.thisMonthWonValue)}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">Avg response</div>
                    <div className="mt-1 text-[20px] font-semibold tabular-nums text-[var(--text-primary)]">
                      {formatResp(m.currentStats.avgResponseMinutes)}
                    </div>
                  </div>
                </div>

                <div className="mt-4 h-10 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={m.trend.leadsByWeek.map((w) => ({ i: w.week, v: w.count }))}
                      margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
                    >
                      <Line
                        type="monotone"
                        dataKey="v"
                        stroke="var(--accent)"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-3 text-[12px] text-[var(--text-tertiary)]">
                  {m.currentStats.overdueFollowUps} overdue · {m.currentStats.followUpsScheduled} upcoming
                </div>
              </button>
            ))}
          </div>

          {data.team.length === 0 ? (
            <p className="mt-8 rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
              No salespeople on this team yet.
            </p>
          ) : null}
        </>
      ) : null}

      {selectedMember && data ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-[var(--surface-overlay)] p-0 md:items-center md:justify-center md:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="team-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalUserId(null);
          }}
        >
          <div className="flex h-full w-full max-w-[720px] flex-col overflow-y-auto border border-[var(--border)] bg-[var(--surface-card)] p-4 shadow-lg md:max-h-[90vh] md:rounded-xl md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <ClientAvatar name={selectedMember.name} size={56} />
                <h2 id="team-modal-title" className="text-2xl font-semibold leading-none text-[var(--text-primary)]">
                  {selectedMember.name}
                </h2>
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
                onClick={() => setModalUserId(null)}
                aria-label="Close"
              >
                <X className="h-5 w-5" strokeWidth={1.5} />
              </button>
            </div>

            <div className="-mx-1 mt-6 flex gap-2 overflow-x-auto border-b border-[var(--border)] px-1 pb-3 scrollbar-hide md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
              {(
                [
                  ["performance", "Performance"],
                  ["pipeline", "Pipeline"],
                  ["activity", "Recent activity"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setModalTab(id)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    modalTab === id
                      ? "bg-surface-sidebar text-[var(--text-on-dark)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-card)]-alt"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {modalTab === "performance" ? (
              <div className="mt-6 space-y-6">
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <XAxis dataKey="week" tick={{ fontSize: 11, fill: "var(--text-tertiary)" }} />
                      <YAxis width={36} tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--surface-sidebar)",
                          border: "1px solid var(--surface-sidebar-border)",
                          borderRadius: 6,
                          color: "var(--text-on-dark)",
                          fontSize: 12,
                        }}
                      />
                      <Line type="monotone" dataKey="leads" name="Leads" stroke="var(--text-tertiary)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="wins" name="Wins" stroke="var(--accent)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 rounded-md border border-[var(--border)] bg-[var(--surface-card)]-alt p-4 text-sm text-[var(--text-secondary)]">
                  {selectedMember.drillDown.insights.map((line, i) => (
                    <p key={i} className="leading-relaxed">
                      · {line}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            {modalTab === "pipeline" ? (
              <div className="mt-6 flex gap-3 overflow-x-auto pb-2">
                {selectedMember.drillDown.pipeline.map((col) => (
                  <div key={col.status} className="w-[200px] shrink-0">
                    <div className="mb-2 font-mono text-[10px] uppercase text-[var(--text-tertiary)]">
                      {col.status.replace("_", " ")}
                    </div>
                    <div className="space-y-2">
                      {col.leads.length === 0 ? (
                        <p className="text-xs text-[var(--text-tertiary)]">—</p>
                      ) : (
                        col.leads.map((l) => (
                          <div key={l.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] p-3 text-xs">
                            <div className="font-medium text-[var(--text-primary)]">{l.name}</div>
                            <div className="mt-1 text-[var(--text-tertiary)]">{l.phone ?? "—"}</div>
                            <div className="mt-1 font-mono tabular-nums text-[var(--text-secondary)]">{l.budgetLabel}</div>
                            <div className="mt-2 text-[10px] text-[var(--text-tertiary)]">
                              {format(parseISO(l.lastActivity), "MMM d, h:mm a")}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {modalTab === "activity" ? (
              <div className="relative mt-6 pl-0">
                <div className="absolute bottom-0 left-[11px] top-0 border-l border-[var(--border)]" aria-hidden />
                <ul className="relative m-0 list-none space-y-0 p-0">
                  {selectedMember.drillDown.timeline.length === 0 ? (
                    <p className="py-4 text-sm text-[var(--text-tertiary)]">No activity yet.</p>
                  ) : (
                    selectedMember.drillDown.timeline.map((ev) => (
                      <li key={ev.id} className="relative border-b border-[var(--border)] py-3 pl-6 last:border-b-0">
                        <span
                          className="absolute left-[7px] top-[18px] h-2 w-2 rounded-full"
                          style={{
                            backgroundColor:
                              ev.kind === "deal_won" ? "var(--activity-won)" : "var(--activity-new)",
                          }}
                          aria-hidden
                        />
                        <div className="flex justify-between gap-2">
                          <span className="font-mono text-[11px] uppercase text-[var(--text-secondary)]">
                            {ev.kind === "deal_won" ? "Deal won" : "Call"}
                          </span>
                          <span className="shrink-0 font-mono text-[11px] text-[var(--text-tertiary)]">
                            {format(parseISO(ev.at), "MMM d, HH:mm")}
                          </span>
                        </div>
                        <p className="mt-1 text-[13px] text-[var(--text-primary)]">{ev.title}</p>
                        {ev.detail ? <p className="mt-0.5 text-[12px] text-[var(--text-tertiary)]">{ev.detail}</p> : null}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
