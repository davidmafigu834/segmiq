"use client";

import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/ui/cn";

const controlFocus =
  "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sales-control-focus-outline,#d4ff4f)]";

const controlMotion =
  "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease motion-reduce:transition-none";

/** Showcase-only. Applies hover chrome without changing production interaction. */
export type SalesControlPreviewState = "hover" | "focus";

/* ─── Switch ─────────────────────────────────────────────────────────────── */

export type SalesSwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  name?: string;
  required?: boolean;
  "aria-label"?: string;
  className?: string;
  /** Showcase-only visual state. Do not use on product pages. */
  previewState?: SalesControlPreviewState;
};

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  id,
  name,
  required,
  "aria-label": ariaLabel,
  className,
  previewState,
}: SalesSwitchProps) {
  const previewOn = checked;
  const previewHover = previewState === "hover";
  const previewFocus = previewState === "focus";

  return (
    <button
      id={id}
      name={name}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-required={required || undefined}
      disabled={disabled}
      data-state={checked ? "checked" : "unchecked"}
      data-disabled={disabled ? "" : undefined}
      data-preview={previewState || undefined}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        // Visual 36×20; `before` expands hit area toward ~44×44 on touch.
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border",
        "border-[var(--sales-switch-track-border)] touch-manipulation",
        "before:absolute before:-inset-x-1.5 before:-inset-y-3 before:content-['']",
        controlMotion,
        controlFocus,
        "disabled:cursor-not-allowed",
        previewOn
          ? cn(
              "bg-sales-brand",
              !disabled && "hover:bg-[var(--sales-brand-hover)]",
              previewHover && "bg-[var(--sales-brand-hover)]",
              disabled && "opacity-[0.5]"
            )
          : cn(
              "bg-[var(--sales-switch-track-off)]",
              !disabled && "hover:bg-[var(--sales-switch-track-off-hover)]",
              previewHover && "bg-[var(--sales-switch-track-off-hover)]",
              disabled && "opacity-[0.55]"
            ),
        previewFocus &&
          "outline outline-2 outline-offset-2 outline-[var(--sales-control-focus-outline,#d4ff4f)]",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none inline-block h-3.5 w-3.5 rounded-full shadow-[var(--sales-switch-thumb-shadow)]",
          controlMotion,
          previewOn
            ? "translate-x-[19px] bg-[var(--sales-switch-thumb-on)]"
            : "translate-x-[3px] bg-[var(--sales-switch-thumb-off)]"
        )}
      />
    </button>
  );
}

/* ─── Checkbox ───────────────────────────────────────────────────────────── */

export type SalesCheckboxProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  name?: string;
  value?: string;
  required?: boolean;
  label?: string;
  indeterminate?: boolean;
  "aria-label"?: string;
  className?: string;
  /** Showcase-only visual state. Do not use on product pages. */
  previewState?: SalesControlPreviewState;
};

export function Checkbox({
  checked,
  onCheckedChange,
  disabled,
  id,
  name,
  value,
  required,
  label,
  indeterminate = false,
  "aria-label": ariaLabel,
  className,
  previewState,
}: SalesCheckboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isChecked = checked && !indeterminate;
  const showMark = checked || indeterminate;
  const previewHover = previewState === "hover";
  const previewFocus = previewState === "focus";

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const box = (
    <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
      <input
        ref={inputRef}
        id={id}
        name={name}
        value={value}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel ?? label}
        aria-checked={indeterminate ? "mixed" : checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        className={cn(
          "peer absolute z-10 cursor-pointer opacity-0 disabled:cursor-not-allowed",
          // 16px visual · ~44px touch hit · desktop stays compact for dense tables
          "left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 sm:inset-0 sm:h-4 sm:w-4 sm:translate-x-0 sm:translate-y-0"
        )}
      />
      <span
        aria-hidden
        data-state={indeterminate ? "indeterminate" : checked ? "checked" : "unchecked"}
        className={cn(
          "pointer-events-none flex h-4 w-4 items-center justify-center rounded-[4px] border",
          controlMotion,
          "peer-focus-visible:shadow-[var(--sales-control-focus-ring)]",
          previewFocus && "shadow-[var(--sales-control-focus-ring)]",
          showMark
            ? cn(
                "border-sales-brand bg-sales-brand text-[var(--sales-ink)]",
                !disabled && "peer-hover:border-[var(--sales-brand-hover)] peer-hover:bg-[var(--sales-brand-hover)]",
                previewHover && "border-[var(--sales-brand-hover)] bg-[var(--sales-brand-hover)]",
                disabled && "opacity-[0.5]"
              )
            : cn(
                "border-[var(--sales-check-border)] bg-[var(--sales-check-bg)]",
                !disabled && "peer-hover:border-[var(--sales-check-border-hover)]",
                previewHover && "border-[var(--sales-check-border-hover)]",
                disabled && "opacity-[0.55]"
              )
        )}
      >
        {indeterminate ? (
          <Minus size={11} strokeWidth={3} />
        ) : isChecked ? (
          <Check size={11} strokeWidth={3} />
        ) : null}
      </span>
    </span>
  );

  if (!label) {
    return <span className={cn("inline-flex items-center", className)}>{box}</span>;
  }

  return (
    <label
      htmlFor={id}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 py-1 text-[13px] text-sales-text-primary sm:min-h-8",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
        className
      )}
    >
      {box}
      <span className={cn(disabled && "text-sales-text-disabled")}>{label}</span>
    </label>
  );
}

