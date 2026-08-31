"use client";

import { useMemo } from "react";
import { SalesBarChart } from "@/components/sales/ui/Charts";

function truncateReason(value: string, max = 28): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export function ReportsReasonsChart({ rows }: { rows: Array<{ reason: string; count: number }> }) {
  const top = useMemo(
    () =>
      rows.slice(0, 5).map((row) => ({
        label: truncateReason(row.reason),
        value: row.count,
        fullReason: row.reason,
      })),
    [rows]
  );

  if (top.length === 0 || !top.some((r) => r.value > 0)) {
    return (
      <div className="flex h-[200px] items-center justify-center text-[13px] text-[var(--text-tertiary)] sm:h-[220px]">
        No reason data for this period
      </div>
    );
  }

  return (
    <div className="h-[200px] w-full min-w-0 sm:h-[220px]">
      <SalesBarChart
        data={top}
        layout="horizontal"
        emptyTitle="No reason data for this period"
      />
    </div>
  );
}
