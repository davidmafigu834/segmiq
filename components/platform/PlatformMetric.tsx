import { cn } from "@/lib/ui/cn";

export function PlatformMetric({
  label,
  value,
  context,
  className,
}: {
  label: string;
  value: React.ReactNode;
  context?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 py-1", className)}>
      <p className="text-[12px] font-medium text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-1 text-[26px] font-semibold tabular-nums tracking-[-0.03em] text-[var(--text-primary)]">
        {value}
      </p>
      {context ? (
        <p className="mt-1 text-[12px] leading-snug text-[var(--text-secondary)]">{context}</p>
      ) : null}
    </div>
  );
}
