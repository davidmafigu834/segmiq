"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import type { PerformanceSummaryRow } from "@/lib/sales/company-reports/types";
import { ReportChartCard } from "./ReportChartCard";

export function PerformanceSummary({ rows }: { rows: PerformanceSummaryRow[] }) {
  return (
    <ReportChartCard title="Performance Summary" bodyClassName="pt-1" className="min-h-0">
      <ul className="divide-y divide-sales-border-subtle">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
            <span className="text-[12px] text-sales-text-secondary sm:text-[13px]">{row.label}</span>
            <span className="flex min-w-0 items-center gap-2">
              <span className="text-[13px] font-semibold tabular-nums text-sales-text-primary">
                {row.value}
              </span>
              <TrendMini trend={row.trend} />
            </span>
          </li>
        ))}
      </ul>
    </ReportChartCard>
  );
}

function TrendMini({ trend }: { trend: PerformanceSummaryRow["trend"] }) {
  if (trend.direction === "none" || trend.direction === "new" || trend.direction === "flat") {
    return (
      <span className="max-w-[7.5rem] truncate text-right text-[11px] text-sales-text-muted" title={trend.label}>
        {trend.label}
      </span>
    );
  }
  const up = trend.direction === "up";
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums",
        up ? "text-sales-success" : "text-sales-danger"
      )}
      title={trend.label}
    >
      <Icon size={12} strokeWidth={1.8} aria-hidden />
      {trend.label.split(" vs")[0]}
    </span>
  );
}
