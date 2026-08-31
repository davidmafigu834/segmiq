"use client";

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode, ThHTMLAttributes } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { EmptyState } from "./Feedback";
import { IconButton } from "./Button";

export type DataTableSortDirection = "asc" | "desc" | "none";
export type DataTableRowDensity = "default" | "comfortable";

const tableShellClass =
  "overflow-hidden rounded-sales-lg border border-sales-border bg-sales-surface shadow-sales-card";

const rowHeightClass: Record<DataTableRowDensity, string> = {
  default: "h-[var(--sales-table-row-height,52px)]",
  comfortable: "h-[var(--sales-table-row-height-comfortable,56px)]",
};

/** One bordered table workspace — tabs, toolbar, table, and footer live inside. */
export function DataTableWorkspace({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(tableShellClass, "flex min-w-0 flex-col", className)}>
      {children}
    </section>
  );
}

/** Underline tab strip inside the table workspace. */
export function DataTableTabsBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "scrollbar-hide flex gap-4 overflow-x-auto overscroll-x-contain border-b border-[var(--sales-table-divider)] px-4 sm:px-4",
        className
      )}
      role="tablist"
    >
      {children}
    </div>
  );
}

/** Toolbar row inside the table card — search, filters, sort, actions. */
export function DataTableToolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[var(--sales-table-toolbar-min-height,56px)] flex-col gap-2 border-b border-[var(--sales-table-divider)] px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
        className
      )}
    >
      {children}
    </div>
  );
}

export function DataTableToolbarGroup({
  children,
  align = "start",
  className,
}: {
  children: ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-2",
        align === "end" ? "sm:ml-auto sm:justify-end" : "",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Scrollable table region inside the workspace. */
export function DataTableScroll({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Bordered shell for standalone table demos or nested table regions. */
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
    <div className={cn(tableShellClass, className)}>
      <DataTableScroll className={scrollClassName}>{children}</DataTableScroll>
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
        "border-b border-[var(--sales-table-divider)] bg-[var(--sales-table-header-bg)] text-[10px] font-semibold uppercase tracking-[0.07em] text-sales-text-muted",
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
  return (
    <tbody
      className={cn("[&>tr+tr]:border-t [&>tr+tr]:border-[var(--sales-table-divider)]", className)}
      {...props}
    />
  );
}

export function DataTableRow({
  className,
  selected,
  clickable,
  hoverable,
  density = "default",
  showSelectedMarker = false,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & {
  selected?: boolean;
  /** Adds pointer cursor when the row opens detail / navigates. */
  clickable?: boolean;
  /** Subtle hover wash. Defaults to true when clickable. */
  hoverable?: boolean;
  density?: DataTableRowDensity;
  /** Optional 2px left brand marker when selected. */
  showSelectedMarker?: boolean;
}) {
  const canHover = hoverable ?? clickable ?? false;

  return (
    <tr
      className={cn(
        rowHeightClass[density],
        "transition-colors duration-150",
        canHover && "hover:bg-[var(--sales-table-hover)]",
        clickable && "cursor-pointer",
        selected && "bg-[var(--sales-table-selected)] hover:bg-[var(--sales-table-selected)]",
        selected &&
          showSelectedMarker &&
          "shadow-[inset_2px_0_0_0_var(--sales-table-selected-marker)]",
        clickable &&
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--sales-focus-outline)]",
        className
      )}
      {...props}
    />
  );
}

export function DataTableTh({
  className,
  compact,
  align = "left",
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & {
  compact?: boolean;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      scope="col"
      className={cn(
        "h-[var(--sales-table-header-height,44px)] whitespace-nowrap px-[var(--sales-table-cell-x,16px)] py-0 font-semibold align-middle",
        compact && "px-[var(--sales-table-cell-x-compact,12px)]",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className
      )}
      {...props}
    />
  );
}

export function DataTableSortableTh({
  label,
  sortDirection = "none",
  onSort,
  align = "left",
  compact,
  className,
}: {
  label: string;
  sortDirection?: DataTableSortDirection;
  onSort?: () => void;
  align?: "left" | "right" | "center";
  compact?: boolean;
  className?: string;
}) {
  const active = sortDirection === "asc" || sortDirection === "desc";
  const Icon =
    sortDirection === "asc" ? ArrowUp : sortDirection === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <DataTableTh compact={compact} align={align} className={className}>
      <button
        type="button"
        onClick={onSort}
        aria-label={`Sort by ${label}`}
        aria-sort={
          sortDirection === "asc"
            ? "ascending"
            : sortDirection === "desc"
              ? "descending"
              : "none"
        }
        className={cn(
          "inline-flex items-center gap-1.5 rounded-[6px] transition-colors",
          "hover:text-sales-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sales-focus-outline)]",
          active ? "text-sales-text-primary" : "text-sales-text-muted"
        )}
      >
        <span>{label}</span>
        <Icon
          size={13}
          strokeWidth={1.8}
          className={cn(
            "shrink-0",
            sortDirection === "none" ? "opacity-45" : "text-sales-brand-fg"
          )}
          aria-hidden
        />
      </button>
    </DataTableTh>
  );
}

export function DataTableTd({
  className,
  compact,
  align = "left",
  numeric,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & {
  compact?: boolean;
  align?: "left" | "right" | "center";
  numeric?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-[var(--sales-table-cell-x,16px)] py-0 text-[13px] text-sales-text-primary align-middle",
        compact && "px-[var(--sales-table-cell-x-compact,12px)]",
        (align === "right" || numeric) && "text-right tabular-nums",
        align === "center" && "text-center",
        className
      )}
      {...props}
    />
  );
}

/** Checkbox column — stops row click propagation. */
export function DataTableCheckboxCell({
  children,
  className,
  compact,
}: {
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <DataTableTd
      compact={compact}
      className={cn("w-11", className)}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </DataTableTd>
  );
}

/** Fixed-width actions column — stops row click propagation. */
export function DataTableActionsCell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <DataTableTd
      className={cn("w-12", className)}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </DataTableTd>
  );
}

