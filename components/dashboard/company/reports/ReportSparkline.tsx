"use client";

import { SalesSparkline } from "@/components/sales/ui/Charts";
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

  const chartData = data.map((value, i) => ({ label: String(i), value }));

  return (
    <SalesSparkline
      data={chartData}
      color={color}
      height={32}
      className={cn("h-8", className)}
    />
  );
}
