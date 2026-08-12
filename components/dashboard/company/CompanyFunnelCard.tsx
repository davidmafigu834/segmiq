"use client";

import {
  CheckCircle2,
  FileText,
  Handshake,
  Inbox,
  MessageCircle,
  UserCheck,
} from "lucide-react";
import type { SalesFunnelStage } from "@/components/dashboard/sales/types";
import { CardShell } from "@/components/dashboard/sales/KpiCard";
import { cn } from "@/lib/ui/cn";

const FUNNEL_ICONS = {
  enquiries: Inbox,
  contacted: MessageCircle,
  qualified: UserCheck,
  deals: Handshake,
  proposal: FileText,
  won: CheckCircle2,
} as const;

const FUNNEL_WIDTHS = ["100%", "88%", "76%", "64%", "52%", "40%"] as const;

export function CompanyFunnelCard({
  stages,
  conversionRate,
  conversionDefinition,
}: {
  stages: SalesFunnelStage[];
  conversionRate: number | null;
  conversionDefinition: string;
}) {
  return (
    <CardShell
      title="Lead → Deal Funnel"
      action={<span className="text-[12px] font-medium text-sales-text-muted">This month</span>}
    >
      <div className="px-4 py-4 sm:px-5">
        {/* Desktop / tablet compact funnel */}
        <div
          className="hidden flex-col items-center sm:flex"
          role="list"
          aria-label="Lead to Deal funnel stages this month"
        >
          {stages.map((stage, idx) => {
            const Icon = FUNNEL_ICONS[stage.icon];
            const width = FUNNEL_WIDTHS[Math.min(idx, FUNNEL_WIDTHS.length - 1)]!;
            const isWon = stage.id === "won";
            const isFirst = idx === 0;
            const isLast = idx === stages.length - 1;
            const hasActivity = stage.count > 0;

            return (
              <div
                key={stage.id}
                className="relative flex w-full flex-col items-center"
                role="listitem"
              >
                <div
                  className={cn(
                    "flex min-h-[48px] items-center justify-between gap-2 border border-sales-border px-3 py-2.5",
                    isFirst && "rounded-t-[12px]",
                    isLast && "rounded-b-[12px]",
                    isWon && hasActivity
                      ? "border-sales-success/35 bg-sales-success-soft"
                      : hasActivity
                        ? "bg-[rgba(212,255,79,0.08)]"
                        : "bg-[var(--sales-neutral-100)]/60"
                  )}
                  style={{
                    width,
                    clipPath: isLast
                      ? "polygon(0 0, 100% 0, 100% 100%, 0 100%)"
                      : "polygon(0 0, 100% 0, 96.5% 100%, 3.5% 100%)",
                  }}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-sales-sm",
                        isWon && hasActivity
                          ? "bg-sales-success/15 text-sales-success-fg"
                          : "bg-sales-neutral-100 text-sales-text-secondary"
                      )}
                    >
                      <Icon size={14} strokeWidth={1.8} aria-hidden />
                    </span>
                    <span className="truncate text-[12px] font-medium text-sales-text-secondary">
                      {stage.label}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-[17px] font-semibold tabular-nums tracking-[-0.02em]",
                      hasActivity ? "text-sales-text-primary" : "text-sales-text-muted"
                    )}
                  >
                    {stage.count}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile vertical step list */}
        <ol className="space-y-0 sm:hidden" aria-label="Lead to Deal funnel this month">
          {stages.map((stage, idx) => {
            const Icon = FUNNEL_ICONS[stage.icon];
            return (
              <li key={stage.id} className="relative flex gap-3 pb-4 last:pb-0">
                {idx < stages.length - 1 ? (
                  <span
                    className="absolute left-[15px] top-8 h-[calc(100%-20px)] w-px bg-sales-border"
                    aria-hidden
                  />
                ) : null}
                <span className="relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sales-border bg-sales-surface-raised text-sales-text-secondary">
                  <Icon size={14} strokeWidth={1.8} aria-hidden />
                </span>
                <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2 pt-1">
                  <span className="text-[13px] font-medium text-sales-text-secondary">
                    {stage.label}
                  </span>
                  <span className="text-[16px] font-semibold tabular-nums text-sales-text-primary">
                    {stage.count}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>

        {conversionRate != null ? (
          <p className="mt-4 text-[12px] text-sales-text-secondary">
            Overall conversion (Lead → Won):{" "}
            <span className="font-semibold tabular-nums text-sales-text-primary">
              {conversionRate}%
            </span>
          </p>
        ) : null}
        <p className="mt-2 text-[10px] leading-relaxed text-sales-text-muted">
          {conversionDefinition} Stage counts only — conversion percentages between stages are
          omitted to avoid misleading non-cohort comparisons.
        </p>
      </div>
    </CardShell>
  );
}
