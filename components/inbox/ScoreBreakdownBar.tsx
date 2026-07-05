"use client";

import type { LucideIcon } from "lucide-react";

type Props = {
  label: string;
  value: number;
  max: number;
  icon: LucideIcon;
};

export function ScoreBreakdownBar({ label, value, max, icon: Icon }: Props) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
          <Icon size={14} />
          {label}
        </div>
        <span
          className="text-xs font-medium text-[var(--text-primary)]"
          style={{ fontFamily: "var(--font-instrument-serif)" }}
        >
          {value}/{max}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-[var(--bg-quaternary)]">
        <div
          className="h-1.5 rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, background: "var(--accent)" }}
        />
      </div>
    </div>
  );
}
