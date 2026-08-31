"use client";

import {
  forwardRef,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/ui/cn";

/**
 * 16px text below `sm` prevents iOS Safari from zooming the viewport on focus;
 * it steps back down to the 13px board size on larger screens.
 */
const fieldText = "text-[16px] font-normal sm:text-[13px] placeholder:font-normal";

/** Touch ≥44 · desktop 40 · compact 32 (desktop) / 40 (touch). */
const fieldHeight = "h-11 min-h-11 sm:h-10 sm:min-h-10";
const fieldHeightCompact = "h-10 min-h-10 sm:h-8 sm:min-h-8";

const fieldMotion =
  "transition-[border-color,box-shadow,background-color,color] duration-[140ms] ease motion-reduce:transition-none";

const fieldBase = cn(
  "w-full rounded-[8px] border bg-[var(--sales-field-bg)] text-sales-text-primary outline-none",
  "border-[var(--sales-field-border)] shadow-[var(--sales-field-shadow)]",
  "placeholder:text-[var(--sales-field-placeholder)]",
  fieldMotion,
  "hover:border-[var(--sales-field-border-hover)]",
  "focus:border-[var(--sales-field-focus-border)] focus:shadow-[var(--sales-field-focus-ring)]",
  "focus-visible:border-[var(--sales-field-focus-border)] focus-visible:shadow-[var(--sales-field-focus-ring)]",
  "disabled:cursor-not-allowed disabled:border-[var(--sales-field-disabled-border)]",
  "disabled:bg-[var(--sales-field-disabled-bg)] disabled:text-sales-text-disabled",
  "disabled:shadow-none disabled:hover:border-[var(--sales-field-disabled-border)]",
  "read-only:bg-[var(--sales-field-readonly-bg)] read-only:hover:border-[var(--sales-field-border)]",
  "read-only:focus:border-[var(--sales-field-focus-border)] read-only:focus:shadow-[var(--sales-field-focus-ring)]"
);

const fieldInvalid = cn(
  "border-[var(--sales-field-danger-border)]",
  "hover:border-[var(--sales-field-danger-border)]",
  "focus:border-[var(--sales-field-danger-border)] focus:shadow-[var(--sales-field-danger-ring)]",
  "focus-visible:border-[var(--sales-field-danger-border)] focus-visible:shadow-[var(--sales-field-danger-ring)]"
);

const fieldSuccess = cn(
  "border-[var(--sales-field-success-border)]",
  "hover:border-[var(--sales-field-success-border)]",
  "focus:border-[var(--sales-field-success-border)] focus:shadow-[var(--sales-field-success-ring)]",
  "focus-visible:border-[var(--sales-field-success-border)] focus-visible:shadow-[var(--sales-field-success-ring)]"
);

const fieldWarning = cn(
  "border-[var(--sales-field-warning-border)]",
  "hover:border-[var(--sales-field-warning-border)]",
  "focus:border-[var(--sales-field-warning-border)] focus:shadow-[var(--sales-field-warning-ring)]",
  "focus-visible:border-[var(--sales-field-warning-border)] focus-visible:shadow-[var(--sales-field-warning-ring)]"
);

const fieldIconSlot =
  "pointer-events-none absolute top-1/2 flex -translate-y-1/2 items-center justify-center text-sales-text-muted [&_svg]:size-4";

/* Hide native search clear so our accessible control owns the right slot. */
const searchNativeClearHide =
  "[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden";

/** Showcase-only. Applies hover/focus chrome without changing production interaction. */
export type SalesInputPreviewState = "hover" | "focus";

export type SalesInputProps = InputHTMLAttributes<HTMLInputElement> & {
  compact?: boolean;
  invalid?: boolean;
  tone?: "success" | "warning";
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  rightAccessory?: ReactNode;
  /** Showcase-only visual state. Do not use on product pages. */
  previewState?: SalesInputPreviewState;
};

function fieldToneClass(tone?: "success" | "warning", invalid?: boolean) {
  if (invalid) return fieldInvalid;
  if (tone === "success") return fieldSuccess;
  if (tone === "warning") return fieldWarning;
  return null;
}

function previewFieldClass(
  previewState?: SalesInputPreviewState,
  invalid?: boolean,
  tone?: "success" | "warning"
) {
  if (!previewState) return null;
  if (invalid) {
    return previewState === "focus"
      ? "border-[var(--sales-field-danger-border)] shadow-[var(--sales-field-danger-ring)]"
      : "border-[var(--sales-field-danger-border)]";
  }
  if (tone === "success") {
    return previewState === "focus"
      ? "border-[var(--sales-field-success-border)] shadow-[var(--sales-field-success-ring)]"
      : "border-[var(--sales-field-success-border)]";
  }
  if (tone === "warning") {
    return previewState === "focus"
      ? "border-[var(--sales-field-warning-border)] shadow-[var(--sales-field-warning-ring)]"
      : "border-[var(--sales-field-warning-border)]";
  }
  if (previewState === "hover") {
    return "border-[var(--sales-field-border-hover)]";
  }
  return "border-[var(--sales-field-focus-border)] shadow-[var(--sales-field-focus-ring)]";
}

function fieldHorizontalPad(hasLeft: boolean, hasRight: boolean) {
  if (hasLeft && hasRight) return "pl-10 pr-10";
  if (hasLeft) return "pl-10 pr-3";
  if (hasRight) return "pl-3 pr-10";
  return "px-3";
}

export const Input = forwardRef<HTMLInputElement, SalesInputProps>(function Input(
  {
    className,
    compact,
    invalid,
    tone,
    leftIcon,
    rightIcon,
    rightAccessory,
    previewState,
    disabled,
    readOnly,
    ...props
  },
  ref
) {
  const right = rightAccessory ?? rightIcon;
  const hasLeft = Boolean(leftIcon);
  const hasRight = Boolean(right);
  const wrapped = hasLeft || hasRight;

  const input = (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      disabled={disabled}
      readOnly={readOnly}
      data-preview={previewState || undefined}
      className={cn(
        fieldBase,
        fieldText,
        compact ? fieldHeightCompact : fieldHeight,
        fieldHorizontalPad(hasLeft, hasRight),
        fieldToneClass(tone, invalid),
        previewFieldClass(previewState, invalid, tone),
        !wrapped && className
      )}
      {...props}
    />
  );

  if (!wrapped) return input;

  return (
    <div className={cn("group relative w-full", className)}>
      {hasLeft ? (
        <span
          className={cn(
            fieldIconSlot,
            "left-3 transition-colors duration-[140ms] ease group-focus-within:text-sales-text-secondary"
          )}
          aria-hidden="true"
        >
          {leftIcon}
        </span>
      ) : null}
      {input}
      {hasRight ? (
        <span
          className={cn(
            fieldIconSlot,
            "right-3 transition-colors duration-[140ms] ease group-focus-within:text-sales-text-secondary"
          )}
          aria-hidden="true"
        >
          {right}
        </span>
      ) : null}
    </div>
  );
});

export type SalesTextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
  tone?: "success" | "warning";
  /** Showcase-only visual state. Do not use on product pages. */
  previewState?: SalesInputPreviewState;
};

