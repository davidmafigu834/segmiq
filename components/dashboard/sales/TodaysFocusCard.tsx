"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Crosshair,
  TrendingUp,
} from "lucide-react";
import type { FocusModeResult, PipelineCoverageResult } from "@/lib/sales/intelligence/types";
import { Card, CardContent } from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";

export function TodaysFocusCard({
  focus,
  coverage,
  goalProgressPct,
  prospectProgress,
  error,
}: {
  focus: FocusModeResult | null;
  coverage: PipelineCoverageResult | null;
  goalProgressPct: number | null;
  prospectProgress: { completed: number; target: number } | null;
  error?: boolean;
}) {
  if (error) {
    return (
      <Card className="border-sales-border">
        <CardContent className="p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
            Today&apos;s focus
          </p>
          <p className="mt-2 text-[14px] text-sales-text-secondary">
            We couldn&apos;t load today&apos;s priorities right now.
          </p>
          <Link
            href="/sales/tasks"
            className="mt-3 inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold text-sales-brand-fg hover:underline"
          >
            Open tasks <ArrowRight size={14} aria-hidden />
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (!focus) return null;

  const Icon =
    focus.mode === "BUILD" ? Building2 : focus.mode === "CLOSE" ? Crosshair : TrendingUp;

  const cta =
    focus.mode === "BUILD"
      ? { label: "Continue prospecting", href: "/sales/tasks" }
      : focus.mode === "CLOSE"
        ? { label: "View priority actions", href: "/sales/tasks" }
        : { label: "Open tasks →", href: "/sales/tasks" };

  return (
    <Card
      className={cn(
        "border-sales-border",
        "bg-[color-mix(in_srgb,var(--sales-brand)_4%,var(--sales-surface))]"
      )}
    >
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-sales-sm bg-sales-brand-soft-solid text-sales-brand-fg">
              <Icon size={16} strokeWidth={1.8} aria-hidden />
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
              Today&apos;s focus
            </p>
          </div>
          <p className="mt-2 text-[18px] font-semibold tracking-[-0.02em] text-sales-text-primary sm:text-[20px]">
            {focus.title}
          </p>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-sales-text-secondary">
            {focus.body}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-sales-text-muted">
            {focus.mode === "BUILD" && prospectProgress && prospectProgress.target > 0 ? (
              <span className="tabular-nums">
                Prospecting:{" "}
                <span className="font-semibold text-sales-text-primary">
                  {prospectProgress.completed} / {prospectProgress.target}
                </span>
              </span>
            ) : null}
            {goalProgressPct != null ? (
              <span className="tabular-nums">
                Goal progress:{" "}
                <span className="font-semibold text-sales-text-primary">{goalProgressPct}%</span>
              </span>
            ) : null}
            {coverage?.available && coverage.coverageRatio != null ? (
              <span className="tabular-nums">
                Pipeline coverage:{" "}
                <span className="font-semibold text-sales-text-primary">
                  {coverage.coverageRatio.toFixed(1)}×
                </span>
              </span>
            ) : null}
          </div>
        </div>

        <Link
          href={cta.href}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-sales-md border border-sales-border bg-sales-surface px-4 text-[13px] font-semibold text-sales-text-primary transition-colors hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sales-brand"
        >
          {cta.label}
          {focus.mode !== "BUILD" ? <ArrowRight size={14} aria-hidden /> : null}
        </Link>
      </CardContent>
    </Card>
  );
}

export function TodaysSalesPlanStrip({
  headline,
  supporting,
  ctaLabel,
  ctaHref,
  state,
}: {
  headline: string;
  supporting: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  state: "active" | "complete" | "build";
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-sales-border bg-sales-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="min-w-0">
        <div className="flex items-start gap-2">
          {state === "complete" ? (
            <CheckCircle2
              size={18}
              className="mt-0.5 shrink-0 text-sales-success"
              aria-hidden
            />
          ) : null}
          <div>
            <p className="text-[14px] font-semibold text-sales-text-primary">{headline}</p>
            <p className="mt-1 text-[12px] text-sales-text-secondary">{supporting}</p>
          </div>
        </div>
      </div>
      {ctaLabel && ctaHref ? (
        <Link
          href={ctaHref}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-sales-md bg-sales-text-primary px-4 text-[13px] font-semibold text-sales-bg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sales-brand"
        >
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}
