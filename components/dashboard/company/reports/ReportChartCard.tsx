"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export function ReportChartCard({
  title,
  legend,
  action,
  children,
  className,
  bodyClassName,
  error,
  onRetry,
}: {
  title: string;
  legend?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  error?: string | null;
  onRetry?: () => void;
}) {
  return (
    <section
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface shadow-sales-card",
        className
      )}
    >
      <header className="flex shrink-0 items-start justify-between gap-3 px-4 pb-1 pt-4 sm:px-[18px] sm:pt-[16px]">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold leading-snug text-sales-text-primary">{title}</h2>
          {legend ? <div className="mt-1.5">{legend}</div> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className={cn("min-h-0 flex-1 px-4 pb-4 pt-2 sm:px-[18px] sm:pb-[16px]", bodyClassName)}>
        {error ? (
          <div className="flex h-full min-h-[160px] flex-col items-center justify-center text-center">
            <p className="text-[13px] font-medium text-sales-text-primary">{error}</p>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-2 text-[12px] font-semibold text-sales-brand-fg hover:underline"
              >
                Retry
              </button>
            ) : null}
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