export const TextArea = forwardRef<HTMLTextAreaElement, SalesTextAreaProps>(function TextArea(
  { className, invalid, tone, previewState, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      data-preview={previewState || undefined}
      className={cn(
        fieldBase,
        fieldText,
        "min-h-[96px] resize-y px-3 py-2.5 sm:min-h-[88px]",
        "[scrollbar-width:thin]",
        fieldToneClass(tone, invalid),
        previewFieldClass(previewState, invalid, tone),
        className
      )}
      {...props}
    />
  );
});

export type SalesSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  compact?: boolean;
  invalid?: boolean;
  tone?: "success" | "warning";
};

export const Select = forwardRef<HTMLSelectElement, SalesSelectProps>(function Select(
  { className, compact, invalid, tone, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        fieldBase,
        fieldText,
        compact ? fieldHeightCompact : fieldHeight,
        "px-3",
        fieldToneClass(tone, invalid),
        className?.match(/\b(!?w-|max-w-)/) ? null : "w-full",
        className
      )}
      {...props}
    />
  );
});

export type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  /** Show ⌘K hint when empty (design-system boards / desktop). */
  shortcutHint?: boolean;
  /** Alias of `shortcutHint` for call-site clarity. */
  showShortcut?: boolean;
  /** Showcase-only visual state. Do not use on product pages. */
  previewState?: SalesInputPreviewState;
};

