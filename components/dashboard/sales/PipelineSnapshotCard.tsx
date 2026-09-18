"use client";

import Link from "next/link";
import type { SalesPipelineSnapshotStage } from "./types";
import { CardShell } from "./KpiCard";
import { cn } from "@/lib/ui/cn";

export function PipelineSnapshotCard({
  stages,
  viewAllHref = "/sales/pipeline",
}: {
  stages: SalesPipelineSnapshotStage[];
  viewAllHref?: string;
}) {
  return (
    <CardShell
      title="Pipeline snapshot"
      className="dashboard-panel--analytics"
      action={
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium text-sales-text-muted">Deals only</span>
          <Link
            href={viewAllHref}
            className="text-[12px] font-medium text-sales-text-secondary transition-colors hover:text-sales-text-primary"
          >
            View full pipeline
          </Link>
        </div>
      }
    >
      <div className="overflow-x-auto px-5 py-4 [-ms-overflow-style:auto] [scrollbar-width:thin]">
        <div
          className="flex min-w-max items-stretch divide-x divide-sales-border-subtle"
          role="list"
          aria-label="Pipeline stages"
        >
          {stages.map((stage) => (
            <Link
              key={stage.id}
              href={stage.href}
              role="listitem"
              className={cn(
                "dashboard-stage-cell w-[132px] shrink-0 px-3 py-1 first:pl-0 last:pr-0 sm:w-[148px] sm:px-4",
                "transition-colors hover:bg-sales-surface-hover/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sales-brand"
              )}
            >
              <p className="text-[12px] font-medium text-sales-text-secondary">{stage.label}</p>
              <p className="mt-1.5 text-[20px] font-bold tabular-nums tracking-[-0.04em] text-sales-text-primary">
                {stage.valueLabel}
              </p>
              <p className="dashboard-activity-detail mt-1 text-[11px] tabular-nums">
                {stage.dealCount} {stage.dealCount === 1 ? "deal" : "deals"}
              </p>
              {stage.awaitingEstimate > 0 ? (
                <p className="mt-1 text-[10px] text-sales-text-muted">
                  {stage.awaitingEstimate} awaiting estimate
                </p>
              ) : null}
            </Link>
          ))}
        </div>
      </div>
    </CardShell>
  );
}
