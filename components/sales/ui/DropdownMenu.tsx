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
import { createPortal } from "react-dom";
import { cn } from "@/lib/ui/cn";
import { useFloatingPanel, type FloatingAlign, type FloatingSide } from "./useFloatingPanel";

type DropdownContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
  menuId: string;
  align: FloatingAlign;
  side: FloatingSide;
};

const DropdownContext = createContext<DropdownContextValue | null>(null);

function useDropdown() {
  const ctx = useContext(DropdownContext);
  if (!ctx) throw new Error("DropdownMenu components must be used within DropdownMenu");
  return ctx;
}

function getMenuItems(panel: HTMLElement) {
  return Array.from(
    panel.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)')
  );
}

export function DropdownMenu({
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const setOpen = useCallback(
    (next: boolean) => {
      onOpenChange?.(next);
      if (controlledOpen === undefined) setUncontrolledOpen(next);
    },
    [controlledOpen, onOpenChange]
  );

  return (
    <DropdownContext.Provider value={{ open, setOpen, triggerRef, menuId, align, side }}>
      {children}
    </DropdownContext.Provider>
  );
}

export function DropdownMenuTrigger({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  const { open, setOpen, triggerRef, menuId } = useDropdown();

  return (
    <button
      ref={triggerRef}
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={menuId}
      {...props}
      className={className}
      onClick={(e) => {
        props.onClick?.(e);
        setOpen(!open);
      }}
      onKeyDown={(e) => {
        props.onKeyDown?.(e);
        if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen(true);
        }
      }}
    >
      {children}
    </button>
  );
}

export function DropdownMenuContent({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  const { open, setOpen, triggerRef, menuId, align, side } = useDropdown();
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const coords = useFloatingPanel({ open, triggerRef, panelRef, align, side });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      const panel = panelRef.current;
      if (!panel) return;

      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }

      const items = getMenuItems(panel);
      if (items.length === 0) return;
      const current = items.indexOf(document.activeElement as HTMLButtonElement);

      if (e.key === "ArrowDown") {
        e.preventDefault();
        items[Math.min(current < 0 ? 0 : current + 1, items.length - 1)]?.focus();
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        items[Math.max(current < 0 ? 0 : current - 1, 0)]?.focus();
      }
      if (e.key === "Home") {
        e.preventDefault();
        items[0]?.focus();
      }
      if (e.key === "End") {
        e.preventDefault();
        items[items.length - 1]?.focus();
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen, triggerRef]);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const items = getMenuItems(panelRef.current);
    items[0]?.focus();
  }, [open, coords]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      ref={panelRef}
      id={menuId}
      role="menu"
      style={
        coords
          ? { top: coords.top, left: coords.left, position: "fixed" }
          : { visibility: "hidden", position: "fixed" }
      }
      className={cn(
        "sales-menu-surface z-[var(--sales-z-dropdown,40)] min-w-[180px] max-h-[320px] overflow-y-auto rounded-[10px] border border-sales-border bg-sales-surface py-1.5 shadow-sales-dropdown",
        className
      )}
      {...props}
    >
      {children}
    </div>,
    document.body
  );
}

export function DropdownMenuLabel({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function DropdownMenuItem({
  className,
  children,
  icon,
  destructive = false,
  disabled,
  onSelect,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  destructive?: boolean;
  onSelect?: () => void;
}) {
  const { setOpen, triggerRef } = useDropdown();

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className={cn(
        "flex w-full min-h-10 items-center gap-2 px-3 py-2 text-left text-[13px] font-normal transition-colors",
        destructive
          ? "text-sales-danger hover:bg-[var(--sales-danger-soft)] focus-visible:bg-[var(--sales-danger-soft)]"
          : "text-sales-text-primary hover:bg-[var(--sales-menu-hover,rgba(16,24,40,0.04))] focus-visible:bg-[var(--sales-menu-hover,rgba(16,24,40,0.04))]",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
      onClick={(e) => {
        props.onClick?.(e);
        if (disabled) return;
        onSelect?.();
        setOpen(false);
        triggerRef.current?.focus();
      }}
      {...props}
    >
      {icon ? (
        <span className="inline-flex shrink-0 [&_svg]:size-4" aria-hidden>
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div role="separator" className={cn("my-1 h-px bg-sales-border-subtle", className)} />;
}
