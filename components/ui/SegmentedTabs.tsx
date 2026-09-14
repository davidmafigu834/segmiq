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
            tabIndex={active ? 0 : -1}
            onClick={() => onValueChange(tab.value)}
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const currentIndex = tabs.findIndex((item) => item.value === tab.value);
              const nextIndex =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? tabs.length - 1
                    : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
              onValueChange(tabs[nextIndex]!.value);
              const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
              buttons?.[nextIndex]?.focus({ preventScroll: true });
            }}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] active:translate-y-px",
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
