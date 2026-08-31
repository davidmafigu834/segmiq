"use client";

import { useLayoutEffect, useState, type RefObject } from "react";
import { SALES_MENU } from "@/lib/sales/design-tokens";

export type FloatingAlign = "start" | "end";
export type FloatingSide = "bottom" | "top";

export function computeFloatingPosition(
  trigger: DOMRect,
  panel: DOMRect,
  align: FloatingAlign,
  side: FloatingSide
) {
  const pad = SALES_MENU.viewportPadding;
  let top =
    side === "bottom" ? trigger.bottom + SALES_MENU.offset : trigger.top - panel.height - SALES_MENU.offset;
  let left = align === "start" ? trigger.left : trigger.right - panel.width;

  if (side === "bottom" && top + panel.height > window.innerHeight - pad) {
    top = trigger.top - panel.height - SALES_MENU.offset;
  } else if (side === "top" && top < pad) {
    top = trigger.bottom + SALES_MENU.offset;
  }

  if (left + panel.width > window.innerWidth - pad) {
    left = window.innerWidth - pad - panel.width;
  }
  if (left < pad) left = pad;

  return { top, left };
}

export function useFloatingPanel({
  open,
  triggerRef,
  panelRef,
  align,
  side,
}: {
  open: boolean;
  triggerRef: RefObject<HTMLElement>;
  panelRef: RefObject<HTMLElement>;
  align: FloatingAlign;
  side: FloatingSide;
}) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    function update() {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;
      setCoords(
        computeFloatingPosition(
          trigger.getBoundingClientRect(),
          panel.getBoundingClientRect(),
          align,
          side
        )
      );
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, align, side, triggerRef, panelRef]);

  return coords;
}
