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
  variant = "primary",
}: {
  label: string;
  value: string;
  supporting?: string;
  trend?: {
    direction: "up" | "down" | "flat" | "new" | "none" | "alert";
    label: string;
  } | null;
  icon?: LucideIcon;
  iconTint?: string;
  tip?: string;
  variant?: "primary" | "secondary";
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

  if (variant === "secondary") {
    return (
      <article className="min-w-0 py-0.5">
        <p className="flex min-w-0 items-center gap-1 text-[11px] font-medium text-sales-text-muted">
          <span className="truncate">{label}</span>
          {tip ? (
            <Tooltip label={tip}>
              <Info size={12} strokeWidth={1.8} className="shrink-0 text-sales-text-muted" aria-hidden />
            </Tooltip>
          ) : null}
        </p>
        <p
          className="mt-1 truncate text-[18px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-sales-text-primary"
          title={value}
        >
          {value}
        </p>
        <div className="mt-1.5 min-h-[18px] overflow-hidden">{footer}</div>
      </article>
    );
  }

  return (
    <article className="sd-card relative flex h-full min-h-[96px] flex-col overflow-hidden border border-sales-border-subtle bg-sales-surface p-3.5 shadow-none sm:min-h-[104px] sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="flex min-w-0 flex-1 items-center gap-1 text-[12px] font-medium text-sales-text-muted">
          <span className="truncate">{label}</span>
          {tip ? (
            <Tooltip label={tip}>
              <Info size={12} strokeWidth={1.8} className="shrink-0 text-sales-text-muted" aria-hidden />
            </Tooltip>
          ) : null}
        </p>
        {Icon && iconTint ? (
          <span className="sr-only">
            <Icon size={14} strokeWidth={1.8} aria-hidden />
          </span>
        ) : null}
      </div>

      <p
        className="mt-2.5 truncate text-[22px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-sales-text-primary sm:text-[24px]"
        title={value}
      >
        {value}
      </p>

      <div className="mt-auto pt-2.5">
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
      <span
        className="inline-flex max-w-full items-center truncate rounded-sales-sm bg-sales-danger-soft px-1.5 py-0.5 text-[11px] font-medium text-sales-danger-fg"
        title={label}
      >
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
          "inline-flex max-w-full truncate rounded-sales-sm px-0 py-0 text-[11px] font-medium tabular-nums",
          up
            ? "text-sales-success-fg"
            : down
              ? "text-sales-danger-fg"
              : "text-sales-text-muted"
        )}
        title={label}
      >
        {label}
      </span>
    );
  }
  if (direction === "flat" || direction === "new") {
    return (
      <span className="inline-flex max-w-full truncate text-[11px] font-medium text-sales-text-muted" title={label}>
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
          "inline-flex max-w-full items-center gap-0.5 truncate text-[11px] font-medium tabular-nums",
          up ? "text-sales-success-fg" : "text-sales-danger-fg"
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
