"use client";

import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "@/lib/ui/cn";
import { SALES_MENU } from "@/lib/sales/design-tokens";

export function Tooltip({
  label,
  children,
  className,
  side = "top",
  maxWidth = SALES_MENU.tooltipMaxWidth,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  side?: "top" | "bottom" | "right";
  maxWidth?: number;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);

  function clearTimers() {
    if (showTimer.current != null) window.clearTimeout(showTimer.current);
    if (hideTimer.current != null) window.clearTimeout(hideTimer.current);
    showTimer.current = null;
    hideTimer.current = null;
  }

  function scheduleShow() {
    clearTimers();
    showTimer.current = window.setTimeout(() => setVisible(true), SALES_MENU.tooltipShowDelayMs);
  }

  function scheduleHide() {
    clearTimers();
    hideTimer.current = window.setTimeout(() => setVisible(false), SALES_MENU.tooltipHideDelayMs);
  }

  useEffect(() => () => clearTimers(), []);

  const trigger =
    isValidElement(children) ?
      cloneElement(children as ReactElement<Record<string, unknown>>, {
        "aria-describedby": visible ? id : undefined,
        onMouseEnter: (e: MouseEvent) => {
          scheduleShow();
          (children as ReactElement<{ onMouseEnter?: (e: MouseEvent) => void }>).props.onMouseEnter?.(e);
        },
        onMouseLeave: (e: MouseEvent) => {
          scheduleHide();
          (children as ReactElement<{ onMouseLeave?: (e: MouseEvent) => void }>).props.onMouseLeave?.(e);
        },
        onFocus: (e: FocusEvent) => {
          setVisible(true);
          (children as ReactElement<{ onFocus?: (e: FocusEvent) => void }>).props.onFocus?.(e);
        },
        onBlur: (e: FocusEvent) => {
          setVisible(false);
          (children as ReactElement<{ onBlur?: (e: FocusEvent) => void }>).props.onBlur?.(e);
        },
      })
    : children;

  return (
    <span className={cn("relative inline-flex", className)}>
      {trigger}
      <span
        id={id}
        role="tooltip"
        style={{ maxWidth }}
        className={cn(
          "sales-tooltip pointer-events-none absolute z-[var(--sales-z-tooltip,110)] w-max rounded-[7px] bg-[#101828] px-2.5 py-1.5 text-[11px] font-medium leading-snug text-white shadow-sales-dropdown",
          side === "right"
            ? "left-[calc(100%+8px)] top-1/2 -translate-y-1/2"
            : cn("left-1/2 -translate-x-1/2", side === "top" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]"),
          visible ? "opacity-100" : "pointer-events-none opacity-0",
          "transition-opacity duration-150 motion-reduce:transition-none"
        )}
      >
        {label}
      </span>
    </span>
  );
}
