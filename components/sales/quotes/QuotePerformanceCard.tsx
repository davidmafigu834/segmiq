"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ChartEmptyState,
  MenuSelect,
  SalesDonutChart,
  Skeleton,
} from "@/components/sales/ui";
import type { QuotePerformanceSlice, QuotesPeriodId } from "@/lib/sales/quotes";
import { QUOTES_PERIODS } from "@/lib/sales/quotes";

export function QuotePerformanceCard({
  period,
  onPeriodChange,
  slices,
  total,
  emptyReason,
  loading,
}: {
  period: QuotesPeriodId;
  onPeriodChange: (p: QuotesPeriodId) => void;
  slices: QuotePerformanceSlice[];
  total: number;
  emptyReason: "none" | "drafts_only" | "no_data";
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader
        className="border-b-0 px-5 pb-2 pt-4"
        action={
          <MenuSelect
            aria-label="Performance period"
            size="sm"
            align="right"
            value={period}
            onChange={onPeriodChange}
            options={QUOTES_PERIODS.map((p) => ({ value: p.id, label: p.label }))}
          />
        }
      >
        <CardTitle className="text-[14px] font-semibold">Quote performance</CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-2">
        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <Skeleton className="h-[140px] w-[140px] rounded-full" />
            <Skeleton className="h-16 w-full rounded-[10px]" />
          </div>
        ) : emptyReason === "no_data" ? (
          <ChartEmptyState
            title="No quotations yet"
            description="Your quote performance will appear here."
            className="min-h-[180px]"
          />
        ) : emptyReason === "drafts_only" ? (
          <ChartEmptyState
            title="No sent quote outcomes yet"
            description="Send a quotation to see acceptance and decline mix."
            className="min-h-[180px]"
          />
        ) : (
          <>
            <div className="mx-auto h-[160px] w-full max-w-[200px]">
              <SalesDonutChart
                data={slices.map((s) => ({ name: s.label, value: s.count, color: s.color }))}
                centerLabel="Total"
                showLegend={false}
                emptyTitle="No quotations yet"
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
            {total > 0 ? (
              <p className="mt-3 text-[11px] text-sales-text-muted">
                Based on {total} non-draft quote{total === 1 ? "" : "s"}
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
