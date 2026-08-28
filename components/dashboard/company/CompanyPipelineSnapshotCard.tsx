"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CompanyDashCard, CompanyDashEmpty, DashLink, PeriodChip } from "./CompanyDashCard";
import type { SalesPipelineSnapshotStage } from "@/components/dashboard/sales/types";
import type { CSSProperties } from "react";

export function CompanyPipelineSnapshotCard({
  stages,
  viewAllHref = "/client/leads/pipeline",
}: {
  stages: SalesPipelineSnapshotStage[];
  viewAllHref?: string;
}) {
  const totalKnown = stages.reduce((sum, stage) => sum + stage.knownValue, 0);

  return (
    <CompanyDashCard
      title="Pipeline snapshot"
      className="dashboard-panel--analytics"
      action={
        <div className="flex items-center gap-2.5">
          <PeriodChip>Deals only</PeriodChip>
          <DashLink href={viewAllHref}>View full pipeline</DashLink>
        </div>
      }
    >
      {stages.length === 0 ? (
        <CompanyDashEmpty
          title="No active Deals yet"
          description="Qualified opportunities will appear here once your sales team creates Deals from Leads."
          action={
            <Link
              href="/client/leads"
              className="inline-flex min-h-11 items-center text-[13px] font-semibold text-sales-brand-fg hover:underline"
            >
              View Leads
            </Link>
          }
        />
      ) : (
        <div className="px-4 py-3">
          {totalKnown > 0 ? (
            <div className="mb-3 flex h-2 overflow-hidden rounded-full bg-sales-neutral-100" aria-hidden>
              {stages.map((stage) => {
                const share = stage.knownValue > 0 ? (stage.knownValue / totalKnown) * 100 : 0;
                if (share <= 0) return null;
                return (
                  <div
                    key={stage.id}
                    className="h-full min-w-[3px] first:rounded-l-full last:rounded-r-full"
                    style={{ width: `${share}%`, backgroundColor: stage.color }}
                  />
                );
              })}
            </div>
          ) : null}

          <div
            className="flex flex-wrap items-stretch gap-2 layout:flex-nowrap layout:overflow-x-auto"
            role="list"
            aria-label="Active Deal stages"
          >
            {stages.map((stage, idx) => (
              <div key={stage.id} className="flex min-w-0 flex-[1_1_140px] items-stretch gap-2">
                <Link
                  href={stage.href}
                  role="listitem"
                  className="dashboard-stage-card min-w-0 transition-colors hover:border-sales-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sales-brand"
                  style={{ ["--stage-accent" as string]: stage.color } as CSSProperties}
                >
                  <span className="dashboard-stage-accent" aria-hidden />
                  <p className="truncate text-[12px] font-semibold text-sales-text-secondary">{stage.label}</p>
                  <p className="mt-1.5 text-[18px] font-bold tabular-nums tracking-[-0.04em] text-sales-text-primary">
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
                  <ChevronRight size={16} className="dashboard-stage-arrow" aria-hidden />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </CompanyDashCard>
  );
}
