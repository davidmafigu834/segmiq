"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { ArrowRight, Check, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";

/** Premium command composer — Ask Documents family, not a chat box. */
export function CommandComposer({
  id,
  value,
  onChange,
  onSubmit,
  onKeyDown,
  placeholder,
  disabled,
  loading,
  onCancel,
  rows = 2,
  scopeChips,
  footerHint,
  submitLabel = "Run",
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  disabled?: boolean;
  loading?: boolean;
  onCancel?: () => void;
  rows?: number;
  scopeChips?: ReactNode;
  footerHint?: string;
  submitLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[12px] border border-sales-border-strong bg-sales-surface p-3 shadow-sales-card",
        "focus-within:border-[color-mix(in_srgb,var(--sales-brand)_55%,var(--sales-border-strong))]",
        className
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sales-brand"
          aria-hidden
        />
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={rows}
          disabled={disabled || loading}
          placeholder={placeholder}
          className="min-h-[52px] w-full resize-none bg-transparent text-[14px] leading-relaxed text-sales-text-primary outline-none placeholder:text-sales-text-muted"
        />
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={loading || !value.trim()}
          onClick={onSubmit}
          className="mt-0.5 shrink-0"
          aria-label={loading ? "Working" : submitLabel}
        >
          {loading ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <ArrowRight size={15} aria-hidden />}
        </Button>
      </div>
      {scopeChips ? <div className="mt-2.5 flex flex-wrap gap-1.5 pl-4">{scopeChips}</div> : null}
      <div className="mt-2 flex items-center justify-between gap-2 pl-4">
        {loading && onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-[12px] font-medium text-sales-text-secondary underline-offset-2 hover:underline"
          >
            Cancel
          </button>
        ) : (
          <span className="text-[11px] text-sales-text-muted">
            {footerHint ?? "Enter to send · Shift+Enter for new line"}
          </span>
        )}
      </div>
    </div>
  );
}

export function CommandScopeChip({
  label,
  active,
  onClick,
  disabled,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled || !onClick}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center rounded-[8px] border px-2.5 text-[11px] font-medium transition-colors",
        active
          ? "border-[color-mix(in_srgb,var(--sales-brand)_45%,var(--sales-border))] bg-[color-mix(in_srgb,var(--sales-brand-soft-solid)_80%,transparent)] text-sales-text-primary"
          : "border-sales-border bg-sales-surface-subtle text-sales-text-secondary hover:border-sales-border-strong hover:text-sales-text-primary",
        (disabled || !onClick) && "cursor-default opacity-90"
      )}
    >
      {label}
    </button>
  );
}

export function CommandQuickAction({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-[148px] flex-1 items-start gap-2.5 rounded-[10px] border border-sales-border bg-sales-surface px-3 py-2.5 text-left transition-colors hover:border-sales-border-strong hover:bg-sales-surface-hover"
    >
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-sales-surface-subtle text-sales-text-secondary">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-sales-text-primary">{label}</span>
        {hint ? <span className="mt-0.5 block text-[11px] leading-snug text-sales-text-muted">{hint}</span> : null}
      </span>
    </button>
  );
}

export function CommandExampleChips({
  examples,
  onSelect,
  label = "Try",
}: {
  examples: string[];
  onSelect: (example: string) => void;
  label?: string;
}) {
  if (!examples.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-medium text-sales-text-muted">{label}</span>
      {examples.map((ex) => (
        <button
          key={ex}
          type="button"
          onClick={() => onSelect(ex)}
          className="max-w-full truncate rounded-full border border-sales-border bg-transparent px-2.5 py-1 text-[11px] text-sales-text-secondary transition-colors hover:border-sales-border-strong hover:text-sales-text-primary"
          title={ex}
        >
          “{ex.length > 42 ? `${ex.slice(0, 40)}…` : ex}”
        </button>
      ))}
    </div>
  );
}

export function CommandResultHeader({
  title,
  meta,
  tone = "success",
}: {
  title: string;
  meta?: string;
  tone?: "success" | "warning" | "error" | "neutral" | "info";
}) {
  const Icon =
    tone === "error" ? XCircle : tone === "neutral" || tone === "info" ? null : Check;
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <div className="flex items-center gap-2">
        {Icon ? (
          <span
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full",
              tone === "success" && "bg-sales-success-soft text-sales-success-fg",
              tone === "warning" && "bg-sales-warning-soft text-sales-warning-fg",
              tone === "error" && "bg-sales-danger-soft text-sales-danger-fg"
            )}
          >
            <Icon size={12} strokeWidth={2.4} aria-hidden />
          </span>
        ) : null}
        <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-sales-text-primary">{title}</h3>
      </div>
      {meta ? <p className="text-[11px] text-sales-text-muted">{meta}</p> : null}
    </div>
  );
}

