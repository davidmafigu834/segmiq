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
  descriptionId,
  icon,
  badge,
  onClose,
  closeDisabled = false,
  elevateForCourse = false,
  children,
  footer,
  maxWidthClass,
  size = "md",
  labelledBy,
  className,
  contentClassName,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  descriptionId?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
  /** Sit above course dim overlay so Practice Mode shows the real modal design. */
  elevateForCourse?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClass?: string;
  size?: keyof typeof widthClass;
  labelledBy?: string;
  className?: string;
  contentClassName?: string;
}) {
  const titleId = labelledBy ?? "premium-sheet-title";
  const descId = descriptionId ?? (description ? `${titleId}-desc` : undefined);

  return (
    <div
      className={cn(
        "sales-modal-premium calendar-modal-premium pipeline-drawer-light fixed inset-0 flex items-end justify-center sm:items-center sm:p-4",
        elevateForCourse
          ? // Above course dim (90), below coachmark (92) so the real modal stays visible and coached
            "z-[91]"
          : "z-[80]"
      )}
    >
      <button
        type="button"
        className="absolute inset-0 z-[70] bg-[var(--sales-neutral-900)]/40 dark:bg-black/62"
        aria-label="Close"
        disabled={closeDisabled}
        onClick={() => {
          if (!closeDisabled) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={cn(
          "relative z-[80] flex max-h-[calc(100dvh-64px)] w-full flex-col overflow-hidden rounded-t-[16px] border border-sales-border bg-sales-surface shadow-sales-modal sm:rounded-[16px]",
          maxWidthClass ?? widthClass[size],
          className
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-sales-border-subtle bg-sales-surface px-5 py-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            {icon ? (
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-sales-border bg-sales-surface-subtle text-sales-text-secondary">
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {eyebrow ? (
                  <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
                    {eyebrow}
                  </p>
                ) : null}
                {badge}
              </div>
              <h2
                id={titleId}
                className={cn(
                  "text-[18px] font-semibold tracking-[-0.02em] text-sales-text-primary",
                  eyebrow || badge ? "mt-0.5" : ""
                )}
              >
                {title}
              </h2>
              {description ? (
                <p
                  id={descId}
                  className="mt-1 text-[13px] leading-snug text-sales-text-secondary"
                >
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          <IconButton
            aria-label="Close"
            size="md"
            disabled={closeDisabled}
            onClick={() => {
              if (!closeDisabled) onClose();
            }}
          >
            <X strokeWidth={1.8} />
          </IconButton>
        </div>

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-sales-surface px-5 py-5",
            contentClassName
          )}
          style={{ paddingBottom: footer ? undefined : "calc(20px + env(safe-area-inset-bottom))" }}
        >
          {children}
        </div>

        {footer ? (
          <div
            className="shrink-0 border-t border-sales-border-subtle bg-sales-surface px-5 py-4"
            style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
