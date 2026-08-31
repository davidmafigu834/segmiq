import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/ui/cn";

export function FilterPill({
  label,
  value,
  valueClassName,
  icon,
  onRemove,
  removeLabel,
  className,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
  icon?: ReactNode;
  onRemove?: () => void;
  /** Accessible label for remove control, e.g. "Remove Stage: Negotiating filter" */
  removeLabel?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-8 max-w-full items-center gap-1.5 rounded-[8px] border border-[var(--sales-filter-pill-border,#d0d5dd)]",
        "bg-[var(--sales-filter-pill-bg,#f5f7fc)] px-2.5 text-[12px] text-sales-text-secondary",
        className
      )}
    >
      {icon ? (
        <span className="inline-flex shrink-0 items-center [&_svg]:size-3.5" aria-hidden>
          {icon}
        </span>
      ) : null}
      <span className="truncate">
        <span className="text-sales-text-muted">{label}:</span>{" "}
        <span className={cn("font-medium text-sales-text-primary", valueClassName)}>{value}</span>
      </span>
      {onRemove ? (
        <button
          type="button"
          className={cn(
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] text-sales-text-muted",
            "transition-colors hover:bg-[var(--sales-table-hover,rgba(16,24,40,0.04))] hover:text-sales-text-primary",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--sales-focus-outline)]"
          )}
          aria-label={removeLabel ?? `Remove ${label} filter`}
          onClick={onRemove}
        >
          <X size={13} strokeWidth={1.8} aria-hidden />
        </button>
      ) : null}
    </span>
  );
}

export function ActiveFiltersBar({
  children,
  onClearAll,
  showClearAll = true,
  className,
}: {
  children: ReactNode;
  onClearAll?: () => void;
  showClearAll?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {children}
      {showClearAll && onClearAll ? (
        <button
          type="button"
          className="text-[12px] font-semibold text-sales-text-secondary transition-colors hover:text-sales-text-primary"
          onClick={onClearAll}
        >
          Clear all
        </button>
      ) : null}
    </div>
  );
}
