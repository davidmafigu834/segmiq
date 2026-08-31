"use client";

import { ChartEmptyState, MenuSelect, SalesMultiLineChart } from "@/components/sales/ui";
import { useSalesChartColors } from "@/lib/sales/use-sales-chart-colors";
import type { WinLossTrendPoint, WonLostGranularity } from "@/lib/sales/outcomes";

export function WinLossTrendChart({
  data,
  granularity,
  onGranularityChange,
}: {
  data: WinLossTrendPoint[];
  granularity: WonLostGranularity;
  onGranularityChange: (g: WonLostGranularity) => void;
}) {
  const colors = useSalesChartColors();
  const has = data.some((d) => d.won > 0 || d.lost > 0);

  return (
    <div className="flex h-full min-h-[220px] flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[14px] font-semibold text-sales-text-primary">Win vs loss trend</h3>
        <MenuSelect
          aria-label="Trend granularity"
          size="sm"
          align="right"
          value={granularity}
          onChange={onGranularityChange}
          options={[
            { value: "weekly", label: "Weekly" },
            { value: "monthly", label: "Monthly" },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1">
        {!has ? (
          <ChartEmptyState
            title="No closed-deal trend yet"
            description="Your win/loss trend will appear as deals are closed."
            className="min-h-[160px]"
          />
        ) : (
          <SalesMultiLineChart
            data={data}
            series={[
              { dataKey: "won", name: "Won", color: colors.success },
              { dataKey: "lost", name: "Lost", color: colors.danger },
            ]}
            labelFormatter={(label) =>
              granularity === "weekly" ? `Week of ${label}` : label
            }
          />
        )}
      </div>
    </div>
  );
}
