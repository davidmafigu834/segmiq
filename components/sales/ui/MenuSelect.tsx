"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/ui/cn";

export type MenuSelectOption<T extends string> = {
  value: T;
  label: string;
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
  triggerClassName,
}: {
  value: T;
  onChange: (value: T) => void;
  options: MenuSelectOption<T>[];
  "aria-label"?: string;
  className?: string;
  menuClassName?: string;
  align?: "left" | "right";
  leadingIcon?: ReactNode;
  size?: "sm" | "md";
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value) ?? options[0];

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

  return (
    <div ref={rootRef} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-sales-border bg-sales-surface font-medium text-sales-text-primary",
          "transition-colors duration-150 hover:border-sales-border-strong hover:bg-sales-surface-hover",
          "focus:outline-none focus-visible:shadow-[var(--sales-focus-ring)]",
          size === "sm" ? "h-8 px-2.5 text-[12px]" : "h-10 px-3 text-[13px]",
          open && "border-sales-brand-border bg-sales-surface-subtle",
          triggerClassName
        )}
      >
        {leadingIcon ? (
          <span className="inline-flex shrink-0 text-sales-text-muted" aria-hidden>
            {leadingIcon}
          </span>
        ) : null}
        <span className={cn("truncate", size === "sm" ? "max-w-[6.5rem]" : "max-w-[8.5rem]")}>
          {selected?.label ?? "Select"}
        </span>
        <ChevronDown
          size={size === "sm" ? 13 : 14}
          strokeWidth={2}
          className={cn(
            "shrink-0 text-sales-text-muted transition-transform duration-150",
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
            "absolute top-[calc(100%+6px)] z-30 min-w-[180px] overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface py-1.5 shadow-[0_8px_24px_rgba(16,24,40,0.10)]",
            align === "right" ? "right-0" : "left-0",
            menuClassName
          )}
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-[13px] transition-colors",
                  active
                    ? "bg-[var(--sales-brand-soft-solid,#F3FCE3)] font-semibold text-sales-text-primary"
                    : "font-medium text-sales-text-secondary hover:bg-sales-surface-hover hover:text-sales-text-primary"
                )}
              >
                <span className="truncate">{opt.label}</span>
                {active ? (
                  <Check size={14} strokeWidth={2.2} className="shrink-0 text-sales-brand-fg" />
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
