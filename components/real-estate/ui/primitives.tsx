"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, ChevronRight, Info, RotateCw } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/sales/ui/Badge";
import { Tooltip } from "@/components/sales/ui/Tooltip";
import { cn } from "@/lib/ui/cn";

export const RE_FOCUS = "re-focus";

export function useMediaQuery(query: string, initial = false): boolean {
  const [matches, setMatches] = useState(initial);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);
  return matches;
}

/** Below 768px overlays become bottom sheets and anchored menus become sheets. */
export const RE_MOBILE_QUERY = "(max-width: 767px)";

/* ─── Page + section chrome ─────────────────────────────────────────────── */

export function RePageHeader({
  context,
  title,
  description,
  actions,
  className,
  mobileTitle = false,
}: {
  /** Short context line above the title, e.g. the date or the agency name. */
  context?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /**
   * Home screens whose mobile header is the wordmark still need a title here.
   * Other pages already show the title in the mobile app header, so this heading stays desktop-only.
   */
  mobileTitle?: boolean;
}) {
  return (
    <header
      className={cn(
        "flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6",
        !mobileTitle && !actions && "hidden layout:flex",
        className
      )}
    >
      <div className={cn("min-w-0", !mobileTitle && "hidden layout:block")}>
        {context ? (
          <p className="text-[12px] font-medium text-sales-text-muted sm:text-[13px]">{context}</p>
        ) : null}
        <h1
          className={cn(
            "min-w-0 font-display font-semibold tracking-[-0.02em] text-sales-text-primary [overflow-wrap:anywhere]",
            mobileTitle
              ? "text-[17px] leading-6 layout:mt-0.5 layout:text-[26px] layout:leading-[1.15]"
              : "mt-0.5 text-[22px] leading-7 layout:text-[26px] layout:leading-[1.15]"
          )}
        >
          {title}
        </h1>
        {description ? (
          <p
            className={cn(
              "mt-1 max-w-[60ch] text-[13px] leading-snug text-sales-text-secondary sm:text-[14px]",
              mobileTitle ? "line-clamp-2 sm:line-clamp-none" : "hidden layout:block"
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function ReSection({
  id,
  title,
  description,
  count,
  action,
  children,
  className,
  bodyClassName,
  flush = false,
  hideMobileDescription = false,
}: {
  id?: string;
  title: string;
  description?: ReactNode;
  /** Total behind the section, shown beside the title. Omit while loading. */
  count?: number | null;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Rows run edge to edge (lists, tables). */
  flush?: boolean;
  /** Keep a longer explanation on desktop and drop it on a phone. */
  hideMobileDescription?: boolean;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn(
        "min-w-0 overflow-hidden rounded-[var(--re-radius-card,12px)] border border-[var(--sales-card-border,var(--sales-border-subtle))] bg-sales-surface",
        className
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-3 px-[var(--re-card-pad,16px)] pb-2 pt-[var(--re-card-pad,16px)]">
        <div className="min-w-0">
          <h2
            id={headingId}
            className="flex min-w-0 items-baseline gap-2 text-[15px] font-semibold leading-tight tracking-[-0.01em] text-sales-text-primary"
          >
            <span className="min-w-0 truncate">{title}</span>
            {count != null ? (
              <span className="shrink-0 text-[13px] font-medium tabular-nums text-sales-text-muted">{count}</span>
            ) : null}
          </h2>
          {description ? (
            <p className={cn("mt-1 text-[12px] leading-snug text-sales-text-secondary sm:text-[13px]", hideMobileDescription && "hidden layout:block")}>{description}</p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 items-center">{action}</div> : null}
      </div>
      <div className={cn(flush ? "pb-1.5" : "px-[var(--re-card-pad,16px)] pb-[var(--re-card-pad,16px)]", bodyClassName)}>
        {children}
      </div>
    </section>
  );
}

export function ReViewAll({ href, label = "View all" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        RE_FOCUS,
        "-mr-2 inline-flex min-h-11 items-center gap-0.5 rounded-[var(--re-radius-control,8px)] px-2 text-[13px] font-medium text-sales-text-secondary transition-colors hover:text-sales-text-primary layout:min-h-8"
      )}
    >
      {label}
      <ChevronRight size={14} strokeWidth={1.8} aria-hidden />
    </Link>
  );
}

export function ReInfoTip({ label }: { label: string }) {
  return (
    <Tooltip label={label} maxWidth={260}>
      <button
        type="button"
        aria-label={label}
        className={cn(
          RE_FOCUS,
          "inline-flex h-6 w-6 items-center justify-center rounded-full text-sales-text-muted transition-colors hover:text-sales-text-primary"
        )}
      >
        <Info size={13} strokeWidth={1.8} aria-hidden />
      </button>
    </Tooltip>
  );
}

/* ─── Metrics ───────────────────────────────────────────────────────────── */

export type ReLoadState = "loading" | "ready" | "error";

export function ReStatCard({
  label,
  value,
  supporting,
  href,
  state = "ready",
  info,
  attention = false,
}: {
  label: string;
  value: string | number | null;
  supporting?: string;
  href?: string;
  state?: ReLoadState;
  /** Definition shown in an info tooltip. */
  info?: string;
  /** Soft warning wash when a non-zero value needs action. */
  attention?: boolean;
}) {
  const body = (
    <>
      <span className="flex min-w-0 items-center gap-1">
        <span className="min-w-0 truncate text-[12px] font-medium text-sales-text-secondary">{label}</span>
      </span>
      {state === "loading" ? (
        <span className="mt-2 block h-7 w-12 animate-pulse rounded-[6px] bg-sales-surface-hover motion-reduce:animate-none" aria-hidden />
      ) : (
        <span className="mt-1 block truncate font-display text-[22px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-sales-text-primary sm:text-[24px]">
          {state === "error" || value == null ? "—" : value}
        </span>
      )}
      {state === "error" ? (
        <span className="mt-1 block truncate text-[12px] leading-4 text-sales-text-muted">Couldn&apos;t load</span>
      ) : supporting && state === "ready" ? (
        <span className="mt-1 hidden truncate text-[12px] leading-4 text-sales-text-muted md:block">{supporting}</span>
      ) : null}
    </>
  );

  const shell = cn(
    "relative flex min-w-0 flex-col rounded-[var(--re-radius-card,12px)] border px-3 py-2.5 sm:px-4 sm:py-3.5",
    attention && state === "ready"
      ? "border-sales-warning/30 bg-sales-warning-soft"
      : "border-[var(--sales-card-border,var(--sales-border-subtle))] bg-sales-surface"
  );

  return (
    <div className="relative min-w-0">
      {href ? (
        <Link
          href={href}
          aria-label={`${label}: ${state === "ready" && value != null ? value : "unavailable"}. Open`}
          className={cn(shell, RE_FOCUS, "transition-colors hover:border-sales-border-strong")}
        >
          {body}
        </Link>
      ) : (
        <div className={shell}>{body}</div>
      )}
      {info ? (
        <span className="absolute right-1.5 top-1.5">
          <ReInfoTip label={info} />
        </span>
      ) : null}
    </div>
  );
}

export function ReMetricGrid({
  children,
  columns = 4,
  className,
  label,
}: {
  children: ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "grid grid-cols-2 gap-2.5 sm:gap-3",
        columns === 3 && "sm:grid-cols-3",
        columns === 4 && "sm:grid-cols-4",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Phone disclosure for secondary counts. Desktop shows the metrics directly. */
export function ReMetricOverview({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-w-0">
      <button
        type="button"
        className="re-focus flex min-h-11 w-full items-center justify-between rounded-[var(--re-radius-control,8px)] border border-sales-border bg-sales-surface px-3 text-[13px] font-semibold text-sales-text-primary md:hidden"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
        <span className="text-[12px] font-medium text-sales-text-muted">{open ? "Hide" : "Show"}</span>
      </button>
      <div className={cn("mt-2 md:mt-0", !open && "hidden md:block")}>{children}</div>
    </div>
  );
}

/** Compact label/value pairs inside a section (operations summaries). */
export function ReFigureList({
  items,
}: {
  items: Array<{ label: string; value: string | number | null; href?: string; tone?: "default" | "attention" }>;
}) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      {items.map((item) => {
        const value = (
          <span
            className={cn(
              "font-display text-[20px] font-semibold leading-none tabular-nums",
              item.tone === "attention" && item.value && item.value !== "0"
                ? "text-sales-warning-fg"
                : "text-sales-text-primary"
            )}
          >
            {item.value ?? "—"}
          </span>
        );
        return (
          <div key={item.label} className="min-w-0">
            <dt className="truncate text-[12px] text-sales-text-secondary">{item.label}</dt>
            <dd className="mt-1">
              {item.href ? (
                <Link href={item.href} className={cn(RE_FOCUS, "rounded-[4px] hover:underline")}>
                  {value}
                </Link>
              ) : (
                value
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/* ─── Status ────────────────────────────────────────────────────────────── */

export type ReUrgency = "overdue" | "today" | "awaiting" | "opportunity" | "done" | "info";

const URGENCY_TONE: Record<ReUrgency, BadgeTone> = {
  overdue: "danger",
  today: "warning",
  awaiting: "info",
  opportunity: "neutral",
  done: "success",
  info: "neutral",
};

export function ReStatusBadge({
  label,
  urgency,
  tone,
  className,
}: {
  label: string;
  urgency?: ReUrgency;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <Badge tone={tone ?? (urgency ? URGENCY_TONE[urgency] : "neutral")} size="md" className={className}>
      {label}
    </Badge>
  );
}

/* ─── Rows ──────────────────────────────────────────────────────────────── */

export function ReRowIcon({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "danger" | "warning" | "info" }) {
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] [&_svg]:size-[17px]",
        tone === "danger" && "bg-sales-danger-soft text-sales-danger-fg",
        tone === "warning" && "bg-sales-warning-soft text-sales-warning-fg",
        tone === "info" && "bg-sales-info-soft text-sales-info-fg",
        tone === "neutral" && "bg-sales-surface-subtle text-sales-text-secondary"
      )}
      aria-hidden
    >
      {children}
    </span>
  );
}

/**
 * One unit of work: what it is, why it matters, and the next step.
 * Primary action stays visible; secondary actions live in `menu`.
 */
export function ReWorkItem({
  icon,
  iconTone,
  title,
  reason,
  meta,
  status,
  action,
  menu,
}: {
  icon?: ReactNode;
  iconTone?: "neutral" | "danger" | "warning" | "info";
  title: string;
  reason?: ReactNode;
  meta?: ReactNode;
  status?: ReactNode;
  action?: ReactNode;
  menu?: ReactNode;
}) {
  return (
    <li className="flex min-w-0 flex-col gap-2 px-[var(--re-card-pad,16px)] py-3 sm:flex-row sm:items-start sm:gap-3">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {icon ? <ReRowIcon tone={iconTone}>{icon}</ReRowIcon> : null}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <p className="min-w-0 max-w-full text-[15px] font-semibold leading-snug text-sales-text-primary [overflow-wrap:anywhere] sm:truncate sm:text-[14px]">{title}</p>
            {status}
          </div>
          {reason ? (
            <p className="mt-0.5 text-[13px] leading-snug text-sales-text-secondary [overflow-wrap:anywhere]">{reason}</p>
          ) : null}
          {meta ? (
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-sales-text-muted">
              {meta}
            </div>
          ) : null}
        </div>
      </div>
      {action || menu ? (
        <div className="flex shrink-0 items-center gap-1 pl-12 sm:self-center sm:pl-0">
          {action}
          {menu}
        </div>
      ) : null}
    </li>
  );
}

export function ReRowAction({
  label,
  onClick,
  href,
  disabled,
  srContext,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  /** Appended for screen readers, e.g. the record name. */
  srContext?: string;
}) {
  const className = cn(
    RE_FOCUS,
    "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[var(--re-radius-control,8px)] border border-sales-border px-3 text-[13px] font-semibold text-sales-text-primary transition-colors hover:border-sales-border-strong hover:bg-sales-surface-hover disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9"
  );
  const content = (
    <>
      {label}
      {srContext ? <span className="sr-only">: {srContext}</span> : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled}>
      {content}
    </button>
  );
}

export function ReList({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul aria-label={label} className="divide-y divide-sales-border-subtle">
      {children}
    </ul>
  );
}

export function ReGroupLabel({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <li
      role="presentation"
      className="flex items-center gap-2 bg-sales-surface-subtle px-[var(--re-card-pad,16px)] py-1.5 text-[12px] font-medium text-sales-text-secondary"
    >
      <span>{children}</span>
      {count != null ? <span className="tabular-nums text-sales-text-muted">{count}</span> : null}
    </li>
  );
}

/* ─── States ────────────────────────────────────────────────────────────── */

export function ReEmptyState({
  title,
  description,
  action,
  compact = false,
  framed = false,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
  /** Standalone empty result. Do not also put the same title on a surrounding section. */
  framed?: boolean;
}) {
  return (
    <div
      className={cn(
        "px-4 text-left",
        compact ? "py-3" : "py-4",
        framed && "rounded-[var(--re-radius-card,12px)] border border-sales-border-subtle bg-sales-surface"
      )}
    >
      <p className="text-[15px] font-semibold text-sales-text-primary">{title}</p>
      {description ? (
        <p className="mt-1 max-w-[42ch] text-[13px] leading-snug text-sales-text-secondary">{description}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function ReErrorState({
  title = "This section didn't load",
  description = "Your other work is unaffected. Try again in a moment.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex items-start gap-3 px-[var(--re-card-pad,16px)] py-4">
      <AlertCircle size={18} strokeWidth={1.8} className="mt-0.5 shrink-0 text-sales-danger" aria-hidden />
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-sales-text-primary">{title}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-sales-text-secondary">{description}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className={cn(
              RE_FOCUS,
              "mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-[var(--re-radius-control,8px)] border border-sales-border px-3 text-[13px] font-semibold text-sales-text-primary hover:bg-sales-surface-hover sm:min-h-9"
            )}
          >
            <RotateCw size={14} strokeWidth={1.8} aria-hidden />
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Data loaded, but the source said it could not include every record. */
export function RePartialNotice({ children }: { children: ReactNode }) {
  return (
    <p className="mx-[var(--re-card-pad,16px)] mb-2 rounded-[var(--re-radius-control,8px)] border border-sales-warning/30 bg-sales-warning-soft px-3 py-2 text-[12px] leading-snug text-sales-warning-fg">
      {children}
    </p>
  );
}

export function ReSkeletonRows({ rows = 3, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="divide-y divide-sales-border-subtle">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-[var(--re-card-pad,16px)] py-3.5">
          <span className="h-9 w-9 shrink-0 animate-pulse rounded-[10px] bg-sales-surface-hover motion-reduce:animate-none" />
          <span className="min-w-0 flex-1 space-y-2">
            <span className="block h-3.5 w-2/5 animate-pulse rounded bg-sales-surface-hover motion-reduce:animate-none" />
            <span className="block h-3 w-3/5 animate-pulse rounded bg-sales-surface-hover motion-reduce:animate-none" />
          </span>
        </div>
      ))}
    </div>
  );
}
