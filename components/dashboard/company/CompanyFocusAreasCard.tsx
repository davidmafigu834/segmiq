"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Flame,
  Inbox,
  ListTodo,
  UserPlus,
  CircleDollarSign,
} from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { CardShell } from "@/components/dashboard/sales/KpiCard";
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
    <CardShell
      title="Focus areas that need attention"
      className="bg-[rgba(212,255,79,0.035)]"
      action={
        !isOnboarding ? (
          <Link
            href={viewAllHref}
            className="text-[12px] font-medium text-sales-text-secondary transition-colors hover:text-sales-text-primary"
          >
            View all alerts
          </Link>
        ) : null
      }
    >
      {signals.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-[13px] font-medium text-sales-text-primary">
            No operational issues need attention right now.
          </p>
          <p className="mt-1 text-[12px] text-sales-text-muted">
            Overdue follow-ups, at-risk Deals and hot enquiries will appear here.
          </p>
        </div>
      ) : isOnboarding ? (
        <div className="px-5 py-6">
          <p className="text-[15px] font-semibold text-sales-text-primary">
            {signals[0]!.label}
          </p>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-sales-text-secondary">
            {signals[0]!.supporting}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/client/team"
              className="inline-flex min-h-11 items-center rounded-[10px] bg-sales-brand px-4 text-[13px] font-semibold text-sales-brand-fg"
            >
              Add salesperson
            </Link>
            <Link
              href="/client/leads"
              className="inline-flex min-h-11 items-center rounded-[10px] border border-sales-border px-4 text-[13px] font-semibold text-sales-text-primary"
            >
              Add Lead
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 divide-y divide-sales-border-subtle sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {signals.map((signal) => {
            const Icon = signalIcon(signal.id, signal.severity);
            return (
              <Link
                key={signal.id}
                href={signal.href}
                className="flex min-h-[88px] items-start gap-3 px-5 py-4 transition-colors hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sales-brand"
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]",
                    SEVERITY_TINT[signal.severity]
                  )}
                >
                  <Icon size={16} strokeWidth={1.8} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[22px] font-semibold tabular-nums tracking-[-0.03em] text-sales-text-primary">
                    {signal.count}
                  </p>
                  <p className="mt-0.5 text-[13px] font-semibold text-sales-text-primary">
                    {signal.label}
                  </p>
                  <p className="mt-0.5 text-[12px] text-sales-text-muted">
                    {signal.supporting}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </CardShell>
  );
}
