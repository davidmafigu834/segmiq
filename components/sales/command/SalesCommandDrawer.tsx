"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { IconButton, StatusDot } from "@/components/sales/ui";
import { SalesCommandWorkspace } from "@/components/sales/command/SalesCommandWorkspace";
import type { SalesPageContext } from "@/lib/agent/sales/types";
import { cn } from "@/lib/ui/cn";

export function SalesCommandDrawer({
  open,
  onClose,
  pageContext,
  customerName,
}: {
  open: boolean;
  onClose: () => void;
  pageContext: SalesPageContext;
  customerName?: string | null;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "sales-modal-premium pipeline-drawer-light fixed inset-0 z-[var(--sales-z-drawer,60)]",
        "md:pointer-events-none md:inset-auto md:bottom-0 md:right-0 md:top-0"
      )}
    >
      <button
        type="button"
        className="sales-modal-backdrop absolute inset-0 md:hidden"
        aria-label="Close Command SegmiQ"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal
        aria-labelledby="sales-command-drawer-title"
        className={cn(
          "relative flex h-full w-full flex-col overflow-hidden bg-sales-bg md:pointer-events-auto",
          "md:ml-auto md:h-full md:w-[min(440px,94vw)] md:border-l md:border-sales-border",
          "md:shadow-[var(--sales-shadow-modal)]"
        )}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-sales-border-subtle px-4 py-3.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p
                id="sales-command-drawer-title"
                className="text-[15px] font-semibold tracking-[-0.02em] text-sales-text-primary"
              >
                Command SegmiQ
              </p>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sales-border bg-sales-surface px-2 py-0.5 text-[10px] font-medium text-sales-text-secondary">
                <StatusDot tone="success" size="sm" />
                Active
              </span>
            </div>
            <p className="mt-0.5 truncate text-[12px] text-sales-text-secondary">
              {customerName || "Tell SegmiQ what you need done."}
            </p>
          </div>
          <IconButton type="button" size="sm" aria-label="Close" onClick={onClose}>
            <X size={18} strokeWidth={1.8} />
          </IconButton>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <SalesCommandWorkspace pageContext={pageContext} compact onClose={onClose} />
        </div>
      </aside>
    </div>
  );
}
