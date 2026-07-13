"use client";

import type { InboxFilter } from "@/lib/inbox/types";
import { Flame } from "lucide-react";

type Props = {
  filter: InboxFilter;
  counts: Record<InboxFilter, number>;
  onChange: (f: InboxFilter) => void;
  whatsappMode?: boolean;
  variant?: "default" | "header" | "panel";
};

export function FilterTabs({ filter, counts, onChange, whatsappMode = false, variant = "default" }: Props) {
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

  const resolvedVariant = variant !== "default" ? variant : whatsappMode ? "header" : "default";

  return (
    <div className="flex min-w-max items-center gap-1.5">
      {tabs.map((tab) => {
        const active = filter === tab.key;
        let className =
          "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all whitespace-nowrap";

        if (resolvedVariant === "panel") {
          className += active
            ? " bg-[#008069] text-white shadow-sm"
            : " bg-white text-[#54656F] border border-[#E9EDEF] hover:bg-[#F5F6F6]";
        } else if (resolvedVariant === "header") {
          className += active
            ? " bg-white/20 text-white"
            : " text-white/70 hover:bg-white/10 hover:text-white";
        } else {
          className += active
            ? " bg-[var(--accent)] text-[var(--accent-foreground)]"
            : " text-[var(--text-tertiary)] hover:text-[var(--text-primary)]";
        }

        return (
          <button key={tab.key} type="button" onClick={() => onChange(tab.key)} className={className}>
            {tab.icon}
            {tab.label}
            <span className="opacity-70">· {counts[tab.key]}</span>
          </button>
        );
      })}
    </div>
  );
}
