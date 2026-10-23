/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V3 */
import type { LucideIcon } from "lucide-react";
import { AlertCircle, CheckCircle2, CircleHelp, MinusCircle } from "lucide-react";
import { cn } from "@/lib/ui/cn";

export function CommercialSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]", className)}>
      <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
          {description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function CommercialMetric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="min-w-0 border-b border-[var(--border)] py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:px-4 sm:first:pl-0 sm:last:border-r-0 sm:last:pr-0">
      <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
        {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
        <span>{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-[var(--text-primary)]">{value}</p>
      {detail ? <p className="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">{detail}</p> : null}
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  active: "border-[var(--success)]/40 text-[var(--success)]",
  accepted: "border-[var(--success)]/40 text-[var(--success)]",
  executed: "border-[var(--success)]/40 text-[var(--success)]",
  pass: "border-[var(--success)]/40 text-[var(--success)]",
  draft: "border-[var(--border)] text-[var(--text-secondary)]",
  off: "border-[var(--border)] text-[var(--text-secondary)]",
  expired: "border-[var(--error)]/40 text-[var(--error)]",
  declined: "border-[var(--error)]/40 text-[var(--error)]",
  suspended: "border-[var(--error)]/40 text-[var(--error)]",
  blocked: "border-[var(--error)]/40 text-[var(--error)]",
  awaiting_countersign: "border-[var(--warning)]/40 text-[var(--warning)]",
  issued: "border-[var(--warning)]/40 text-[var(--warning)]",
  sent: "border-[var(--warning)]/40 text-[var(--warning)]",
  viewed: "border-[var(--warning)]/40 text-[var(--warning)]",
  unknown: "border-[var(--warning)]/40 text-[var(--warning)]",
};

export function CommercialStatus({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const Icon = ["active", "accepted", "executed", "pass"].includes(normalized)
    ? CheckCircle2
    : ["expired", "declined", "suspended", "blocked"].includes(normalized)
      ? AlertCircle
      : normalized === "unknown"
        ? CircleHelp
        : MinusCircle;
  return (
    <span className={cn("inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium capitalize", STATUS_TONE[normalized] ?? STATUS_TONE.draft)}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {value.replaceAll("_", " ")}
    </span>
  );
}

export function CommercialEmptyState({
  title,
  description,
  icon: Icon = CircleHelp,
  action,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)]">
        <Icon className="h-4 w-4 text-[var(--text-tertiary)]" aria-hidden="true" />
      </span>
      <h3 className="mt-3 text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="mt-1 max-w-md text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function CommercialUnavailable({ detail }: { detail: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--warning)]/40 bg-[var(--warning)]/5 p-4" role="status">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" aria-hidden="true" />
      <div>
        <p className="text-sm font-medium text-[var(--text-primary)]">Commercial data unavailable</p>
        <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{detail}</p>
      </div>
    </div>
  );
}
