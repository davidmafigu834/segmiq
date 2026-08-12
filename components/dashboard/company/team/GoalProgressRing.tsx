"use client";

import { cn } from "@/lib/ui/cn";

export function GoalProgressRing({
  pct,
  size = 80,
}: {
  pct: number;
  size?: number;
}) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = c * (1 - clamped / 100);
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden className="shrink-0">
      <circle
        cx="40"
        cy="40"
        r={r}
        fill="none"
        stroke="var(--sales-chart-track, var(--sales-neutral-100))"
        strokeWidth="7"
      />
      <circle
        cx="40"
        cy="40"
        r={r}
        fill="none"
        stroke="#D4FF4F"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 40 40)"
      />
      <text
        x="40"
        y="45"
        textAnchor="middle"
        className="fill-sales-text-primary"
        fontSize="15"
        fontWeight="650"
      >
        {Math.round(clamped)}%
      </text>
    </svg>
  );
}

export function GoalBar({
  pct,
  label,
  className,
}: {
  pct: number;
  label?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className={cn("min-w-[88px]", className)}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold tabular-nums text-sales-text-primary">
          {Math.round(clamped)}%
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-[var(--sales-chart-track,var(--sales-neutral-100))]"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? `Goal progress ${clamped}%`}
      >
        <div className="h-full rounded-full bg-sales-brand" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
