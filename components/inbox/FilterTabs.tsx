"use client";

import type { ReactNode } from "react";
import type { InboxFilter } from "@/lib/inbox/types";
import { INBOX_FILTER_LABELS, INBOX_FILTER_ORDER } from "@/lib/inbox/queue-filters";
import { Flame, CalendarClock, MessageSquare, Clock, FileText } from "lucide-react";

type Props = {
  filter: InboxFilter;
  counts: Record<InboxFilter, number>;
  onChange: (f: InboxFilter) => void;
  whatsappMode?: boolean;
  variant?: "default" | "header" | "panel";
};

const FILTER_ICONS: Partial<Record<InboxFilter, ReactNode>> = {
  hot: <Flame size={14} className="shrink-0" />,
  follow_up_due: <CalendarClock size={14} className="shrink-0" />,
  awaiting_reply: <MessageSquare size={14} className="shrink-0" />,
  waiting_customer: <Clock size={14} className="shrink-0" />,
  quotes_sent: <FileText size={14} className="shrink-0" />,
};

export function FilterTabs({ filter, counts, onChange, whatsappMode = false, variant = "default" }: Props) {
  const tabs = INBOX_FILTER_ORDER.map((key) => ({
    key,
    label: INBOX_FILTER_LABELS[key],
    icon: FILTER_ICONS[key],
  }));

  const resolvedVariant = variant !== "default" ? variant : whatsappMode ? "header" : "default";

  return (
    <div className="flex min-w-max items-center gap-1.5">
      {tabs.map((tab) => {
        const active = filter === tab.key;
        let className = "flex items-center gap-1 whitespace-nowrap text-[11px] font-medium transition-all";

        if (resolvedVariant === "panel") {
          className += active ? " wa-filter-pill-active" : " wa-filter-pill";
        } else {
          className += " rounded-full px-2.5 py-1";
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

        const count = counts[tab.key] ?? 0;
        if (count === 0 && tab.key !== "all" && tab.key !== "mine") {
          return null;
        }

        return (
          <button key={tab.key} type="button" onClick={() => onChange(tab.key)} className={className}>
            {tab.icon}
            {tab.label}
            <span
              className={`inline-flex min-w-[18px] items-center justify-center rounded-full px-1 text-[9px] font-bold ${
                active ? "bg-white/20 text-white" : "bg-[#EEF2F4] text-[#6B7886]"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
