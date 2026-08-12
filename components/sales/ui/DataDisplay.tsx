"use client";

import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarClock,
  CircleDollarSign,
  Clock3,
  Inbox,
  Target,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/ui/cn";
import type { SalesKpiItem } from "@/components/dashboard/sales/types";

const ICON_MAP = {
  followups: CalendarClock,
  pipeline: CircleDollarSign,
  won: Trophy,
  conversion: Target,
  response: Clock3,
  enquiries: Inbox,
  deals: BriefcaseBusiness,
} as const;

const ICON_TINT: Record<SalesKpiItem["icon"], string> = {
  followups: "bg-sales-warning-soft text-sales-warning-fg",
  pipeline: "bg-sales-success-soft text-sales-success-fg",
  won: "bg-sales-brand-soft-solid text-sales-brand-fg",
  conversion: "bg-sales-info-soft text-sales-info-fg",
  response: "bg-sales-neutral-100 text-sales-text-secondary",
  enquiries: "bg-sales-info-soft text-sales-info-fg",
  deals: "bg-sales-teal-soft text-sales-teal-fg",
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

export function KpiStat({ item }: { item: SalesKpiItem }) {
  const Icon = ICON_MAP[item.icon];
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[12px] font-medium leading-snug text-sales-text-secondary">
          {item.label}
        </p>
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-sales-sm sm:h-8 sm:w-8",
            ICON_TINT[item.icon]
          )}
        >
          <Icon size={16} strokeWidth={1.8} aria-hidden className="sm:size-[18px]" />
        </span>
      </div>
      <div className="min-w-0">
        <MetricValue value={item.value} />
        <div className="mt-2 min-h-[18px]">
          {item.trend ? (
            <Trend direction={item.trend.direction} label={item.trend.label} />
          ) : (
            <p className="truncate text-[12px] text-sales-text-muted">{item.supporting}</p>
          )}
        </div>
      </div>
    </>
  );

  const className =
    "sd-card group flex h-full min-h-[104px] min-w-0 flex-col justify-between p-3.5 transition-[border-color,box-shadow] duration-150 sm:min-h-[120px] sm:p-4";

  if (item.href) {
    return (
      <Link
        href={item.href}
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

  return <article className={className}>{body}</article>;
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
