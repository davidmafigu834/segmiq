"use client";

import Link from "next/link";
import type { SalesPipelineDeal, SalesPipelineStage } from "./types";
import { CardShell } from "./KpiCard";

export function PipelineColumn({ stage }: { stage: SalesPipelineStage }) {
  return (
    <div className="flex w-[180px] min-w-[180px] shrink-0 flex-col">
      <div
        className="mb-2.5 h-[3px] w-full rounded-full"
        style={{ backgroundColor: stage.color }}
        aria-hidden
      />
      <div className="mb-3">
        <p className="text-[12px] font-semibold text-sales-text-primary">{stage.label}</p>
        <p className="mt-0.5 text-[11px] text-sales-text-muted tabular-nums">
          {stage.dealCount} {stage.dealCount === 1 ? "deal" : "deals"}
          <span className="text-[var(--sales-neutral-300)]"> · </span>
          <span className="font-medium text-sales-text-secondary">{stage.valueLabel}</span>
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {stage.deals.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-sales-border bg-sales-surface-hover px-3 py-3 text-center text-[11px] text-sales-text-muted">
            No deals
          </div>
        ) : (
          stage.deals.map((deal) => <DealCard key={deal.id} deal={deal} />)
        )}
        {stage.remainingCount > 0 ? (
          <Link
            href="/sales/leads"
            className="pt-1 text-center text-[11px] font-medium text-sales-text-secondary transition-colors hover:text-sales-text-primary"
          >
            +{stage.remainingCount} more
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function DealCard({ deal }: { deal: SalesPipelineDeal }) {
  const mutedValue = deal.valueLabel === "Value not set";
  return (
    <Link
      href={deal.href}
      title={deal.name}
      className="block rounded-[10px] border border-sales-border bg-sales-surface px-2.5 py-2 transition-[border-color,box-shadow] duration-150 hover:border-sales-border-strong hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sales-brand"
    >
      <p className="truncate text-[12px] font-semibold text-sales-text-primary">{deal.name}</p>
      <p className="mt-0.5 truncate text-[11px] text-sales-text-muted">{deal.industry}</p>
      <p
        className={`mt-1 text-[12px] font-semibold tabular-nums ${
          mutedValue ? "font-medium text-sales-text-muted" : "text-sales-text-primary"
        }`}
      >
        {deal.valueLabel}
      </p>
    </Link>
  );
}

export function PipelineSummary({ stages }: { stages: SalesPipelineStage[] }) {
  return (
    <CardShell
      title="My pipeline"
      action={
        <Link
          href="/sales/leads"
          className="text-[12px] font-medium text-sales-text-secondary transition-colors hover:text-sales-text-primary"
        >
          View full pipeline
        </Link>
      }
    >
      <div className="overflow-x-auto px-5 py-4 [-ms-overflow-style:auto] [scrollbar-width:thin]">
        <div className="flex min-w-max gap-4 pb-1">
          {stages.map((stage) => (
            <PipelineColumn key={stage.id} stage={stage} />
          ))}
        </div>
      </div>
    </CardShell>
  );
}
