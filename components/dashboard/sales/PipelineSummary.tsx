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
        <p className="text-[12px] font-semibold text-[#101828]">{stage.label}</p>
        <p className="mt-0.5 text-[11px] text-[#98A2B3] tabular-nums">
          {stage.dealCount} {stage.dealCount === 1 ? "deal" : "deals"}
          <span className="text-[#D0D5DD]"> · </span>
          <span className="font-medium text-[#667085]">{stage.valueLabel}</span>
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {stage.deals.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-[#E5E7EB] bg-[#F9FAFB] px-3 py-3 text-center text-[11px] text-[#98A2B3]">
            No deals
          </div>
        ) : (
          stage.deals.map((deal) => <DealCard key={deal.id} deal={deal} />)
        )}
        {stage.remainingCount > 0 ? (
          <Link
            href="/sales/leads"
            className="pt-1 text-center text-[11px] font-medium text-[#667085] transition-colors hover:text-[#101828]"
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
      className="block rounded-[10px] border border-[#E5E7EB] bg-white px-2.5 py-2 transition-[border-color,box-shadow] duration-150 hover:border-[#D0D5DD] hover:bg-[#F9FAFB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4FF4F]"
    >
      <p className="truncate text-[12px] font-semibold text-[#101828]">{deal.name}</p>
      <p className="mt-0.5 truncate text-[11px] text-[#98A2B3]">{deal.industry}</p>
      <p
        className={`mt-1 text-[12px] font-semibold tabular-nums ${
          mutedValue ? "font-medium text-[#98A2B3]" : "text-[#101828]"
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
          className="text-[12px] font-medium text-[#667085] transition-colors hover:text-[#101828]"
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