export function CommandExecutionStatus({
  phase,
  label = "SegmiQ is working",
}: {
  phase: string | null;
  label?: string;
}) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-[10px] border border-sales-border-subtle bg-sales-surface-subtle px-3.5 py-3"
      role="status"
    >
      <Loader2 size={14} className="animate-spin text-sales-text-muted" aria-hidden />
      <div>
        <p className="text-[13px] font-medium text-sales-text-primary">{phase || "Working…"}</p>
        <p className="text-[11px] text-sales-text-muted">{label}</p>
      </div>
    </div>
  );
}

export function CommandEmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-[12px] border border-dashed border-sales-border bg-sales-surface-subtle/50 px-4 py-6">
      <p className="text-[15px] font-semibold tracking-[-0.02em] text-sales-text-primary">{title}</p>
      {description ? (
        <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-sales-text-secondary">{description}</p>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

export function CommandRailSection({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">{title}</p>
        {action}
      </div>
      {children}
    </section>
  );
}

export function CommandRailStat({
  label,
  value,
  onClick,
  emphasize,
}: {
  label: string;
  value: number | string;
  onClick?: () => void;
  emphasize?: boolean;
}) {
  const showDash = value === null || value === undefined || value === "";
  const content = (
    <>
      <span className="text-[12px] text-sales-text-secondary">{label}</span>
      <span
        className={cn(
          "text-[13px] font-semibold tabular-nums",
          emphasize && Number(value) > 0 ? "text-sales-warning-fg" : "text-sales-text-primary"
        )}
      >
        {showDash ? "—" : value}
      </span>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-baseline justify-between gap-3 rounded-[8px] px-1 py-1.5 text-left transition-colors hover:bg-sales-surface"
      >
        {content}
      </button>
    );
  }
  return <div className="flex items-baseline justify-between gap-3 px-1 py-1.5">{content}</div>;
}

export function CommandAttentionStrip({
  items,
}: {
  items: Array<{ id: string; label: string; count: number; onClick: () => void }>;
}) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">
        Needs attention
      </p>
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-[10px] border border-sales-border bg-sales-surface px-3 py-2 text-left transition-colors hover:border-sales-border-strong hover:bg-sales-surface-hover",
              item.count > 0 && "border-sales-warning/25 bg-sales-warning-soft/30"
            )}
          >
            <span
              className={cn(
                "text-[15px] font-semibold tabular-nums",
                item.count > 0 ? "text-sales-warning-fg" : "text-sales-text-primary"
              )}
            >
              {item.count}
            </span>
            <span className="text-[11px] font-medium text-sales-text-secondary">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function CommandRecentWork({
  title = "Recent work",
  items,
  viewAllHref,
}: {
  title?: string;
  items: Array<{ id: string; title: string; subtitle?: string; meta?: string; href: string }>;
  viewAllHref?: string;
}) {
  if (!items.length) return null;
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">{title}</p>
        {viewAllHref ? (
          <Link
            href={viewAllHref}
            className="text-[11px] font-medium text-sales-text-secondary hover:text-sales-text-primary"
          >
            View all
          </Link>
        ) : null}
      </div>
      <ul className="divide-y divide-sales-border-subtle overflow-hidden rounded-[10px] border border-sales-border bg-sales-surface">
        {items.slice(0, 5).map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-sales-surface-hover"
            >
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-sales-text-primary">{item.title}</span>
                {item.subtitle ? (
                  <span className="block truncate text-[11px] text-sales-text-muted">{item.subtitle}</span>
                ) : null}
              </span>
              {item.meta ? (
                <span className="shrink-0 text-[11px] text-sales-text-muted">{item.meta}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CommandCommandRow({
  role,
  content,
}: {
  role: "user" | "system";
  content: string;
}) {
  return (
    <div className="border-b border-sales-border-subtle pb-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
        {role === "user" ? "You" : "SegmiQ"}
      </p>
      <p className="mt-0.5 text-[13px] text-sales-text-secondary">{content}</p>
    </div>
  );
}
