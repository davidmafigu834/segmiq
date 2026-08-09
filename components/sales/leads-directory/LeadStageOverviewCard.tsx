"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ChartEmptyState,
  Skeleton,
} from "@/components/sales/ui";
import type { StageSlice } from "@/lib/sales/leads-directory";

export function LeadStageOverviewCard({
  slices,
  total,
  loading,
}: {
  slices: StageSlice[];
  total: number;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="border-b-0 px-5 pb-2 pt-4">
        <CardTitle className="text-[14px] font-semibold">Lead stages overview</CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-2">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded-[8px]" />
            ))}
          </div>
        ) : total === 0 ? (
          <ChartEmptyState
            title="No active stages yet"
            description="Pipeline stages will appear as you work leads."
            className="min-h-[140px]"
          />
        ) : (
          <ul className="space-y-3">
            {slices.map((s) => (
              <li key={s.status}>
                <div className="mb-1 flex items-center justify-between gap-2 text-[12px]">
                  <span className="truncate font-medium text-sales-text-secondary">{s.label}</span>
                  <span className="shrink-0 tabular-nums text-sales-text-primary">
                    {s.count}
                    <span className="ml-1.5 text-sales-text-muted">{s.pct}%</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--sales-neutral-100)]">
                  <div
                    className="h-full rounded-full transition-[width] duration-300"
                    style={{ width: `${Math.max(s.pct, 2)}%`, background: s.color }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
