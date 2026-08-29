import { dealSideBadgeLabel } from "@/lib/terminology";
import { cn } from "@/lib/ui/cn";

export function DealSideBadge({
  dealSide,
  className,
}: {
  dealSide?: string | null;
  className?: string;
}) {
  const label = dealSideBadgeLabel(dealSide);
  if (!label) return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-[6px] border border-sales-border-subtle bg-sales-surface-subtle px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-sales-text-secondary",
        className
      )}
    >
      {label}
    </span>
  );
}
