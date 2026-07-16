import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/ui/cn";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-5 py-12 text-center", className)}>
      {Icon ? (
        <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)]">
          <Icon className="h-4 w-4 text-[var(--text-tertiary)]" strokeWidth={1.5} />
        </div>
      ) : null}
      <h3 className="text-sm font-medium text-[var(--text-primary)]">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-[var(--text-tertiary)]">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
