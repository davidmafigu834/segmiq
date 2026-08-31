"use client";

import { SalesAreaChart } from "@/components/sales/ui/Charts";
import { Trend } from "@/components/sales/ui/DataDisplay";
import { CompanyDashCard, CompanyDashEmpty, PeriodChip } from "./CompanyDashCard";
import type { CompanyRevenuePoint } from "./types";
import type { SalesKpiItem } from "@/components/dashboard/sales/types";

export function CompanyRevenueTrendCard({
  points,
  totalLabel,
  compare,
  hasHistory,
}: {
  points: CompanyRevenuePoint[];
  totalLabel: string;
  compare?: SalesKpiItem["trend"];
  hasHistory: boolean;
}) {
  return (
    <CompanyDashCard
      title="Revenue trend"
      className="dashboard-panel--analytics"
      action={<PeriodChip>Last 6 months</PeriodChip>}
    >
      <div className="px-3 pb-3 pt-2.5 sm:px-4">
        {!hasHistory ? (
          <CompanyDashEmpty
            title="Revenue history will appear after Deals are Won"
            description="Won Deal value is the company revenue metric — not Pipeline or Quote totals."
          />
        ) : (
          <>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[24px] font-semibold tracking-[-0.04em] tabular-nums text-sales-text-primary">
                  {totalLabel}
                </p>
                <p className="mt-1 text-[12px] text-sales-text-muted">Revenue Won in this period</p>
              </div>
              {compare ? <Trend direction={compare.direction} label={compare.label} /> : null}
            </div>
            <div className="h-[128px] w-full" aria-label={`Revenue trend totaling ${totalLabel}`}>
              <SalesAreaChart
                data={points}
                dataKey="value"
                xKey="label"
                valueFormat="currency"
                primaryName="Revenue Won"
                emptyTitle="No revenue history yet"
              />
            </div>
          </>
        )}
      </div>
    </CompanyDashCard>
  );
}
