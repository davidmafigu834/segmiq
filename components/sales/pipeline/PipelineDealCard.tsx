"use client";

import { useMemo, useState, type MouseEvent } from "react";
import {
  ArrowRightLeft,
  Calendar,
  FileText,
  MoreHorizontal,
  PanelRight,
  Phone,
} from "lucide-react";
import { SiFacebook, SiWhatsapp } from "react-icons/si";
import { useRouter } from "next/navigation";
import type { DealRow, DealStage } from "@/types";
import type { DealCommercialValue } from "@/lib/sales/deals/commercial-value";
import {
  DEAL_ACTIVE_STAGES,
  DEAL_STAGE_LABEL,
  type DealActiveStage,
} from "@/lib/sales/deals";
import { resolvePipelineAttentionBadge } from "@/lib/sales/attention/pipeline-badge";
import { formatLeadSource } from "@/lib/sales/leads-directory/format";
import { scoreLabel } from "@/lib/inbox/scoring";
import { isWhatsAppInboundLead, whatsappInboxHref } from "@/lib/leads/whatsapp-lead-display";
import { openWhatsAppAndLog } from "@/lib/whatsapp-opener";
import { Avatar, Badge, IconButton, Tooltip } from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";

export type PipelineDealQuoteSummary = {
  id: string;
  quote_number: string | null;
  total: number | null;
  status: string;
} | null;

export type PipelineDealCardItem = {
  deal: DealRow;
  commercial: DealCommercialValue;
  customerName: string | null;
  customerPhone: string | null;
  customerCompany: string | null;
  leadScore: number | null;
  leadSource: string | null;
  leadManualPriority: "hot" | "warm" | "cold" | null;
  quoteCount: number;
  latestQuote: PipelineDealQuoteSummary;
  /** Optional Sales Attention overlays */
  awaitingReplyMinutes?: number | null;
  hasOpenCommitmentDue?: boolean;
};

function intentBadge(
  score: number | null,
  manual: "hot" | "warm" | "cold" | null
): { label: string; tone: "danger" | "warning" | "info" } | null {
  if (manual === "hot") return { label: "Hot", tone: "danger" };
  if (manual === "warm") return { label: "Warm", tone: "warning" };
  if (manual === "cold") return { label: "Cold", tone: "info" };
  if (score == null || !Number.isFinite(score)) return null;
  const label = scoreLabel(score);
  if (label === "Hot") return { label: "Hot", tone: "danger" };
  if (label === "Warm") return { label: "Warm", tone: "warning" };
  return { label: "Cold", tone: "info" };
}

function SourceGlyph({ source }: { source: string | null }) {
  const meta = formatLeadSource(source);
  if (meta.key === "whatsapp" || isWhatsAppInboundLead(source)) {
    return <SiWhatsapp className="h-3.5 w-3.5" style={{ color: "#25D366" }} aria-hidden />;
  }
  if (meta.key === "facebook") {
    return <SiFacebook className="h-3.5 w-3.5 text-[#1877F2]" aria-hidden />;
  }
  return null;
}

