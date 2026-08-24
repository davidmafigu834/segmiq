"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";
import { EmptyState } from "./Feedback";

export function DataTable({
  children,
  className,
  scrollClassName,
}: {
  children: ReactNode;
  className?: string;
  scrollClassName?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-sales-lg border border-sales-border bg-sales-surface shadow-sales-card",
        className
      )}
    >
      <div
        className={cn("overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]", scrollClassName)}
      >
        {children}
      </div>
    </div>
  );
}

export function DataTableEl({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn("w-full min-w-0 border-collapse text-left", className)}
      {...props}
    />
  );
}

export function DataTableHead({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "border-b border-sales-border-subtle bg-sales-surface-subtle text-[10px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted",
        className
      )}
      {...props}
    />
  );
}

export function DataTableBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-sales-border-subtle", className)} {...props} />;
}

export function DataTableRow({
  className,
  selected,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { selected?: boolean }) {
  return (
    <tr
      className={cn(
        "h-[52px] transition-colors duration-150 hover:bg-sales-surface-hover sm:h-14",
        selected ? "bg-sales-brand-soft" : "",
        className
      )}
      {...props}
    />
  );
}

export function DataTableTh({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("whitespace-nowrap px-3 py-3 font-medium sm:px-4", className)} {...props} />;
}

export function DataTableTd({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("px-3 py-3 text-[13px] text-sales-text-primary sm:px-4", className)}
      {...props}
    />
  );
}

export function DataTableEmpty({
  colSpan,
  title,
  description,
}: {
  colSpan: number;
  title: string;
  description?: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <EmptyState title={title} description={description} size="compact" />
      </td>
    </tr>
  );
}
