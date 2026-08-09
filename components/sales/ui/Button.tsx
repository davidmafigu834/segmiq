"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/ui/cn";

export type SalesButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "success"
  | "link";
export type SalesButtonSize = "sm" | "md" | "lg";

const variantClass: Record<SalesButtonVariant, string> = {
  primary:
    "bg-sales-brand text-sales-brand-text hover:bg-sales-brand-hover active:bg-[var(--sales-brand-hover)] border border-transparent",
  secondary:
    "bg-sales-surface text-sales-text-primary border border-sales-border-strong hover:bg-sales-surface-hover hover:border-sales-border-strong active:bg-[var(--sales-neutral-100)]",
  ghost:
    "bg-transparent text-sales-text-secondary border border-transparent hover:bg-sales-surface-hover hover:text-sales-text-primary",
  danger:
    "bg-sales-danger text-white border border-transparent hover:bg-[#DC2626] active:bg-[#B91C1C]",
  success:
    "bg-sales-success text-white border border-transparent hover:bg-[#15803D] active:bg-[#166534]",
  link: "bg-transparent border-transparent text-sales-brand-fg hover:underline px-0 h-auto min-h-0",
};

/** Board sizes: Small 32 · Medium 40 · Large 48 */
const sizeClass: Record<SalesButtonSize, string> = {
  sm: "h-8 min-h-8 px-3 text-[12px] gap-1.5 rounded-sales-sm",
  md: "h-10 min-h-10 px-3.5 text-[13px] gap-2 rounded-sales-md",
  lg: "h-12 min-h-12 px-5 text-[14px] gap-2 rounded-sales-md",
};

export type SalesButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: SalesButtonVariant;
  size?: SalesButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, SalesButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      leftIcon,
      rightIcon,
      className,
      disabled,
      children,
      type = "button",
      ...props
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center font-semibold whitespace-nowrap transition-colors duration-150",
          "focus:outline-none focus-visible:shadow-[var(--sales-focus-ring)]",
          "disabled:opacity-45 disabled:cursor-not-allowed disabled:bg-[var(--sales-neutral-100)] disabled:text-sales-text-muted disabled:border-sales-border",
          variantClass[variant],
          variant !== "link" ? sizeClass[size] : "",
          className
        )}
        {...props}
      >
        {loading ? (
          <Loader2 size={16} strokeWidth={1.8} className="animate-spin shrink-0" aria-hidden />
        ) : leftIcon ? (
          <span className="inline-flex shrink-0 [&_svg]:size-4" aria-hidden>
            {leftIcon}
          </span>
        ) : null}
        {children}
        {!loading && rightIcon ? (
          <span className="inline-flex shrink-0 [&_svg]:size-4" aria-hidden>
            {rightIcon}
          </span>
        ) : null}
      </button>
    );
  }
);

export type IconButtonSize = "sm" | "md" | "lg";

const iconSizeClass: Record<IconButtonSize, string> = {
  sm: "h-8 w-8 min-h-8 min-w-8",
  md: "h-9 w-9 min-h-9 min-w-9",
  lg: "h-10 w-10 min-h-10 min-w-10",
};

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  "aria-label": string;
  size?: IconButtonSize;
  active?: boolean;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { size = "lg", active = false, className, children, type = "button", ...props },
    ref
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center rounded-sales-md border transition-colors duration-150",
          "focus:outline-none focus-visible:shadow-[var(--sales-focus-ring)]",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          iconSizeClass[size],
          active
            ? "border-sales-brand-border bg-sales-brand-soft text-sales-text-primary"
            : "border-sales-border bg-sales-surface text-sales-text-secondary hover:bg-sales-surface-hover hover:border-sales-border-strong hover:text-sales-text-primary",
          className
        )}
        {...props}
      >
        <span className="inline-flex [&_svg]:size-[18px]" aria-hidden>
          {children}
        </span>
      </button>
    );
  }
);
