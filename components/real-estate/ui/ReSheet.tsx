"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "@/components/sales/ui/Button";
import { OverlayPortal } from "@/components/sales/ui/OverlayPortal";
import { useFocusTrap } from "@/components/sales/ui/useFocusTrap";
import { cn } from "@/lib/ui/cn";

export type ReSheetPlacement =
  /** Desktop: right drawer (~500px). Mobile: full-height sheet. Record previews and menus. */
  | "drawer"
  /** Desktop: narrow right drawer. Mobile: bottom sheet. Action lists and filters. */
  | "bottom";

/**
 * Real Estate overlay surface. One component for the detail drawer, the mobile
 * menu, action sheets and filter sheets so focus, scroll lock and Escape behave
 * the same everywhere. Render it only while open.
 */
export function ReSheet({
  title,
  description,
  onClose,
  children,
  footer,
  placement = "drawer",
  headerAside,
  bodyClassName,
}: {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  placement?: ReSheetPlacement;
  /** Extra control beside the close button (e.g. a link to the full record). */
  headerAside?: ReactNode;
  bodyClassName?: string;
}) {
  const reactId = useId();
  const titleId = `re-sheet-title-${reactId}`;
  const descId = description ? `${titleId}-desc` : undefined;
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useFocusTrap(panelRef, true);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const bottom = placement === "bottom";

  return (
    <OverlayPortal>
      <div className="sales-modal-premium fixed inset-0 z-[var(--sales-z-modal,80)]">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close"
          className="sales-modal-backdrop absolute inset-0"
          onClick={() => onCloseRef.current()}
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          tabIndex={-1}
          className={cn(
            "absolute flex flex-col overflow-hidden bg-sales-surface text-sales-text-primary shadow-sales-modal outline-none",
            bottom
              ? "re-sheet-up inset-x-0 bottom-0 max-h-[88dvh] rounded-t-[16px] border-t border-sales-border"
              : "re-sheet-full inset-0 pt-[env(safe-area-inset-top,0px)]",
            "md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:rounded-none md:border-l md:border-t-0 md:border-sales-border md:pt-0",
            bottom ? "md:w-[min(420px,100vw)]" : "md:w-[min(var(--re-drawer-width,500px),100vw)]"
          )}
        >
          {bottom ? (
            <span className="mx-auto mt-2 block h-1 w-9 shrink-0 rounded-full bg-sales-border md:hidden" aria-hidden />
          ) : null}
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-sales-border-subtle px-5 pb-3 pt-3 md:pt-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-[17px] font-semibold leading-tight tracking-[-0.01em] text-sales-text-primary [overflow-wrap:anywhere]">
                {title}
              </h2>
              {description ? (
                <p id={descId} className="mt-1 text-[13px] leading-snug text-sales-text-secondary">
                  {description}
                </p>
              ) : null}
            </div>
            <div className="-mr-1 flex shrink-0 items-center gap-1">
              {headerAside}
              <IconButton aria-label="Close" size="lg" onClick={() => onCloseRef.current()}>
                <X strokeWidth={1.8} />
              </IconButton>
            </div>
          </div>
          <div
            className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", bodyClassName ?? "px-5 py-4")}
            style={footer ? undefined : { paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}
          >
            {children}
          </div>
          {footer ? (
            <div
              className="shrink-0 border-t border-sales-border-subtle bg-sales-surface px-5 pt-3"
              style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}
            >
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </OverlayPortal>
  );
}

/** Label / value rows inside a detail drawer. */
export function ReDetailList({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  const shown = items.filter((item) => item.value != null && item.value !== "");
  return (
    <dl className="divide-y divide-sales-border-subtle">
      {shown.map((item) => (
        <div key={item.label} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 py-2.5">
          <dt className="text-[13px] text-sales-text-secondary">{item.label}</dt>
          <dd className="min-w-0 text-[13px] font-medium text-sales-text-primary [overflow-wrap:anywhere]">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Mobile filter pattern: search stays on the page, everything else goes in this
 * sheet with Clear / Apply pinned to the bottom.
 */
export function ReFilterSheet({
  onClose,
  onApply,
  onClear,
  children,
  title = "Filters",
  activeCount = 0,
}: {
  onClose: () => void;
  onApply: () => void;
  onClear: () => void;
  children: ReactNode;
  title?: string;
  activeCount?: number;
}) {
  return (
    <ReSheet
      title={title}
      description={activeCount > 0 ? `${activeCount} filter${activeCount === 1 ? "" : "s"} applied` : undefined}
      onClose={onClose}
      placement="bottom"
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClear}
            className="re-focus inline-flex min-h-11 items-center justify-center rounded-[var(--re-radius-control,8px)] border border-sales-border px-4 text-[14px] font-semibold text-sales-text-primary hover:bg-sales-surface-hover"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={onApply}
            className="re-focus inline-flex min-h-11 items-center justify-center rounded-[var(--re-radius-control,8px)] bg-sales-text-primary px-4 text-[14px] font-semibold text-sales-surface hover:opacity-90"
          >
            Apply
          </button>
        </div>
      }
    >
      <div className="space-y-4">{children}</div>
    </ReSheet>
  );
}
