"use client";

import type { SourceSlice } from "@/lib/sales/company-reports/metrics";
import { ReportChartCard } from "./ReportChartCard";

export function LeadsBySource({
  rows,
  total,
  onViewAll,
  onSelect,
}: {
  rows: SourceSlice[];
  total: number;
  onViewAll?: () => void;
  onSelect?: (key: string) => void;
}) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <ReportChartCard
      title="Leads by Source"
      action={
        onViewAll ? (
          <button
            type="button"
            onClick={onViewAll}
            className="text-[12px] font-medium text-sales-brand-fg hover:underline"
          >
            View all
          </button>
        ) : undefined
      }
      bodyClassName="pt-1"
    >
      {rows.length === 0 || total === 0 ? (
        <p className="py-6 text-center text-[13px] text-sales-text-muted">
          No Lead source data for this period.
        </p>
      ) : (
        <ul className="space-y-3" aria-label="Leads by acquisition source">
          {rows.map((row) => (
            <li key={row.key}>
              <button
                type="button"
                className="w-full text-left"
                onClick={() => onSelect?.(row.key)}
              >
                <div className="mb-1 flex items-center justify-between gap-2 text-[12px]">
                  <span className="truncate font-medium text-sales-text-primary">{row.label}</span>
                  <span className="shrink-0 tabular-nums text-sales-text-secondary">
                    {row.count} · {row.pct}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-sales-neutral-100">
                  <div
                    className="h-full rounded-full bg-sales-brand"
                    style={{ width: `${Math.max(6, Math.round((row.count / max) * 100))}%` }}
                  />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </ReportChartCard>
  );
}
