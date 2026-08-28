"use client";

import {
  CheckCircle2,
  FileText,
  Handshake,
  Inbox,
  MessageCircle,
  UserCheck,
} from "lucide-react";
import type { SalesFunnelStage } from "./types";
import { CardShell } from "./KpiCard";
import { cn } from "@/lib/ui/cn";
import type { CSSProperties } from "react";

const FUNNEL_ICONS = {
  enquiries: Inbox,
  contacted: MessageCircle,
  qualified: UserCheck,
  deals: Handshake,
  proposal: FileText,
  won: CheckCircle2,
} as const;

/** Progressive width for a classic funnel silhouette (top → bottom). */
const FUNNEL_WIDTHS = ["100%", "88%", "76%", "64%", "52%", "40%"] as const;

const FUNNEL_COLOR: Record<SalesFunnelStage["icon"], string> = {
  enquiries: "var(--sales-info)",
  contacted: "#6b7cff",
  qualified: "var(--sales-cyan)",
  deals: "var(--sales-success)",
  proposal: "var(--sales-purple)",
  won: "var(--sales-brand)",
};

export function LeadDealFunnelCard({ stages }: { stages: SalesFunnelStage[] }) {
  return (
    <CardShell
      title="Lead → Deal funnel"
      className="dashboard-panel--analytics"
      action={<span className="text-[12px] font-medium text-sales-text-muted">This month</span>}
    >
      <div className="px-5 py-5">
        <p className="mb-4 text-[11px] leading-relaxed text-sales-text-muted">
          How enquiries become commercial outcomes (period counts).
        </p>

        <div
          className="flex flex-col items-center"
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
                    "dashboard-funnel-step flex min-h-[48px] items-center justify-between gap-2 px-3 py-2.5",
                    isFirst && "rounded-t-[12px]",
                    isLast && "rounded-b-[12px]",
                    !hasActivity && "dashboard-funnel-step--idle"
                  )}
                  style={
                    {
                      width,
                      ["--funnel-color" as string]: FUNNEL_COLOR[stage.icon],
                      clipPath: isLast
                        ? "polygon(0 0, 100% 0, 100% 100%, 0 100%)"
                        : "polygon(0 0, 100% 0, 96.5% 100%, 3.5% 100%)",
                    } as CSSProperties
                  }
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-sales-sm",
                        isWon && hasActivity
                          ? "bg-sales-brand-soft text-sales-brand-fg"
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

                {!isLast ? (
                  <div className="relative z-[1] -my-px h-0 w-full" aria-hidden>
                    <div
                      className="mx-auto border-x border-sales-border bg-transparent"
                      style={{
                        width: FUNNEL_WIDTHS[Math.min(idx + 1, FUNNEL_WIDTHS.length - 1)],
                        height: 0,
                      }}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <p className="mt-3.5 text-[10px] leading-relaxed text-sales-text-muted">
          Counts are period totals, not cohort conversion rates.
        </p>
      </div>
    </CardShell>
  );
}
