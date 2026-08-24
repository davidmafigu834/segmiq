"use client";

import {
  CalendarClock,
  CheckCircle2,
  ClockAlert,
  TimerReset,
  TriangleAlert,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { formatResponseTime } from "@/lib/sales/sales-dashboard-display";
import type { CompanyCalendarExecutionMetrics } from "@/lib/sales/company-calendar/types";

type SummaryAction = "upcoming" | "overdue" | "today" | "completed" | "at_risk";

type SummaryCard = {
  id: SummaryAction | "response";
  label: string;
  value: string;
  supporting: string;
  Icon: LucideIcon;
  iconClass: string;
  accentClass: string;
  orderClass: string;
};

function responseContext(current: number | null, previous: number | null): string {
  if (current == null) return "Not enough response data";
  if (previous == null || previous <= 0) return "Lead captured → first response";
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return "Same as previous 30 days";
  return `${Math.abs(change)}% ${change < 0 ? "faster" : "slower"} vs previous 30 days`;
}

export function CompanyCalendarSummary({
  metrics,
  activeAction,
  scopeLabel,
  onAction,
}: {
  metrics: CompanyCalendarExecutionMetrics;
  activeAction: SummaryAction | null;
  scopeLabel: string;
  onAction: (action: SummaryAction) => void;
}) {
  const cards: SummaryCard[] = [
    {
      id: "upcoming",
      label: "Upcoming Activities",
      value: String(metrics.upcomingActivities),
      supporting: `Next 7 days · ${scopeLabel}`,
      Icon: CalendarClock,
      iconClass: "bg-sales-brand-soft-solid text-sales-brand-fg",
      accentClass: "bg-sales-brand",
      orderClass: "order-3 md:order-1",
    },
    {
      id: "overdue",
      label: "Overdue Follow-ups",
      value: String(metrics.overdueFollowUps),
      supporting: metrics.overdueFollowUps ? "Needs manager attention" : "No overdue follow-ups",
      Icon: ClockAlert,
      iconClass: "bg-sales-danger-soft text-sales-danger-fg",
      accentClass: "bg-sales-danger",
      orderClass: "order-1 md:order-2",
    },
    {
      id: "today",
      label: "Today's Activities",
      value: String(metrics.todayActivities),
      supporting: `Company-local date · ${scopeLabel}`,
      Icon: UsersRound,
      iconClass: "bg-sales-info-soft text-sales-info-fg",
      accentClass: "bg-sales-info",
      orderClass: "order-2 md:order-3",
    },
    {
      id: "completed",
      label: "Completed (Week)",
      value: String(metrics.completedWeek),
      supporting: `Actual completions · ${scopeLabel}`,
      Icon: CheckCircle2,
      iconClass: "bg-sales-success-soft text-sales-success-fg",
      accentClass: "bg-sales-success",
      orderClass: "order-5 md:order-4",
    },
    {
      id: "response",
      label: "Team Response Time",
      value: formatResponseTime(metrics.responseTimeMinutes),
      supporting: responseContext(metrics.responseTimeMinutes, metrics.responseTimeMinutesPrevious),
      Icon: TimerReset,
      iconClass: "bg-sales-neutral-100 text-sales-text-secondary",
      accentClass: "bg-sales-warning",
      orderClass: "order-6 md:order-5",
    },
    {
      id: "at_risk",
      label: "At Risk Activities",
      value: String(metrics.atRiskActivities),
      supporting: metrics.atRiskActivities ? "Deterministic attention signals" : "No at-risk activities",
      Icon: TriangleAlert,
      iconClass: "bg-sales-warning-soft text-sales-warning-fg",
      accentClass: "bg-sales-warning",
      orderClass: "order-4 md:order-6",
    },
  ];

  return (
    <section className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6" aria-label="Company Calendar execution summary" data-course-target="company-calendar-kpis">
      {cards.map((card) => {
        const interactive = card.id !== "response";
        const active = interactive && activeAction === card.id;
        const content = (
          <>
            <span className={cn("absolute inset-x-0 top-0 h-[2px]", card.accentClass)} aria-hidden />
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
                {card.label}
              </span>
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-sales-sm sm:h-8 sm:w-8",
                  card.iconClass
                )}
              >
                <card.Icon size={16} strokeWidth={1.8} aria-hidden className="sm:size-[18px]" />
              </span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-[24px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-sales-text-primary sm:text-[26px]">
                {card.value}
              </p>
              <div className="mt-auto min-h-[18px] pt-3">
                <p
                  className={cn(
                    "truncate text-[11px]",
                    card.id === "overdue" && metrics.overdueFollowUps
                      ? "font-medium text-sales-danger-fg"
                      : card.id === "at_risk" && metrics.atRiskActivities
                        ? "font-medium text-sales-warning-fg"
                        : "text-sales-text-muted"
                  )}
                >
                  {card.supporting}
                </p>
              </div>
            </div>
          </>
        );
        const className = cn(
          "sd-card group relative flex h-full min-h-[118px] min-w-0 flex-col overflow-hidden p-3.5 text-left transition-[border-color,box-shadow] duration-150 sm:min-h-[128px] sm:p-4",
          card.orderClass,
          active ? "border-sales-brand ring-1 ring-sales-brand-border" : "border-sales-border",
          interactive &&
            "hover:border-sales-border-strong hover:shadow-sales-card-hover focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sales-focus-outline)]"
        );
        return interactive ? <button key={card.id} type="button" className={className} onClick={() => onAction(card.id as SummaryAction)} aria-pressed={active}>{content}</button> : <article key={card.id} className={className}>{content}</article>;
      })}
    </section>
  );
}

export type { SummaryAction as CompanyCalendarSummaryAction };