export function PipelineDealCard({
  item,
  compact = false,
  selected = false,
  practiceMode = false,
  repName = "",
  onOpen,
  onMoved,
  onSchedule,
  onLogCall,
}: {
  item: PipelineDealCardItem;
  compact?: boolean;
  selected?: boolean;
  practiceMode?: boolean;
  repName?: string;
  onOpen: (dealId: string) => void;
  onMoved?: (deal: DealRow) => void;
  onSchedule?: (dealId: string) => void;
  onLogCall?: (dealId: string) => void;
}) {
  const router = useRouter();
  const [moveOpen, setMoveOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const {
    deal,
    commercial,
    customerName,
    customerPhone,
    customerCompany,
    leadScore,
    leadSource,
    leadManualPriority,
    quoteCount,
  } = item;

  const attentionBadge = useMemo(
    () =>
      resolvePipelineAttentionBadge({
        deal,
        awaitingReplyMinutes: item.awaitingReplyMinutes,
        hasOpenCommitmentDue: item.hasOpenCommitmentDue,
      }),
    [deal, item.awaitingReplyMinutes, item.hasOpenCommitmentDue]
  );
  const name = customerName?.trim() || "Customer";
  const valueLabel =
    commercial.kind === "pending" ? "Value pending" : commercial.display;
  const sourceMeta = formatLeadSource(leadSource);
  const intent = intentBadge(leadScore, leadManualPriority);
  const hasWhatsApp = isWhatsAppInboundLead(leadSource) || Boolean(customerPhone?.trim());
  const hasPhone = Boolean(customerPhone?.trim());
  const badgeTone = attentionBadge?.tone ?? "neutral";

  async function moveTo(stage: DealActiveStage) {
    if (practiceMode || moving || stage === deal.stage) {
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

  async function handleWhatsApp(e: MouseEvent) {
    e.stopPropagation();
    if (practiceMode) return;
    if (isWhatsAppInboundLead(leadSource)) {
      router.push(whatsappInboxHref(deal.originating_lead_id));
      return;
    }
    if (!customerPhone) return;
    await openWhatsAppAndLog({
      leadId: deal.originating_lead_id,
      clientId: deal.client_id,
      leadName: customerName,
      leadPhone: customerPhone,
      repName,
      formData: {},
      tier: "neutral",
    });
  }

  function handleCall(e: MouseEvent) {
    e.stopPropagation();
    if (practiceMode) return;
    if (onLogCall) {
      onLogCall(deal.id);
      return;
    }
    if (customerPhone) window.location.href = `tel:${customerPhone}`;
  }

  function handleSchedule(e: MouseEvent) {
    e.stopPropagation();
    if (practiceMode) return;
    if (onSchedule) {
      onSchedule(deal.id);
      return;
    }
    router.push(`/sales/calendar?deal=${deal.id}`);
  }

  function handleQuote(e: MouseEvent) {
    e.stopPropagation();
    if (practiceMode) return;
    router.push(
      `/sales/quotes?leadId=${deal.originating_lead_id}&dealId=${deal.id}`
    );
  }

  return (
    <article
      role="button"
      tabIndex={0}
      data-course-target="pipeline-deal-card"
      aria-pressed={selected}
      onClick={() => onOpen(deal.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(deal.id);
        }
      }}
      className={cn(
        "group relative cursor-pointer rounded-[12px] border bg-sales-surface text-left shadow-sales-card",
        "transition-[border-color,box-shadow,background-color] duration-150",
        compact ? "p-3" : "px-3.5 py-3",
        selected
          ? "border-sales-brand-border bg-sales-brand-soft shadow-sales-card"
          : "border-sales-border hover:border-sales-border-strong hover:shadow-sales-card-hover"
      )}
    >
      <div className="flex items-start gap-2.5">
        <Avatar name={name} size="sm" className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 truncate text-[13px] font-semibold tracking-[-0.01em] text-sales-text-primary">
              {name}
            </h3>
            {attentionBadge ? (
              <Badge
                tone={
                  badgeTone === "danger"
                    ? "danger"
                    : badgeTone === "warning"
                      ? "warning"
                      : badgeTone === "info"
                        ? "info"
                        : "neutral"
                }
                appearance="soft"
                className="shrink-0"
              >
                {attentionBadge.label}
              </Badge>
            ) : null}
          </div>

          {customerPhone ? (
            <p className="mt-0.5 truncate font-mono text-[11px] text-sales-text-muted">
              {customerPhone}
            </p>
          ) : null}

          {customerCompany || deal.name ? (
            <p className="mt-1 truncate text-[12px] text-sales-text-secondary">
              {customerCompany || deal.name}
            </p>
          ) : null}

          {customerCompany && deal.name ? (
            <p className="mt-0.5 truncate text-[11px] text-sales-text-muted">{deal.name}</p>
          ) : null}

          <p
            className="mt-1.5 flex items-center gap-1.5 text-[11px] text-sales-text-secondary"
            title={`Source: ${sourceMeta.label}`}
          >
            <SourceGlyph source={leadSource} />
            <span className="truncate">{sourceMeta.label}</span>
          </p>

          <div
            className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1"
            data-course-target="pipeline-deal-value"
          >
            {intent ? (
              <Badge tone={intent.tone} appearance="soft" className="!px-1.5 !py-px">
                {intent.label}
              </Badge>
            ) : null}
            <span
              className="text-[13px] font-semibold tabular-nums text-sales-text-primary"
              title={
                commercial.kind === "pending"
                  ? "Value not estimated yet"
                  : commercial.label
              }
            >
              {valueLabel}
            </span>
          </div>
        </div>
      </div>

      <div
        className="mt-3 flex items-center gap-1.5 border-t border-sales-border pt-2.5"
        onClick={(e) => e.stopPropagation()}
      >
        <Tooltip label="Open Deal">
          <IconButton
            size="sm"
            aria-label="Open Deal"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(deal.id);
            }}
          >
            <PanelRight strokeWidth={1.8} />
          </IconButton>
        </Tooltip>

        {hasWhatsApp ? (
          <Tooltip label="Open WhatsApp">
            <IconButton
              size="sm"
              aria-label="Open WhatsApp"
              disabled={practiceMode}
              onClick={(e) => void handleWhatsApp(e)}
            >
              <SiWhatsapp style={{ color: "#25D366" }} />
            </IconButton>
          </Tooltip>
        ) : null}

        {hasPhone ? (
          <Tooltip label="Call">
            <IconButton
              size="sm"
              aria-label="Call"
              disabled={practiceMode}
              onClick={handleCall}
            >
              <Phone strokeWidth={1.8} />
            </IconButton>
          </Tooltip>
        ) : null}

        <Tooltip label="Schedule follow-up">
          <IconButton
            size="sm"
            aria-label="Schedule follow-up"
            disabled={practiceMode}
            onClick={handleSchedule}
          >
            <Calendar strokeWidth={1.8} />
          </IconButton>
        </Tooltip>

        <Tooltip label={quoteCount > 0 ? "View Quotes" : "Create Quote"}>
          <IconButton
            size="sm"
            aria-label={quoteCount > 0 ? "View Quotes" : "Create Quote"}
            disabled={practiceMode}
            onClick={handleQuote}
          >
            <FileText strokeWidth={1.8} />
          </IconButton>
        </Tooltip>

        <div className="relative ml-auto">
          <IconButton
            size="sm"
            aria-label="More actions"
            aria-expanded={moreOpen || moveOpen}
            onClick={(e) => {
              e.stopPropagation();
              setMoreOpen((v) => !v);
              setMoveOpen(false);
            }}
          >
            <MoreHorizontal strokeWidth={1.8} />
          </IconButton>
          {moreOpen ? (
            <div
              className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-sales-md border border-sales-border bg-sales-surface py-1 shadow-sales-popover"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="flex min-h-9 w-full items-center gap-2 px-3 text-left text-[12px] font-medium text-sales-text-primary hover:bg-sales-surface-hover"
                onClick={() => {
                  setMoreOpen(false);
                  setMoveOpen(true);
                }}
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Change stage
              </button>
              <button
                type="button"
                className="flex min-h-9 w-full items-center px-3 text-left text-[12px] font-medium text-sales-text-primary hover:bg-sales-surface-hover"
                onClick={() => {
                  setMoreOpen(false);
                  onOpen(deal.id);
                }}
              >
                Open Deal
              </button>
              <button
                type="button"
                className="flex min-h-9 w-full items-center px-3 text-left text-[12px] font-medium text-sales-text-secondary hover:bg-sales-surface-hover"
                disabled={practiceMode}
                onClick={() => {
                  setMoreOpen(false);
                  router.push(`/sales/deals/${deal.id}?close=won`);
                }}
              >
                Mark won…
              </button>
              <button
                type="button"
                className="flex min-h-9 w-full items-center px-3 text-left text-[12px] font-medium text-sales-text-secondary hover:bg-sales-surface-hover"
                disabled={practiceMode}
                onClick={() => {
                  setMoreOpen(false);
                  router.push(`/sales/deals/${deal.id}?close=lost`);
                }}
              >
                Mark lost…
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {moveOpen ? (
        <div
          className="mt-2 space-y-1 rounded-sales-md border border-sales-border bg-sales-surface-subtle p-2"
          onClick={(e) => e.stopPropagation()}
        >
          {(DEAL_ACTIVE_STAGES as readonly DealStage[]).map((stage) => (
            <button
              key={stage}
              type="button"
              disabled={practiceMode || moving || stage === deal.stage}
              onClick={() => void moveTo(stage as DealActiveStage)}
              className="flex min-h-10 w-full items-center rounded-sales-sm px-2 text-left text-[12px] font-medium text-sales-text-primary hover:bg-sales-surface disabled:opacity-40"
            >
              {DEAL_STAGE_LABEL[stage as DealActiveStage]}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}
