"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/ui/cn";

export function PlatformDrawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 480,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>("button, a, input")?.focus();
    }, 20);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 transition-opacity duration-150"
        aria-label="Close drawer"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="platform-drawer-title"
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-[var(--border)] bg-[var(--surface-modal)] shadow-[var(--shadow-lg)] md:w-[var(--drawer-width)]"
        style={{ ["--drawer-width" as string]: `${width}px` }}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0">
            <h2 id="platform-drawer-title" className="text-[15px] font-semibold text-[var(--text-primary)]">
              {title}
            </h2>
            {description ? (
              <div className="mt-1 text-[12px] text-[var(--text-secondary)]">{description}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer ? (
          <footer className="shrink-0 border-t border-[var(--border)] px-5 py-3">{footer}</footer>
        ) : null}
      </div>
    </div>
  );
}

export function DetailList({
  rows,
}: {
  rows: { label: string; value: React.ReactNode; mono?: boolean }[];
}) {
  return (
    <dl className="space-y-3">
      {rows.map((row) => (
        <div key={row.label}>
          <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
            {row.label}
          </dt>
          <dd
            className={cn(
              "mt-1 break-words text-[13px] text-[var(--text-primary)]",
              row.mono && "font-mono text-[12px]"
            )}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
