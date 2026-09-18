"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import type { SalesKpiItem } from "@/components/dashboard/sales/types";

export function KpiStat({
  item,
  variant = "primary",
}: {
  item: SalesKpiItem;
  /** primary = elevated metric tile; secondary = dense type-only strip cell */
  variant?: "primary" | "secondary";
}) {
  const body =
    variant === "secondary" ? (
      <>
        <p className="dashboard-kpi-label min-w-0">{item.label}</p>
        <p className="dashboard-kpi-value mt-1 truncate">{item.value || "—"}</p>
        <div className="mt-1 min-w-0">
          {item.trend ? (
            <TrendChip direction={item.trend.direction} label={item.trend.label} />
          ) : (
            <p className="truncate text-[11px] leading-4 text-sales-text-muted">{item.supporting}</p>
          )}
        </div>
      </>
    ) : (
      <>
        <p className="dashboard-kpi-label min-w-0">{item.label}</p>
        <p className="dashboard-kpi-value mt-2.5 truncate">{item.value || "—"}</p>
        <div className="mt-auto pt-2.5">
          {item.trend ? (
            <TrendChip direction={item.trend.direction} label={item.trend.label} />
          ) : (
            <p className="truncate text-[12px] leading-4 text-sales-text-muted">{item.supporting}</p>
          )}
        </div>
      </>
    );

  const className = cn(
    "dashboard-kpi group relative flex min-w-0 flex-col",
    variant === "secondary"
      ? "dashboard-kpi--secondary min-h-0 border-0 bg-transparent p-0 shadow-none"
      : "h-full min-h-[96px] p-3.5 sm:min-h-[104px] sm:p-4"
  );

  if (item.href) {
    return (
      <Link
        href={item.href}
        data-course-target={item.id ? `dashboard-kpi-${item.id}` : undefined}
        className={cn(className, "focus:outline-none")}
        aria-label={`View ${item.label}`}
      >
        {body}
      </Link>
    );
  }

  return (
    <article
      className={className}
      data-course-target={item.id ? `dashboard-kpi-${item.id}` : undefined}
    >
      {body}
    </article>
  );
}

export function Trend({
  direction,
  label,
}: {
  direction: "up" | "down" | "flat" | "alert" | "new" | "none";
  label: string;
}) {
  if (direction === "alert") {
    return <p className="text-[12px] font-medium text-sales-danger">{label}</p>;
  }
  if (direction === "flat" || direction === "none" || direction === "new") {
    return <p className="text-[12px] text-sales-text-muted">{label}</p>;
  }
  const up = direction === "up";
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <p
      className={cn(
        "inline-flex items-center gap-0.5 text-[12px] font-medium",
        up ? "text-sales-success" : "text-sales-danger"
      )}
    >
      <Icon size={14} strokeWidth={1.8} aria-hidden />
      <span className="tabular-nums">{label}</span>
    </p>
  );
}

export function MetricValue({
  value,
  emptyLabel = "—",
  className,
}: {
  value: string | number | null | undefined;
  emptyLabel?: string;
  className?: string;
}) {
  const empty =
    value == null || value === "" || value === "—" || value === "undefined" || value === "NaN";
  return (
    <p
      className={cn(
        "truncate text-[22px] font-bold leading-none tracking-[-0.025em] tabular-nums text-sales-text-primary sm:text-[26px] layout:text-[28px]",
        className
      )}
    >
      {empty ? emptyLabel : value}
    </p>
  );
}

function TrendChip({
  direction,
  label,
}: {
  direction: "up" | "down" | "flat" | "alert" | "new" | "none";
  label: string;
}) {
  if (direction === "alert") {
    return (
      <span className="dashboard-kpi-pill inline-flex max-w-full items-center truncate rounded-sales-sm bg-sales-danger-soft px-1.5 py-0.5 text-[11px] font-medium text-sales-danger-fg">
        {label}
      </span>
    );
  }
  if (direction === "flat" || direction === "none" || direction === "new") {
    return (
      <span className="dashboard-kpi-pill inline-flex max-w-full truncate rounded-sales-sm px-0 py-0 text-[11px] font-medium text-sales-text-muted">
        {label}
      </span>
    );
  }
  const up = direction === "up";
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "dashboard-kpi-pill inline-flex max-w-full items-center gap-0.5 truncate rounded-sales-sm px-0 py-0 text-[11px] font-medium tabular-nums",
        up ? "text-sales-success" : "text-sales-danger"
      )}
    >
      <Icon size={12} strokeWidth={2} className="shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}
