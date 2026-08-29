import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export function WorkspacePageTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 layout:flex-row layout:items-start layout:justify-between">
      <div className="min-w-0">
        <h1 className="dashboard-greeting text-[22px] leading-tight text-sales-text-primary sm:text-[24px] layout:text-[26px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-[42rem] text-[13px] leading-snug text-sales-text-secondary sm:mt-1.5 sm:text-[14px]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function WorkspaceUnderlineTabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: Array<{ id: T; label: string; count?: number }>;
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div
      className="scrollbar-hide flex gap-4 overflow-x-auto overscroll-x-contain border-b border-sales-border-subtle px-4 sm:px-5"
      role="tablist"
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              "relative h-11 shrink-0 whitespace-nowrap text-[13px] transition-colors duration-150",
              active
                ? "font-semibold text-sales-text-primary"
                : "font-medium text-sales-text-secondary hover:text-sales-text-primary"
            )}
          >
            {item.label}
            {item.count != null ? (
              <span className="ml-1.5 tabular-nums text-sales-text-muted">{item.count}</span>
            ) : null}
            {active ? (
              <span className="absolute inset-x-0 -bottom-px h-[3px] bg-sales-brand" aria-hidden />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
