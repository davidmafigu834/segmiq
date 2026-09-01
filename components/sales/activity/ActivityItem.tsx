"use client";

import { format, formatDistanceToNow, parseISO } from "date-fns";
import { MoreHorizontal, Pin, PinOff } from "lucide-react";
import { ActivityIcon } from "@/components/sales/activity/ActivityIcon";
import type { ActivityIconKey, ActivityTone } from "@/lib/activity/presentation";
import type { ActivityTimelineItem } from "@/lib/activity/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";

export function ActivityItem({
  item,
  onPin,
  onUnpin,
  canPin = false,
  compact = false,
}: {
  item: ActivityTimelineItem;
  onPin?: (item: ActivityTimelineItem) => void;
  onUnpin?: (item: ActivityTimelineItem) => void;
  canPin?: boolean;
  compact?: boolean;
}) {
  const iconKey = (item.metadata.iconKey as ActivityIconKey) ?? "activity";
  const tone = (item.metadata.tone as ActivityTone) ?? "neutral";
  const ts = parseISO(item.occurredAt);
  const timeTitle = format(ts, "PPpp");
  const timeLabel = formatDistanceToNow(ts, { addSuffix: true });
  const isPinned = Boolean(item.pinnedAt);
  const canPinThis = canPin && item.sourceType === "LEAD_EVENT";

  return (
    <article className={cn("relative flex gap-3", compact ? "py-2.5" : "py-3")}>
      <ActivityIcon iconKey={iconKey} tone={tone} className={compact ? "!h-8 !w-8" : undefined} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold text-sales-text-primary">{item.title}</h3>
            {item.summary ? (
              <p className="mt-0.5 text-[12px] leading-relaxed text-sales-text-secondary">{item.summary}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <time
              className="text-[11px] tabular-nums text-sales-text-muted"
              dateTime={item.occurredAt}
              title={timeTitle}
            >
              {timeLabel}
            </time>
            {canPinThis ? (
              <DropdownMenu align="end">
                <DropdownMenuTrigger
                  aria-label={`Actions for ${item.title}`}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] text-sales-text-muted hover:bg-sales-surface-hover hover:text-sales-text-primary"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal size={14} strokeWidth={1.8} />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-44">
                  {isPinned ? (
                    <DropdownMenuItem
                      icon={<PinOff size={14} strokeWidth={1.8} />}
                      onSelect={() => onUnpin?.(item)}
                    >
                      Unpin
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem icon={<Pin size={14} strokeWidth={1.8} />} onSelect={() => onPin?.(item)}>
                      Pin
                    </DropdownMenuItem>
                  )}
                  {item.refType === "quotation" && item.refId ? (
                    <DropdownMenuItem onSelect={() => { window.location.href = `/sales/quotes/${item.refId}`; }}>
                      Open quote
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
        <p className="mt-1 text-[11px] text-sales-text-muted">
          {item.actorType === "SYSTEM" ? "SegmiQ system" : item.actorName}
          {item.actorRole && item.actorRole !== "SYSTEM"
            ? ` · ${item.actorRole.replace(/_/g, " ")}`
            : ""}
        </p>
      </div>
    </article>
  );
}
