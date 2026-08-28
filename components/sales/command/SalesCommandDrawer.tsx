"use client";

import { X } from "lucide-react";
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
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:pointer-events-none md:inset-auto md:bottom-0 md:right-0 md:top-0 md:z-50">
      <button
        type="button"
        className="absolute inset-0 bg-[var(--sales-overlay)] md:hidden"
        aria-label="Close Sales Command"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal
        aria-labelledby="sales-command-drawer-title"
        className={cn(
          "relative flex h-full w-full flex-col border-sales-border bg-sales-bg md:pointer-events-auto",
          "md:ml-auto md:h-full md:w-[min(420px,94vw)] md:border-l md:shadow-[-12px_0_28px_rgba(16,24,40,0.14)]"
        )}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-sales-border-subtle px-4 py-3">
          <div>
            <p id="sales-command-drawer-title" className="text-[16px] font-semibold text-sales-text-primary">
              Sales Command
            </p>
            {customerName ? (
              <p className="text-[12px] text-sales-text-secondary">{customerName}</p>
            ) : (
              <p className="text-[12px] text-sales-text-secondary">Tell SegmiQ what you need done.</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] text-sales-text-secondary hover:bg-sales-surface-hover"
            aria-label="Close"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-3">
          <SalesCommandWorkspace pageContext={pageContext} compact onClose={onClose} />
        </div>
      </aside>
    </div>
  );
}
