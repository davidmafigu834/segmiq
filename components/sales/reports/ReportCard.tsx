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
        "sd-card flex flex-col overflow-hidden border-sales-border-subtle",
        equalHeight ? "h-full" : "h-auto",
        className
      )}
    >
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-sales-border-subtle px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-sales-text-primary">
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
