"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Info } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { Tooltip } from "@/components/sales/ui/BrandIcon";

export function ReportKpiCard({
  label,
  value,
  supporting,
  trend,
  icon: Icon,
  iconTint,
  tip,
}: {
  label: string;
  value: string;
  supporting?: string;
  trend?: {
    direction: "up" | "down" | "flat" | "new" | "none" | "alert";
    label: string;
  } | null;
  icon: LucideIcon;
  iconTint: string;
  tip?: string;
  /** @deprecated Kept for callers; subtitle removed so cards stay aligned. */
  pointInTime?: boolean;
}) {
  const footer =
    trend && trend.direction !== "none" ? (
      <TrendLine direction={trend.direction} label={trend.label} />
    ) : supporting ? (
      <p className="truncate text-[12px] text-sales-text-muted" title={supporting}>
        {supporting}
      </p>
    ) : (
      <p className="text-[12px] text-sales-text-muted">—</p>
    );

  return (
    <article className="flex h-full min-h-[100px] flex-col rounded-[12px] border border-sales-border bg-sales-surface p-3 shadow-sales-card sm:min-h-[118px] sm:p-4">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full sm:h-9 sm:w-9",
            iconTint
          )}
        >
          <Icon size={15} strokeWidth={1.8} aria-hidden />
        </span>
        <p className="flex min-w-0 flex-1 items-center gap-1 text-[11px] font-medium leading-snug text-sales-text-secondary sm:text-[12px]">
          <span className="truncate">{label}</span>
          {tip ? (
            <Tooltip label={tip}>
              <Info size={12} strokeWidth={1.8} className="shrink-0 text-sales-text-muted" aria-hidden />
            </Tooltip>
          ) : null}
        </p>
      </div>

      <p
        className="mt-2 truncate text-[20px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-sales-text-primary sm:mt-3 sm:text-[24px]"
        title={value}
      >
        {value}
      </p>

      <div className="mt-auto pt-2 sm:pt-3">
        <div className="flex min-h-[18px] items-center overflow-hidden">{footer}</div>
      </div>
    </article>
  );
}

function TrendLine({
  direction,
  label,
}: {
  direction: "up" | "down" | "flat" | "new" | "none" | "alert";
  label: string;
}) {
  if (direction === "alert") {
    return (
      <p className="truncate text-[12px] font-medium text-sales-warning" title={label}>
        {label}
      </p>
    );
  }
  // Percentage-point changes: no arrow glyph
  if (/\bpts\b/i.test(label)) {
    const tone =
      label.trim().startsWith("+") || label.includes("up")
        ? "text-sales-success"
        : label.trim().startsWith("-")
          ? "text-sales-danger"
          : "text-sales-text-muted";
    return (
      <p className={cn("truncate text-[12px] font-medium tabular-nums", tone)} title={label}>
        {label}
      </p>
    );
  }
  if (direction === "flat" || direction === "new") {
    return (
      <p className="truncate text-[12px] text-sales-text-muted" title={label}>
        {label}
      </p>
    );
  }
  if (direction === "up") {
    return (
      <p
        className="inline-flex max-w-full items-center gap-0.5 text-[12px] font-medium text-sales-success"
        title={label}
      >
        <ArrowUpRight size={14} strokeWidth={1.8} className="shrink-0" aria-hidden />
        <span className="truncate tabular-nums">{label}</span>
      </p>
    );
  }
  if (direction === "down") {
    return (
      <p
        className="inline-flex max-w-full items-center gap-0.5 text-[12px] font-medium text-sales-danger"
        title={label}
      >
        <ArrowDownRight size={14} strokeWidth={1.8} className="shrink-0" aria-hidden />
        <span className="truncate tabular-nums">{label}</span>
      </p>
    );
  }
  return (
    <p className="truncate text-[12px] text-sales-text-muted" title={label}>
      {label}
    </p>
  );
}
