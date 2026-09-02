"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Crosshair,
  TrendingUp,
} from "lucide-react";
import type {
  DailyPlanSchedule,
  FocusMode,
  FocusModeResult,
  PipelineCoverageResult,
} from "@/lib/sales/intelligence/types";
import { Badge } from "@/components/sales/ui";
import { Card, CardContent } from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";

function modeIcon(mode: FocusMode) {
  if (mode === "BUILD") return Building2;
  if (mode === "CLOSE") return Crosshair;
  return TrendingUp;
}

function modeBadgeTone(mode: FocusMode): "brand" | "warning" | "success" {
  if (mode === "BUILD") return "warning";
  if (mode === "CLOSE") return "success";
  return "brand";
}

function modeLabel(mode: FocusMode): string {
  if (mode === "BUILD") return "Build pipeline";
  if (mode === "CLOSE") return "Close";
  return "Move";
}

function focusCta(mode: FocusMode): { label: string; href: string } {
  if (mode === "BUILD") return { label: "Continue prospecting", href: "/sales/tasks" };
  if (mode === "CLOSE") return { label: "View priority deals", href: "/sales/pipeline" };
  return { label: "Start my day", href: "/sales/command?view=focus" };
}

function ScheduleMeta({
  schedule,
  scheduleLine,
}: {
  schedule?: DailyPlanSchedule | null;
  scheduleLine?: string | null;
}) {
  if (schedule) {
    const hours =
      schedule.workStartLabel && schedule.workEndLabel
        ? `${schedule.workStartLabel}–${schedule.workEndLabel}`
        : null;
    const status = schedule.withinHours
      ? "On the clock"
      : schedule.beforeStart
        ? "Work starts soon"
        : schedule.afterEnd
          ? "After hours"
          : null;

    return (
      <div className="hidden min-w-0 text-right sm:block">
        <p className="flex items-center justify-end gap-1.5 text-[11px] font-medium text-sales-text-secondary">
          <CalendarDays size={12} className="shrink-0 text-sales-text-muted" aria-hidden />
          <span className="truncate">{schedule.dateLabel}</span>
        </p>
        {hours ? (
          <p className="mt-0.5 flex items-center justify-end gap-1.5 text-[11px] text-sales-text-muted">
            <Clock3 size={12} className="shrink-0" aria-hidden />
            <span>
              {status ? `${status} · ` : ""}
              {hours}
            </span>
          </p>
        ) : null}
      </div>
    );
  }

  if (!scheduleLine) return null;
  return (
    <p className="hidden max-w-[240px] truncate text-right text-[11px] leading-relaxed text-sales-text-muted sm:block">
      {scheduleLine}
    </p>
  );
}

function FocusStat({
  label,
  value,
  href,
  accent,
}: {
  label: string;
  value: number;
  href: string;
  accent?: "brand" | "neutral";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group block rounded-[10px] border px-3 py-2.5 transition-colors",
        accent === "brand"
          ? "border-sales-brand/25 bg-sales-brand/8 hover:border-sales-brand/40 hover:bg-sales-brand/12"
          : "border-sales-border/70 bg-sales-surface/50 hover:border-sales-border hover:bg-sales-surface"
      )}
    >
      <p
        className={cn(
          "text-[22px] font-bold tabular-nums leading-none tracking-tight",
          accent === "brand" ? "text-sales-brand-fg" : "text-sales-text-primary"
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted group-hover:text-sales-text-secondary">
        {label}
      </p>
    </Link>
  );
}

