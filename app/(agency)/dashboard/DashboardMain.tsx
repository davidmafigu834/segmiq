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
  { key: "CONTACTED", label: "Contacted", barClass: "bg-[#4A7AB5]" },
  { key: "QUALIFIED", label: "Qualified", barClass: "bg-[#C49A3C]" },
  { key: "NEGOTIATING", label: "Negotiating", barClass: "bg-[#E8602C]" },
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

      <div className="ag-fade-in ag-delay-1">
        <PulseBar metrics={pulse} />
      </div>

      {d.uncontactedFlags.length > 0 ? (
        <FlagAlert rows={d.uncontactedFlags} totalCount={totalFlagged} href="/dashboard/leads?filter=uncontacted" />
      ) : null}

      <div className="ag-fade-in ag-delay-2 flex flex-col gap-8 min-[1100px]:max-h-[min(72dvh,calc(100dvh-15rem))] min-[1100px]:min-h-0 min-[1100px]:flex-row min-[1100px]:items-stretch">
        <div className="min-h-0 min-w-0 min-[1100px]:flex-[1.6] min-[1100px]:overflow-y-auto min-[1100px]:overflow-x-hidden min-[1100px]:pr-2 min-[1100px]:overscroll-contain">
          <RecentLeadsTable rows={d.recentLeads} agencyFooter />
        </div>
        <div className="min-h-0 min-w-0 min-[1100px]:flex-1 min-[1100px]:overflow-y-auto min-[1100px]:overflow-x-hidden min-[1100px]:overscroll-contain">
          <ActivityFeed />
        </div>
      </div>

      <div className="ag-fade-in ag-delay-3 mt-10 grid grid-cols-1 gap-6 min-[800px]:grid-cols-2">

        {/* Pipeline */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
            Pipeline
          </p>
          <h2 className="mb-5 text-[18px] font-semibold text-[var(--text-primary)]">
            Lead stages
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
                        className={`h-full rounded-full transition-[width] duration-700 ${stage.barClass}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right font-display text-[17px] font-semibold text-[var(--text-primary)]">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Lead sources */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
            Sources
          </p>
          <h2 className="mb-5 text-[18px] font-semibold text-[var(--text-primary)]">
            Lead sources
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
                      className={`h-full rounded-full bg-[var(--accent)] transition-[width] duration-700 ${hasSourceData ? "opacity-100" : "opacity-25"}`}
                      style={{ width: hasSourceData ? `${pct}%` : `${GHOST_WIDTHS[source.key] ?? 0}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right font-display text-[17px] font-semibold text-[var(--text-primary)]">
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
        </div>

      </div>

      <div className="ag-fade-in ag-delay-4">
        <ClientPerformanceGrid rows={d.clientPerf} />
      </div>
    </>
  );
}
