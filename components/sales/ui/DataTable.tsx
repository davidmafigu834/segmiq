"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";
import { EmptyState } from "./Feedback";

export function DataTable({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-sales-lg border border-sales-border bg-sales-surface shadow-sales-card",
        className
      )}
    >
      <div className="overflow-x-auto">{children}</div>
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
        "bg-sales-surface-subtle text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted",
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
        "h-14 transition-colors duration-150 hover:bg-sales-surface-hover",
        selected ? "bg-sales-surface-active" : "",
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
  return <th className={cn("px-4 py-3 font-medium", className)} {...props} />;
}

export function DataTableTd({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3 text-[13px] text-sales-text-primary", className)} {...props} />;
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