export function DataTableEmpty({
  colSpan,
  title,
  description,
  action,
}: {
  colSpan: number;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <EmptyState title={title} description={description} action={action} size="compact" />
      </td>
    </tr>
  );
}

/** Full-height empty region when the table body is replaced (filters/search/no rows). */
export function DataTableEmptyPanel({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-1 items-center justify-center px-4 py-12 sm:px-5", className)}>
      <EmptyState title={title} description={description} action={action} />
    </div>
  );
}

export function DataTableSkeleton({
  columns,
  rows = 6,
  density = "default",
}: {
  columns: number;
  rows?: number;
  density?: DataTableRowDensity;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <DataTableRow key={rowIndex} density={density}>
          {Array.from({ length: columns }).map((__, colIndex) => (
            <DataTableTd key={colIndex}>
              <div className="h-4 w-full max-w-[140px] animate-pulse rounded-[6px] bg-[var(--sales-table-divider)]" />
            </DataTableTd>
          ))}
        </DataTableRow>
      ))}
    </>
  );
}

/** Mobile stacked records inside the same table workspace. */
export function DataTableMobileList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "divide-y divide-[var(--sales-table-divider)] lg:hidden",
        className
      )}
    >
      {children}
    </div>
  );
}

export function DataTableMobileItem({
  selected,
  onClick,
  className,
  children,
  ...props
}: {
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "className" | "type">) {
  const classes = cn(
    "w-full p-4 text-left transition-colors hover:bg-[var(--sales-table-hover)]",
    selected && "bg-[var(--sales-table-selected)] hover:bg-[var(--sales-table-selected)]",
    className
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes} {...props}>
        {children}
      </button>
    );
  }

  return <div className={classes}>{children}</div>;
}

