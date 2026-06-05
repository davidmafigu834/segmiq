import { cn } from "@/lib/ui/cn";

export type StatusTone = "success" | "error" | "warning" | "neutral";

const toneColor: Record<StatusTone, string> = {
  success: "bg-[var(--success)]",
  error: "bg-[var(--error)]",
  warning: "bg-[var(--warning)]",
  neutral: "bg-[var(--text-tertiary)]",
};

export interface StatusDotProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone;
  label?: React.ReactNode;
}

/** Status dot + optional label. */
export function StatusDot({ tone = "neutral", label, className, ...props }: StatusDotProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)} {...props}>
      <span className={cn("h-2 w-2 rounded-full", toneColor[tone])} aria-hidden />
      {label != null && <span className="text-sm text-[var(--text-primary)]">{label}</span>}
    </span>
  );
}
