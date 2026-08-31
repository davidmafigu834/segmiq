"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/ui/cn";

export type MenuSelectOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
  icon?: ReactNode;
};

export function MenuSelect<T extends string>({
  value,
  onChange,
  options,
  "aria-label": ariaLabel,
  className,
  menuClassName,
  align = "left",
  leadingIcon,
  size = "md",
  variant = "toolbar",
  triggerClassName,
  placeholder = "Select",
}: {
  value: T;
  onChange: (value: T) => void;
  options: MenuSelectOption<T>[];
  "aria-label"?: string;
  className?: string;
  menuClassName?: string;
  align?: "left" | "right";
  leadingIcon?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Toolbar chip (default) or field-style trigger aligned with Phase 02 inputs. */
  variant?: "toolbar" | "field";
  triggerClassName?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value);
  const enabledOptions = options.filter((o) => !o.disabled);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (!open) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((i) => Math.min(i + 1, enabledOptions.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const opt = enabledOptions[highlight];
        if (opt) {
          onChange(opt.value);
          setOpen(false);
        }
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, highlight, enabledOptions, onChange]);

  useEffect(() => {
    if (open) {
      const idx = Math.max(
        0,
        enabledOptions.findIndex((o) => o.value === value)
      );
      setHighlight(idx);
    }
  }, [open, value, enabledOptions]);

  const sizeClass =
    size === "sm"
      ? "h-9 min-h-9 px-2.5 text-[12px]"
      : size === "lg"
        ? "h-11 min-h-11 px-3.5 text-[14px] sm:h-11"
        : "h-10 min-h-10 px-3 text-[13px] sm:h-10";

  const fieldTrigger = cn(
    "flex w-full items-center gap-2 rounded-[8px] border border-[var(--sales-field-border)] bg-[var(--sales-field-bg)] text-left font-normal text-sales-text-primary shadow-[var(--sales-field-shadow)]",
    "transition-[border-color,box-shadow,background-color] duration-[140ms] ease hover:border-[var(--sales-field-border-hover)]",
    "focus:outline-none focus-visible:border-[var(--sales-field-focus-border)] focus-visible:shadow-[var(--sales-field-focus-ring)]",
    sizeClass,
    open && "border-[var(--sales-field-focus-border)] shadow-[var(--sales-field-focus-ring)]"
  );

  const toolbarTrigger = cn(
    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-sales-border bg-sales-surface font-medium text-sales-text-primary",
    "transition-colors duration-150 hover:border-sales-border-strong hover:bg-sales-surface-hover",
    "focus:outline-none focus-visible:shadow-[var(--sales-focus-ring)]",
    size === "sm" ? "h-8 px-2.5 text-[12px]" : size === "lg" ? "h-11 px-3.5 text-[14px]" : "h-10 px-3 text-[13px]",
    open && "border-sales-border-strong bg-sales-surface-subtle"
  );

  return (
    <div ref={rootRef} className={cn("relative shrink-0", variant === "field" && "w-full", className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className={cn(variant === "field" ? fieldTrigger : toolbarTrigger, triggerClassName)}
      >
        {leadingIcon ? (
          <span className="inline-flex shrink-0 text-sales-text-muted" aria-hidden>
            {leadingIcon}
          </span>
        ) : null}
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            !selected && "text-[var(--sales-field-placeholder)]",
            variant === "toolbar" && (size === "sm" ? "max-w-[6.5rem]" : "max-w-[8.5rem]")
          )}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={size === "sm" ? 13 : 14}
          strokeWidth={2}
          className={cn(
            "shrink-0 text-sales-text-muted transition-transform duration-150 motion-reduce:transition-none",
            open && "rotate-180 text-sales-text-secondary"
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className={cn(
            "sales-menu-surface absolute top-[calc(100%+6px)] z-[var(--sales-z-dropdown,40)] max-h-[320px] min-w-[180px] overflow-y-auto rounded-[10px] border border-sales-border bg-sales-surface py-1.5 shadow-sales-dropdown",
            align === "right" ? "right-0" : "left-0",
            variant === "field" && "w-full",
            menuClassName
          )}
        >
          {options.map((opt, index) => {
            const active = opt.value === value;
            const enabledIndex = enabledOptions.findIndex((o) => o.value === opt.value);
            const keyboardActive = enabledIndex === highlight;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={active}
                disabled={opt.disabled}
                onMouseEnter={() => {
                  if (!opt.disabled && enabledIndex >= 0) setHighlight(enabledIndex);
                }}
                onClick={() => {
                  if (opt.disabled) return;
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full min-h-10 items-center justify-between gap-3 px-3 py-2 text-left text-[13px] transition-colors",
                  opt.disabled && "cursor-not-allowed opacity-50",
                  active
                    ? "bg-[rgba(212,255,79,0.12)] font-medium text-sales-text-primary"
                    : "font-normal text-sales-text-secondary",
                  !opt.disabled &&
                    (keyboardActive || !active) &&
                    "hover:bg-[var(--sales-menu-hover,rgba(16,24,40,0.04))] hover:text-sales-text-primary",
                  keyboardActive && !active && "bg-[var(--sales-menu-hover,rgba(16,24,40,0.04))] text-sales-text-primary"
                )}
                data-index={index}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {opt.icon ? (
                    <span className="inline-flex shrink-0 [&_svg]:size-4" aria-hidden>
                      {opt.icon}
                    </span>
                  ) : null}
                  <span className="min-w-0">
                    <span className="block truncate">{opt.label}</span>
                    {opt.description ? (
                      <span className="block truncate text-[11px] text-sales-text-muted">{opt.description}</span>
                    ) : null}
                  </span>
                </span>
                {active ? (
                  <Check size={14} strokeWidth={2.2} className="shrink-0 text-sales-brand-fg" aria-hidden />
                ) : (
                  <span className="w-3.5 shrink-0" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
