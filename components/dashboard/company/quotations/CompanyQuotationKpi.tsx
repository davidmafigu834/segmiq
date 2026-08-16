import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/ui/cn";

const tones = {
  blue: "bg-sales-info-soft text-sales-info-fg",
  neutral: "bg-sales-neutral-100 text-sales-text-secondary",
  purple: "bg-sales-purple-soft text-sales-purple-fg",
  success: "bg-sales-success-soft text-sales-success-fg",
  danger: "bg-sales-danger-soft text-sales-danger-fg",
  brand: "bg-sales-brand-soft text-sales-brand-fg",
} as const;

export function CompanyQuotationKpi({
  label,
  value,
  supporting,
  icon: Icon,
  tone,
  className,
}: {
  label: string;
  value: string;
  supporting: string;
  icon: LucideIcon;
  tone: keyof typeof tones;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "min-w-0 rounded-[14px] border border-sales-border bg-sales-surface px-3.5 py-4 shadow-sales-card sm:px-4",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            tones[tone]
          )}
        >
          <Icon size={17} strokeWidth={1.8} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium leading-4 text-sales-text-secondary">
            {label}
          </p>
          <p className="mt-0.5 truncate text-[19px] font-semibold leading-6 tracking-[-0.025em] text-sales-text-primary tabular-nums sm:text-[21px]">
            {value}
          </p>
          <p className="mt-1 truncate text-[11px] text-sales-text-muted">{supporting}</p>
        </div>
      </div>
    </article>
  );
}
