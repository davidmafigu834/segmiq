import { cn } from "@/lib/ui/cn";

export interface MetricProps {
  value: React.ReactNode;
  label?: React.ReactNode;
  /** Render the label above the number instead of below. */
  labelPosition?: "top" | "bottom";
  className?: string;
  valueClassName?: string;
  labelClassName?: string;
}

/**
 * Big dashboard metric. The number uses Instrument Serif — the one permitted
 * inline style per the design system (font-family token only).
 */
export function Metric({
  value,
  label,
  labelPosition = "bottom",
  className,
  valueClassName,
  labelClassName,
}: MetricProps) {
  const labelEl = label != null && (
    <div className={cn("text-sm text-[var(--text-secondary)]", labelClassName)}>{label}</div>
  );
  return (
    <div className={className}>
      {labelPosition === "top" && labelEl}
      <div
        className={cn("text-3xl md:text-4xl leading-none text-[var(--text-primary)]", valueClassName)}
        style={{ fontFamily: "var(--font-instrument-serif)" }}
      >
        {value}
      </div>
      {labelPosition === "bottom" && labelEl}
    </div>
  );
}
