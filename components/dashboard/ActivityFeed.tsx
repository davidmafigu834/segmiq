"use client";

import useSWR from "swr";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Activity } from "lucide-react";
import type { ActivityEventDTO, ActivityEventKind } from "@/lib/activity-feed-types";
import { formatTimeAgo } from "@/lib/format";

const fetcher = (u: string) =>
  fetch(u).then((r) => {
    if (!r.ok) throw new Error("Failed");
    return r.json();
  });

const labelFor: Record<ActivityEventKind, string> = {
  NEW_LEAD: "New lead",
  DEAL_WON: "Deal won",
  FOLLOW_UP_SET: "Follow-up set",
  FLAGGED: "Flagged",
  NOT_QUALIFIED: "Not qualified",
  CONTACTED: "Contacted",
};

const bulletClass: Record<ActivityEventKind, string> = {
  NEW_LEAD: "bg-[var(--activity-new)]",
  DEAL_WON: "bg-accent",
  FOLLOW_UP_SET: "bg-[var(--activity-follow)]",
  FLAGGED: "bg-[var(--activity-flag)]",
  NOT_QUALIFIED: "bg-[var(--activity-nq)]",
  CONTACTED: "bg-[var(--activity-contacted)]",
};

export function ActivityFeed() {
  const reduceMotion = useReducedMotion();
  const { data } = useSWR<{ events: ActivityEventDTO[] }>("/api/activity", fetcher, {
    refreshInterval: 30_000,
  });
  const events = data?.events ?? [];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="font-display text-[19px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">Activity</h2>
        <span className="inline-flex items-center gap-2 text-[11px] font-medium text-[var(--text-tertiary)]">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
          Live updates
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[var(--border)] pb-3">
        <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--activity-new)]" aria-hidden />
          New lead
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--activity-flag)]" aria-hidden />
          Flagged
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--activity-follow)]" aria-hidden />
          Follow-up
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--activity-contacted)]" aria-hidden />
          Contacted
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
          <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden />
          Deal won
        </span>
      </div>

      <div className="border-l border-[var(--border)]">
        <ul className="relative m-0 list-none p-0">
          <AnimatePresence initial={false}>
            {events.map((e) => (
              <motion.li
                key={e.id}
                layout
                initial={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
                transition={{ duration: reduceMotion ? 0.12 : 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="relative border-b border-[var(--border)] py-3.5 pl-6 last:border-b-0"
              >
                <span
                  className={`absolute left-[-4px] top-[22px] h-2 w-2 rounded-full shadow-[0_0_0_1px_var(--bg-primary)] ${bulletClass[e.type]}`}
                  aria-hidden
                />
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                    {labelFor[e.type]}
                  </span>
                  <span className="shrink-0 tabular-nums text-[11px] text-[var(--text-tertiary)]">
                    {formatTimeAgo(e.timestamp)}
                  </span>
                </div>
                <p className="mt-0.5 text-[13px] text-[var(--text-primary)]">{e.message}</p>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        {!events.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Activity className="mb-3 h-8 w-8 text-[var(--text-disabled)]" />
            <p className="mb-1 text-[14px] font-semibold text-[var(--text-secondary)]">No activity yet</p>
            <p className="text-[12px] text-[var(--text-tertiary)]">Activity will appear here as your team logs calls, sends messages, and updates leads.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
