import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/ui/cn";

const tones = {
  blue: "bg-sales-info-soft text-sales-info-fg",
  neutral: "bg-sales-neutral-100 text-sales-text-secondary",
  purple: "bg-sales-purple-soft text-sales-purple-fg",
  success: "bg-sales-success-soft text-sales-success-fg",
  danger: "bg-sales-danger-soft text-sales-danger-fg",
  warning: "bg-sales-warning-soft text-sales-warning-fg",
  brand: "bg-sales-brand-soft-solid text-sales-brand-fg",
} as const;

const accents = {
  blue: "bg-sales-info",
  neutral: "bg-sales-text-muted",
  purple: "bg-sales-purple",
  success: "bg-sales-success",
  danger: "bg-sales-danger",
  warning: "bg-sales-warning",
  brand: "bg-sales-brand",
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
  const className = cn(
    "sd-card group relative flex h-full w-full min-h-[118px] min-w-0 flex-col overflow-hidden p-3.5 text-left",
    "transition-[border-color,box-shadow] duration-150 sm:min-h-[128px] sm:p-4",
    onClick &&
      "hover:border-sales-border-strong hover:shadow-sales-card-hover focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sales-focus-outline)]"
  );

  const body = (
    <>
      <span className={cn("absolute inset-x-0 top-0 h-[2px]", accents[tone])} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
          {label}
        </p>
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-sales-sm",
            tones[tone]
          )}
        >
          <Icon size={14} strokeWidth={1.8} aria-hidden />
        </span>
      </div>
      <p className="mt-3 truncate text-[24px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-sales-text-primary sm:text-[26px]">
        {value}
      </p>
      <p className="mt-auto truncate pt-3 text-[11px] leading-4 text-sales-text-muted">{supporting}</p>
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
