"use client";

import { Line, LineChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/ui/cn";

export function ReportSparkline({
  data,
  color,
  className,
}: {
  data: number[];
  color: string;
  className?: string;
}) {
  if (!data.length || data.every((n) => n === 0)) {
    return (
      <div className={cn("h-8 w-full", className)} aria-hidden>
        <svg viewBox="0 0 100 24" className="h-full w-full" preserveAspectRatio="none">
          <line x1="0" y1="18" x2="100" y2="18" stroke="currentColor" strokeWidth="1.5" className="text-sales-border" />
        </svg>
      </div>
    );
  }
  const points = data.map((y, i) => ({ i, y }));
  return (
    <div className={cn("h-8 w-full", className)} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 4, right: 0, bottom: 2, left: 0 }}>
          <Line
            type="monotone"
            dataKey="y"
            stroke={color}
            strokeWidth={1.6}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
