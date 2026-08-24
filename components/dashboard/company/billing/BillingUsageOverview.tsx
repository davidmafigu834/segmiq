"use client";

import { Users } from "lucide-react";
import { Button, Progress } from "@/components/sales/ui";
import { usageBarTone } from "@/lib/billing/status";
import type { CompanyBillingUsageMetric } from "@/lib/billing/company-billing-types";

export function BillingUsageOverview({
  metrics,
  loadError,
  onRetry,
  onUpgrade,
}: {
  metrics: CompanyBillingUsageMetric[];
  loadError?: boolean;
  onRetry?: () => void;
  onUpgrade?: () => void;
}) {
  if (loadError) {
    return (
      <section
        className="sd-card overflow-hidden p-5"
        data-course-target="billing-usage"
      >
        <h2 className="text-[15px] font-semibold text-sales-text-primary">Usage Overview</h2>
        <p className="mt-2 text-[13px] text-sales-text-secondary">
          Usage information is temporarily unavailable.
        </p>
        {onRetry ? (
          <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </section>
    );
  }

  if (metrics.length === 0) return null;

  return (
    <section
      className="sd-card overflow-hidden p-5"
      data-course-target="billing-usage"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-sales-text-primary">Usage Overview</h2>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 layout:grid-cols-[repeat(auto-fit,minmax(160px,1fr))]">
        {metrics.map((metric) => (
          <UsageModule key={metric.id} metric={metric} onUpgrade={onUpgrade} />
        ))}
      </div>
    </section>
  );
}

function UsageModule({
  metric,
  onUpgrade,
}: {
  metric: CompanyBillingUsageMetric;
  onUpgrade?: () => void;
}) {
  const tone = usageBarTone(metric.percent);
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-sales-neutral-100 text-sales-text-secondary">
          <Users size={14} strokeWidth={1.8} aria-hidden />
        </span>
        <p className="truncate text-[12px] font-medium text-sales-text-secondary">{metric.label}</p>
      </div>
      <p className="text-[13px] font-semibold tabular-nums text-sales-text-primary">
        {metric.unlimited ? (
          <>
            {metric.displayUsed} used · Unlimited
          </>
        ) : (
          <>
            {metric.displayUsed} / {metric.displayLimit}
          </>
        )}
      </p>
      {metric.unlimited ? (
        <p className="mt-2 text-[11px] text-sales-text-muted">No seat limit on this plan.</p>
      ) : (
        <>
          <Progress
            value={metric.percent ?? 0}
            tone={tone}
            className="mt-2 h-1.5"
            aria-label={`${metric.label} usage`}
          />
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <p className="text-[11px] text-sales-text-muted">
              {metric.atLimit ? "Limit reached." : `${metric.percent ?? 0}% used`}
            </p>
            {metric.atLimit && onUpgrade ? (
              <button
                type="button"
                className="text-[11px] font-semibold text-sales-brand-fg hover:underline"
                onClick={onUpgrade}
              >
                Upgrade
              </button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
