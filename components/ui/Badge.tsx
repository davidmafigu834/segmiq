import { cn } from "@/lib/ui/cn";

/** Tag pill (repo / label style): rounded-full hairline chip. */
export function TagPill({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-tertiary)] px-2.5 py-0.5 text-xs text-[var(--text-secondary)]",
        className
      )}
      {...props}
    />
  );
}

/** Commit / code pill: monospace, rectangular. */
export function CodePill({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)] px-2.5 py-0.5 font-mono text-xs text-[var(--text-secondary)]",
        className
      )}
      {...props}
    />
  );
}
