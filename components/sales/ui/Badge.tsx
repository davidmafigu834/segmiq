import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/ui/cn";
import { formatStageLabel } from "@/lib/sales/format";
import {
  formatQuoteStatus,
  getQuoteStatusTone,
} from "@/lib/sales/quotes/format";
import type { QuotationStatus } from "@/types";

export type BadgeTone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "purple"
  | "teal";

export type BadgeAppearance = "soft" | "outline" | "solid";
export type BadgeSize = "sm" | "md" | "lg";

const softTone: Record<BadgeTone, string> = {
  neutral:
    "border border-sales-border/70 bg-sales-neutral-100 text-sales-text-secondary",
  brand:
    "border border-sales-brand-border bg-sales-brand-soft-solid text-sales-brand-fg",
  success:
    "border border-sales-success/20 bg-sales-success-soft text-sales-success-fg",
  warning:
    "border border-sales-warning/25 bg-sales-warning-soft text-sales-warning-fg",
  danger:
    "border border-sales-danger/20 bg-sales-danger-soft text-sales-danger-fg",
  info: "border border-sales-info/20 bg-sales-info-soft text-sales-info-fg",
  purple:
    "border border-sales-purple/20 bg-sales-purple-soft text-sales-purple-fg",
  teal: "border border-sales-teal/20 bg-sales-teal-soft text-sales-teal-fg",
};

const outlineTone: Record<BadgeTone, string> = {
  neutral: "border border-sales-border bg-transparent text-sales-text-secondary",
  brand: "border border-sales-brand-border bg-transparent text-sales-brand-fg",
  success: "border border-sales-success/30 bg-transparent text-sales-success-fg",
  warning: "border border-sales-warning/35 bg-transparent text-sales-warning-fg",
  danger: "border border-sales-danger/30 bg-transparent text-sales-danger-fg",
  info: "border border-sales-info/30 bg-transparent text-sales-info-fg",
  purple: "border border-sales-purple/30 bg-transparent text-sales-purple-fg",
  teal: "border border-sales-teal/30 bg-transparent text-sales-teal-fg",
};

const solidInk = "text-[var(--sales-solid-ink)]";

const solidTone: Record<BadgeTone, string> = {
  neutral: `bg-[var(--sales-neutral-500)] ${solidInk}`,
  brand: "bg-sales-brand text-[var(--sales-ink)]",
  // Amber is too light for white text in either theme.
  warning: "bg-sales-warning text-[#4A2A02]",
  success: `bg-sales-success ${solidInk}`,
  danger: `bg-sales-danger ${solidInk}`,
  info: `bg-sales-info ${solidInk}`,
  purple: `bg-sales-purple ${solidInk}`,
  teal: `bg-sales-teal ${solidInk}`,
};

const sizeClass: Record<BadgeSize, string> = {
  sm: "h-5 min-h-5 gap-1 px-1.5 text-[10px] leading-none",
  md: "h-6 min-h-6 gap-1 px-2 text-[11px] leading-none",
  lg: "h-7 min-h-7 gap-1.5 px-2.5 text-[12px] leading-none",
};

export function Badge({
  tone = "neutral",
  appearance = "soft",
  size = "md",
  leftIcon,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  appearance?: BadgeAppearance;
  size?: BadgeSize;
  leftIcon?: ReactNode;
}) {
  const toneMap =
    appearance === "outline" ? outlineTone : appearance === "solid" ? solidTone : softTone;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-[7px] font-semibold tabular-nums",
        sizeClass[size],
        toneMap[tone],
        className
      )}
      {...props}
    >
      {leftIcon ? (
        <span className="inline-flex shrink-0 items-center justify-center [&_svg]:size-3" aria-hidden>
          {leftIcon}
        </span>
      ) : null}
      {children}
    </span>
  );
}

/* ─── StatusDot ──────────────────────────────────────────────────────────── */

export type StatusDotTone = BadgeTone | "busy" | "away" | "offline";