export function TodaysFocusCard({
  focus,
  coverage,
  goalProgressPct,
  prospectProgress,
  error,
  daysLeftLabel,
  dailyFocusHeadline,
  scheduleLine,
  schedule,
  enquiryCount = 0,
  dealCount = 0,
}: {
  focus: FocusModeResult | null;
  coverage: PipelineCoverageResult | null;
  goalProgressPct: number | null;
  prospectProgress: { completed: number; target: number } | null;
  error?: boolean;
  daysLeftLabel?: string | null;
  dailyFocusHeadline?: string | null;
  scheduleLine?: string | null;
  schedule?: DailyPlanSchedule | null;
  enquiryCount?: number;
  dealCount?: number;
}) {
  if (error) {
    return (
      <Card className="dashboard-panel dashboard-panel--attention overflow-hidden border-0 shadow-none">
        <CardContent className="px-5 py-5 sm:px-6">
          <p className="dashboard-focus-kicker">Today&apos;s focus</p>
          <p className="mt-3 text-[15px] font-semibold text-sales-text-primary">
            Priorities couldn&apos;t load
          </p>
          <p className="mt-1.5 text-[13px] text-sales-text-secondary">
            Your CRM data is unchanged — open tasks to keep working.
          </p>
          <Link
            href="/sales/tasks"
            className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-sales-md bg-sales-brand px-4 text-[13px] font-semibold text-sales-brand-fg"
          >
            Open tasks <ArrowRight size={14} aria-hidden />
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (!focus) return null;

  const Icon = modeIcon(focus.mode);
  const cta = focusCta(focus.mode);
  const showStats = enquiryCount > 0 || dealCount > 0;
  const mobileSchedule = schedule?.summary ?? scheduleLine;

  return (
    <Card
      data-course-target="dashboard-todays-focus"
      className="dashboard-panel dashboard-panel--attention dashboard-panel--focus overflow-hidden border-0 shadow-none"
    >
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sales-border-subtle px-5 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="dashboard-focus-kicker">Today&apos;s focus</p>
            <Badge tone={modeBadgeTone(focus.mode)} appearance="soft" size="sm">
              {modeLabel(focus.mode)}
            </Badge>
          </div>
          <ScheduleMeta schedule={schedule} scheduleLine={scheduleLine} />
        </div>

        <div
          className={cn(
            "grid gap-5 p-5 sm:px-6 sm:py-5",
            showStats ? "lg:grid-cols-[minmax(0,1fr)_220px]" : ""
          )}
        >
          <div className="min-w-0">
            <div className="flex gap-3.5">
              <span className="dashboard-focus-icon mt-0.5 hidden sm:flex" aria-hidden>
                <Icon size={16} strokeWidth={1.8} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="dashboard-focus-title">{focus.title}</h2>
                <p className="mt-2.5 max-w-2xl text-[14px] leading-relaxed text-sales-text-secondary">
                  {focus.body}
                </p>

                {mobileSchedule ? (
                  <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-sales-text-muted sm:hidden">
                    <CalendarDays size={12} aria-hidden />
                    {mobileSchedule}
                  </p>
                ) : null}

                {dailyFocusHeadline ? (
                  <p className="mt-3 rounded-[8px] border border-sales-warning/20 bg-sales-warning-soft/40 px-3 py-2 text-[12px] font-medium text-sales-warning-fg">
                    {dailyFocusHeadline}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-sales-text-muted">
                  {focus.mode === "BUILD" && prospectProgress && prospectProgress.target > 0 ? (
                    <span className="tabular-nums">
                      Prospecting{" "}
                      <span className="font-semibold text-sales-text-primary">
                        {prospectProgress.completed}/{prospectProgress.target}
                      </span>
                    </span>
                  ) : null}
                  {goalProgressPct != null ? (
                    <span className="tabular-nums">
                      Goal{" "}
                      <span className="font-semibold text-sales-text-primary">{goalProgressPct}%</span>
                    </span>
                  ) : null}
                  {coverage?.available && coverage.coverageRatio != null ? (
                    <span className="tabular-nums">
                      Coverage{" "}
                      <span className="font-semibold text-sales-text-primary">
                        {coverage.coverageRatio.toFixed(1)}×
                      </span>
                    </span>
                  ) : null}
                  {daysLeftLabel ? (
                    <span className="tabular-nums">
                      <span className="font-semibold text-sales-text-primary">{daysLeftLabel}</span>
                    </span>
                  ) : null}
                </div>

                {!showStats ? (
                  <Link
                    href={cta.href}
                    className="mt-5 inline-flex min-h-11 items-center gap-1.5 rounded-sales-md bg-sales-brand px-4 text-[13px] font-semibold text-sales-brand-fg transition-opacity hover:opacity-90"
                  >
                    {cta.label}
                    <ArrowRight size={14} aria-hidden />
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          {showStats ? (
            <div className="flex flex-col gap-3 lg:items-stretch">
              <div
                className={cn(
                  "grid gap-2",
                  enquiryCount > 0 && dealCount > 0 ? "grid-cols-2" : "grid-cols-1"
                )}
              >
                {enquiryCount > 0 ? (
                  <FocusStat
                    label="Enquiries"
                    value={enquiryCount}
                    href="/sales/call-now"
                    accent="brand"
                  />
                ) : null}
                {dealCount > 0 ? (
                  <FocusStat
                    label="Deals"
                    value={dealCount}
                    href="/sales/pipeline"
                    accent="neutral"
                  />
                ) : null}
              </div>
              <Link
                href={cta.href}
                className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-sales-md bg-sales-brand px-4 text-[13px] font-semibold text-sales-brand-fg transition-opacity hover:opacity-90"
              >
                {cta.label}
                <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          ) : null}
        </div>
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
    <div
      data-course-target="dashboard-sales-plan"
      className="dashboard-panel dashboard-panel--analytics flex flex-col gap-3 overflow-hidden border-0 p-4 shadow-none sm:flex-row sm:items-center sm:justify-between sm:p-5"
    >
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
