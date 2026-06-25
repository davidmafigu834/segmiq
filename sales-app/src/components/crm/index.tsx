import type { ReactNode } from "react";

export function CrmCard({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`rounded-xl border border-border bg-surface-card text-left transition-colors ${
        onClick ? "hover:border-border-hover active:bg-bg-tertiary" : ""
      } ${className}`}
    >
      {children}
    </Tag>
  );
}

export function CrmButton({
  children,
  onClick,
  variant = "primary",
  disabled,
  className = "",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  const styles = {
    primary:
      "bg-accent text-accent-ink font-semibold hover:bg-accent-hover shadow-accent disabled:opacity-50",
    secondary:
      "bg-bg-tertiary text-ink-primary border border-border hover:border-border-hover disabled:opacity-50",
    ghost: "text-ink-secondary hover:text-ink-primary hover:bg-bg-tertiary disabled:opacity-50",
    danger: "bg-[var(--error)]/10 text-[var(--error)] border border-[var(--error)]/20",
  }[variant];

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg px-4 text-[15px] transition-colors ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function AvatarInitials({
  name,
  heat = "warm",
  size = "md",
}: {
  name: string | null | undefined;
  heat?: "hot" | "warm" | "cold";
  size?: "sm" | "md" | "lg";
}) {
  const initials = (() => {
    const parts = (name ?? "?").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
  })();

  const ring =
    heat === "hot"
      ? "ring-[var(--warning)]"
      : heat === "cold"
        ? "ring-[var(--text-disabled)]"
        : "ring-accent/40";

  const sizeClass =
    size === "sm" ? "h-10 w-10 text-sm" : size === "lg" ? "h-14 w-14 text-lg" : "h-12 w-12 text-base";

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-bg-quaternary font-semibold text-accent ring-2 ${ring} ${sizeClass}`}
    >
      {initials}
    </div>
  );
}
