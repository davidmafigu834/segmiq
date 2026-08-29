"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type MouseEventHandler,
  type ReactNode,
} from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/ui/cn";

export type SalesButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "success"
  | "link";
export type SalesButtonSize = "sm" | "md" | "lg";

/** Showcase-only. Applies hover/active chrome without changing production hover logic. */
export type SalesButtonPreviewState = "hover" | "active";

const focusClass =
  "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sales-btn-focus-outline,#d4ff4f)]";

const motionClass =
  "transition-[background-color,border-color,color,box-shadow,transform] duration-[140ms] ease-out motion-reduce:transition-none motion-reduce:active:translate-y-0";

const iconPx: Record<SalesButtonSize, number> = {
  sm: 14,
  md: 16,
  lg: 18,
};

const iconClass: Record<SalesButtonSize, string> = {
  sm: "[&_svg]:size-[14px]",
  md: "[&_svg]:size-4",
  lg: "[&_svg]:size-[18px]",
};

const sizeClass: Record<SalesButtonSize, string> = {
  sm: "h-8 min-h-8 px-3 text-[12px] gap-2 rounded-[8px]",
  md: "h-11 min-h-11 px-4 text-[13px] gap-2 rounded-[8px] sm:h-10 sm:min-h-10",
  lg: "h-12 min-h-12 px-5 text-[14px] gap-2 rounded-[8px]",
};

const variantClass: Record<SalesButtonVariant, string> = {
  primary: cn(
    "sales-btn-primary bg-sales-brand text-[var(--sales-ink)] border border-[var(--sales-btn-primary-border)] shadow-[var(--sales-btn-shadow)]",
    "hover:bg-[var(--sales-brand-hover)] hover:shadow-[var(--sales-btn-shadow-hover)]",
    "active:bg-[var(--sales-brand-active)] active:translate-y-px active:shadow-[var(--sales-btn-shadow-active)]",
    "data-[preview=hover]:bg-[var(--sales-brand-hover)] data-[preview=hover]:shadow-[var(--sales-btn-shadow-hover)]",
    "data-[preview=active]:bg-[var(--sales-brand-active)] data-[preview=active]:translate-y-px data-[preview=active]:shadow-[var(--sales-btn-shadow-active)]"
  ),
  secondary: cn(
    "bg-sales-surface text-sales-text-primary border border-[var(--sales-btn-secondary-border)] shadow-[var(--sales-btn-shadow-secondary)]",
    "hover:bg-sales-surface-hover hover:border-[var(--sales-btn-secondary-border-hover)]",
    "active:bg-sales-surface-active active:translate-y-px active:shadow-none",
    "data-[preview=hover]:bg-sales-surface-hover data-[preview=hover]:border-[var(--sales-btn-secondary-border-hover)]",
    "data-[preview=active]:bg-sales-surface-active data-[preview=active]:translate-y-px data-[preview=active]:shadow-none"
  ),
  ghost: cn(
    "bg-transparent text-sales-text-secondary border border-transparent shadow-none",
    "hover:bg-sales-surface-hover hover:text-sales-text-primary",
    "active:bg-sales-surface-active active:translate-y-px",
    "data-[preview=hover]:bg-sales-surface-hover data-[preview=hover]:text-sales-text-primary",
    "data-[preview=active]:bg-sales-surface-active data-[preview=active]:translate-y-px"
  ),
  danger: cn(
    "bg-sales-danger text-white border border-transparent shadow-[var(--sales-btn-shadow)]",
    "hover:bg-[var(--sales-btn-danger-hover)] hover:shadow-[var(--sales-btn-shadow-hover)]",
    "active:bg-[var(--sales-btn-danger-active)] active:translate-y-px active:shadow-[var(--sales-btn-shadow-active)]",
    "data-[preview=hover]:bg-[var(--sales-btn-danger-hover)] data-[preview=hover]:shadow-[var(--sales-btn-shadow-hover)]",
    "data-[preview=active]:bg-[var(--sales-btn-danger-active)] data-[preview=active]:translate-y-px data-[preview=active]:shadow-[var(--sales-btn-shadow-active)]"
  ),
  success: cn(
    "bg-sales-success text-white border border-transparent shadow-[var(--sales-btn-shadow)]",
    "hover:brightness-[0.95] hover:shadow-[var(--sales-btn-shadow-hover)]",
    "active:brightness-90 active:translate-y-px active:shadow-[var(--sales-btn-shadow-active)]",
    "data-[preview=hover]:brightness-[0.95] data-[preview=hover]:shadow-[var(--sales-btn-shadow-hover)]",
    "data-[preview=active]:brightness-90 data-[preview=active]:translate-y-px data-[preview=active]:shadow-[var(--sales-btn-shadow-active)]"
  ),
  link: "h-auto min-h-0 bg-transparent border-transparent px-0 text-sales-brand-fg shadow-none hover:underline data-[preview=hover]:underline",
};