/* ─── Radio ──────────────────────────────────────────────────────────────── */

export type SalesRadioProps = {
  checked: boolean;
  onChange: () => void;
  name: string;
  value: string;
  disabled?: boolean;
  id?: string;
  label?: string;
  required?: boolean;
  "aria-label"?: string;
  className?: string;
  /** Showcase-only visual state. Do not use on product pages. */
  previewState?: SalesControlPreviewState;
};

export function Radio({
  checked,
  onChange,
  name,
  value,
  disabled,
  id,
  label,
  required,
  "aria-label": ariaLabel,
  className,
  previewState,
}: SalesRadioProps) {
  const previewHover = previewState === "hover";
  const previewFocus = previewState === "focus";

  const control = (
    <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel ?? label}
        onChange={onChange}
        className={cn(
          "peer absolute z-10 cursor-pointer opacity-0 disabled:cursor-not-allowed",
          "left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 sm:inset-0 sm:h-4 sm:w-4 sm:translate-x-0 sm:translate-y-0"
        )}
      />
      <span
        aria-hidden
        data-state={checked ? "checked" : "unchecked"}
        className={cn(
          "pointer-events-none flex h-4 w-4 items-center justify-center rounded-full border bg-[var(--sales-check-bg)]",
          controlMotion,
          "peer-focus-visible:shadow-[var(--sales-control-focus-ring)]",
          previewFocus && "shadow-[var(--sales-control-focus-ring)]",
          checked
            ? cn(
                "border-sales-brand",
                !disabled && "peer-hover:border-[var(--sales-brand-hover)]",
                previewHover && "border-[var(--sales-brand-hover)]",
                disabled && "opacity-[0.5]"
              )
            : cn(
                "border-[var(--sales-check-border)]",
                !disabled && "peer-hover:border-[var(--sales-check-border-hover)]",
                previewHover && "border-[var(--sales-check-border-hover)]",
                disabled && "opacity-[0.55]"
              )
        )}
      >
        {checked ? <span className="h-2 w-2 rounded-full bg-sales-brand" /> : null}
      </span>
    </span>
  );

  if (!label) {
    return <span className={cn("inline-flex items-center", className)}>{control}</span>;
  }

  return (
    <label
      htmlFor={id}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 py-1 text-[13px] text-sales-text-primary sm:min-h-8",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
        className
      )}
    >
      {control}
      <span className={cn(disabled && "text-sales-text-disabled")}>{label}</span>
    </label>
  );
}

/* ─── SegmentedControl ───────────────────────────────────────────────────── */

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  badge?: string | number;
  icon?: ReactNode;
  disabled?: boolean;
};

