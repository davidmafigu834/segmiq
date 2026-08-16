"use client";

import { Avatar } from "@/components/sales/ui";
import { formatDealCurrency } from "@/lib/sales/format";
import type { ReportSalespersonRow } from "@/lib/sales/company-reports/types";
import { ReportChartCard } from "./ReportChartCard";
import { ReportSparkline } from "./ReportSparkline";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/ui/cn";

export function TopSalespeople({
  rows,
  currency,
  onViewAll,
  onSelect,
}: {
  rows: ReportSalespersonRow[];
  currency: string;
  onViewAll: () => void;
  onSelect?: (userId: string) => void;
}) {
  return (
    <ReportChartCard
      title="Top Salespeople"
      action={
        <button
          type="button"
          onClick={onViewAll}
          className="text-[12px] font-medium text-sales-brand-fg hover:underline"
        >
          View all
        </button>
      }
      bodyClassName="pt-1"
    >
      {rows.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-sales-text-muted">
          No Won Deal results in this period.
        </p>
      ) : (
        <ul className="space-y-2.5" aria-label="Top salespeople by Revenue Won">
          {rows.map((row) => (
            <li key={row.userId}>
              <button
                type="button"
                onClick={() => onSelect?.(row.userId)}
                className="flex min-w-0 w-full items-center gap-2.5 rounded-[8px] px-0.5 py-0.5 text-left hover:bg-sales-surface-hover"
              >
                <Avatar name={row.name} src={row.avatarUrl} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium text-sales-text-primary">
                    {row.name}
                  </span>
                  <span className="text-[11px] tabular-nums text-sales-text-secondary">
                    {formatDealCurrency(row.revenueWon, { currency })}
                  </span>
                </span>
                <span className="hidden w-[56px] shrink-0 sm:block">
                  <ReportSparkline data={row.sparkline} color="#22C55E" />
                </span>
                <span className="shrink-0">
                  <Trend trend={row.trend} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[10px] text-sales-text-muted">Ranked by Revenue Won this period.</p>
    </ReportChartCard>
  );
}

function Trend({ trend }: { trend: ReportSalespersonRow["trend"] }) {
  if (trend.direction === "new") {
    return <span className="text-[11px] text-sales-text-muted">New</span>;
  }
  if (trend.direction !== "up" && trend.direction !== "down") {
    return <span className="w-10" />;
  }
  const up = trend.direction === "up";
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center text-[11px] font-medium tabular-nums",
        up ? "text-sales-success" : "text-sales-danger"
      )}
    >
      <Icon size={12} strokeWidth={1.8} aria-hidden />
      {trend.label.split(" vs")[0]}
    </span>
  );
}
