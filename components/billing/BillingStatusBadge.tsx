import { cn } from "@/lib/ui/cn";

type Tone = "success" | "warning" | "error" | "neutral";

/** Maps every billing status onto the shared status-colour convention. */
const STATUS_TONE: Record<string, Tone> = {
  // success
  active: "success",
  paid: "success",
  confirmed: "success",
  // warning
  past_due: "warning",
  overdue: "warning",
  pending: "warning",
  // error
  suspended: "error",
  rejected: "error",
  void: "error",
  // neutral
  draft: "neutral",
  cancelled: "neutral",
  sent: "neutral",
};

const TONE_CLASS: Record<Tone, string> = {
  success: "border-[var(--success-border)] bg-[var(--success-muted)] text-[var(--success)]",
  warning: "border-[var(--warning-border)] bg-[var(--warning-muted)] text-[var(--warning)]",
  error: "border-[var(--error-border)] bg-[var(--error-muted)] text-[var(--error)]",
  neutral: "border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
};

const LABELS: Record<string, string> = {
  active: "Active",
  past_due: "Past due",
  suspended: "Suspended",
  cancelled: "Cancelled",
  draft: "Draft",
  sent: "Sent",
  overdue: "Overdue",
  paid: "Paid",
  void: "Void",
  pending: "Pending",
  confirmed: "Confirmed",
  rejected: "Rejected",
};

export function BillingStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const tone = STATUS_TONE[status] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        TONE_CLASS[tone],
        className
      )}
    >
      {LABELS[status] ?? status}
    </span>
  );
}
