import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/ui/cn";
import { StateLayout, type StateAlign, type StateSize } from "./state-layout";

export type AlertTone = "info" | "warning" | "danger" | "success" | "brand";

const toneClass: Record<AlertTone, string> = {
  info: "border-sales-border bg-sales-info-soft border-l-sales-info",
  warning: "border-sales-border bg-sales-warning-soft border-l-sales-warning",
  danger: "border-sales-border bg-sales-danger-soft border-l-sales-danger",
  success: "border-sales-border bg-sales-success-soft border-l-sales-success",
  brand: "border-sales-border bg-sales-brand-soft border-l-sales-brand",
};

export function Alert({
  tone = "info",
  icon,
  title,
  children,
  action,
  className,
  compact = false,
}: {
  tone?: AlertTone;
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** Single-line contextual banners (~40–44px). */
  compact?: boolean;
}) {
  return (
    <aside
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex flex-col gap-3 rounded-[10px] border border-l-[3px] px-4 sm:flex-row sm:items-center sm:justify-between",
        compact ? "min-h-[40px] py-2.5 sm:py-2.5" : "px-4 py-3 sm:px-5 sm:py-3.5",
        toneClass[tone],
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-sales-surface text-sales-text-primary">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-snug text-sales-text-primary sm:text-[14px]">
            {title}
          </p>
          {children ? (
            <div className="mt-0.5 break-words text-[12px] text-sales-text-secondary sm:text-[13px]">
              {children}
            </div>
          ) : null}
        </div>
      </div>
      {action ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{action}</div>
      ) : null}
    </aside>
  );
}

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("sales-skeleton rounded-sales-md", className)}
      aria-hidden
      {...props}
    />
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  size = "standard",
  align = "center",
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  size?: StateSize;
  align?: StateAlign;
  className?: string;
}) {
  return (
    <StateLayout
      icon={icon}
      title={title}
      description={description}
      actions={action}
      tone="neutral"
      size={size}
      align={align}
      className={className}
    />
  );
}

export function Progress({
  value,
  className,
  tone = "brand",
  label,
  showValue = false,
}: {
  value: number;
  className?: string;
  tone?: "brand" | "success" | "warning" | "danger" | "info";
  label?: string;
  showValue?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const fill: Record<string, string> = {
    brand: "bg-sales-brand",
    success: "bg-sales-success",
    warning: "bg-sales-warning",
    danger: "bg-sales-danger",
    info: "bg-sales-info",
  };
  return (
    <div className={className}>
      {label || showValue ? (
        <div className="mb-1.5 flex items-center justify-between gap-3">
          {label ? (
            <span className="text-[12px] font-medium text-sales-text-secondary">{label}</span>
          ) : (
            <span />
          )}
          {showValue ? (
            <span className="text-[12px] font-semibold tabular-nums text-sales-text-primary">
              {pct}%
            </span>
          ) : null}
        </div>
      ) : null}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-[var(--sales-chart-track,var(--sales-border-subtle))]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-300 ease-out", fill[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizes = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-7 w-7 text-[11px]",
    md: "h-9 w-9 text-[12px]",
    lg: "h-11 w-11 text-[13px]",
    xl: "h-[52px] w-[52px] text-[14px]",
  } as const;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials =
    parts.length === 0
      ? "?"
      : parts.length === 1
        ? parts[0]!.slice(0, 2).toUpperCase()
        : `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={cn("rounded-full object-cover ring-1 ring-sales-border", sizes[size], className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-[var(--sales-neutral-100)] font-semibold text-sales-text-primary ring-1 ring-sales-border",
        sizes[size],
        className
      )}
      aria-hidden
    >
      {initials}
    </div>
  );
}
