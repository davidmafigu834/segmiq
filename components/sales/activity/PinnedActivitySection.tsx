"use client";

import { useState } from "react";
import { Pin } from "lucide-react";
import { ActivityItem } from "@/components/sales/activity/ActivityItem";
import type { ActivityTimelineItem } from "@/lib/activity/types";
import { Button } from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";

const DEFAULT_VISIBLE = 3;

export function PinnedActivitySection({
  items,
  onPin,
  onUnpin,
  canPin,
  className,
}: {
  items: ActivityTimelineItem[];
  onPin?: (item: ActivityTimelineItem) => void;
  onUnpin?: (item: ActivityTimelineItem) => void;
  canPin?: boolean;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;

  const visible = expanded ? items : items.slice(0, DEFAULT_VISIBLE);

  return (
    <section
      className={cn(
        "rounded-[12px] border border-[rgba(245,158,11,0.22)] bg-[rgba(255,250,235,0.55)] px-3 py-3 dark:border-[rgba(245,158,11,0.18)] dark:bg-[rgba(245,158,11,0.06)]",
        className
      )}
      aria-label="Pinned activity"
    >
      <div className="mb-2 flex items-center gap-2">
        <Pin size={14} strokeWidth={1.8} className="text-[#B54708] dark:text-[#F6BB59]" aria-hidden />
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-sales-text-primary">Pinned</h2>
      </div>
      <div className="divide-y divide-[rgba(245,158,11,0.12)]">
        {visible.map((item) => (
          <div key={item.id} className="first:pt-0">
            <ActivityItem item={item} onPin={onPin} onUnpin={onUnpin} canPin={canPin} compact />
            {item.pinnedByName ? (
              <p className="pb-2 pl-11 text-[11px] text-sales-text-muted">
                Pinned by {item.pinnedByName}
              </p>
            ) : null}
          </div>
        ))}
      </div>
      {items.length > DEFAULT_VISIBLE ? (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show fewer pinned" : `View all pinned (${items.length})`}
        </Button>
      ) : null}
    </section>
  );
}
