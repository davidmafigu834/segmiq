"use client";

import type { SalesPerformanceView } from "./types";
import { CardShell } from "./KpiCard";
import { formatDealValue } from "@/lib/sales/sales-dashboard-display";
import { SalesAreaChart } from "@/components/sales/ui/Charts";
import { Progress } from "@/components/sales/ui/Feedback";

export function PerformanceCard({ performance }: { performance: SalesPerformanceView }) {
  return (
    <CardShell
      title="My performance"
      action={<span className="text-[12px] font-medium text-sales-text-muted">This month</span>}
    >
      <div className="px-5 py-4">
        <div className="flex items-center gap-5">
          <div className="relative flex h-[108px] w-[108px] shrink-0 items-center justify-center">
            <svg width="108" height="108" viewBox="0 0 108 108" aria-hidden>
              <circle cx="54" cy="54" r={42} fill="none" stroke="var(--sales-chart-track, var(--sales-neutral-100))" strokeWidth={8} />
              <circle
                cx="54"
                cy="54"
                r={42}
                fill="none"
                stroke="var(--sales-brand, #D4FF4F)"
                strokeWidth={8}
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 42}
                strokeDashoffset={2 * Math.PI * 42 - (performance.progressPct / 100) * 2 * Math.PI * 42}
                transform="rotate(-90 54 54)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[20px] font-semibold tabular-nums text-sales-text-primary">
                {performance.progressPct}%
              </span>
              <span className="text-[10px] font-medium text-sales-text-muted">Goal progress</span>
            </div>
          </div>

          <dl className="min-w-0 flex-1 divide-y divide-sales-border-subtle">
            <div className="flex items-baseline justify-between gap-3 py-2 first:pt-0">
              <dt className="text-[12px] text-sales-text-muted">
                {performance.hasTarget ? "Target" : "Monthly target"}
              </dt>
              <dd className="text-[13px] font-semibold tabular-nums text-sales-text-primary">
                {performance.hasTarget ? formatDealValue(performance.target) : "Not set"}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-2">
              <dt className="text-[12px] text-sales-text-muted">Achieved</dt>
              <dd className="text-[13px] font-semibold tabular-nums text-sales-success">
                {formatDealValue(performance.achieved)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-2 last:pb-0">
              <dt className="text-[12px] text-sales-text-muted">Remaining</dt>
              <dd className="text-[13px] font-semibold tabular-nums text-sales-text-primary">
                {performance.hasTarget ? formatDealValue(performance.remaining) : "—"}
              </dd>
            </div>
          </dl>
        </div>

        {!performance.hasTarget ? (
          <p className="mt-3 text-[12px] text-sales-text-muted">No monthly target assigned.</p>
        ) : (
          <div className="mt-3">
            <Progress value={performance.progressPct} />
          </div>
        )}

        <div className="mt-5 h-[140px] w-full">
          <SalesAreaChart
            data={performance.series}
            dataKey="value"
            xKey="label"
            emptyTitle="No revenue recorded this month yet"
            emptyDescription="Won deals will chart your progress through the month."
          />
        </div>
      </div>
    </CardShell>
  );
}
