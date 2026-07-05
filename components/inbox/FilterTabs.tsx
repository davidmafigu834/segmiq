"use client";

import type { InboxFilter } from "@/lib/inbox/types";
import { Flame } from "lucide-react";

type Props = {
  filter: InboxFilter;
  counts: Record<InboxFilter, number>;
  onChange: (f: InboxFilter) => void;
};

export function FilterTabs({ filter, counts, onChange }: Props) {
  const tabs: { key: InboxFilter; label: string; icon?: React.ReactNode }[] = [
    { key: "all", label: "All" },
    { key: "unassigned", label: "Unassigned" },
    { key: "mine", label: "Mine" },
    {
      key: "hot",
      label: "Hot",
      icon: <Flame size={14} className="shrink-0" />,
    },
  ];

  return (
    <div className="flex items-center gap-2">
      {tabs.map((tab) => {
        const active = filter === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              active
                ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {tab.icon}
            {tab.label}
            <span className="opacity-60">· {counts[tab.key]}</span>
          </button>
        );
      })}
    </div>
  );
}
