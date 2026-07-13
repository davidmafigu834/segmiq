"use client";

import type { LucideIcon } from "lucide-react";

type Props = {
  label: string;
  value: number;
  max: number;
  icon: LucideIcon;
  light?: boolean;
};

export function ScoreBreakdownBar({ label, value, max, icon: Icon, light = false }: Props) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <div
          className={`flex items-center gap-1.5 text-xs ${
            light ? "text-[#667781]" : "text-[var(--text-secondary)]"
          }`}
        >
          <Icon size={14} />
          {label}
        </div>
        <span
          className={`text-xs font-medium ${light ? "text-[#111B21]" : "text-[var(--text-primary)]"}`}
          style={{ fontFamily: "var(--font-instrument-serif)" }}
        >
          {value}/{max}
        </span>
      </div>
      <div
        className={`h-1.5 w-full rounded-full ${light ? "bg-[#E9EDEF]" : "bg-[var(--bg-quaternary)]"}`}
      >
        <div
          className="h-1.5 rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, background: light ? "#00A884" : "var(--accent)" }}
        />
      </div>
    </div>
  );
}
