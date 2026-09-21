"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Tooltip } from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";
import type { ComparedMetric } from "@/lib/sales/weekly-team-report/types";
import { formatMetricValue, METRIC_HELP, trendTone } from "./format";

export function SemanticTrend({ metric }: { metric: ComparedMetric }) {
  const tone = trendTone(metric);
  const direction = metric.trend.direction;
  if (direction === "none" || direction === "flat" || direction === "new" || tone === "neutral") {
    return <span className="text-[12px] text-sales-text-muted">{metric.trend.label}</span>;
  }
  const Icon = direction === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[12px] font-medium tabular-nums",
        tone === "positive" ? "text-sales-success-fg" : "text-sales-warning-fg"
      )}
    >
      <Icon size={13} strokeWidth={1.8} aria-hidden />
      {metric.trend.label}
    </span>
  );
}

export function MetricSummary({
  metric,
  currency,
}: {
  metric: ComparedMetric;
  currency: string;
}) {
  const help = METRIC_HELP[metric.id];
  return (
    <div className="min-w-0 py-2 pr-4">
      <p className="flex items-center gap-1 text-[12px] text-sales-text-muted">
        {help ? (
          <Tooltip label={help}>
            <button type="button" className="text-left hover:text-sales-text-secondary">
              {metric.label}
            </button>
          </Tooltip>
        ) : (
          metric.label
        )}
      </p>
      <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-[-0.03em] text-sales-text-primary">
        {formatMetricValue(metric, currency)}
      </p>
      <div className="mt-1">
        <SemanticTrend metric={metric} />
      </div>
    </div>
  );
}
