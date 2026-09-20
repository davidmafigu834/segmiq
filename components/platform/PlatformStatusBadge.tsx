import { cn } from "@/lib/ui/cn";

export type PlatformStatusKind =
  | "active"
  | "healthy"
  | "operational"
  | "warning"
  | "attention"
  | "error"
  | "failed"
  | "neutral"
  | "suspended"
  | "pending";

const TONE: Record<
  PlatformStatusKind,
  { dot: string; text: string; bg: string }
> = {
  active: { dot: "bg-[var(--success)]", text: "text-[var(--success)]", bg: "bg-[var(--success-muted)]" },
  healthy: { dot: "bg-[var(--success)]", text: "text-[var(--success)]", bg: "bg-[var(--success-muted)]" },
  operational: { dot: "bg-[var(--success)]", text: "text-[var(--success)]", bg: "bg-[var(--success-muted)]" },
  warning: { dot: "bg-[var(--warning)]", text: "text-[var(--warning)]", bg: "bg-[var(--warning-muted)]" },
  attention: { dot: "bg-[var(--warning)]", text: "text-[var(--warning)]", bg: "bg-[var(--warning-muted)]" },
  error: { dot: "bg-[var(--error)]", text: "text-[var(--error)]", bg: "bg-[var(--error-muted)]" },
  failed: { dot: "bg-[var(--error)]", text: "text-[var(--error)]", bg: "bg-[var(--error-muted)]" },
  pending: { dot: "bg-[var(--warning)]", text: "text-[var(--warning)]", bg: "bg-[var(--warning-muted)]" },
  neutral: { dot: "bg-[var(--text-tertiary)]", text: "text-[var(--text-secondary)]", bg: "bg-[var(--bg-tertiary)]" },
  suspended: { dot: "bg-[var(--text-tertiary)]", text: "text-[var(--text-secondary)]", bg: "bg-[var(--bg-tertiary)]" },
};

export function PlatformStatusBadge({
  kind,
  label,
  className,
}: {
  kind: PlatformStatusKind;
  label: string;
  className?: string;
}) {
  const tone = TONE[kind] ?? TONE.neutral;
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-md px-1.5 text-[11px] font-medium",
        tone.bg,
        tone.text,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", tone.dot)} aria-hidden />
      {label}
    </span>
  );
}

export function PlatformHealthRow({
  name,
  kind,
  label,
  meta,
}: {
  name: string;
  kind: PlatformStatusKind;
  label: string;
  meta?: string;
}) {
  const tone = TONE[kind] ?? TONE.neutral;
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-primary)]">{name}</span>
      {meta ? (
        <span className="hidden shrink-0 font-mono text-[11px] tabular-nums text-[var(--text-tertiary)] sm:inline">
          {meta}
        </span>
      ) : null}
      <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
        <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} aria-hidden />
        {label}
      </span>
    </div>
  );
}
