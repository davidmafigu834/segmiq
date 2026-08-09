"use client";

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/ui/cn";

const fieldBase =
  "w-full rounded-sales-md border border-sales-border bg-sales-surface text-sales-text-primary placeholder:text-sales-text-muted outline-none transition-colors duration-150 focus:border-sales-brand focus:shadow-[var(--sales-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed";

export type SalesInputProps = InputHTMLAttributes<HTMLInputElement> & {
  compact?: boolean;
  invalid?: boolean;
};

export const Input = forwardRef<HTMLInputElement, SalesInputProps>(
  function Input({ className, compact, invalid, ...props }, ref) {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          fieldBase,
          compact ? "h-9 px-3 text-[13px]" : "h-10 px-3 text-[13px]",
          invalid &&
            "border-sales-danger focus:border-sales-danger focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]",
          className
        )}
        {...props}
      />
    );
  }
);

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(fieldBase, "min-h-[88px] resize-none px-3 py-2.5 text-[13px]", className)}
        {...props}
      />
    );
  }
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "rounded-sales-md border border-sales-border bg-sales-surface text-sales-text-primary outline-none transition-colors duration-150",
          "focus:border-sales-brand focus:shadow-[var(--sales-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50",
          "h-10 px-3 text-[13px]",
          // Default full width unless caller sets a width class / wrapper constrains it
          className?.match(/\b(!?w-|max-w-)/) ? null : "w-full",
          className
        )}
        {...props}
      />
    );
  }
);

export function SearchInput({
  value,
  onChange,
  onClear,
  placeholder = "Search…",
  className,
  id,
  shortcutHint = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
  id?: string;
  /** Show ⌘K hint when empty (design-system boards) */
  shortcutHint?: boolean;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search
        size={16}
        strokeWidth={1.8}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sales-text-muted"
        aria-hidden
      />
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn("pl-9", value || shortcutHint ? "pr-12" : "pr-9")}
        type="search"
      />
      {value ? (
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sales-sm p-1 text-sales-text-muted hover:text-sales-text-primary"
          aria-label="Clear search"
          onClick={() => {
            onChange("");
            onClear?.();
          }}
        >
          <X size={14} strokeWidth={1.8} />
        </button>
      ) : shortcutHint ? (
        <kbd
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-sales-border bg-sales-surface-subtle px-1.5 py-0.5 text-[10px] font-medium text-sales-text-muted"
          aria-hidden
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
  className,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("mb-1.5 block text-[12px] font-medium text-[#344054]", className)}
    >
      {children}
      {required ? <span className="ml-0.5 text-sales-danger">*</span> : null}
    </label>
  );
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-1 text-[12px] text-sales-danger">{children}</p>;
}

export function FieldHint({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-1 text-[12px] text-sales-text-secondary">{children}</p>;
}
