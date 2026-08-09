"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "@/components/sales/ui/Button";
import { cn } from "@/lib/ui/cn";

const widthClass = {
  sm: "max-w-[420px]",
  md: "max-w-[520px]",
  lg: "max-w-[680px]",
} as const;

export function PremiumSheet({
  title,
  eyebrow,
  description,
  onClose,
  children,
  footer,
  maxWidthClass,
  size = "md",
  labelledBy,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClass?: string;
  size?: keyof typeof widthClass;
  labelledBy?: string;
}) {
  const titleId = labelledBy ?? "premium-sheet-title";

  return (
    <div className="sales-modal-premium calendar-modal-premium pipeline-drawer-light fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 z-[70] bg-[#101828]/35 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby={titleId}
        className={cn(
          "relative z-[80] flex max-h-[min(92dvh,760px)] w-full flex-col overflow-hidden rounded-t-[16px] border border-sales-border bg-sales-surface shadow-sales-modal sm:rounded-sales-xl",
          maxWidthClass ?? widthClass[size]
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-sales-border-subtle bg-sales-surface-subtle px-5 py-4">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
                {eyebrow}
              </p>
            ) : null}
            <h2
              id={titleId}
              className={cn(
                "text-[18px] font-semibold tracking-[-0.02em] text-sales-text-primary",
                eyebrow ? "mt-0.5" : ""
              )}
            >
              {title}
            </h2>
            {description ? (
              <p className="mt-1 truncate text-[13px] text-sales-text-secondary">{description}</p>
            ) : null}
          </div>
          <IconButton aria-label="Close" size="md" onClick={onClose}>
            <X strokeWidth={1.8} />
          </IconButton>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-sales-surface px-5 py-5"
          style={{ paddingBottom: footer ? undefined : "calc(20px + env(safe-area-inset-bottom))" }}
        >
          {children}
        </div>

        {footer ? (
          <div
            className="shrink-0 border-t border-sales-border-subtle bg-sales-surface-subtle px-5 py-4"
            style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