export function DataTableFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mt-auto flex min-h-[var(--sales-table-footer-min-height,52px)] flex-col gap-3 border-t border-[var(--sales-table-divider)] px-4 py-3 text-[11px] text-sales-text-muted sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      {children}
    </div>
  );
}

function pageNumbers(page: number, pageCount: number, max = 5): (number | "ellipsis")[] {
  if (pageCount <= max) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const items: (number | "ellipsis")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);

  if (start > 2) items.push("ellipsis");
  for (let value = start; value <= end; value += 1) items.push(value);
  if (end < pageCount - 1) items.push("ellipsis");
  items.push(pageCount);

  return items;
}

export function DataTablePagination({
  page,
  pageCount,
  onPageChange,
  summary,
  pageSizeControl,
  compactOnMobile = true,
  className,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  summary?: ReactNode;
  pageSizeControl?: ReactNode;
  compactOnMobile?: boolean;
  className?: string;
}) {
  const items = pageNumbers(page, pageCount);

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      {summary ? <div className="text-[12px] text-sales-text-muted">{summary}</div> : null}
      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
        <div
          className={cn(
            "flex items-center gap-1",
            compactOnMobile && pageCount > 3 ? "hidden sm:flex" : "flex"
          )}
        >
          <IconButton
            aria-label="Previous page"
            size="sm"
            disabled={page <= 1}
            icon={<ChevronLeft strokeWidth={1.8} />}
            onClick={() => onPageChange(page - 1)}
            className="!h-8 !w-8 !rounded-[8px] border border-sales-border text-sales-text-secondary disabled:opacity-35"
          />
          {items.map((item, index) =>
            item === "ellipsis" ? (
              <span key={`ellipsis-${index}`} className="px-1 text-sales-text-muted" aria-hidden>
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                aria-label={`Page ${item}`}
                aria-current={item === page ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 min-w-8 items-center justify-center rounded-[8px] border px-2 text-[12px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sales-focus-outline)]",
                  item === page
                    ? "border-[var(--sales-table-pagination-active-bg)] bg-[var(--sales-table-pagination-active-bg)] text-[var(--sales-table-pagination-active-fg)]"
                    : "border-sales-border bg-sales-surface text-sales-text-secondary hover:bg-[var(--sales-table-hover)]"
                )}
                onClick={() => onPageChange(item)}
              >
                {item}
              </button>
            )
          )}
          <IconButton
            aria-label="Next page"
            size="sm"
            disabled={page >= pageCount}
            icon={<ChevronRight strokeWidth={1.8} />}
            onClick={() => onPageChange(page + 1)}
            className="!h-8 !w-8 !rounded-[8px] border border-sales-border text-sales-text-secondary disabled:opacity-35"
          />
        </div>

        {compactOnMobile && pageCount > 1 ? (
          <div className="flex w-full items-center justify-between gap-3 sm:hidden">
            <IconButton
              aria-label="Previous page"
              size="sm"
              disabled={page <= 1}
              icon={<ChevronLeft strokeWidth={1.8} />}
              onClick={() => onPageChange(page - 1)}
              className="!h-8 !w-8 !rounded-[8px] border border-sales-border"
            />
            <span className="text-[12px] text-sales-text-secondary">
              Page {page} of {pageCount}
            </span>
            <IconButton
              aria-label="Next page"
              size="sm"
              disabled={page >= pageCount}
              icon={<ChevronRight strokeWidth={1.8} />}
              onClick={() => onPageChange(page + 1)}
              className="!h-8 !w-8 !rounded-[8px] border border-sales-border"
            />
          </div>
        ) : null}

        {pageSizeControl}
      </div>
    </div>
  );
}

export function DataTablePageSizeButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 min-w-8 items-center justify-center rounded-[8px] border border-sales-border bg-sales-surface px-2 text-[12px] font-medium text-sales-text-secondary transition-colors hover:bg-[var(--sales-table-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sales-focus-outline)] disabled:opacity-35",
        className
      )}
      {...props}
    />
  );
}