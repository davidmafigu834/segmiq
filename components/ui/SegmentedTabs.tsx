import { cn } from "@/lib/ui/cn";

export type SegmentedTab = {
  value: string;
  label: React.ReactNode;
};

export interface SegmentedTabsProps {
  tabs: SegmentedTab[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  "aria-label"?: string;
}

/** Vercel-style segmented control (Recents / Usage / Alerts). */
export function SegmentedTabs({
  tabs,
  value,
  onValueChange,
  className,
  "aria-label": ariaLabel,
}: SegmentedTabsProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] p-1",
        className
      )}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(tab.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]/40",
              active
                ? "bg-[var(--surface-card)] text-[var(--text-primary)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
