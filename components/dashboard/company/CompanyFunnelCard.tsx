"use client";

import type { SalesFunnelStage } from "@/components/dashboard/sales/types";
import { CardShell } from "@/components/dashboard/sales/KpiCard";
import { cn } from "@/lib/ui/cn";

/** Soft lime → deeper green progression (matches Company Dashboard reference). */
const FUNNEL_FILLS = [
  "rgba(212,255,79,0.55)",
  "rgba(190,235,70,0.62)",
  "rgba(150,210,60,0.70)",
  "rgba(110,185,55,0.78)",
  "rgba(70,160,55,0.86)",
  "rgba(40,140,55,0.94)",
] as const;

const FUNNEL_WIDTHS = ["100%", "90%", "78%", "66%", "54%", "42%"] as const;

function stepRate(current: number, previous: number): string | null {
  if (previous <= 0) return null;
  return `${Math.round((current / previous) * 100)}%`;
}

export function CompanyFunnelCard({
  stages,
  conversionRate,
  conversionDefinition,
}: {
  stages: SalesFunnelStage[];
  conversionRate: number | null;
  conversionDefinition: string;
}) {
  return (
    <CardShell
      title="Lead → Deal Funnel"
      action={<span className="text-[12px] font-medium text-sales-text-muted">This month</span>}
    >
      <div className="px-4 py-4 sm:px-5">
        {/* Desktop: label/count left · lime funnel right */}
        <div
          className="hidden gap-4 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] sm:items-stretch"
          role="list"
          aria-label="Lead to Deal funnel stages this month"
        >
          <ul className="flex flex-col justify-between gap-1 py-0.5">
            {stages.map((stage, idx) => {
              const prev = idx > 0 ? stages[idx - 1]! : null;
              const rate = prev ? stepRate(stage.count, prev.count) : null;
              return (
                <li key={stage.id} className="flex min-h-[40px] flex-col justify-center">
                  {rate ? (
                    <p className="mb-0.5 text-[10px] font-medium tabular-nums text-sales-text-muted">
                      {rate}
                    </p>
                  ) : null}
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[12px] font-medium text-sales-text-secondary">
                      {stage.label}
                    </span>
                    <span className="shrink-0 text-[15px] font-semibold tabular-nums text-sales-text-primary">
                      {stage.count}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-col items-center justify-center gap-1.5 py-1">
            {stages.map((stage, idx) => {
              const width = FUNNEL_WIDTHS[Math.min(idx, FUNNEL_WIDTHS.length - 1)]!;
              const fill = FUNNEL_FILLS[Math.min(idx, FUNNEL_FILLS.length - 1)]!;
              const isLast = idx === stages.length - 1;
              return (
                <div
                  key={`bar-${stage.id}`}
                  role="listitem"
                  className="relative flex h-9 w-full items-center justify-center"
                  aria-hidden
                >
                  <div
                    className={cn(
                      "h-full w-full border border-[rgba(40,120,40,0.12)]",
                      idx === 0 && "rounded-t-[10px]",
                      isLast && "rounded-b-[10px]"
                    )}
                    style={{
                      width,
                      background: fill,
                      clipPath: isLast
                        ? "polygon(0 0, 100% 0, 100% 100%, 0 100%)"
                        : "polygon(0 0, 100% 0, 96% 100%, 4% 100%)",
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile: vertical lime steps */}
        <ol className="space-y-2 sm:hidden" aria-label="Lead to Deal funnel this month">
          {stages.map((stage, idx) => {
            const prev = idx > 0 ? stages[idx - 1]! : null;
            const rate = prev ? stepRate(stage.count, prev.count) : null;
            const fill = FUNNEL_FILLS[Math.min(idx, FUNNEL_FILLS.length - 1)]!;
            return (
              <li key={stage.id}>
                {rate ? (
                  <p className="mb-1 text-center text-[10px] font-medium text-sales-text-muted">
                    ↓ {rate}
                  </p>
                ) : null}
                <div
                  className="flex min-h-11 items-center justify-between rounded-[10px] border border-[rgba(40,120,40,0.12)] px-3 py-2.5"
                  style={{ background: fill }}
                >
                  <span className="text-[13px] font-medium text-[#0B1A0B]">{stage.label}</span>
                  <span className="text-[16px] font-semibold tabular-nums text-[#0B1A0B]">
                    {stage.count}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>

        {conversionRate != null ? (
          <p className="mt-4 text-[12px] text-sales-text-secondary">
            Overall conversion (Lead → Won):{" "}
            <span className="font-semibold tabular-nums text-sales-text-primary">
              {conversionRate}%
            </span>
          </p>
        ) : null}
        <p className="mt-2 text-[10px] leading-relaxed text-sales-text-muted">
          {conversionDefinition} Stage-to-stage % use current-period counts (not cohort tracking).
        </p>
      </div>
    </CardShell>
  );
}
