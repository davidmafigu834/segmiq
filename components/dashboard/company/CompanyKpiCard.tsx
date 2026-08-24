"use client";

import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CircleDollarSign,
  Clock3,
  Inbox,
  Target,
  Trophy,
  UserRound,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/ui/cn";
import type { SalesKpiItem } from "@/components/dashboard/sales/types";

const ICON_MAP = {
  customers: UsersRound,
  companies: Building2,
  individuals: UserRound,
  followups: CalendarClock,
  pipeline: CircleDollarSign,
  won: Trophy,
  conversion: Target,
  response: Clock3,
  enquiries: Inbox,
  deals: BriefcaseBusiness,
} as const;

const ICON_TINT: Record<SalesKpiItem["icon"], string> = {
  customers: "bg-sales-brand-soft-solid text-sales-brand-fg",
  companies: "bg-sales-success-soft text-sales-success-fg",
  individuals: "bg-sales-info-soft text-sales-info-fg",
  followups: "bg-sales-warning-soft text-sales-warning-fg",
  pipeline: "bg-sales-success-soft text-sales-success-fg",
  won: "bg-sales-brand-soft-solid text-sales-brand-fg",
  conversion: "bg-sales-teal-soft text-sales-teal-fg",
  response: "bg-sales-neutral-100 text-sales-text-secondary",
  enquiries: "bg-sales-info-soft text-sales-info-fg",
  deals: "bg-sales-purple-soft text-sales-purple-fg",
};

const ACCENT: Record<SalesKpiItem["icon"], string> = {
  customers: "bg-sales-brand",
  companies: "bg-sales-success",
  individuals: "bg-sales-info",
  followups: "bg-sales-warning",
  pipeline: "bg-sales-success",
  won: "bg-sales-brand",
  conversion: "bg-sales-teal",
  response: "bg-sales-warning",
  enquiries: "bg-sales-info",
  deals: "bg-sales-purple",
};

function TrendChip({
  trend,
  fallback,
}: {
  trend?: SalesKpiItem["trend"];
  fallback: string;
}) {
  if (!trend) {
    return <p className="truncate text-[11px] leading-4 text-sales-text-muted">{fallback}</p>;
  }

  if (trend.direction === "alert") {
    return (
      <span className="inline-flex max-w-full items-center truncate rounded-full bg-sales-danger-soft px-1.5 py-0.5 text-[11px] font-medium text-sales-danger-fg">
        {trend.label}
      </span>
    );
  }

  if (trend.direction === "flat") {
    return (
      <span className="inline-flex max-w-full truncate rounded-full bg-sales-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-sales-text-muted">
        {trend.label}
      </span>
    );
  }

  const up = trend.direction === "up";
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-0.5 truncate rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
        up ? "bg-sales-success-soft text-sales-success-fg" : "bg-sales-danger-soft text-sales-danger-fg"
      )}
    >
      <Icon size={12} strokeWidth={2} className="shrink-0" aria-hidden />
      <span className="truncate">{trend.label}</span>
    </span>
  );
}

export function CompanyKpiCard({ item }: { item: SalesKpiItem }) {
  const Icon = ICON_MAP[item.icon];
  const href = item.href;
  const body = (
    <>
      <span className={cn("absolute inset-x-0 top-0 h-[2px]", ACCENT[item.icon])} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
          {item.label}
        </p>
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-sales-sm",
            ICON_TINT[item.icon]
          )}
        >
          <Icon size={14} strokeWidth={1.8} aria-hidden />
        </span>
      </div>
      <p className="mt-3 truncate text-[24px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-sales-text-primary sm:text-[26px]">
        {item.value || "—"}
      </p>
      <div className="mt-auto pt-3">
        <TrendChip trend={item.trend} fallback={item.supporting} />
      </div>
    </>
  );

  const className =
    "sd-card group relative flex h-full min-h-[118px] min-w-0 flex-col overflow-hidden p-3.5 sm:min-h-[128px] sm:p-4";

  if (href) {
    return (
      <Link
        href={href}
        data-course-target={item.id ? `dashboard-kpi-${item.id}` : undefined}
        className={cn(
          className,
          "transition-[border-color,box-shadow] duration-150 hover:border-sales-border-strong hover:shadow-sales-card-hover",
          "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sales-focus-outline)]"
        )}
        aria-label={`View ${item.label}`}
      >
        {body}
      </Link>
    );
  }

  return (
    <article className={className} data-course-target={item.id ? `dashboard-kpi-${item.id}` : undefined}>
      {body}
    </article>
  );
}