export type SalesButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: SalesButtonVariant;
  size?: SalesButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  /** Showcase-only visual state. Do not use on product pages. */
  previewState?: SalesButtonPreviewState;
};

export const Button = forwardRef<HTMLButtonElement, SalesButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    leftIcon,
    rightIcon,
    previewState,
    className,
    disabled,
    children,
    type = "button",
    ...props
  },
  ref
) {
  const isDisabled = Boolean(disabled);
  const interactLocked = isDisabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={interactLocked}
      aria-busy={loading || undefined}
      data-preview={previewState}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap font-semibold leading-none tracking-[-0.01em]",
        "touch-manipulation",
        motionClass,
        focusClass,
        interactLocked && "cursor-not-allowed pointer-events-none",
        isDisabled && !loading && "opacity-[0.48] shadow-none",
        variantClass[variant],
        variant !== "link" ? sizeClass[size] : "text-[13px] gap-2 font-semibold",
        iconClass[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2
          size={iconPx[size]}
          strokeWidth={1.8}
          className="shrink-0 animate-spin"
          aria-hidden
        />
      ) : leftIcon ? (
        <span className="inline-flex shrink-0 items-center" aria-hidden>
          {leftIcon}
        </span>
      ) : null}
      {children}
      {!loading && rightIcon ? (
        <span className="inline-flex shrink-0 items-center" aria-hidden>
          {rightIcon}
        </span>
      ) : null}
    </button>
  );
});

export type IconButtonSize = "sm" | "md" | "lg";

const iconBtnVisual: Record<IconButtonSize, string> = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-10 w-10",
};

const iconBtnGlyph: Record<IconButtonSize, string> = {
  sm: "[&_svg]:size-[14px]",
  md: "[&_svg]:size-4",
  lg: "[&_svg]:size-[18px]",
};

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  "aria-label": string;
  size?: IconButtonSize;
  active?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  /** Showcase-only visual state. Do not use on product pages. */
  previewState?: SalesButtonPreviewState;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    size = "lg",
    active = false,
    loading = false,
    icon,
    previewState,
    className,
    children,
    type = "button",
    disabled,
    ...props
  },
  ref
) {
  const isDisabled = Boolean(disabled);
  const interactLocked = isDisabled || loading;
  const glyph = icon ?? children;

  return (
    <button
      ref={ref}
      type={type}
      disabled={interactLocked}
      aria-busy={loading || undefined}
      aria-pressed={active || undefined}
      data-preview={previewState}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-[8px] border touch-manipulation",
        // 44×44 hit target on touch widths; visual size stays compact.
        "before:absolute before:left-1/2 before:top-1/2 before:h-11 before:w-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] sm:before:hidden",
        motionClass,
        focusClass,
        iconBtnVisual[size],
        iconBtnGlyph[size],
        interactLocked && "cursor-not-allowed pointer-events-none",
        isDisabled && !loading && "opacity-[0.48]",
        active
          ? "border-[var(--sales-btn-icon-active-border)] bg-[var(--sales-btn-icon-active-bg)] text-sales-brand-fg"
          : cn(
              "border-transparent bg-transparent text-sales-text-secondary",
              "hover:border-sales-border hover:bg-sales-surface-hover hover:text-sales-text-primary",
              "active:bg-sales-surface-active active:translate-y-px",
              "data-[preview=hover]:border-sales-border data-[preview=hover]:bg-sales-surface-hover data-[preview=hover]:text-sales-text-primary",
              "data-[preview=active]:border-[var(--sales-btn-icon-active-border)] data-[preview=active]:bg-[var(--sales-btn-icon-active-bg)] data-[preview=active]:text-sales-brand-fg"
            ),
        className
      )}
      {...props}
    >
      <span className="inline-flex items-center justify-center" aria-hidden>
        {loading ? (
          <Loader2 size={iconPx[size === "lg" ? "lg" : size]} strokeWidth={1.8} className="animate-spin" />
        ) : (
          glyph
        )}
      </span>
    </button>
  );
});

export type SplitButtonMenuItem = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

export type SplitButtonProps = {
  variant?: Extract<SalesButtonVariant, "primary" | "secondary">;
  size?: SalesButtonSize;
  className?: string;
  /** Visible label. Falls back to `children`. */
  label?: ReactNode;
  children?: ReactNode;
  leftIcon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  onMainClick?: MouseEventHandler<HTMLButtonElement>;
  trailing?: ReactNode;
  onTrailingClick?: MouseEventHandler<HTMLButtonElement>;
  trailingAriaLabel?: string;
  menuItems?: SplitButtonMenuItem[];
  /** Showcase-only visual state. Do not use on product pages. */
  previewState?: SalesButtonPreviewState;
};

const splitChevronWidth: Record<SalesButtonSize, string> = {
  sm: "w-9 min-w-9",
  md: "w-10 min-w-10",
  lg: "w-10 min-w-10",
};