export function SearchInput({
  value,
  onChange,
  onClear,
  placeholder = "Search…",
  className,
  id,
  name,
  disabled,
  shortcutHint = false,
  showShortcut,
  previewState,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const showKbd = Boolean(showShortcut ?? shortcutHint);
  const hasQuery = value.length > 0;

  return (
    <div className={cn("group relative w-full", className)}>
      <Search
        size={16}
        strokeWidth={1.8}
        className={cn(
          "pointer-events-none absolute left-3 top-1/2 z-[1] size-4 -translate-y-1/2 text-sales-text-muted",
          "transition-colors duration-[140ms] ease",
          "group-focus-within:text-sales-text-secondary",
          previewState === "focus" && "text-sales-text-secondary"
        )}
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="search"
        value={value}
        disabled={disabled}
        autoComplete="off"
        placeholder={placeholder}
        data-preview={previewState || undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          fieldBase,
          fieldText,
          fieldHeight,
          "pl-10 pr-10",
          searchNativeClearHide,
          previewFieldClass(previewState, false)
        )}
      />
      {hasQuery && !disabled ? (
        <button
          type="button"
          className={cn(
            "absolute right-1.5 top-1/2 z-[1] flex h-9 w-9 -translate-y-1/2 items-center justify-center",
            "rounded-[6px] text-sales-text-muted transition-colors duration-[140ms] ease",
            "hover:bg-sales-surface-hover hover:text-sales-text-primary",
            "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1",
            "focus-visible:outline-[var(--sales-focus-outline)]"
          )}
          aria-label="Clear search"
          onClick={() => {
            onChange("");
            onClear?.();
            inputRef.current?.focus();
          }}
        >
          <X size={14} strokeWidth={1.8} aria-hidden="true" />
        </button>
      ) : showKbd ? (
        <kbd
          className={cn(
            "pointer-events-none absolute right-2.5 top-1/2 z-[1] hidden h-[22px] -translate-y-1/2 items-center",
            "rounded-[5px] border border-[var(--sales-field-shortcut-border)] bg-[var(--sales-field-shortcut-bg)]",
            "px-1.5 text-[11px] font-medium tabular-nums text-sales-text-muted sm:inline-flex"
          )}
          aria-hidden="true"
        >
          ⌘K
        </kbd>
      ) : null}
    </div>
  );
}

export function FieldLabel({
  children,
  htmlFor,
  required,
  optional,
  className,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  optional?: boolean;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("mb-1.5 block text-[12px] font-semibold text-sales-text-label", className)}
    >
      {children}
      {required ? <span className="ml-0.5 text-sales-danger">*</span> : null}
      {optional ? (
        <span className="ml-1.5 text-[11px] font-normal text-sales-text-muted">Optional</span>
      ) : null}
    </label>
  );
}

export function FieldError({ id, children }: { id?: string; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 text-[12px] font-normal text-sales-danger">
      {children}
    </p>
  );
}

export function FieldHint({ id, children }: { id?: string; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 text-[12px] font-normal text-sales-text-muted">
      {children}
    </p>
  );
}
