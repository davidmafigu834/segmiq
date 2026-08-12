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

const FUNNEL_ICONS = {
  enquiries: Inbox,
  contacted: MessageCircle,
  qualified: UserCheck,
  deals: Handshake,
  proposal: FileText,
  won: CheckCircle2,
} as const;

export function LeadDealFunnelCard({ stages }: { stages: SalesFunnelStage[] }) {
  return (
    <CardShell
      title="Lead → Deal funnel"
      action={<span className="text-[12px] font-medium text-sales-text-muted">This month</span>}
    >
      <div className="px-4 py-4 sm:px-5">
        <p className="mb-3 text-[11px] text-sales-text-muted">
          How enquiries become commercial outcomes (period counts).
        </p>
        {/* Horizontal scroll on mobile; stepped vertical on wider */}
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:thin] sm:flex-col sm:overflow-visible sm:pb-0">
          {stages.map((stage, idx) => {
            const Icon = FUNNEL_ICONS[stage.icon];
            return (
              <div key={stage.id} className="flex shrink-0 items-stretch gap-2 sm:w-full">
                <div className="flex min-w-[112px] flex-1 items-center gap-3 rounded-[10px] border border-sales-border bg-sales-surface-raised px-3 py-2.5 sm:min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sales-sm bg-sales-neutral-100 text-sales-text-secondary">
                    <Icon size={15} strokeWidth={1.8} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[11px] text-sales-text-muted">{stage.label}</p>
                    <p className="text-[16px] font-semibold tabular-nums text-sales-text-primary">
                      {stage.count}
                    </p>
                  </div>
                </div>
                {idx < stages.length - 1 ? (
                  <div
                    className="hidden w-px self-stretch bg-sales-border sm:mx-4 sm:block sm:h-3 sm:w-auto sm:self-center sm:border-l sm:border-dashed sm:border-sales-border sm:bg-transparent"
                    aria-hidden
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </CardShell>
  );
}
