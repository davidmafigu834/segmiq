"use client";

import type { InboxFilter } from "@/lib/inbox/types";
import { INBOX_FILTER_LABELS, INBOX_FILTER_ORDER } from "@/lib/inbox/queue-filters";

type Props = {
  filter: InboxFilter;
  counts: Record<InboxFilter, number>;
  onChange: (f: InboxFilter) => void;
  whatsappMode?: boolean;
  variant?: "default" | "header" | "panel";
};

export function FilterTabs({ filter, counts, onChange, whatsappMode = false, variant = "default" }: Props) {
  const tabs = INBOX_FILTER_ORDER.map((key) => ({
    key,
    label: INBOX_FILTER_LABELS[key],
  }));

  const resolvedVariant = variant !== "default" ? variant : whatsappMode ? "header" : "default";

  return (
    <div className="flex min-w-max items-center gap-1.5" role="tablist" aria-label="Conversation filters">
      {tabs.map((tab) => {
        const active = filter === tab.key;
        const count = counts[tab.key] ?? 0;
        if (count === 0 && tab.key !== "all" && tab.key !== "mine") {
          return null;
        }

        let className = "flex items-center gap-1.5 whitespace-nowrap transition-colors duration-150";

        if (resolvedVariant === "panel") {
          className += active ? " wa-filter-pill-active" : " wa-filter-pill";
        } else {
          className += " rounded-full px-2.5 py-1 text-[11px] font-medium";
          if (resolvedVariant === "header") {
            className += active
              ? " bg-white/20 text-white"
              : " text-white/70 hover:bg-white/10 hover:text-white";
          } else {
            className += active
              ? " bg-[var(--accent)] text-[var(--accent-foreground)]"
              : " text-[var(--text-tertiary)] hover:text-[var(--text-primary)]";
          }
        }

        const countBadgeClass =
          resolvedVariant === "panel"
            ? active
              ? "bg-white/70 text-[#101828]"
              : "bg-[#F2F4F7] text-[#667085]"
            : active
              ? "bg-[var(--bg-quaternary)] text-[var(--text-primary)]"
              : "bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]";

        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            className={className}
          >
            {tab.key === "hot" ? (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#EF4444]" aria-hidden />
            ) : null}
            {tab.label}
            <span
              className={`inline-flex min-w-[18px] items-center justify-center rounded-md px-1 text-[10px] font-semibold tabular-nums ${countBadgeClass}`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
