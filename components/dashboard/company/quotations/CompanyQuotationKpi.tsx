import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { MetricValue } from "@/components/sales/ui/DataDisplay";

const tones = {
  blue: "bg-sales-info-soft text-sales-info-fg",
  neutral: "bg-sales-neutral-100 text-sales-text-secondary",
  purple: "bg-sales-purple-soft text-sales-purple-fg",
  success: "bg-sales-success-soft text-sales-success-fg",
  danger: "bg-sales-danger-soft text-sales-danger-fg",
  brand: "bg-sales-brand-soft-solid text-sales-brand-fg",
} as const;

export function CompanyQuotationKpi({
  label,
  value,
  supporting,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  supporting: string;
  icon: LucideIcon;
  tone: keyof typeof tones;
  onClick?: () => void;
}) {
  const compactValue = value.length > 10;
  const className = cn(
    "sd-card group flex h-full w-full min-h-[104px] min-w-0 flex-col justify-between p-3.5 text-left",
    "transition-[border-color,box-shadow] duration-150 sm:min-h-[120px] sm:p-4",
    onClick &&
      "hover:border-sales-border-strong hover:shadow-sales-card-hover focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sales-focus-outline)]"
  );

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 pr-1 text-[12px] font-medium leading-snug text-sales-text-secondary">
          {label}
        </p>
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-sales-sm sm:h-8 sm:w-8",
            tones[tone]
          )}
        >
          <Icon size={16} strokeWidth={1.8} aria-hidden className="sm:size-[18px]" />
        </span>
      </div>
      <div className="min-w-0">
        <MetricValue
          value={value}
          className={compactValue ? "text-[18px] sm:text-[22px] layout:text-[24px]" : undefined}
        />
        <p className="mt-2 truncate text-[12px] leading-snug text-sales-text-muted">{supporting}</p>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick} aria-label={`Filter by ${label}`}>
        {body}
      </button>
    );
  }

  return <article className={className}>{body}</article>;
}
