"use client";

import type { LucideIcon } from "lucide-react";

type Props = {
  label: string;
  value: number;
  max: number;
  icon?: LucideIcon;
  light?: boolean;
  barColor?: string;
};

export function ScoreBreakdownBar({
  label,
  value,
  max,
  icon: Icon,
  light = false,
  barColor,
}: Props) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <div
          className={`flex items-center gap-1.5 text-[12px] ${
            light ? "text-[#667085]" : "text-[var(--text-secondary)]"
          }`}
        >
          {Icon ? <Icon size={13} strokeWidth={1.8} aria-hidden /> : null}
          {label}
        </div>
        <span
          className={`text-[12px] font-medium tabular-nums ${
            light ? "text-[#101828]" : "text-[var(--text-primary)]"
          }`}
        >
          {pct}%
        </span>
      </div>
      <div
        className={`h-1 w-full overflow-hidden rounded-full ${
          light ? "bg-[#F2F4F7]" : "bg-[var(--bg-quaternary)]"
        }`}
      >
        <div
          className="h-1 rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: `${pct}%`,
            background: barColor || (light ? "#D4FF4F" : "var(--accent)"),
          }}
        />
      </div>
    </div>
  );
}
