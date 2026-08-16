"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { Tooltip } from "@/components/sales/ui/BrandIcon";
import { ReportSparkline } from "./ReportSparkline";
import type { ReportTrend } from "@/lib/sales/company-reports/metrics";

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
  return (
    <article className="flex h-full min-h-[135px] flex-col rounded-[12px] border border-sales-border bg-sales-surface p-3.5 shadow-sales-card sm:min-h-[142px] sm:p-4">
      <div className="flex items-center gap-2.5">
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
        className="mt-2.5 truncate text-[24px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-sales-text-primary sm:text-[26px]"
        title={value}
      >
        {value}
      </p>
      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
        <TrendChip trend={trend} tip={tip} />
        <div className="w-[72px] shrink-0 sm:w-[88px]">
          <ReportSparkline data={sparkline} color={sparkColor} />
        </div>
      </div>
    </article>
  );
}

function TrendChip({ trend, tip }: { trend: ReportTrend; tip?: string }) {
  const tone =
    trend.direction === "up"
      ? "text-sales-success"
      : trend.direction === "down"
        ? "text-sales-danger"
        : "text-sales-text-muted";
  const body = (
    <p className={cn("inline-flex max-w-full items-center gap-0.5 text-[11px] font-medium sm:text-[12px]", tone)}>
      {trend.direction === "up" ? <ArrowUpRight size={13} strokeWidth={1.8} className="shrink-0" aria-hidden /> : null}
      {trend.direction === "down" ? (
        <ArrowDownRight size={13} strokeWidth={1.8} className="shrink-0" aria-hidden />
      ) : null}
      <span className="truncate tabular-nums" title={trend.label}>
        {trend.label}
      </span>
    </p>
  );
  if (!tip) return body;
  return <Tooltip label={tip}>{body}</Tooltip>;
}
