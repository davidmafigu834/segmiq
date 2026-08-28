"use client";

import { CompanyDashCard, PeriodChip } from "./CompanyDashCard";
import type { SalesFunnelStage } from "@/components/dashboard/sales/types";
import type { CSSProperties } from "react";

function stepRate(current: number, previous: number): string | null {
  if (previous <= 0) return null;
  return `${Math.round((current / previous) * 100)}%`;
}

const FUNNEL_COLOR: Record<SalesFunnelStage["icon"], string> = {
  enquiries: "var(--sales-info)",
  contacted: "#6b7cff",
  qualified: "var(--sales-cyan)",
  deals: "var(--sales-success)",
  proposal: "var(--sales-purple)",
  won: "var(--sales-brand)",
};

export function CompanyFunnelCard({
  stages,
  conversionRate,
  conversionDefinition,
}: {
  stages: SalesFunnelStage[];
  conversionRate: number | null;
  conversionDefinition: string;
}) {
  const peak = Math.max(...stages.map((stage) => stage.count), 1);

  return (
    <CompanyDashCard
      title="Lead → Deal funnel"
      className="dashboard-panel--analytics"
      action={<PeriodChip>This month</PeriodChip>}
    >
      <div className="grid gap-0 sm:grid-cols-[132px_minmax(0,1fr)]">
        <div className="flex flex-col justify-center border-b border-sales-border-subtle px-5 py-4 sm:border-b-0 sm:border-r">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">
            Lead → Won
          </p>
          <p className="mt-1.5 text-[32px] font-bold leading-none tracking-[-0.035em] tabular-nums text-sales-text-primary">
            {conversionRate != null ? `${conversionRate}%` : "—"}
          </p>
          <p className="mt-2 text-[11px] leading-snug text-sales-text-muted">Overall conversion</p>
        </div>

        <div className="px-5 py-5 sm:px-5">
          <ol className="space-y-2.5" aria-label="Lead to Deal funnel this month">
            {stages.map((stage, idx) => {
              const prev = idx > 0 ? stages[idx - 1]! : null;
              const rate = prev ? stepRate(stage.count, prev.count) : null;
              const width = Math.max(8, Math.round((stage.count / peak) * 100));
              return (
                <li key={stage.id}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="truncate text-[12px] font-medium text-sales-text-secondary">
                      {stage.label}
                    </span>
                    <span className="flex items-baseline gap-2">
                      {rate ? (
                        <span className="text-[10px] font-medium tabular-nums text-sales-text-muted">
                          {rate}
                        </span>
                      ) : null}
                      <span className="text-[13px] font-semibold tabular-nums text-sales-text-primary">
                        {stage.count}
                      </span>
                    </span>
                  </div>
                  <div className="dashboard-funnel-track">
                    <div
                      className="dashboard-funnel-fill"
                      style={
                        {
                          width: `${width}%`,
                          ["--funnel-color" as string]: FUNNEL_COLOR[stage.icon],
                        } as CSSProperties
                      }
                    />
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-[10px] leading-relaxed text-sales-text-muted">
            {conversionDefinition} Stage-to-stage % use current-period counts (not cohort tracking).
          </p>
        </div>
      </div>
    </CompanyDashCard>
  );
}
