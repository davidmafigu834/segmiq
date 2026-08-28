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
import type { CSSProperties } from "react";

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
      <span className="dashboard-kpi-pill inline-flex max-w-full items-center truncate rounded-full bg-sales-danger-soft px-1.5 py-0.5 text-[11px] font-medium text-sales-danger-fg">
        {trend.label}
      </span>
    );
  }

  if (trend.direction === "flat") {
    return (
      <span className="dashboard-kpi-pill inline-flex max-w-full truncate rounded-full bg-sales-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-sales-text-muted">
        {trend.label}
      </span>
    );
  }

  const up = trend.direction === "up";
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "dashboard-kpi-pill inline-flex max-w-full items-center gap-0.5 truncate rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
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
  const style = { ["--kpi-accent" as string]: KPI_ACCENT[item.icon] } as CSSProperties;
  const body = (
    <>
      <span className="dashboard-kpi-accent" aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <p className="dashboard-kpi-label min-w-0">{item.label}</p>
        <span className="dashboard-kpi-icon">
          <Icon size={14} strokeWidth={1.8} aria-hidden />
        </span>
      </div>
      <p className="dashboard-kpi-value mt-2 truncate">{item.value || "—"}</p>
      <div className="mt-auto pt-2">
        <TrendChip trend={item.trend} fallback={item.supporting} />
      </div>
    </>
  );

  const className =
    "dashboard-kpi group relative flex h-full min-h-[96px] min-w-0 flex-col p-3.5 sm:min-h-[104px]";

  if (href) {
    return (
      <Link
        href={href}
        style={style}
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
      style={style}
      data-course-target={item.id ? `dashboard-kpi-${item.id}` : undefined}
    >
      {body}
    </article>
  );
}
