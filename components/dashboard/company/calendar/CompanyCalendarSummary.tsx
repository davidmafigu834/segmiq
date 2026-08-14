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
      iconClass: "bg-violet-50 text-violet-600 dark:bg-violet-950/35 dark:text-violet-300",
      orderClass: "order-3 md:order-1",
    },
    {
      id: "overdue",
      label: "Overdue Follow-ups",
      value: String(metrics.overdueFollowUps),
      supporting: metrics.overdueFollowUps ? "Needs manager attention" : "No overdue follow-ups",
      Icon: ClockAlert,
      iconClass: "bg-orange-50 text-orange-600 dark:bg-orange-950/35 dark:text-orange-300",
      orderClass: "order-1 md:order-2",
    },
    {
      id: "today",
      label: "Today's Activities",
      value: String(metrics.todayActivities),
      supporting: `Company-local date · ${scopeLabel}`,
      Icon: UsersRound,
      iconClass: "bg-blue-50 text-blue-600 dark:bg-blue-950/35 dark:text-blue-300",
      orderClass: "order-2 md:order-3",
    },
    {
      id: "completed",
      label: "Completed (Week)",
      value: String(metrics.completedWeek),
      supporting: `Actual completions · ${scopeLabel}`,
      Icon: CheckCircle2,
      iconClass: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/35 dark:text-emerald-300",
      orderClass: "order-5 md:order-4",
    },
    {
      id: "response",
      label: "Team Response Time",
      value: formatResponseTime(metrics.responseTimeMinutes),
      supporting: responseContext(metrics.responseTimeMinutes, metrics.responseTimeMinutesPrevious),
      Icon: TimerReset,
      iconClass: "bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-950/35 dark:text-fuchsia-300",
      orderClass: "order-6 md:order-5",
    },
    {
      id: "at_risk",
      label: "At Risk Activities",
      value: String(metrics.atRiskActivities),
      supporting: metrics.atRiskActivities ? "Deterministic attention signals" : "No at-risk activities",
      Icon: TriangleAlert,
      iconClass: "bg-amber-50 text-amber-600 dark:bg-amber-950/35 dark:text-amber-300",
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
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]", card.iconClass)}><card.Icon size={17} strokeWidth={1.8} aria-hidden /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10px] font-medium text-sales-text-secondary">{card.label}</span>
              <span className="mt-1 block text-[22px] font-semibold leading-none tracking-[-0.02em] text-sales-text-primary">{card.value}</span>
              <span className={cn("mt-2 block truncate text-[8px]", card.id === "overdue" && metrics.overdueFollowUps ? "text-sales-danger-fg" : card.id === "at_risk" && metrics.atRiskActivities ? "text-sales-warning-fg" : "text-sales-text-muted")}>{card.supporting}</span>
            </span>
          </>
        );
        const className = cn(
          "min-h-[104px] rounded-[12px] border bg-sales-surface p-3 text-left shadow-[0_1px_2px_rgba(16,24,40,0.02)]",
          card.orderClass,
          active ? "border-sales-brand ring-1 ring-sales-brand-border" : "border-sales-border",
          interactive && "transition-[border-color,box-shadow] hover:border-sales-border-strong hover:shadow-[0_3px_10px_rgba(16,24,40,0.06)]"
        );
        return interactive ? <button key={card.id} type="button" className={cn(className, "flex gap-2.5")} onClick={() => onAction(card.id as SummaryAction)} aria-pressed={active}>{content}</button> : <div key={card.id} className={cn(className, "flex gap-2.5")}>{content}</div>;
      })}
    </section>
  );
}

export type { SummaryAction as CompanyCalendarSummaryAction };
