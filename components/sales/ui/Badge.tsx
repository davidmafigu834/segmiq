import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export type BadgeTone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "purple";

export type BadgeAppearance = "soft" | "outline" | "solid";

const softTone: Record<BadgeTone, string> = {
  neutral: "bg-sales-neutral-100 text-sales-text-secondary",
  brand: "bg-sales-brand-soft-solid text-sales-brand-fg",
  success: "bg-sales-success-soft text-sales-success-fg",
  warning: "bg-sales-warning-soft text-sales-warning-fg",
  danger: "bg-sales-danger-soft text-sales-danger-fg",
  info: "bg-sales-info-soft text-sales-info-fg",
  purple: "bg-sales-purple-soft text-sales-purple-fg",
};

const outlineTone: Record<BadgeTone, string> = {
  neutral: "border border-sales-border bg-sales-surface text-sales-text-secondary",
  brand: "border border-sales-brand-border bg-sales-surface text-sales-brand-fg",
  success: "border border-sales-success/30 bg-sales-surface text-sales-success-fg",
  warning: "border border-sales-warning/35 bg-sales-surface text-sales-warning-fg",
  danger: "border border-sales-danger/30 bg-sales-surface text-sales-danger-fg",
  info: "border border-sales-info/30 bg-sales-surface text-sales-info-fg",
  purple: "border border-sales-purple/30 bg-sales-surface text-sales-purple-fg",
};

const solidInk = "text-[var(--sales-solid-ink)]";

const solidTone: Record<BadgeTone, string> = {
  neutral: `bg-[var(--sales-neutral-500)] ${solidInk}`,
  brand: "bg-sales-brand text-sales-brand-text",
  // Amber is too light for white text in either theme.
  warning: "bg-sales-warning text-[#4A2A02]",
  success: `bg-sales-success ${solidInk}`,
  danger: `bg-sales-danger ${solidInk}`,
  info: `bg-sales-info ${solidInk}`,
  purple: `bg-sales-purple ${solidInk}`,
};

export function Badge({
  tone = "neutral",
  appearance = "soft",
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  appearance?: BadgeAppearance;
}) {
  const toneMap =
    appearance === "outline" ? outlineTone : appearance === "solid" ? solidTone : softTone;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 truncate rounded-sales-xs px-2 py-[3px] text-[11px] font-medium leading-4",
        toneMap[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export type StatusDotTone = BadgeTone | "busy" | "away" | "offline";

const dotTone: Record<StatusDotTone, string> = {
  neutral: "bg-sales-text-muted",
  brand: "bg-sales-brand",
  success: "bg-sales-success",
  warning: "bg-sales-warning",
  danger: "bg-sales-danger",
  info: "bg-sales-info",
  purple: "bg-sales-purple",
  busy: "bg-sales-warning",
  away: "bg-[#EAB308]",
  offline: "bg-sales-text-muted",
};

export function StatusDot({
  tone = "neutral",
  size = 8,
  className,
  label,
}: {
  tone?: StatusDotTone;
  size?: 6 | 8;
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={cn("inline-block shrink-0 rounded-full", dotTone[tone], className)}
      style={{ width: size, height: size }}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
}

const STAGE_TONE: Record<string, BadgeTone> = {
  NEW: "info",
  CONTACTED: "success",
  QUALIFIED: "info",
  SCOPING: "brand",
  NEGOTIATING: "warning",
  PROPOSAL_SENT: "purple",
  WON: "success",
  LOST: "danger",
  NOT_QUALIFIED: "neutral",
};

export function PipelineStageBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  return (
    <Badge tone={STAGE_TONE[status] ?? "neutral"} className={className}>
      {label ?? status.replace(/_/g, " ")}
    </Badge>
  );
}

/** Hot ≥70 · Warm 45–69 · Cold <45 (Cold = blue per boards) */
export function LeadScoreBadge({
  score,
  className,
}: {
  score: number | null | undefined;
  className?: string;
}) {
  if (score == null || !Number.isFinite(score)) return null;
  const band = score >= 70 ? "hot" : score >= 45 ? "warm" : "cold";
  const tone: BadgeTone = band === "hot" ? "danger" : band === "warm" ? "warning" : "info";
  const label = band === "hot" ? "Hot" : band === "warm" ? "Warm" : "Cold";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[12px] font-medium text-sales-text-secondary",
        className
      )}
    >
      <StatusDot tone={tone} size={6} />
      {label}
    </span>
  );
}

export function MetaPill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 truncate rounded-sales-sm border border-sales-border bg-sales-surface-subtle px-2 py-[3px] text-[11px] font-medium leading-4 text-sales-text-secondary",
        className
      )}
    >
      {children}
    </span>
  );
}
