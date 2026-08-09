"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ChartEmptyState,
  SalesDonutChart,
  Skeleton,
} from "@/components/sales/ui";
import type { SourceSlice } from "@/lib/sales/leads-directory";

export function LeadsBySourceCard({
  slices,
  total,
  loading,
}: {
  slices: SourceSlice[];
  total: number;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="border-b-0 px-5 pb-2 pt-4">
        <CardTitle className="text-[14px] font-semibold">Leads by source</CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-2">
        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <Skeleton className="h-[130px] w-[130px] rounded-full" />
            <Skeleton className="h-20 w-full rounded-[10px]" />
          </div>
        ) : total === 0 ? (
          <ChartEmptyState
            title="No lead-source data yet"
            description="New captured leads will appear here."
            className="min-h-[160px]"
          />
        ) : (
          <>
            <div className="mx-auto h-[140px] w-full max-w-[180px]">
              <SalesDonutChart
                data={slices.map((s) => ({ name: s.label, value: s.count, color: s.color }))}
                centerLabel="Total"
              />
            </div>
            <ul className="mt-3 space-y-2">
              {slices.map((s) => (
                <li key={s.key} className="flex items-center gap-2 text-[12px]">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: s.color }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-sales-text-secondary">{s.label}</span>
                  <span className="tabular-nums font-medium text-sales-text-primary">{s.count}</span>
                  <span className="w-9 text-right tabular-nums text-sales-text-muted">{s.pct}%</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
