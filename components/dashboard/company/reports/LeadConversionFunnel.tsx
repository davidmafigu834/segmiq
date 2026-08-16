"use client";

import { cn } from "@/lib/ui/cn";
import type { FunnelStage } from "@/lib/sales/company-reports/metrics";
import { ReportChartCard } from "./ReportChartCard";

const FUNNEL_FILLS = ["#60A5FA", "#93C5FD", "#FBBF24", "#F9A8D4", "#D4FF4F"] as const;
const FUNNEL_WIDTHS = ["100%", "86%", "72%", "58%", "44%"] as const;

export function LeadConversionFunnel({
  stages,
  methodology,
  error,
  onRetry,
}: {
  stages: FunnelStage[];
  methodology: string;
  error?: string | null;
  onRetry?: () => void;
}) {
  const empty = stages[0]?.count === 0;

  return (
    <ReportChartCard
      title="Lead Conversion Funnel"
      error={error}
      onRetry={onRetry}
      className="min-h-[250px] layout:min-h-[260px]"
    >
      {empty ? (
        <div className="flex h-full min-h-[180px] flex-col items-center justify-center text-center">
          <p className="text-[13px] font-medium text-sales-text-primary">No data for this period.</p>
          <p className="mt-1 text-[12px] text-sales-text-muted">No Leads were captured during this period.</p>
        </div>
      ) : (
        <div className="flex h-full min-h-[180px] flex-col gap-4 layout:flex-row layout:items-center">
          <div
            className="hidden min-w-[140px] flex-1 flex-col items-center justify-center gap-1.5 layout:flex"
            aria-hidden
          >
            {stages.map((stage, idx) => (
              <div
                key={stage.id}
                className={cn(
                  "flex h-8 w-full items-center justify-center border border-black/5 dark:border-white/5",
                  idx === 0 && "rounded-t-[8px]",
                  idx === stages.length - 1 && "rounded-b-[8px]"
                )}
                style={{
                  width: FUNNEL_WIDTHS[idx] ?? "40%",
                  background: FUNNEL_FILLS[idx] ?? FUNNEL_FILLS[0],
                  clipPath:
                    idx === stages.length - 1
                      ? "polygon(0 0, 100% 0, 100% 100%, 0 100%)"
                      : "polygon(0 0, 100% 0, 94% 100%, 6% 100%)",
                }}
              />
            ))}
          </div>
          <table className="w-full min-w-0 flex-1 text-left text-[12px]">
            <caption className="sr-only">Lead cohort conversion by stage</caption>
            <thead>
              <tr className="text-[11px] font-medium text-sales-text-muted">
                <th className="pb-2 font-medium">Stage</th>
                <th className="pb-2 text-right font-medium">Count</th>
                <th className="pb-2 text-right font-medium">Conversion</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((stage, idx) => (
                <tr key={stage.id} className="border-t border-sales-border-subtle">
                  <td className="py-1.5">
                    <span className="inline-flex items-center gap-2 text-sales-text-secondary">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: FUNNEL_FILLS[idx] }}
                        aria-hidden
                      />
                      {stage.label}
                    </span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums font-medium text-sales-text-primary">
                    {stage.count}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-sales-text-muted">
                    {stage.conversionPct.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[10px] leading-relaxed text-sales-text-muted">{methodology}</p>
    </ReportChartCard>
  );
}
