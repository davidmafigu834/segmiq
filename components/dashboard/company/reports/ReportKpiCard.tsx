"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { ReportSparkline } from "./ReportSparkline";
import type { ReportTrend } from "@/lib/sales/company-reports/metrics";

export function reportKpiGridClass(count: number) {
  if (count <= 3) {
    return "grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 md:grid-cols-[repeat(3,minmax(0,1fr))]";
  }
  if (count === 4) {
    return "grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 layout:grid-cols-[repeat(4,minmax(0,1fr))]";
  }
  if (count === 5) {
    return "grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 md:grid-cols-[repeat(3,minmax(0,1fr))] layout:grid-cols-[repeat(5,minmax(0,1fr))]";
  }
  return "grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 md:grid-cols-[repeat(3,minmax(0,1fr))] layout:grid-cols-[repeat(6,minmax(0,1fr))]";
}

export function ReportKpiCard({
  label,
  value,
  trend,
  icon: Icon,
  iconClass,
  sparkline,
  sparkColor,
  tip,
  accentClass = "bg-sales-brand",
}: {
  label: string;
  value: string;
  trend: ReportTrend;
  icon: LucideIcon;
  iconClass: string;
  sparkline: number[];
  sparkColor: string;
  tip?: string;
  accentClass?: string;
}) {
  const shortTrend = trend.label.split(" vs")[0] ?? trend.label;
  const hover = [trend.label, tip].filter(Boolean).join(" · ");

  return (
    <article className="sd-card relative flex h-full min-h-[128px] min-w-0 flex-col overflow-hidden p-3.5 sm:min-h-[136px] sm:p-4">
      <span className={cn("absolute inset-x-0 top-0 h-[2px]", accentClass)} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
          {label}
        </p>
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-sales-sm",
            iconClass
          )}
        >
          <Icon size={14} strokeWidth={1.8} aria-hidden />
        </span>
      </div>
      <p
        className="mt-3 truncate text-[24px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-sales-text-primary sm:text-[26px]"
        title={value}
      >
        {value}
      </p>
      <div className="mt-auto flex min-w-0 items-end justify-between gap-2 pt-3">
        <TrendChip trend={trend} shortLabel={shortTrend} hover={hover} />
        <div className="w-[56px] shrink-0 sm:w-[72px]">
          <ReportSparkline data={sparkline} color={sparkColor} />
        </div>
      </div>
    </article>
  );
}

function TrendChip({
  trend,
  shortLabel,
  hover,
}: {
  trend: ReportTrend;
  shortLabel: string;
  hover: string;
}) {
  if (trend.direction === "up" || trend.direction === "down") {
    const up = trend.direction === "up";
    const Icon = up ? ArrowUpRight : ArrowDownRight;
    return (
      <span
        className={cn(
          "inline-flex max-w-full items-center gap-0.5 truncate rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
          up ? "bg-sales-success-soft text-sales-success-fg" : "bg-sales-danger-soft text-sales-danger-fg"
        )}
        title={hover}
      >
        <Icon size={12} strokeWidth={2} className="shrink-0" aria-hidden />
        <span className="truncate">{shortLabel}</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex max-w-full truncate rounded-full bg-sales-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-sales-text-muted"
      title={hover}
    >
      {shortLabel}
    </span>
  );
}
