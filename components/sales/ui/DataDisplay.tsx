"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import type { SalesKpiItem } from "@/components/dashboard/sales/types";
import type { CSSProperties } from "react";

const KPI_ACCENT: Record<SalesKpiItem["icon"], string> = {
  customers: "var(--sales-brand)",
  companies: "var(--sales-success)",
  individuals: "var(--sales-info)",
  followups: "var(--sales-warning)",
  pipeline: "var(--sales-success)",
  won: "var(--sales-brand)",
  conversion: "var(--sales-cyan)",
  response: "var(--sales-orange)",
  enquiries: "var(--sales-info)",
  deals: "var(--sales-purple)",
};

export type KpiStatVariant = "default" | "primary" | "row";

export function KpiStat({
  item,
  variant = "default",
}: {
  item: SalesKpiItem;
  variant?: KpiStatVariant;
}) {
  const style = { ["--kpi-accent" as string]: KPI_ACCENT[item.icon] } as CSSProperties;
  const detail = item.trend ? (
    <TrendChip direction={item.trend.direction} label={item.trend.label} />
  ) : (
    <p className="truncate text-[11px] leading-4 text-sales-text-muted">{item.supporting}</p>
  );

  const body =
    variant === "row" ? (
      <>
        <span className="dashboard-kpi-accent" aria-hidden />
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="dashboard-kpi-label min-w-0">{item.label}</p>
            <div className="mt-1.5 min-w-0">{detail}</div>
          </div>
          <p className="dashboard-kpi-value shrink-0 text-right">{item.value || "—"}</p>
        </div>
      </>
    ) : variant === "primary" ? (
      <>
        <span className="dashboard-kpi-accent" aria-hidden />
        <p className="dashboard-kpi-label min-w-0">{item.label}</p>
        <p className="dashboard-kpi-value dashboard-kpi-value--primary mt-4 truncate">
          {item.value || "—"}
        </p>
        <div className="mt-auto pt-4">{detail}</div>
      </>
    ) : (
      <>
        <span className="dashboard-kpi-accent" aria-hidden />
        <p className="dashboard-kpi-label min-w-0">{item.label}</p>
        <p className="dashboard-kpi-value mt-2.5 truncate">{item.value || "—"}</p>
        <div className="mt-auto pt-2">{detail}</div>
      </>
    );

  const className = cn(
    "dashboard-kpi group relative flex min-w-0 focus:outline-none",
    variant === "row" &&
      "dashboard-kpi--row min-h-[52px] flex-1 items-center px-3.5 py-2.5 md:min-h-0 md:px-4",
    variant === "primary" &&
      "dashboard-kpi--primary h-full min-h-[200px] flex-col justify-between p-4 sm:min-h-[240px] sm:p-5",
    variant === "default" && "h-full min-h-[88px] flex-col p-3.5 sm:min-h-[96px]"
  );

  if (item.href) {
    return (
      <Link
        href={item.href}
        style={style}
        data-course-target={item.id ? `dashboard-kpi-${item.id}` : undefined}
        className={className}
        aria-label={`View ${item.label}`}
      >
        {body}
      </Link>
    );
  }

  return (
    <article
      className={className}
      style={style}
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
      <span className="dashboard-kpi-pill inline-flex max-w-full items-center truncate rounded-full bg-sales-danger-soft px-1.5 py-0.5 text-[11px] font-medium text-sales-danger-fg">
        {label}
      </span>
    );
  }
  if (direction === "flat" || direction === "none" || direction === "new") {
    return (
      <span className="dashboard-kpi-pill inline-flex max-w-full truncate rounded-full bg-sales-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-sales-text-muted">
        {label}
      </span>
    );
  }
  const up = direction === "up";
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "dashboard-kpi-pill inline-flex max-w-full items-center gap-0.5 truncate rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
        up ? "bg-sales-success-soft text-sales-success-fg" : "bg-sales-danger-soft text-sales-danger-fg"
      )}
    >
      <Icon size={12} strokeWidth={2} className="shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}
