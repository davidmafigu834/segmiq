"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Info } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { Tooltip } from "@/components/sales/ui/BrandIcon";

function accentFromTint(iconTint: string) {
  if (iconTint.includes("success")) return "bg-sales-success";
  if (iconTint.includes("danger")) return "bg-sales-danger";
  if (iconTint.includes("warning")) return "bg-sales-warning";
  if (iconTint.includes("info")) return "bg-sales-info";
  if (iconTint.includes("teal")) return "bg-sales-teal";
  if (iconTint.includes("purple")) return "bg-sales-purple";
  return "bg-sales-brand";
}

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
      <TrendChip direction={trend.direction} label={trend.label} />
    ) : supporting ? (
      <p className="truncate text-[11px] leading-4 text-sales-text-muted" title={supporting}>
        {supporting}
      </p>
    ) : (
      <p className="text-[11px] text-sales-text-muted">—</p>
    );

  return (
    <article className="sd-card relative flex h-full min-h-[118px] flex-col overflow-hidden p-3.5 sm:min-h-[128px] sm:p-4">
      <span className={cn("absolute inset-x-0 top-0 h-[2px]", accentFromTint(iconTint))} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <p className="flex min-w-0 flex-1 items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
          <span className="truncate">{label}</span>
          {tip ? (
            <Tooltip label={tip}>
              <Info size={12} strokeWidth={1.8} className="shrink-0 text-sales-text-muted" aria-hidden />
            </Tooltip>
          ) : null}
        </p>
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-sales-sm",
            iconTint
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

      <div className="mt-auto pt-3">
        <div className="flex min-h-[18px] items-center overflow-hidden">{footer}</div>
      </div>
    </article>
  );
}

function TrendChip({
  direction,
  label,
}: {
  direction: "up" | "down" | "flat" | "new" | "none" | "alert";
  label: string;
}) {
  if (direction === "alert") {
    return (
      <span className="inline-flex max-w-full items-center truncate rounded-full bg-sales-danger-soft px-1.5 py-0.5 text-[11px] font-medium text-sales-danger-fg" title={label}>
        {label}
      </span>
    );
  }
  if (/\bpts\b/i.test(label)) {
    const up = label.trim().startsWith("+") || label.includes("up");
    const down = label.trim().startsWith("-");
    return (
      <span
        className={cn(
          "inline-flex max-w-full truncate rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
          up
            ? "bg-sales-success-soft text-sales-success-fg"
            : down
              ? "bg-sales-danger-soft text-sales-danger-fg"
              : "bg-sales-neutral-100 text-sales-text-muted"
        )}
        title={label}
      >
        {label}
      </span>
    );
  }
  if (direction === "flat" || direction === "new") {
    return (
      <span className="inline-flex max-w-full truncate rounded-full bg-sales-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-sales-text-muted" title={label}>
        {label}
      </span>
    );
  }
  if (direction === "up" || direction === "down") {
    const up = direction === "up";
    const Icon = up ? ArrowUpRight : ArrowDownRight;
    return (
      <span
        className={cn(
          "inline-flex max-w-full items-center gap-0.5 truncate rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
          up ? "bg-sales-success-soft text-sales-success-fg" : "bg-sales-danger-soft text-sales-danger-fg"
        )}
        title={label}
      >
        <Icon size={12} strokeWidth={2} className="shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
      </span>
    );
  }
  return (
    <span className="truncate text-[11px] text-sales-text-muted" title={label}>
      {label}
    </span>
  );
}
