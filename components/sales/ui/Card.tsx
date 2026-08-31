import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export type SalesCardVariant =
  | "standard"
  | "compact"
  | "interactive"
  | "selected"
  | "attention"
  | "flat";

export type SalesCardAttentionTone = "warning" | "danger" | "brand" | "info";

const cardMotion =
  "transition-[border-color,background-color,box-shadow,transform] duration-[140ms] ease motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:translate-y-0";

const baseSurface =
  "bg-sales-surface border border-[var(--sales-card-border,var(--sales-border-subtle))]";

const variantClass: Record<SalesCardVariant, string> = {
  standard: cn(baseSurface, "rounded-sales-lg shadow-sales-card"),
  compact: cn(baseSurface, "rounded-sales-md shadow-sales-card"),
  interactive: cn(
    baseSurface,
    "rounded-sales-lg shadow-sales-card cursor-pointer",
    cardMotion,
    "hover:-translate-y-px hover:border-sales-border-strong hover:shadow-sales-card-hover",
    "active:translate-y-px active:shadow-sales-card",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
    "focus-visible:outline-[var(--sales-control-focus-outline,#d4ff4f)]"
  ),
  selected: cn(
    "rounded-sales-lg border bg-[var(--sales-card-selected-bg)]",
    "border-[var(--sales-card-selected-border)] shadow-[var(--sales-card-selected-shadow)]"
  ),
  attention: cn(
    "relative overflow-hidden rounded-sales-lg border border-[var(--sales-card-border,var(--sales-border-subtle))] shadow-sales-card",
    "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-['']"
  ),
  flat: cn(
    "rounded-sales-lg border border-[var(--sales-card-border,var(--sales-border-subtle))] bg-sales-surface-subtle shadow-none"
  ),
};

const attentionToneClass: Record<SalesCardAttentionTone, string> = {
  warning: "bg-[var(--sales-card-attention-warning-bg)] before:bg-sales-warning",
  danger: "bg-[var(--sales-card-attention-danger-bg)] before:bg-sales-danger",
  brand: "bg-[var(--sales-card-attention-brand-bg)] before:bg-sales-brand",
  info: "bg-[var(--sales-card-attention-info-bg)] before:bg-sales-info",
};

/** Large workspace panels (14px). Prefer `<Card>` for new compact surfaces. */
export const WORKSPACE_CARD = cn(
  "workspace-card rounded-[14px] border border-[var(--sales-card-border,var(--sales-border))] bg-sales-surface shadow-sales-card"
);

export function Card({
  variant = "standard",
  attentionTone = "warning",
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement> & {
  variant?: SalesCardVariant;
  /** Used when variant="attention". Soft wash + 3px left accent. */
  attentionTone?: SalesCardAttentionTone;
}) {
  return (
    <section
      data-variant={variant}
      data-attention-tone={variant === "attention" ? attentionTone : undefined}
      className={cn(
        "overflow-hidden",
        variantClass[variant],
        variant === "attention" && attentionToneClass[attentionTone],
        className
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  className,
  children,
  action,
  ...props
}: HTMLAttributes<HTMLDivElement> & { action?: ReactNode }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-x-3 gap-y-2",
        "border-b border-[var(--sales-card-divider,var(--sales-border-subtle))]",
        "px-4 py-3 sm:px-5 sm:py-4",
        className
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "text-[14px] font-semibold tracking-[-0.02em] text-sales-text-primary sm:text-[15px]",
        className
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "mt-0.5 text-[12px] leading-relaxed text-sales-text-secondary sm:text-[13px]",
        className
      )}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 py-4 sm:px-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-2",
        "border-t border-[var(--sales-card-divider,var(--sales-border-subtle))]",
        "px-4 py-3 sm:px-5",
        className
      )}
      {...props}
    />
  );
}
