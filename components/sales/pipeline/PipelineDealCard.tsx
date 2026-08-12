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
  attentionBadgeTone,
  getDealAttentionState,
  type DealActiveStage,
} from "@/lib/sales/deals";
import { formatLeadSource } from "@/lib/sales/leads-directory/format";
import { scoreLabel } from "@/lib/inbox/scoring";
import { isWhatsAppInboundLead, whatsappInboxHref } from "@/lib/leads/whatsapp-lead-display";
import { openWhatsAppAndLog } from "@/lib/whatsapp-opener";
import { Avatar, Badge, Tooltip } from "@/components/sales/ui";
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
};

const actionBtn =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-[#E4E7EC] bg-white text-[#667085] transition-[border-color,background-color,box-shadow] duration-150 hover:border-[#CDD5DF] hover:bg-[#F8F9FB] hover:text-[#344054] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sales-brand/50 disabled:opacity-40 dark:border-[#272C27] dark:bg-[#111411] dark:text-[#B1B7AE] dark:hover:border-[#343A34] dark:hover:bg-[#151815]";

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
  /** When true, action mutations are disabled (training practice). */
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

  const attention = useMemo(() => getDealAttentionState(deal), [deal]);
  const name = customerName?.trim() || "Customer";
  const valueLabel =
    commercial.kind === "pending" ? "Value pending" : commercial.display;
  const sourceMeta = formatLeadSource(leadSource);
  const intent = intentBadge(leadScore, leadManualPriority);
  const hasWhatsApp = isWhatsAppInboundLead(leadSource) || Boolean(customerPhone?.trim());
  const hasPhone = Boolean(customerPhone?.trim());
  const badgeTone = attentionBadgeTone(attention.badge);

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
    const qs = new URLSearchParams({
      leadId: deal.originating_lead_id,
      dealId: deal.id,
    });
    router.push(`/sales/quotes?${qs.toString()}`);
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
        "group relative cursor-pointer rounded-[12px] border bg-white text-left transition-[border-color,box-shadow,background-color] duration-150",
        "dark:bg-[#111411]",
        compact ? "p-3" : "p-3.5",
        selected
          ? "border-[rgba(212,255,79,0.55)] bg-[rgba(212,255,79,0.035)] shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-[rgba(212,255,79,0.35)] dark:bg-[rgba(212,255,79,0.06)]"
          : "border-[#E4E7EC] shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:border-[#CDD5DF] hover:shadow-[0_4px_12px_rgba(16,24,40,0.06)] dark:border-[#272C27] dark:hover:border-[#343A34] dark:hover:bg-[#151815]"
      )}
    >
      <div className="flex items-start gap-2.5">
        <Avatar name={name} size="sm" className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-[13px] font-semibold tracking-[-0.01em] text-[#101828] dark:text-[#F7F8F5]">
                {name}
              </h3>
              <p className="mt-0.5 truncate text-[12px] text-[#667085] dark:text-[#B1B7AE]">
                {deal.name}
              </p>
            </div>
            {attention.badge ? (
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
                {attention.badge}
              </Badge>
            ) : null}
          </div>

          {customerPhone || customerCompany ? (
            <p className="mt-1.5 truncate text-[11px] text-[#98A2B3] dark:text-[#8A9086]">
              {[customerPhone, customerCompany].filter(Boolean).join(" · ")}
            </p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className="inline-flex items-center gap-1 text-[11px] text-[#667085] dark:text-[#B1B7AE]"
              title={`Source: ${sourceMeta.label}`}
            >
              <SourceGlyph source={leadSource} />
              {sourceMeta.label}
            </span>
            {intent ? (
              <Badge tone={intent.tone} appearance="outline" className="!px-1.5 !py-0">
                {intent.label}
              </Badge>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap items-baseline gap-x-2" data-course-target="pipeline-deal-value">
            <span
              className="text-[13px] font-semibold tabular-nums text-[#101828] dark:text-[#F7F8F5]"
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
        className={cn(
          "mt-3 flex items-center gap-1.5 border-t border-[#E4E7EC] pt-2.5 transition-opacity duration-150 dark:border-[#272C27]",
          compact ? "opacity-100" : "opacity-90 group-hover:opacity-100"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Tooltip label="Open Deal">
          <button
            type="button"
            className={actionBtn}
            aria-label="Open Deal"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(deal.id);
            }}
          >
            <PanelRight className="h-3.5 w-3.5" strokeWidth={1.8} />
          </button>
        </Tooltip>

        {hasWhatsApp ? (
          <Tooltip label="Open WhatsApp">
            <button
              type="button"
              className={actionBtn}
              aria-label="Open WhatsApp"
              disabled={practiceMode}
              onClick={(e) => void handleWhatsApp(e)}
            >
              <SiWhatsapp className="h-[15px] w-[15px]" style={{ color: "#25D366" }} />
            </button>
          </Tooltip>
        ) : null}

        {hasPhone ? (
          <Tooltip label="Call">
            <button
              type="button"
              className={actionBtn}
              aria-label="Call"
              disabled={practiceMode}
              onClick={handleCall}
            >
              <Phone className="h-3.5 w-3.5" strokeWidth={1.8} />
            </button>
          </Tooltip>
        ) : null}

        <Tooltip label="Schedule follow-up">
          <button
            type="button"
            className={actionBtn}
            aria-label="Schedule follow-up"
            disabled={practiceMode}
            onClick={handleSchedule}
          >
            <Calendar className="h-3.5 w-3.5" strokeWidth={1.8} />
          </button>
        </Tooltip>

        <Tooltip label={quoteCount > 0 ? "View Quotes" : "Create Quote"}>
          <button
            type="button"
            className={actionBtn}
            aria-label={quoteCount > 0 ? "View Quotes" : "Create Quote"}
            disabled={practiceMode}
            onClick={handleQuote}
          >
            <FileText className="h-3.5 w-3.5" strokeWidth={1.8} />
          </button>
        </Tooltip>

        <div className="relative ml-auto">
          <button
            type="button"
            className={actionBtn}
            aria-label="More actions"
            aria-expanded={moreOpen || moveOpen}
            onClick={(e) => {
              e.stopPropagation();
              setMoreOpen((v) => !v);
              setMoveOpen(false);
            }}
          >
            <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.8} />
          </button>
          {moreOpen ? (
            <div
              className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-[10px] border border-[#E4E7EC] bg-white py-1 shadow-[0_8px_24px_rgba(16,24,40,0.12)] dark:border-[#272C27] dark:bg-[#151815]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="flex min-h-9 w-full items-center gap-2 px-3 text-left text-[12px] font-medium text-[#344054] hover:bg-[#F8F9FB] dark:text-[#F7F8F5] dark:hover:bg-[#1B1F1B]"
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
                className="flex min-h-9 w-full items-center px-3 text-left text-[12px] font-medium text-[#344054] hover:bg-[#F8F9FB] dark:text-[#F7F8F5] dark:hover:bg-[#1B1F1B]"
                onClick={() => {
                  setMoreOpen(false);
                  onOpen(deal.id);
                }}
              >
                Open Deal
              </button>
              <button
                type="button"
                className="flex min-h-9 w-full items-center px-3 text-left text-[12px] font-medium text-[#344054] hover:bg-[#F8F9FB] dark:text-[#F7F8F5] dark:hover:bg-[#1B1F1B]"
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
                className="flex min-h-9 w-full items-center px-3 text-left text-[12px] font-medium text-[#344054] hover:bg-[#F8F9FB] dark:text-[#F7F8F5] dark:hover:bg-[#1B1F1B]"
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
          className="mt-2 space-y-1 rounded-[10px] border border-[#E4E7EC] bg-[#F8F9FB] p-2 dark:border-[#272C27] dark:bg-[#151815]"
          onClick={(e) => e.stopPropagation()}
        >
          {(DEAL_ACTIVE_STAGES as readonly DealStage[]).map((stage) => (
            <button
              key={stage}
              type="button"
              disabled={practiceMode || moving || stage === deal.stage}
              onClick={() => void moveTo(stage as DealActiveStage)}
              className="flex min-h-[40px] w-full items-center rounded-[8px] px-2 text-left text-[12px] font-medium text-[#101828] hover:bg-white disabled:opacity-40 dark:text-[#F7F8F5] dark:hover:bg-[#111411]"
            >
              {DEAL_STAGE_LABEL[stage as DealActiveStage]}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}
