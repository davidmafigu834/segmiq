import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export type SalesCardVariant =
  | "standard"
  | "compact"
  | "interactive"
  | "selected"
  | "attention"
  | "flat";

const variantClass: Record<SalesCardVariant, string> = {
  standard:
    "bg-sales-surface border border-sales-border-subtle rounded-sales-xl shadow-sales-card",
  compact:
    "bg-sales-surface border border-sales-border-subtle rounded-sales-lg shadow-sales-card",
  interactive:
    "bg-sales-surface border border-sales-border-subtle rounded-sales-xl shadow-sales-card transition-[border-color,box-shadow] duration-150 hover:border-sales-border-strong",
  selected:
    "bg-[var(--sales-brand-soft-solid)] border border-sales-brand-border rounded-sales-xl shadow-sales-card",
  attention:
    "bg-sales-danger-soft border border-sales-danger/20 rounded-sales-xl shadow-sales-card",
  flat: "bg-sales-surface border border-sales-border-subtle rounded-sales-xl",
};

export function Card({
  variant = "standard",
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement> & { variant?: SalesCardVariant }) {
  return (
    <section className={cn(variantClass[variant], "overflow-hidden", className)} {...props}>
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
        "flex items-center justify-between gap-3 border-b border-sales-border-subtle px-5 py-3.5",
        className
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "text-[15px] font-semibold tracking-[-0.01em] text-sales-text-primary",
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
  return <p className={cn("mt-0.5 text-[13px] text-sales-text-secondary", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 border-t border-sales-border-subtle px-5 py-3",
        className
      )}
      {...props}
    />
  );
}
