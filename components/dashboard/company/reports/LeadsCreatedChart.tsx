"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MenuSelect } from "@/components/sales/ui";
import { useSalesChartColors } from "@/lib/sales/use-sales-chart-colors";
import type { ReportGranularity } from "@/lib/sales/company-reports/range";
import type { ReportTimePoint } from "@/lib/sales/company-reports/types";
import { ReportChartCard } from "./ReportChartCard";
import { ReportTooltip } from "./ReportTooltip";

export function LeadsCreatedChart({
  series,
  granularity,
  onGranularity,
  error,
  onRetry,
}: {
  series: ReportTimePoint[];
  granularity: ReportGranularity;
  onGranularity: (value: ReportGranularity) => void;
  error?: string | null;
  onRetry?: () => void;
}) {
  const colors = useSalesChartColors();
  const has = series.some((p) => p.current > 0);

  return (
    <ReportChartCard
      title="Leads Created Over Time"
      action={
        <MenuSelect
          size="sm"
          align="right"
          aria-label="Leads granularity"
          value={granularity}
          onChange={onGranularity}
          options={[
            { value: "day", label: "Daily" },
            { value: "week", label: "Weekly" },
            { value: "month", label: "Monthly" },
          ]}
        />
      }
      error={error}
      onRetry={onRetry}
      className="min-h-[250px] layout:min-h-[260px]"
    >
      {!has ? (
        <div className="flex h-full min-h-[180px] flex-col items-center justify-center text-center">
          <p className="text-[13px] font-medium text-sales-text-primary">
            No Leads were captured during this period.
          </p>
        </div>
      ) : (
        <div className="h-[190px] w-full sm:h-[200px] layout:h-[208px]" aria-label="Leads created over time">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={colors.grid} vertical={false} strokeDasharray="3 6" />
              <XAxis
                dataKey="label"
                tick={{ fill: colors.axis, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis
                width={28}
                allowDecimals={false}
                tick={{ fill: colors.axis, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ active, label, payload }) => (
                  <ReportTooltip
                    active={active}
                    label={String(label ?? "")}
                    rows={[
                      {
                        name: "New Leads",
                        value: String(payload?.[0]?.value ?? 0),
                        color: colors.brand,
                      },
                    ]}
                  />
                )}
              />
              <Bar dataKey="current" name="New Leads" fill={colors.brand} radius={[3, 3, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ReportChartCard>
  );
}
