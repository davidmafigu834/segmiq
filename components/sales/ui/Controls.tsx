"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/ui/cn";

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
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150",
        "focus:outline-none focus-visible:shadow-[var(--sales-focus-ring)]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        checked ? "bg-sales-brand" : "bg-sales-border-strong"
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-150",
          checked ? "translate-x-[18px]" : "translate-x-0.5"
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
        "inline-flex items-center gap-2 text-[13px] text-sales-text-primary",
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
        "inline-flex items-center gap-2 text-[13px] text-sales-text-primary",
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
        "inline-flex max-w-full flex-nowrap items-center gap-0 overflow-x-auto rounded-[9px] border border-[#E4E7EC] bg-white p-1",
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
              "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[7px] border px-3 py-1.5 text-[12px] transition-[background-color,border-color,color] duration-150",
              active
                ? "border-[rgba(160,210,30,0.45)] bg-[rgba(212,255,79,0.22)] font-semibold text-[#101828]"
                : "border-transparent font-medium text-[#667085] hover:text-[#101828]"
            )}
          >
            <span className="whitespace-nowrap leading-none">{opt.label}</span>
            {opt.badge != null && opt.badge !== "" ? (
              <span
                className={cn(
                  "inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-none tabular-nums",
                  active
                    ? "bg-white text-[#101828] shadow-[0_0_0_1px_rgba(16,24,40,0.04)]"
                    : "bg-[#F2F4F7] text-[#667085]"
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
      className={cn("flex gap-4 border-b border-sales-border-subtle", className)}
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
              "relative h-11 text-[13px] transition-colors duration-150",
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
