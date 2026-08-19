"use client";

import type { LucideIcon } from "lucide-react";

type Props = {
  label: string;
  value: number;
  max: number;
  icon?: LucideIcon;
  light?: boolean;
  compact?: boolean;
  barColor?: string;
};

export function ScoreBreakdownBar({
  label,
  value,
  max,
  icon: Icon,
  light = false,
  compact = false,
  barColor,
}: Props) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className={`flex items-center justify-between gap-2 ${compact ? "mb-0.5" : "mb-1"}`}>
        <div
          className={`flex items-center gap-1.5 ${
            compact ? "text-[10.5px]" : "text-[12px]"
          } ${light ? "text-sales-text-secondary" : "text-[var(--text-secondary)]"}`}
        >
          {Icon ? <Icon size={compact ? 11 : 13} strokeWidth={1.8} aria-hidden /> : null}
          {label}
        </div>
        <span
          className={`font-medium tabular-nums ${compact ? "text-[10.5px]" : "text-[12px]"} ${
            light ? "text-sales-text-primary" : "text-[var(--text-primary)]"
          }`}
        >
          {pct}%
        </span>
      </div>
      <div
        className={`w-full overflow-hidden rounded-full ${compact ? "h-1" : "h-1.5"} ${
          light ? "bg-sales-neutral-100" : "bg-[var(--bg-quaternary)]"
        }`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: `${pct}%`,
            background: barColor || (light ? "#D4FF4F" : "var(--accent)"),
          }}
        />
      </div>
    </div>
  );
}
