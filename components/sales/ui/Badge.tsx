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
  neutral: "bg-[#F2F4F7] text-sales-text-secondary",
  brand: "bg-[var(--sales-brand-soft-solid,#F3FCE3)] text-sales-brand-fg",
  success: "bg-sales-success-soft text-[#027A48]",
  warning: "bg-sales-warning-soft text-[#B54708]",
  danger: "bg-sales-danger-soft text-[#B42318]",
  info: "bg-sales-info-soft text-[#175CD3]",
  purple: "bg-sales-purple-soft text-[#6941C6]",
};

const outlineTone: Record<BadgeTone, string> = {
  neutral: "border border-sales-border bg-white text-sales-text-secondary",
  brand: "border border-sales-brand-border bg-white text-sales-brand-fg",
  success: "border border-sales-success/30 bg-white text-sales-success",
  warning: "border border-sales-warning/35 bg-white text-[#B54708]",
  danger: "border border-sales-danger/30 bg-white text-sales-danger",
  info: "border border-sales-info/30 bg-white text-sales-info",
  purple: "border border-sales-purple/30 bg-white text-sales-purple",
};

const solidTone: Record<BadgeTone, string> = {
  neutral: "bg-[#667085] text-white",
  brand: "bg-sales-brand text-sales-brand-text",
  success: "bg-sales-success text-white",
  warning: "bg-sales-warning text-white",
  danger: "bg-sales-danger text-white",
  info: "bg-sales-info text-white",
  purple: "bg-sales-purple text-white",
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
        "inline-flex max-w-full items-center truncate rounded-[6px] px-2 py-0.5 text-[11px] font-medium",
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
        "inline-flex items-center rounded-sales-sm border border-sales-border bg-sales-surface-subtle px-2 py-0.5 text-[11px] font-medium text-sales-text-secondary",
        className
      )}
    >
      {children}
    </span>
  );
}
