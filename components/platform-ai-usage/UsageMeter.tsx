import type { AiQuotaMetric } from "@/lib/platform-ai-usage/types";

export function UsageMeter({
  label,
  metric,
}: {
  label: string;
  metric: AiQuotaMetric;
}) {
  const tone =
    metric.threshold >= 100
      ? "bg-[var(--error)]"
      : metric.threshold >= 80
        ? "bg-[var(--warning)]"
        : "bg-[var(--accent)]";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-[var(--text-primary)]">{label}</span>
        <span className="text-[var(--text-secondary)]">
          {metric.consumed.toLocaleString()} of{" "}
          {(metric.included + metric.topups).toLocaleString()}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-[var(--bg-tertiary)]"
        role="progressbar"
        aria-label={`${label} usage`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={metric.percent}
      >
        <div
          className={`h-full ${tone}`}
          style={{ width: `${metric.percent}%` }}
        />
      </div>
      <p className="text-xs text-[var(--text-tertiary)]">
        {metric.available.toLocaleString()} remaining
        {metric.topups > 0
          ? ` · ${metric.topups.toLocaleString()} from active top-ups`
          : ""}
      </p>
    </div>
  );
}
