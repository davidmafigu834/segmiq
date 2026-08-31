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
import { SalesFunnelChart, type FunnelChartStage } from "@/components/sales/ui/Charts";
import { PIPELINE_STAGE_COLORS } from "@/lib/sales/design-tokens";

const FUNNEL_ICONS = {
  enquiries: Inbox,
  contacted: MessageCircle,
  qualified: UserCheck,
  deals: Handshake,
  proposal: FileText,
  won: CheckCircle2,
} as const;

const FUNNEL_COLOR: Record<SalesFunnelStage["icon"], string> = {
  enquiries: PIPELINE_STAGE_COLORS.NEW,
  contacted: PIPELINE_STAGE_COLORS.CONTACTED,
  qualified: "var(--sales-cyan)",
  deals: PIPELINE_STAGE_COLORS.CONTACTED,
  proposal: PIPELINE_STAGE_COLORS.PROPOSAL_SENT,
  won: PIPELINE_STAGE_COLORS.WON,
};

export function LeadDealFunnelCard({ stages }: { stages: SalesFunnelStage[] }) {
  const funnelStages: FunnelChartStage[] = stages.map((stage) => ({
    id: stage.id,
    label: stage.label,
    count: stage.count,
    color: FUNNEL_COLOR[stage.icon],
    icon: FUNNEL_ICONS[stage.icon],
  }));

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

        <SalesFunnelChart stages={funnelStages} />

        <p className="mt-3.5 text-[10px] leading-relaxed text-sales-text-muted">
          Counts are period totals, not cohort conversion rates.
        </p>
      </div>
    </CardShell>
  );
}
