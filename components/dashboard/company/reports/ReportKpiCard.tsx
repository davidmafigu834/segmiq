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
}: {
  label: string;
  value: string;
  trend: ReportTrend;
  icon: LucideIcon;
  iconClass: string;
  sparkline: number[];
  sparkColor: string;
  tip?: string;
}) {
  const shortTrend = trend.label.split(" vs")[0] ?? trend.label;
  const hover = [trend.label, tip].filter(Boolean).join(" · ");

  return (
    <article className="flex h-full min-h-[135px] min-w-0 flex-col overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface p-3.5 shadow-sales-card sm:min-h-[142px] sm:p-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full sm:h-9 sm:w-9",
            iconClass
          )}
        >
          <Icon size={15} strokeWidth={1.8} aria-hidden />
        </span>
        <p className="min-w-0 flex-1 truncate text-[12px] font-medium leading-snug text-sales-text-secondary">
          {label}
        </p>
      </div>
      <p
        className="mt-2.5 truncate text-[22px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-sales-text-primary sm:text-[24px]"
        title={value}
      >
        {value}
      </p>
      <div className="mt-auto flex min-w-0 items-end justify-between gap-2 pt-2">
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
  const tone =
    trend.direction === "up"
      ? "text-sales-success"
      : trend.direction === "down"
        ? "text-sales-danger"
        : "text-sales-text-muted";
  return (
    <p
      className={cn("flex min-w-0 flex-1 items-center gap-0.5 text-[11px] font-medium sm:text-[12px]", tone)}
      title={hover}
    >
      {trend.direction === "up" ? <ArrowUpRight size={13} strokeWidth={1.8} className="shrink-0" aria-hidden /> : null}
      {trend.direction === "down" ? (
        <ArrowDownRight size={13} strokeWidth={1.8} className="shrink-0" aria-hidden />
      ) : null}
      <span className="min-w-0 truncate tabular-nums">{shortLabel}</span>
    </p>
  );
}
