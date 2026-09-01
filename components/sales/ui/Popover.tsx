"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/ui/cn";
import { OverlayPortal } from "./OverlayPortal";
import { useFloatingPanel, type FloatingAlign, type FloatingSide } from "./useFloatingPanel";

type PopoverContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement>;
  contentId: string;
  align: FloatingAlign;
  side: FloatingSide;
};

const PopoverContext = createContext<PopoverContextValue | null>(null);

function usePopover() {
  const ctx = useContext(PopoverContext);
  if (!ctx) throw new Error("Popover components must be used within Popover");
  return ctx;
}

export function Popover({
  open: controlledOpen,
  onOpenChange,
  align = "start",
  side = "bottom",
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: FloatingAlign;
  side?: FloatingSide;
  children: ReactNode;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const triggerRef = useRef<HTMLElement>(null);
  const contentId = useId();

  const setOpen = useCallback(
    (next: boolean) => {
      onOpenChange?.(next);
      if (controlledOpen === undefined) setUncontrolledOpen(next);
    },
    [controlledOpen, onOpenChange]
  );

  return (
    <PopoverContext.Provider value={{ open, setOpen, triggerRef, contentId, align, side }}>
      {children}
    </PopoverContext.Provider>
  );
}

export function PopoverTrigger({
  className,
  children,
  asChild = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; asChild?: boolean }) {
  const { open, setOpen, triggerRef, contentId } = usePopover();

  if (asChild && children && typeof children === "object" && "type" in children) {
    // asChild not fully supported — use button wrapper for simplicity
  }

  return (
    <button
      ref={triggerRef as React.RefObject<HTMLButtonElement>}
      type="button"
      aria-expanded={open}
      aria-controls={contentId}
      {...props}
      className={className}
      onClick={(e) => {
        props.onClick?.(e);
        setOpen(!open);
      }}
    >
      {children}
    </button>
  );
}

export function PopoverContent({
  className,
  children,
  padding = "default",
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  /** Avoid double padding when content is a self-padded control list. */
  padding?: "default" | "none";
}) {
  const { open, setOpen, triggerRef, contentId, align, side } = usePopover();
  const panelRef = useRef<HTMLDivElement>(null);
  const coords = useFloatingPanel({
    open,
    triggerRef: triggerRef as React.RefObject<HTMLElement>,
    panelRef,
    align,
    side,
  });

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen, triggerRef]);

  if (!open) return null;

  return (
    <OverlayPortal>
      <div
        ref={panelRef}
        id={contentId}
        role="dialog"
        style={
          coords
            ? { top: coords.top, left: coords.left, position: "fixed" }
            : { visibility: "hidden", position: "fixed" }
        }
        className={cn(
          "z-[var(--sales-z-popover,50)] max-w-[360px] rounded-[10px] border border-sales-border bg-sales-surface shadow-sales-popover",
          padding === "default" ? "p-3 sm:p-4" : "",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </OverlayPortal>
  );
}
