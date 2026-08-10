"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/ui/cn";

const focusRing =
  "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sales-focus-outline)]";

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  id,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        // `before` widens the hit area to ~44px without changing the visual size.
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150 touch-manipulation",
        "before:absolute before:-inset-x-1.5 before:-inset-y-3 before:content-['']",
        focusRing,
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-sales-brand" : "bg-sales-border-strong"
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 rounded-full shadow-sm transition-transform duration-150",
          // Lime is a very light track, so the "on" thumb goes dark in both themes.
          checked
            ? "translate-x-[18px] bg-sales-brand-text"
            : "translate-x-0.5 bg-[var(--sales-switch-thumb)]"
        )}
      />
    </button>
  );
}

export function Checkbox({
  checked,
  onCheckedChange,
  disabled,
  id,
  label,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  label?: string;
  "aria-label"?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "inline-flex min-h-[32px] items-center gap-2 py-1 text-[13px] text-sales-text-primary",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      )}
    >
      <span className="relative inline-flex h-4 w-4 shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-label={ariaLabel ?? label}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="peer absolute inset-0 z-10 h-4 w-4 cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <span
          className={cn(
            "pointer-events-none flex h-4 w-4 items-center justify-center rounded-[4px] border transition-colors",
            "peer-focus-visible:shadow-[var(--sales-focus-ring)]",
            checked
              ? "border-sales-brand bg-sales-brand text-sales-brand-text"
              : "border-sales-border-strong bg-sales-surface"
          )}
          aria-hidden
        >
          {checked ? <Check size={11} strokeWidth={3} /> : null}
        </span>
      </span>
      {label}
    </label>
  );
}

export function Radio({
  checked,
  onChange,
  name,
  value,
  disabled,
  id,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  name: string;
  value: string;
  disabled?: boolean;
  id?: string;
  label?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "inline-flex min-h-[32px] items-center gap-2 py-1 text-[13px] text-sales-text-primary",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      )}
    >
      <span className="relative inline-flex h-4 w-4 shrink-0">
        <input
          id={id}
          type="radio"
          name={name}
          value={value}
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          className="peer absolute inset-0 z-10 h-4 w-4 cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <span
          className={cn(
            "pointer-events-none flex h-4 w-4 items-center justify-center rounded-full border transition-colors",
            "peer-focus-visible:shadow-[var(--sales-focus-ring)]",
            checked ? "border-sales-brand bg-sales-surface" : "border-sales-border-strong bg-sales-surface"
          )}
          aria-hidden
        >
          {checked ? <span className="h-2 w-2 rounded-full bg-sales-brand" /> : null}
        </span>
      </span>
      {label}
    </label>
  );
}

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  badge?: string | number;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "scrollbar-hide inline-flex max-w-full flex-nowrap items-center gap-0 overflow-x-auto overscroll-x-contain rounded-[9px] border border-sales-border bg-sales-surface p-1",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex min-h-[34px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[7px] border px-3 py-1.5 text-[12px] transition-[background-color,border-color,color] duration-150",
              focusRing,
              active
                ? "border-sales-brand-border bg-sales-brand-soft font-semibold text-sales-text-primary"
                : "border-transparent font-medium text-sales-text-secondary hover:bg-sales-surface-hover hover:text-sales-text-primary"
            )}
          >
            <span className="whitespace-nowrap leading-none">{opt.label}</span>
            {opt.badge != null && opt.badge !== "" ? (
              <span
                className={cn(
                  "inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-none tabular-nums",
                  active
                    ? "bg-sales-surface text-sales-text-primary ring-1 ring-sales-border-subtle"
                    : "bg-sales-neutral-100 text-sales-text-secondary"
                )}
              >
                {opt.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export type TabItem = { id: string; label: string };

export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "scrollbar-hide flex gap-4 overflow-x-auto overscroll-x-contain border-b border-sales-border-subtle",
        className
      )}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              "relative h-11 shrink-0 whitespace-nowrap text-[13px] transition-colors duration-150",
              focusRing,
              active
                ? "font-semibold text-sales-text-primary"
                : "font-medium text-sales-text-secondary hover:text-sales-text-primary"
            )}
          >
            {item.label}
            {active ? (
              <span className="absolute inset-x-0 -bottom-px h-[3px] bg-sales-brand" aria-hidden />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
