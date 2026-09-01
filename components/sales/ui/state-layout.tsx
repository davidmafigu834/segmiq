import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export type StateTone = "neutral" | "info" | "danger" | "success";
export type StateSize = "compact" | "standard" | "large";
export type StateAlign = "center" | "start";

export const statePadClass: Record<StateSize, string> = {
  compact: "py-8 px-4 sm:px-6",
  standard: "py-10 px-6 sm:px-6",
  large: "py-12 px-6 sm:py-16 sm:px-6",
};

const iconWellClass: Record<StateTone, string> = {
  neutral: "bg-sales-neutral-100 text-sales-text-muted",
  info: "bg-sales-info-soft text-sales-info-fg",
  danger: "bg-sales-danger-soft text-sales-danger",
  success: "bg-sales-success-soft text-sales-success-fg",
};

/** Internal layout primitive for SegmiQ state components — not exported publicly. */
export function StateLayout({
  icon,
  title,
  description,
  actions,
  tone = "neutral",
  size = "standard",
  align = "center",
  role,
  ariaBusy,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
  tone?: StateTone;
  size?: StateSize;
  align?: StateAlign;
  role?: "status" | "alert";
  ariaBusy?: boolean;
  className?: string;
}) {
  const centered = align === "center";

  return (
    <div
      className={cn(
        "flex flex-col",
        centered ? "items-center text-center" : "items-start text-left",
        statePadClass[size],
        className
      )}
      role={role}
      aria-busy={ariaBusy || undefined}
    >
      <div
        className={cn(
          "flex w-full max-w-[440px] flex-col",
          centered ? "items-center" : "items-start"
        )}
      >
        {icon ? (
          <span
            className={cn(
              "mb-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
              iconWellClass[tone]
            )}
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
        <p
          className={cn(
            "text-balance font-semibold text-sales-text-primary",
            size === "large" ? "text-[18px]" : "text-[16px]"
          )}
        >
          {title}
        </p>
        {description ? (
          <p
            className={cn(
              "mt-1.5 text-pretty text-[13px] leading-[1.55] text-sales-text-secondary",
              centered ? "max-w-[420px]" : "max-w-[440px]"
            )}
          >
            {description}
          </p>
        ) : null}
        {actions ? (
          <div
            className={cn(
              "mt-4 flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap",
              centered ? "sm:justify-center" : "sm:justify-start"
            )}
          >
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function truncateStateQuery(query: string, max = 48): string {
  const trimmed = query.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}
