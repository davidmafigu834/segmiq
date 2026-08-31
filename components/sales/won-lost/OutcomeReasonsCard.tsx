"use client";

import { ChartEmptyState } from "@/components/sales/ui";
import type { OutcomeReasonRow } from "@/lib/sales/outcomes";
import { cn } from "@/lib/ui/cn";

export function OutcomeReasonsCard({
  title,
  rows,
  withReason,
  total,
  tone,
  emptyTitle,
  emptyDescription,
  footer,
}: {
  title: string;
  rows: OutcomeReasonRow[];
  withReason: number;
  total: number;
  tone: "danger" | "success";
  emptyTitle: string;
  emptyDescription?: string;
  footer?: string;
}) {
  const fill =
    tone === "danger" ? "bg-sales-danger" : "bg-sales-success";
  const hasRows = rows.length > 0 && rows.some((r) => r.reason !== "No reason recorded" || r.count > 0);

  return (
    <div className="flex h-full min-h-[200px] flex-col">
      <h3 className="mb-3 text-[14px] font-semibold text-sales-text-primary">{title}</h3>
      {!hasRows ? (
        <ChartEmptyState title={emptyTitle} description={emptyDescription} className="min-h-[140px]" />
      ) : (
        <ul className="flex flex-1 flex-col gap-3">
          {rows.map((row) => (
            <li key={row.reason}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="truncate text-[12px] font-medium text-sales-text-primary">{row.reason}</span>
                <span className="shrink-0 text-[12px] tabular-nums text-sales-text-secondary">
                  {row.count}
                  <span className="ml-1.5 text-sales-text-muted">{row.pct}%</span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--sales-border-subtle)]">
                <div
                  className={cn("h-full rounded-full transition-[width] duration-200", fill)}
                  style={{ width: `${Math.max(2, Math.min(100, row.pct))}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      {footer || (total > 0 && withReason < total) ? (
        <p className="mt-3 text-[11px] text-sales-text-muted">
          {footer ?? `Known reasons: ${withReason} of ${total} lost deals`}
        </p>
      ) : null}
    </div>
  );
}
