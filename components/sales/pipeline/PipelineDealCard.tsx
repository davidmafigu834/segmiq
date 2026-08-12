"use client";

import { useState } from "react";
import { ArrowRightLeft, Phone } from "lucide-react";
import { SiFacebook, SiWhatsapp } from "react-icons/si";
import { useRouter } from "next/navigation";
import type { DealRow, DealStage } from "@/types";
import type { DealCommercialValue } from "@/lib/sales/deals/commercial-value";
import {
  DEAL_ACTIVE_STAGES,
  DEAL_STAGE_LABEL,
  formatDealStage,
  type DealActiveStage,
} from "@/lib/sales/deals/display";
import { timeAgo } from "@/lib/sales-priority-lead";

export type PipelineDealCardItem = {
  deal: DealRow;
  commercial: DealCommercialValue;
  customerName: string | null;
  customerPhone: string | null;
  leadScore: number | null;
  leadSource: string | null;
};

function sourceIcon(source: string | null) {
  if (source === "WHATSAPP_INBOUND") {
    return <SiWhatsapp className="h-3.5 w-3.5" style={{ color: "#25D366" }} aria-hidden />;
  }
  if (source === "FACEBOOK" || source === "FACEBOOK_AD") {
    return <SiFacebook className="h-3.5 w-3.5 text-[#1877F2]" aria-hidden />;
  }
  return null;
}

export function PipelineDealCard({
  item,
  compact = false,
  onOpen,
  onMoved,
}: {
  item: PipelineDealCardItem;
  compact?: boolean;
  onOpen: (dealId: string) => void;
  onMoved?: (deal: DealRow) => void;
}) {
  const router = useRouter();
  const [moveOpen, setMoveOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const { deal, commercial, customerName, customerPhone, leadSource } = item;
  const name = customerName?.trim() || "Customer";
  const valueLabel =
    commercial.kind === "pending" ? commercial.display : commercial.display;
  const basisLabel =
    commercial.kind === "pending" ? null : commercial.label;
  const nextLine = deal.next_action_at
    ? `${deal.next_action_label || "Next action"} · ${new Date(deal.next_action_at).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : "No next action";
  const last = deal.last_meaningful_activity_at
    ? timeAgo(deal.last_meaningful_activity_at)
    : timeAgo(deal.updated_at);

  async function moveTo(stage: DealActiveStage) {
    if (moving || stage === deal.stage) {
      setMoveOpen(false);
      return;
    }
    setMoving(true);
    try {
      const res = await fetch(`/api/deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      const json = (await res.json().catch(() => ({}))) as { deal?: DealRow };
      if (res.ok && json.deal) onMoved?.(json.deal);
    } finally {
      setMoving(false);
      setMoveOpen(false);
    }
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(deal.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(deal.id);
        }
      }}
      className={`group cursor-pointer rounded-[12px] border border-sales-border bg-sales-surface text-left shadow-sm transition-shadow hover:shadow-md ${
        compact ? "p-3" : "p-3.5"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {sourceIcon(leadSource)}
            <p className="truncate text-[13px] font-semibold uppercase tracking-wide text-sales-text-primary">
              {name}
            </p>
          </div>
          <p className="mt-0.5 truncate text-[14px] font-medium text-sales-text-primary">
            {deal.name}
          </p>
        </div>
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-sales-text-secondary hover:bg-sales-surface-hover"
          aria-label="Move stage"
          onClick={(e) => {
            e.stopPropagation();
            setMoveOpen((v) => !v);
          }}
        >
          <ArrowRightLeft className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[15px] font-semibold text-sales-text-primary">{valueLabel}</span>
        {basisLabel ? (
          <span className="text-[11px] text-sales-text-secondary">{basisLabel}</span>
        ) : null}
      </div>

      <p className="mt-1 text-[12px] text-sales-text-secondary">
        {formatDealStage(deal.stage)}
      </p>
      <p className="mt-2 text-[12px] text-sales-text-secondary">{nextLine}</p>
      <p className="mt-0.5 text-[11px] text-sales-text-tertiary">Last activity · {last}</p>

      {customerPhone ? (
        <a
          href={`tel:${customerPhone}`}
          onClick={(e) => e.stopPropagation()}
          className="mt-2 inline-flex min-h-[36px] items-center gap-1.5 text-[12px] font-medium text-sales-text-secondary hover:text-sales-text-primary"
        >
          <Phone className="h-3.5 w-3.5" />
          Call
        </a>
      ) : null}

      {moveOpen ? (
        <div
          className="mt-2 space-y-1 rounded-[10px] border border-sales-border bg-[#F8F9FB] p-2 dark:bg-[#151815]"
          onClick={(e) => e.stopPropagation()}
        >
          {(DEAL_ACTIVE_STAGES as readonly DealStage[]).map((stage) => (
            <button
              key={stage}
              type="button"
              disabled={moving || stage === deal.stage}
              onClick={() => void moveTo(stage as DealActiveStage)}
              className="flex min-h-[40px] w-full items-center rounded-[8px] px-2 text-left text-[12px] font-medium text-sales-text-primary hover:bg-white disabled:opacity-40 dark:hover:bg-[#111411]"
            >
              {DEAL_STAGE_LABEL[stage as DealActiveStage]}
            </button>
          ))}
          <button
            type="button"
            className="flex min-h-[40px] w-full items-center rounded-[8px] px-2 text-left text-[12px] font-medium text-sales-text-secondary"
            onClick={() => {
              router.push(`/sales/deals/${deal.id}?close=won`);
            }}
          >
            Mark won…
          </button>
          <button
            type="button"
            className="flex min-h-[40px] w-full items-center rounded-[8px] px-2 text-left text-[12px] font-medium text-sales-text-secondary"
            onClick={() => {
              router.push(`/sales/deals/${deal.id}?close=lost`);
            }}
          >
            Mark lost…
          </button>
        </div>
      ) : null}
    </article>
  );
}
