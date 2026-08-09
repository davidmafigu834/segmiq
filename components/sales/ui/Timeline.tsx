"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export type TimelineItem = {
  id: string;
  title: string;
  description?: string | null;
  timeLabel: string;
  tone?: "neutral" | "brand" | "success" | "warning" | "danger";
  icon?: ReactNode;
};

const nodeTone: Record<NonNullable<TimelineItem["tone"]>, string> = {
  neutral: "bg-sales-border-strong",
  brand: "bg-sales-brand ring-2 ring-sales-brand-soft",
  success: "bg-sales-success",
  warning: "bg-sales-warning",
  danger: "bg-sales-danger",
};

export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <ol className={cn("relative space-y-0", className)}>
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!last ? (
              <span
                className="absolute left-[5px] top-3 bottom-0 w-px bg-sales-border-subtle"
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                "relative z-[1] mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                nodeTone[item.tone ?? "neutral"]
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[13px] font-semibold text-sales-text-primary">{item.title}</p>
                <p className="shrink-0 text-[11px] text-sales-text-muted">{item.timeLabel}</p>
              </div>
              {item.description ? (
                <p className="mt-0.5 text-[12px] text-sales-text-secondary">{item.description}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function ActivityRow({
  icon,
  title,
  detail,
  timeLabel,
  href,
}: {
  icon?: ReactNode;
  title: string;
  detail?: string | null;
  timeLabel: string;
  href?: string;
}) {
  const body = (
    <div className="flex items-start gap-3 px-5 py-3 transition-colors duration-150 hover:bg-sales-surface-hover">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sales-sm bg-[var(--sales-neutral-100)]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-sales-text-primary">{title}</p>
        {detail ? (
          <p className="mt-0.5 truncate text-[12px] text-sales-text-secondary">{detail}</p>
        ) : null}
        <p className="mt-1 text-[11px] text-sales-text-muted">{timeLabel}</p>
      </div>
    </div>
  );
  if (href) {
    return (
      <a href={href} className="block focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]">
        {body}
      </a>
    );
  }
  return body;
}

export function Milestone({
  steps,
  currentIndex,
  className,
}: {
  steps: string[];
  currentIndex: number;
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-wrap items-center gap-1", className)}>
      {steps.map((label, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        return (
          <li key={label} className="flex items-center gap-1">
            {i > 0 ? <span className="mx-1 h-px w-4 bg-sales-border" aria-hidden /> : null}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-[12px]",
                current
                  ? "font-semibold text-sales-text-primary"
                  : done
                    ? "font-medium text-sales-success"
                    : "text-sales-text-muted"
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  current
                    ? "bg-sales-brand ring-2 ring-sales-brand-soft"
                    : done
                      ? "bg-sales-success"
                      : "bg-sales-border-strong"
                )}
                aria-hidden
              />
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
