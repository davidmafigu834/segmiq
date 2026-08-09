"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export function ReportCard({
  title,
  description,
  action,
  footer,
  className,
  /** Only for equal-height sibling rows (e.g. secondary trio). Default: natural height. */
  equalHeight = false,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  footer?: ReactNode;
  className?: string;
  equalHeight?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-sales-xl border border-sales-border bg-sales-surface shadow-sales-card",
        equalHeight ? "h-full" : "h-auto",
        className
      )}
    >
      <header className="flex shrink-0 items-start justify-between gap-3 px-4 py-3 sm:px-[16px]">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-sales-text-primary">
            {title}
          </h3>
          {description ? (
            <p className="mt-0.5 text-[12px] text-sales-text-secondary">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className={cn("px-4 pb-3 sm:px-[16px]", equalHeight && "min-h-0 flex-1")}>
        {children}
      </div>
      {footer ? (
        <footer className="shrink-0 border-t border-sales-border-subtle px-4 py-3 sm:px-[16px]">
          {footer}
        </footer>
      ) : null}
    </section>
  );
}
