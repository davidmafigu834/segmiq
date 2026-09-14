import { forwardRef } from "react";
import { cn } from "@/lib/ui/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "default" | "lg" | "icon" | "icon-sm" | "icon-lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 ease-[var(--ease-out)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)] active:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=loading]:cursor-wait data-[state=error]:border-[var(--error)] data-[state=success]:border-[var(--success)]";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]",
  secondary:
    "bg-transparent text-[var(--text-primary)] border border-[var(--border)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-tertiary)]",
  ghost: "bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]",
  destructive: "border border-[var(--error)] bg-[var(--error)] text-[var(--text-on-dark)] hover:brightness-95",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3",
  default: "h-9 px-4",
  lg: "h-10 px-5",
  icon: "h-9 w-9",
  "icon-sm": "h-8 w-8",
  "icon-lg": "h-10 w-10",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "default", className, type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
});

export interface SplitButtonProps {
  variant?: ButtonVariant;
  size?: Exclude<ButtonSize, "icon" | "icon-sm" | "icon-lg">;
  className?: string;
  /** Main action. */
  children: React.ReactNode;
  onMainClick?: React.MouseEventHandler<HTMLButtonElement>;
  mainProps?: Omit<ButtonProps, "variant" | "size">;
  /** Attached trailing segment (e.g. a chevron toggle). */
  trailing: React.ReactNode;
  onTrailingClick?: React.MouseEventHandler<HTMLButtonElement>;
  trailingProps?: Omit<ButtonProps, "variant" | "size">;
  trailingAriaLabel?: string;
}

/** Vercel-style split button: main action + attached segment divided by a hairline. */
export function SplitButton({
  variant = "secondary",
  size = "default",
  className,
  children,
  onMainClick,
  mainProps,
  trailing,
  onTrailingClick,
  trailingProps,
  trailingAriaLabel,
}: SplitButtonProps) {
  const heightBySize = { sm: "h-8", default: "h-9", lg: "h-10" } as const;
  return (
    <div className={cn("inline-flex items-stretch", heightBySize[size], className)}>
      <Button
        variant={variant}
        size={size}
        onClick={onMainClick}
        className="rounded-r-none"
        {...mainProps}
      >
        {children}
      </Button>
      <Button
        variant={variant}
        size={size}
        onClick={onTrailingClick}
        aria-label={trailingAriaLabel}
        className="rounded-l-none border-l border-[var(--border)] px-2"
        {...trailingProps}
      >
        {trailing}
      </Button>
    </div>
  );
}
