"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CircleCheck,
  CircleDollarSign,
  Flame,
  Inbox,
  ListTodo,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { CompanyDashCard, DashLink } from "./CompanyDashCard";
import type { CompanyFocusSignal } from "./types";

const SEVERITY_ICON = {
  critical: AlertTriangle,
  high: AlertTriangle,
  medium: ListTodo,
  info: Inbox,
} as const;

const SEVERITY_TINT: Record<CompanyFocusSignal["severity"], string> = {
  critical: "bg-sales-danger-soft text-sales-danger-fg",
  high: "bg-sales-warning-soft text-sales-warning-fg",
  medium: "bg-sales-info-soft text-sales-info-fg",
  info: "bg-sales-brand-soft-solid text-sales-brand-fg",
};

const SEVERITY_RAIL: Record<CompanyFocusSignal["severity"], string> = {
  critical: "bg-sales-danger",
  high: "bg-sales-warning",
  medium: "bg-sales-info",
  info: "bg-sales-brand",
};

function signalIcon(id: string, severity: CompanyFocusSignal["severity"]) {
  if (id === "hot-enquiries") return Flame;
  if (id === "unassigned") return UserPlus;
  if (id === "awaiting-estimate") return CircleDollarSign;
  if (id === "no-next-action") return ListTodo;
  return SEVERITY_ICON[severity];
}

export function CompanyFocusAreasCard({
  signals,
  viewAllHref,
}: {
  signals: CompanyFocusSignal[];
  viewAllHref: string;
}) {
  const isOnboarding = signals.length === 1 && signals[0]?.id === "onboarding";

  return (
    <CompanyDashCard
      title="Needs attention"
      action={!isOnboarding && signals.length > 0 ? <DashLink href={viewAllHref}>View all alerts</DashLink> : null}
    >
      {signals.length === 0 ? (
        <div className="flex items-center gap-3 px-5 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sales-success-soft text-sales-success-fg">
            <CircleCheck size={18} strokeWidth={1.8} aria-hidden />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-sales-text-primary">Operation is clear</p>
            <p className="text-[12px] text-sales-text-muted">
              No overdue follow-ups, at-risk Deals, or hot enquiries need you right now.
            </p>
          </div>
        </div>
      ) : isOnboarding ? (
        <div className="px-5 py-4">
          <p className="text-[15px] font-semibold tracking-[-0.02em] text-sales-text-primary">
            {signals[0]!.label}
          </p>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-sales-text-secondary">
            {signals[0]!.supporting}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/client/team"
              className="inline-flex min-h-10 items-center rounded-[10px] bg-sales-brand px-3.5 text-[12px] font-semibold text-sales-brand-fg"
            >
              Add salesperson
            </Link>
            <Link
              href="/client/leads"
              className="inline-flex min-h-10 items-center rounded-[10px] border border-sales-border px-3.5 text-[12px] font-semibold text-sales-text-primary"
            >
              Add Lead
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-3 sm:p-3">
          {signals.map((signal) => {
            const Icon = signalIcon(signal.id, signal.severity);
            return (
              <Link
                key={signal.id}
                href={signal.href}
                className="relative flex min-h-[84px] items-start gap-3 overflow-hidden rounded-[12px] bg-sales-surface-subtle px-3.5 py-3 transition-colors hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sales-brand"
              >
                <span
                  className={cn("absolute inset-y-0 left-0 w-[3px]", SEVERITY_RAIL[signal.severity])}
                  aria-hidden
                />
                <span
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]",
                    SEVERITY_TINT[signal.severity]
                  )}
                >
                  <Icon size={15} strokeWidth={1.8} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[22px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-sales-text-primary">
                    {signal.count}
                  </p>
                  <p className="mt-1.5 truncate text-[12px] font-semibold text-sales-text-primary">
                    {signal.label}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-sales-text-muted">{signal.supporting}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </CompanyDashCard>
  );
}
