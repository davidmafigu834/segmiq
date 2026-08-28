"use client";

import Link from "next/link";
import { CompanyDashCard, CompanyDashEmpty, DashLink, PeriodChip } from "./CompanyDashCard";
import type { SalesPipelineSnapshotStage } from "@/components/dashboard/sales/types";

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
        <div className="px-4 py-4 sm:px-5">
          {totalKnown > 0 ? (
            <div className="mb-4 flex h-2.5 overflow-hidden rounded-full bg-sales-neutral-100" aria-hidden>
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
            className="grid grid-cols-2 gap-2 sm:grid-cols-3 layout:grid-cols-4 xl:grid-cols-5"
            role="list"
            aria-label="Active Deal stages"
          >
            {stages.map((stage) => (
              <Link
                key={stage.id}
                href={stage.href}
                role="listitem"
                className="dashboard-card min-w-0 px-3 py-3 transition-colors hover:border-sales-border-strong hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sales-brand"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: stage.color }}
                    aria-hidden
                  />
                  <p className="truncate text-[12px] font-semibold text-sales-text-primary">{stage.label}</p>
                </div>
                <p className="text-[16px] font-semibold tabular-nums tracking-[-0.03em] text-sales-text-primary">
                  {stage.valueLabel}
                </p>
                <p className="mt-0.5 text-[11px] tabular-nums text-sales-text-muted">
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
      )}
    </CompanyDashCard>
  );
}
