"use client";

import { useSalesChartColors } from "@/lib/sales/use-sales-chart-colors";

export function ReportTooltip({
  active,
  label,
  rows,
}: {
  active?: boolean;
  label?: string;
  rows: Array<{ name: string; value: string; color?: string }>;
}) {
  const colors = useSalesChartColors();
  if (!active || rows.length === 0) return null;
  return (
    <div
      className="min-w-[160px] rounded-[10px] border px-3 py-2 shadow-sales-popover"
      style={{
        background: colors.surfaceRaised,
        borderColor: colors.border,
        color: colors.textPrimary,
      }}
    >
      {label ? (
        <p className="mb-1 text-[11px] font-medium" style={{ color: colors.textMuted }}>
          {label}
        </p>
      ) : null}
      {rows.map((row) => (
        <p key={row.name} className="flex items-center justify-between gap-4 text-[12px]">
          <span className="inline-flex items-center gap-1.5" style={{ color: colors.textSecondary }}>
            {row.color ? (
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: row.color }} aria-hidden />
            ) : null}
            {row.name}
          </span>
          <span className="font-medium tabular-nums" style={{ color: colors.textPrimary }}>
            {row.value}
          </span>
        </p>
      ))}
    </div>
  );
}
