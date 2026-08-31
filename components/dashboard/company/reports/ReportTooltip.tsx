"use client";

import { SalesChartTooltip } from "@/components/sales/ui/Charts";

/** Company report charts — thin wrapper over shared chart tooltip. */
export function ReportTooltip({
  active,
  label,
  rows,
}: {
  active?: boolean;
  label?: string;
  rows: Array<{ name: string; value: string; color?: string }>;
}) {
  if (!active || rows.length === 0) return null;

  return (
    <SalesChartTooltip
      active={active}
      label={label}
      payload={rows.map((row) => ({
        name: row.name,
        value: row.value,
        color: row.color,
      }))}
      formatValue={(value) => String(value ?? "—")}
    />
  );
}