const splitHeight: Record<SalesButtonSize, string> = {
  sm: "h-8 min-h-8",
  md: "h-11 min-h-11 sm:h-10 sm:min-h-10",
  lg: "h-12 min-h-12",
};

/**
 * One connected control: primary (or secondary) action + chevron segment.
 * Pass `menuItems` for a built-in menu, or `onTrailingClick` to reuse an existing menu.
 */
export function SplitButton({
  variant = "primary",
  size = "md",
  className,
  label,
  children,
  leftIcon,
  loading = false,
  disabled = false,
  onClick,
  onMainClick,
  trailing,
  onTrailingClick,
  trailingAriaLabel = "More actions",
  menuItems,
  previewState,
}: SplitButtonProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const interactLocked = disabled || loading;
  const text = label ?? children;
  const handleMain = onMainClick ?? onClick;
  const hasMenu = Boolean(menuItems?.length);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const shared = cn(
    "inline-flex select-none items-center justify-center font-semibold leading-none tracking-[-0.01em]",
    "touch-manipulation",
    motionClass,
    focusClass,
    splitHeight[size],
    size === "sm" ? "text-[12px]" : size === "lg" ? "text-[14px]" : "text-[13px]",
    iconClass[size],
    interactLocked && "cursor-not-allowed pointer-events-none",
    disabled && !loading && "opacity-[0.48] shadow-none",
    variant === "primary"
      ? cn(
          "bg-sales-brand text-[var(--sales-ink)] border-[var(--sales-btn-primary-border)]",
          "hover:bg-[var(--sales-brand-hover)]",
          "active:bg-[var(--sales-brand-active)] active:translate-y-px",
          "data-[preview=hover]:bg-[var(--sales-brand-hover)]",
          "data-[preview=active]:bg-[var(--sales-brand-active)] data-[preview=active]:translate-y-px"
        )
      : cn(
          "bg-sales-surface text-sales-text-primary border-[var(--sales-btn-secondary-border)]",
          "hover:bg-sales-surface-hover",
          "active:bg-sales-surface-active active:translate-y-px",
          "data-[preview=hover]:bg-sales-surface-hover",
          "data-[preview=active]:bg-sales-surface-active data-[preview=active]:translate-y-px"
        )
  );

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative inline-flex items-stretch rounded-[8px]",
        variant === "primary" ? "shadow-[var(--sales-btn-shadow)]" : "shadow-[var(--sales-btn-shadow-secondary)]",
        previewState === "hover" && variant === "primary" && "shadow-[var(--sales-btn-shadow-hover)]",
        previewState === "active" && "shadow-[var(--sales-btn-shadow-active)]",
        className
      )}
    >
      <button
        type="button"
        disabled={interactLocked}
        aria-busy={loading || undefined}
        data-preview={previewState}
        onClick={handleMain}
        className={cn(
          shared,
          "rounded-l-[8px] rounded-r-none border border-r-0 gap-2",
          size === "sm" ? "px-3" : size === "lg" ? "px-5" : "px-4"
        )}
      >
        {loading ? (
          <Loader2 size={iconPx[size]} strokeWidth={1.8} className="shrink-0 animate-spin" aria-hidden />
        ) : leftIcon ? (
          <span className="inline-flex shrink-0 items-center" aria-hidden>
            {leftIcon}
          </span>
        ) : null}
        {text}
      </button>
      <button
        type="button"
        disabled={interactLocked}
        data-preview={previewState}
        aria-label={trailingAriaLabel}
        aria-haspopup={hasMenu ? "menu" : undefined}
        aria-expanded={hasMenu ? open : undefined}
        aria-controls={hasMenu && open ? listId : undefined}
        onClick={(e) => {
          if (hasMenu) {
            setOpen((v) => !v);
            return;
          }
          onTrailingClick?.(e);
        }}
        className={cn(
          shared,
          splitChevronWidth[size],
          "rounded-r-[8px] rounded-l-none border",
          variant === "primary"
            ? "border-l-[var(--sales-btn-split-divider)]"
            : "border-l-sales-border-strong",
          open && variant === "primary" && "bg-[var(--sales-brand-hover)]"
        )}
      >
        {trailing ?? <ChevronDown size={iconPx[size]} strokeWidth={2} aria-hidden />}
      </button>

      {hasMenu && open ? (
        <div
          id={listId}
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-[var(--sales-z-dropdown,40)] min-w-[180px] overflow-hidden rounded-[8px] border border-sales-border bg-sales-surface py-1 shadow-sales-dropdown"
        >
          {menuItems!.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                item.onClick();
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center px-3 py-2.5 text-left text-[13px] font-medium text-sales-text-secondary",
                "hover:bg-sales-surface-hover hover:text-sales-text-primary",
                focusClass,
                "disabled:cursor-not-allowed disabled:opacity-40"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
