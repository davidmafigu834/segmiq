import { BarChart2 } from "lucide-react";
import { PulseBar } from "@/components/dashboard/PulseBar";
import { buildPulseMetrics } from "@/components/dashboard/pulse-metrics";
import { FlagAlert } from "@/components/dashboard/FlagAlert";
import { RecentLeadsTable } from "@/components/dashboard/RecentLeadsTable";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { ClientPerformanceGrid } from "@/components/dashboard/ClientPerformanceGrid";
import { QuickActions } from "./components/QuickActions";
import { fetchAgencyDashboardData } from "@/lib/dashboard-data";

const PIPELINE_STAGES = [
  { key: "NEW", label: "New", barClass: "bg-[var(--text-tertiary)]" },
  { key: "CONTACTED", label: "Contacted", barClass: "bg-[var(--pipeline-contacted)]" },
  { key: "QUALIFIED", label: "Qualified", barClass: "bg-[var(--pipeline-qualified)]" },
  { key: "NEGOTIATING", label: "Negotiating", barClass: "bg-[var(--pipeline-negotiating)]" },
  { key: "WON", label: "Won", barClass: "bg-[var(--success)]" },
  { key: "LOST", label: "Lost", barClass: "bg-[var(--error)]" },
];

const LEAD_SOURCE_ROWS = [
  { key: "FACEBOOK", label: "Facebook" },
  { key: "LANDING_PAGE", label: "Profile page" },
  { key: "MANUAL", label: "Manual" },
  { key: "REFERRAL", label: "Referral" },
];

const GHOST_WIDTHS: Record<string, number> = {
  FACEBOOK: 65,
  LANDING_PAGE: 40,
  MANUAL: 25,
  REFERRAL: 15,
};

export async function DashboardMain() {
  const d = await fetchAgencyDashboardData();

  const totalFlagged = d.uncontactedFlags.reduce((s, r) => s + r.count, 0);

  const pulse = buildPulseMetrics({
    leadsToday: d.leadsToday,
    leadsYesterday: d.leadsYesterday,
    dayDeltaPct: d.dayDeltaPct,
    leadsDeltaNeutral: d.leadsDeltaNeutral,
    contactRate: d.contactRate,
    contactRateDeltaPts: d.contactRateDeltaPts,
    dealsWonCount: d.dealsWonMTD.count,
    dealsWonValueSum: d.dealsWonMTD.valueSum,
    avgResponseMinutes: d.avgResponseTime,
    avgResponseDeltaMinutes: d.avgResponseDeltaMinutes,
  });

  const leadSourceCounts: Record<string, number> = {
    FACEBOOK: 0,
    LANDING_PAGE: 0,
    MANUAL: 0,
    REFERRAL: 0,
  };
  for (const lead of d.recentLeads) {
    const src = lead.source as string;
    if (src in leadSourceCounts) leadSourceCounts[src]++;
  }
  const hasSourceData = Object.values(leadSourceCounts).some((v) => v > 0);
  const maxSourceCount = Math.max(...Object.values(leadSourceCounts), 1);

  return (
    <>
      <QuickActions />

      <div>
        <PulseBar metrics={pulse} />
      </div>

      {d.uncontactedFlags.length > 0 ? (
        <FlagAlert rows={d.uncontactedFlags} totalCount={totalFlagged} href="/dashboard/leads?filter=uncontacted" />
      ) : null}

      <section aria-label="Lead operations" className="grid items-start gap-8 border-y border-[var(--border-strong)] py-8 min-[1100px]:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)] min-[1100px]:gap-0">
        <div className="min-w-0 min-[1100px]:pr-8">
          <RecentLeadsTable rows={d.recentLeads} agencyFooter />
        </div>
        <div className="min-w-0 min-[1100px]:border-l min-[1100px]:border-[var(--border)] min-[1100px]:pl-8">
          <ActivityFeed />
        </div>
      </section>

      <section aria-label="Pipeline and lead-source analysis" className="mt-12 grid grid-cols-1 border-y border-[var(--border-strong)] min-[800px]:grid-cols-2">

        {/* Pipeline */}
        <article className="py-7 min-[800px]:pr-8">
          <h2 className="mb-6 font-display text-[19px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            Pipeline by stage
          </h2>

          {Object.values(d.pipelineByStatus).every((v) => v === 0) ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <BarChart2 className="mb-3 h-7 w-7 text-[var(--text-disabled)]" />
              <p className="text-[13px] text-[var(--text-tertiary)]">Pipeline is empty</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {PIPELINE_STAGES.map((stage) => {
                const count = d.pipelineByStatus[stage.key] ?? 0;
                const max = Math.max(...Object.values(d.pipelineByStatus), 1);
                const pct = Math.round((count / max) * 100);
                return (
                  <div key={stage.key} className="flex items-center gap-3">
                    <span className="w-[90px] shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                      {stage.label}
                    </span>
                    <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-[var(--bg-quaternary)]">
                      <div
                        className={`h-full w-full origin-left rounded-full transition-transform duration-500 ease-[var(--ease-out)] ${stage.barClass}`}
                        style={{ transform: `scaleX(${pct / 100})` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right font-display tabular-nums text-[17px] font-semibold text-[var(--text-primary)]">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </article>

        {/* Lead sources */}
        <article className="border-t border-[var(--border)] py-7 min-[800px]:border-l min-[800px]:border-t-0 min-[800px]:pl-8">
          <h2 className="mb-6 font-display text-[19px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            Leads by source
          </h2>

          <div className="flex flex-col gap-3">
            {LEAD_SOURCE_ROWS.map((source) => {
              const count = leadSourceCounts[source.key] ?? 0;
              const pct = hasSourceData ? Math.round((count / maxSourceCount) * 100) : 0;
              return (
                <div key={source.key} className="flex items-center gap-3">
                  <span className="w-[90px] shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                    {source.label}
                  </span>
                  <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-[var(--bg-quaternary)]">
                    <div
                      className={`h-full w-full origin-left rounded-full bg-[var(--accent)] transition-transform duration-500 ease-[var(--ease-out)] ${hasSourceData ? "opacity-100" : "opacity-25"}`}
                      style={{ transform: `scaleX(${(hasSourceData ? pct : GHOST_WIDTHS[source.key] ?? 0) / 100})` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right font-display tabular-nums text-[17px] font-semibold text-[var(--text-primary)]">
                    {hasSourceData ? count : "—"}
                  </span>
                </div>
              );
            })}
          </div>

          {!hasSourceData && (
            <p className="mt-4 text-center text-[12px] text-[var(--text-tertiary)]">
              Lead source data will appear here
            </p>
          )}
        </article>

      </section>

      <div>
        <ClientPerformanceGrid rows={d.clientPerf} />
      </div>
    </>
  );
}