const dotTone: Record<StatusDotTone, string> = {
  neutral: "bg-sales-text-muted",
  brand: "bg-sales-brand",
  success: "bg-sales-success",
  warning: "bg-sales-warning",
  danger: "bg-sales-danger",
  info: "bg-sales-info",
  purple: "bg-sales-purple",
  teal: "bg-sales-teal",
  busy: "bg-sales-warning",
  away: "bg-[#EAB308]",
  offline: "bg-sales-text-muted",
};

export type StatusDotSize = "sm" | "md" | "lg" | 6 | 8 | 10;

function resolveDotPx(size: StatusDotSize): number {
  if (size === "sm" || size === 6) return 6;
  if (size === "lg" || size === 10) return 10;
  return 8;
}

export function StatusDot({
  tone = "neutral",
  size = "md",
  className,
  label,
}: {
  tone?: StatusDotTone;
  size?: StatusDotSize;
  className?: string;
  label?: string;
}) {
  const px = resolveDotPx(size);
  return (
    <span
      className={cn("inline-block shrink-0 rounded-full", dotTone[tone], className)}
      style={{ width: px, height: px }}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
    />
  );
}

/* ─── PipelineStageBadge ─────────────────────────────────────────────────── */

/** Approved visual mapping — presentation only; does not alter domain enums. */
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
  /** Existing lifecycle value — mapped neutrally; not in the showcase stage list. */
  CONVERTED_TO_DEAL: "neutral",
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
    <Badge
      tone={STAGE_TONE[status] ?? "neutral"}
      appearance="soft"
      size="md"
      className={cn("rounded-[7px] font-semibold", className)}
    >
      {label ?? formatStageLabel(status)}
    </Badge>
  );
}

/* ─── LeadScoreBadge ─────────────────────────────────────────────────────── */

/** Hot ≥70 · Warm 45–69 · Cold <45 (Cold = blue / info — never grey) */
export function LeadScoreBadge({
  score,
  className,
  showScore = true,
}: {
  score: number | null | undefined;
  className?: string;
  /** When false, show Hot/Warm/Cold only. Default shows `Hot · 82`. */
  showScore?: boolean;
}) {
  if (score == null || !Number.isFinite(score)) return null;
  const band = score >= 70 ? "hot" : score >= 45 ? "warm" : "cold";
  const tone: BadgeTone = band === "hot" ? "danger" : band === "warm" ? "warning" : "info";
  const label = band === "hot" ? "Hot" : band === "warm" ? "Warm" : "Cold";
  const rounded = Math.round(score);

  return (
    <Badge tone={tone} appearance="soft" size="md" className={cn("gap-1.5", className)}>
      <StatusDot tone={tone} size="sm" />
      <span>
        {label}
        {showScore ? (
          <>
            <span className="mx-1 text-[10px] opacity-50" aria-hidden>
              ·
            </span>
            <span className="tabular-nums font-semibold">{rounded}</span>
          </>
        ) : null}
      </span>
    </Badge>
  );
}

/* ─── QuotationStatusBadge ───────────────────────────────────────────────── */

function normalizeQuoteStatus(status: string): QuotationStatus {
  const key = status.trim().toLowerCase().replace(/\s+/g, "_");
  // Filter UI may say "declined"; domain enum is "rejected".
  if (key === "declined") return "rejected";
  return key as QuotationStatus;
}

export function QuotationStatusBadge({
  status,
  className,
}: {
  status: QuotationStatus | string;
  className?: string;
}) {
  const normalized = normalizeQuoteStatus(String(status));
  return (
    <Badge
      tone={getQuoteStatusTone(normalized)}
      appearance="soft"
      size="md"
      className={className}
    >
      {formatQuoteStatus(normalized)}
    </Badge>
  );
}

/* ─── MetaPill ───────────────────────────────────────────────────────────── */

export function MetaPill({
  children,
  className,
  leftIcon,
}: {
  children: ReactNode;
  className?: string;
  leftIcon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 truncate rounded-full border border-sales-border",
        "bg-transparent px-2 py-[3px] text-[11px] font-medium leading-4 text-sales-text-secondary",
        className
      )}
    >
      {leftIcon ? (
        <span className="inline-flex shrink-0 items-center justify-center [&_svg]:size-3" aria-hidden>
          {leftIcon}
        </span>
      ) : null}
      {children}
    </span>
  );
}