export type SalesSegmentedControlProps<T extends string> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  "aria-label"?: string;
  /** Showcase-only: paints one option as hover without changing value. */
  previewHoverValue?: T;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
  previewHoverValue,
}: SalesSegmentedControlProps<T>) {
  const enabled = options.filter((o) => !o.disabled);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (enabled.length === 0) return;
    const idx = enabled.findIndex((o) => o.value === value);
    if (idx < 0) return;
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      next = (idx + 1) % enabled.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      next = (idx - 1 + enabled.length) % enabled.length;
    } else if (e.key === "Home") {
      next = 0;
    } else if (e.key === "End") {
      next = enabled.length - 1;
    }
    if (next < 0) return;
    e.preventDefault();
    onChange(enabled[next].value);
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn(
        "scrollbar-hide inline-flex h-11 max-w-full flex-nowrap items-stretch gap-0 overflow-x-auto overscroll-x-contain",
        "rounded-[8px] border border-[var(--sales-segment-track-border)] bg-[var(--sales-segment-track-bg)] p-0.5",
        "shadow-[var(--sales-segment-track-shadow)] sm:h-9",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        const previewHover = previewHoverValue === opt.value && !active;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={opt.disabled}
            tabIndex={active ? 0 : -1}
            onClick={() => {
              if (!opt.disabled) onChange(opt.value);
            }}
            data-state={active ? "on" : "off"}
            data-disabled={opt.disabled ? "" : undefined}
            className={cn(
              "inline-flex min-h-0 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[6px] border px-3 text-[12px]",
              controlMotion,
              controlFocus,
              "disabled:cursor-not-allowed disabled:opacity-50",
              active
                ? cn(
                    "border-[var(--sales-segment-active-border)] bg-sales-brand font-semibold text-[var(--sales-ink)]",
                    "shadow-[var(--sales-segment-active-shadow)]",
                    "hover:bg-[var(--sales-brand-hover)] active:bg-[var(--sales-brand-active)] active:translate-y-px"
                  )
                : cn(
                    "border-transparent font-medium text-sales-text-secondary",
                    "hover:bg-[var(--sales-segment-hover)] hover:text-sales-text-primary",
                    previewHover && "bg-[var(--sales-segment-hover)] text-sales-text-primary"
                  )
            )}
          >
            {opt.icon ? (
              <span className="inline-flex size-3.5 shrink-0 items-center justify-center [&_svg]:size-3.5" aria-hidden>
                {opt.icon}
              </span>
            ) : null}
            <span className="whitespace-nowrap leading-none">{opt.label}</span>
            {opt.badge != null && opt.badge !== "" ? (
              <span
                className={cn(
                  "inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold leading-none tabular-nums",
                  active
                    ? "bg-[var(--sales-segment-count-active)] text-[var(--sales-ink)]"
                    : "bg-[var(--sales-segment-count-idle)] text-sales-text-secondary"
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

/* ─── Tabs (page-level underline navigation — Phase 04) ──────────────────── */

export type TabItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
};

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
  const enabled = items.filter((item) => !item.disabled);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (enabled.length === 0) return;
    const idx = enabled.findIndex((item) => item.id === value);
    if (idx < 0) return;
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      next = (idx + 1) % enabled.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      next = (idx - 1 + enabled.length) % enabled.length;
    } else if (e.key === "Home") {
      next = 0;
    } else if (e.key === "End") {
      next = enabled.length - 1;
    }
    if (next < 0) return;
    e.preventDefault();
    onChange(enabled[next].id);
  }

  return (
    <div
      role="tablist"
      onKeyDown={onKeyDown}
      className={cn(
        "scrollbar-hide flex gap-1 overflow-x-auto overscroll-x-contain border-b border-[var(--sales-tab-divider,var(--sales-border-subtle))]",
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
            disabled={item.disabled}
            tabIndex={active ? 0 : -1}
            onClick={() => {
              if (!item.disabled) onChange(item.id);
            }}
            className={cn(
              "relative inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-[13px] sm:h-10",
              "transition-[color,background-color] duration-[140ms] ease motion-reduce:transition-none",
              "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
              "focus-visible:outline-[var(--sales-control-focus-outline,#d4ff4f)]",
              "disabled:cursor-not-allowed disabled:opacity-50",
              active
                ? "font-semibold text-sales-text-primary"
                : "font-medium text-sales-text-secondary hover:bg-[var(--sales-tab-hover)] hover:text-sales-text-primary"
            )}
          >
            {item.icon ? (
              <span
                className="inline-flex size-3.5 shrink-0 items-center justify-center [&_svg]:size-3.5"
                aria-hidden
              >
                {item.icon}
              </span>
            ) : null}
            <span className="leading-none">{item.label}</span>
            {active ? (
              <span
                className="absolute inset-x-3 -bottom-px h-[3px] rounded-t-full bg-sales-brand"
                aria-hidden
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
