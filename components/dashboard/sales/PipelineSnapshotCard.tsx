"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { CSSProperties } from "react";
import type { SalesPipelineSnapshotStage } from "./types";
import { CardShell } from "./KpiCard";

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
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">
            Deals only
          </span>
          <Link
            href={viewAllHref}
            className="text-[12px] font-medium text-sales-text-secondary transition-colors hover:text-sales-text-primary"
          >
            View full pipeline
          </Link>
        </div>
      }
    >
      <div className="overflow-x-auto px-5 py-5 [-ms-overflow-style:auto] [scrollbar-width:thin]">
        <div className="flex min-w-max items-stretch gap-2 pb-1 sm:gap-2.5">
          {stages.map((stage, idx) => (
            <div key={stage.id} className="flex items-center gap-2 sm:gap-2.5">
              <Link
                href={stage.href}
                className="dashboard-stage-card w-[148px] shrink-0 transition-colors hover:border-sales-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sales-brand sm:w-[160px]"
                style={{ ["--stage-accent" as string]: stage.color } as CSSProperties}
              >
                <span className="dashboard-stage-accent" aria-hidden />
                <p className="text-[12px] font-semibold text-sales-text-secondary">{stage.label}</p>
                <p className="mt-2 text-[20px] font-bold tabular-nums tracking-[-0.04em] text-sales-text-primary">
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
              {idx < stages.length - 1 ? (
                <ChevronRight
                  size={16}
                  className="dashboard-stage-arrow dashboard-stage-arrow--inline shrink-0"
                  aria-hidden
                />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </CardShell>
  );
}
