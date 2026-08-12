"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { SalesPipelineSnapshotStage } from "./types";
import { CardShell } from "./KpiCard";

export function PipelineSnapshotCard({ stages }: { stages: SalesPipelineSnapshotStage[] }) {
  return (
    <CardShell
      title="Pipeline snapshot"
      action={
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
            Deals only
          </span>
          <Link
            href="/sales/leads"
            className="text-[12px] font-medium text-sales-text-secondary transition-colors hover:text-sales-text-primary"
          >
            View full pipeline
          </Link>
        </div>
      }
    >
      <div className="overflow-x-auto px-4 py-4 sm:px-5 [-ms-overflow-style:auto] [scrollbar-width:thin]">
        <div className="flex min-w-max items-stretch gap-2 pb-1 sm:gap-3">
          {stages.map((stage, idx) => (
            <div key={stage.id} className="flex items-center gap-2 sm:gap-3">
              <Link
                href={stage.href}
                className="block w-[148px] shrink-0 rounded-[12px] border border-sales-border bg-sales-surface p-3 transition-colors hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sales-brand sm:w-[160px]"
              >
                <div
                  className="mb-2 h-[3px] w-full rounded-full"
                  style={{ backgroundColor: stage.color }}
                  aria-hidden
                />
                <p className="text-[12px] font-semibold text-sales-text-primary">{stage.label}</p>
                <p className="mt-1 text-[11px] tabular-nums text-sales-text-muted">
                  {stage.dealCount} {stage.dealCount === 1 ? "deal" : "deals"}
                </p>
                <p className="mt-1 text-[14px] font-semibold tabular-nums text-sales-text-primary">
                  {stage.valueLabel}
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
                  className="shrink-0 text-sales-text-muted"
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
