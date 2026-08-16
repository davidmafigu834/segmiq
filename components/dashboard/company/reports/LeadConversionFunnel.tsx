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
      hint={methodology}
      error={error}
      onRetry={onRetry}
      className="h-full min-h-[240px]"
      bodyClassName="flex min-h-0 flex-col overflow-hidden"
    >
      {empty ? (
        <div className="flex h-full min-h-0 flex-col items-center justify-center text-center">
          <p className="text-[13px] font-medium text-sales-text-primary">No data for this period.</p>
          <p className="mt-1 text-[12px] text-sales-text-muted">No Leads were captured during this period.</p>
        </div>
      ) : (
        <div className="flex h-full min-h-0 gap-4 overflow-hidden">
          <div
            className="hidden w-[88px] shrink-0 flex-col items-center justify-center gap-1 sm:flex"
            aria-hidden
          >
            {stages.map((stage, idx) => (
              <div
                key={stage.id}
                className={cn(
                  "h-7 w-full border border-black/5 dark:border-white/5",
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
          <div className="min-w-0 flex-1 overflow-y-auto">
            <table className="w-full text-left text-[12px]">
              <caption className="sr-only">{methodology}</caption>
              <thead>
                <tr className="text-[11px] font-medium text-sales-text-muted">
                  <th className="pb-2 font-medium">Stage</th>
                  <th className="pb-2 text-right font-medium">Count</th>
                  <th className="pb-2 text-right font-medium">Conv.</th>
                </tr>
              </thead>
              <tbody>
                {stages.map((stage, idx) => (
                  <tr key={stage.id} className="border-t border-sales-border-subtle">
                    <td className="py-1.5">
                      <span className="inline-flex min-w-0 items-center gap-2 text-sales-text-secondary">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: FUNNEL_FILLS[idx] }}
                          aria-hidden
                        />
                        <span className="truncate">{stage.label}</span>
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
        </div>
      )}
    </ReportChartCard>
  );
}
