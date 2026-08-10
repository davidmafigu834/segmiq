import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

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
}: {
  tone?: AlertTone;
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "flex flex-col gap-3 rounded-sales-lg border border-l-[3px] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4",
        toneClass[tone],
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sales-surface text-sales-text-primary">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-sales-text-primary">{title}</p>
          {children ? (
            <div className="mt-0.5 break-words text-[13px] text-sales-text-secondary">
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
      className={cn(
        "animate-pulse rounded-sales-md bg-[var(--sales-skeleton-base,var(--sales-border))] opacity-80",
        className
      )}
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
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  size?: "compact" | "standard" | "large";
  className?: string;
}) {
  const pad =
    size === "compact" ? "py-8" : size === "large" ? "py-12 sm:py-16" : "py-10 sm:py-12";
  return (
    <div className={cn("flex flex-col items-center justify-center px-4 text-center sm:px-5", pad, className)}>
      {icon ? (
        <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-sales-md bg-sales-neutral-100 text-sales-text-muted">
          {icon}
        </span>
      ) : null}
      <p className="text-balance text-[14px] font-semibold text-sales-text-primary">{title}</p>
      {description ? (
        <p className="mt-1 max-w-[320px] text-pretty text-[13px] text-sales-text-secondary">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Progress({
  value,
  className,
  tone = "brand",
}: {
  value: number;
  className?: string;
  tone?: "brand" | "success" | "warning" | "danger" | "info";
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
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-[var(--sales-chart-track,var(--sales-border-subtle))]",
        className
      )}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-150", fill[tone])} style={{ width: `${pct}%` }} />
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
