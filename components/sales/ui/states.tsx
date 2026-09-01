import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Filter,
  Info,
  Search,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { Button } from "./Button";
import { StateLayout, statePadClass, truncateStateQuery, type StateAlign, type StateSize } from "./state-layout";

export function FilteredEmptyState({
  icon,
  title,
  description,
  searchQuery,
  onClearFilters,
  onClearSearch,
  clearFiltersLabel = "Clear filters",
  clearSearchLabel = "Clear search",
  action,
  size = "standard",
  align = "center",
  className,
}: {
  icon?: ReactNode;
  title?: string;
  description?: string;
  searchQuery?: string;
  onClearFilters?: () => void;
  onClearSearch?: () => void;
  clearFiltersLabel?: string;
  clearSearchLabel?: string;
  action?: ReactNode;
  size?: StateSize;
  align?: StateAlign;
  className?: string;
}) {
  const trimmedQuery = searchQuery?.trim();
  const resolvedTitle =
    title ??
    (trimmedQuery
      ? `No results for “${truncateStateQuery(trimmedQuery)}”`
      : "No results found");
  const resolvedDescription =
    description ??
    (trimmedQuery
      ? "Try another search term or clear your search."
      : "Try changing your filters or search terms.");

  const defaultIcon = trimmedQuery ? (
    <Search size={20} strokeWidth={1.8} />
  ) : (
    <Filter size={20} strokeWidth={1.8} />
  );

  const actions = (
    <>
      {onClearSearch && trimmedQuery ? (
        <Button variant="secondary" size="sm" onClick={onClearSearch}>
          {clearSearchLabel}
        </Button>
      ) : null}
      {onClearFilters ? (
        <Button variant="secondary" size="sm" onClick={onClearFilters}>
          {clearFiltersLabel}
        </Button>
      ) : null}
      {action}
    </>
  );

  const hasActions = Boolean(onClearFilters || (onClearSearch && trimmedQuery) || action);

  return (
    <StateLayout
      icon={icon ?? defaultIcon}
      title={resolvedTitle}
      description={resolvedDescription}
      actions={hasActions ? actions : undefined}
      tone="info"
      size={size}
      align={align}
      className={className}
    />
  );
}

export function ErrorState({
  icon,
  title,
  description,
  retryLabel = "Try again",
  onRetry,
  retryLoading = false,
  secondaryAction,
  size = "standard",
  align = "center",
  compactIcon = false,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
  retryLoading?: boolean;
  secondaryAction?: ReactNode;
  size?: StateSize;
  align?: StateAlign;
  /** Smaller icon well for chart/table embeds */
  compactIcon?: boolean;
  className?: string;
}) {
  const actions = (
    <>
      {onRetry ? (
        <Button variant="primary" size="sm" loading={retryLoading} onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
      {secondaryAction}
    </>
  );

  return (
    <StateLayout
      icon={
        icon ?? (
          <AlertTriangle
            size={compactIcon ? 18 : 20}
            strokeWidth={1.8}
            className={compactIcon ? "h-[18px] w-[18px]" : undefined}
          />
        )
      }
      title={title}
      description={description}
      actions={onRetry || secondaryAction ? actions : undefined}
      tone="danger"
      size={size}
      align={align}
      role="alert"
      className={className}
    />
  );
}

export function LoadingState({
  label,
  skeleton,
  size = "standard",
  className,
}: {
  label?: string;
  skeleton?: ReactNode;
  size?: StateSize;
  className?: string;
}) {
  if (skeleton) {
    return (
      <div className={cn(className)} aria-busy="true">
        {skeleton}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center",
        statePadClass[size],
        className
      )}
      aria-busy="true"
      role="status"
    >
      {label ? (
        <p className="text-[13px] text-sales-text-secondary">{label}</p>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  );
}

export function SuccessState({
  icon,
  title,
  description,
  action,
  size = "standard",
  align = "center",
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  size?: StateSize;
  align?: StateAlign;
  className?: string;
}) {
  return (
    <StateLayout
      icon={icon ?? <CheckCircle2 size={20} strokeWidth={1.8} />}
      title={title}
      description={description}
      actions={action}
      tone="success"
      size={size}
      align={align}
      role="status"
      className={className}
    />
  );
}

export function InfoState({
  variant = "default",
  icon,
  title,
  description,
  action,
  size = "standard",
  align = "center",
  className,
}: {
  variant?: "default" | "setup";
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  size?: StateSize;
  align?: StateAlign;
  className?: string;
}) {
  const defaultIcon =
    variant === "setup" ? (
      <Settings2 size={20} strokeWidth={1.8} />
    ) : (
      <Info size={20} strokeWidth={1.8} />
    );

  return (
    <StateLayout
      icon={icon ?? defaultIcon}
      title={title}
      description={description}
      actions={action}
      tone="info"
      size={size}
      align={align}
      className={className}
    />
  );
}
