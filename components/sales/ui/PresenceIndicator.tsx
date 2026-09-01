"use client";

import { cn } from "@/lib/ui/cn";
import { PRESENCE_LABEL, type PresenceState } from "@/lib/presence/constants";

const DOT_CLASS: Record<PresenceState, string> = {
  online: "bg-sales-success",
  away: "bg-sales-warning",
  busy: "bg-sales-danger",
  offline: "bg-sales-border-strong",
};

const SIZE_CLASS = {
  sm: "h-1.5 w-1.5",
  md: "h-2 w-2",
  lg: "h-2.5 w-2.5",
} as const;

export function PresenceIndicator({
  state,
  size = "md",
  showLabel = true,
  className,
}: {
  state: PresenceState;
  size?: keyof typeof SIZE_CLASS;
  showLabel?: boolean;
  className?: string;
}) {
  const label = PRESENCE_LABEL[state];

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "shrink-0 rounded-full ring-2 ring-sales-surface",
          SIZE_CLASS[size],
          DOT_CLASS[state]
        )}
        aria-hidden={showLabel}
      />
      {showLabel ? (
        <span className="text-[11px] font-medium text-sales-text-secondary">{label}</span>
      ) : null}
      {!showLabel ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
