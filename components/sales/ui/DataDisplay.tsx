"use client";

import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarClock,
  CircleDollarSign,
  Clock3,
  Building2,
  Inbox,
  UserRound,
  UsersRound,
  Target,
  Trophy,
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
        "truncate text-[22px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-sales-text-primary sm:text-[26px] layout:text-[28px]",
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
      <span className="inline-flex max-w-full items-center truncate rounded-full bg-sales-danger-soft px-1.5 py-0.5 text-[11px] font-medium text-sales-danger-fg">
        {label}
      </span>
    );
  }
  if (direction === "flat" || direction === "none" || direction === "new") {
    return (
      <span className="inline-flex max-w-full truncate rounded-full bg-sales-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-sales-text-muted">
        {label}
      </span>
    );
  }
  const up = direction === "up";
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-0.5 truncate rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
        up ? "bg-sales-success-soft text-sales-success-fg" : "bg-sales-danger-soft text-sales-danger-fg"
      )}
    >
      <Icon size={12} strokeWidth={2} className="shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}

export function KpiStat({ item }: { item: SalesKpiItem }) {
  const Icon = ICON_MAP[item.icon];
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
        {item.trend ? (
          <TrendChip direction={item.trend.direction} label={item.trend.label} />
        ) : (
          <p className="truncate text-[11px] leading-4 text-sales-text-muted">{item.supporting}</p>
        )}
      </div>
    </>
  );

  const className =
    "sd-card group relative flex h-full min-h-[118px] min-w-0 flex-col overflow-hidden p-3.5 sm:min-h-[128px] sm:p-4";

  if (item.href) {
    return (
      <Link
        href={item.href}
        data-course-target={item.id ? `dashboard-kpi-${item.id}` : undefined}
        className={cn(
          className,
          "hover:border-sales-border-strong hover:shadow-sales-card-hover",
          "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sales-focus-outline)]"
        )}
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

export function LeadIdentity({
  name,
  secondary,
  href,
  size = "md",
}: {
  name: string;
  secondary?: string | null;
  href?: string;
  size?: "sm" | "md";
}) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials =
    parts.length <= 1
      ? (parts[0] ?? "?").slice(0, 2).toUpperCase()
      : `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  const avatar = size === "sm" ? "h-[28px] w-[28px] text-[10px]" : "h-9 w-9 text-[11px]";
  const title = (
    <p
      className={cn(
        "truncate font-semibold text-sales-text-primary",
        size === "sm" ? "text-[13px]" : "text-[13px]"
      )}
      title={name}
    >
      {name}
    </p>
  );

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-[var(--sales-neutral-100)] font-semibold text-sales-text-secondary",
          avatar
        )}
        aria-hidden
      >
        {initials}
      </div>
      <div className="min-w-0">
        {href ? (
          <Link href={href} className="hover:text-sales-brand-fg focus-visible:outline-none">
            {title}
          </Link>
        ) : (
          title
        )}
        {secondary ? (
          <p className="truncate text-[12px] text-sales-text-secondary" title={secondary}>
            {secondary}
          </p>
        ) : null}
      </div>
    </div>
  );
}
