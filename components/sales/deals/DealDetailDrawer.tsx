"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Check,
  ExternalLink,
  FileText,
  Phone,
  X,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import type { DealRow, LeadRow, QuotationRow } from "@/types";
import type { DealCommercialValue } from "@/lib/sales/deals/commercial-value";
import type { DealTimelineItem } from "@/lib/sales/deals/timeline";
import {
  DEAL_ACTIVE_STAGES,
  DEAL_STAGE_LABEL,
  attentionBadgeTone,
  dealAgeDays,
  formatDealStage,
  getDealAttentionState,
  getDealNextActionState,
  isDealClosedStage,
  type DealActiveStage,
} from "@/lib/sales/deals";
import { formatLeadSource } from "@/lib/sales/leads-directory/format";
import { formatQuoteStatus } from "@/lib/sales/quotes/format";
import { isWhatsAppInboundLead, whatsappInboxHref } from "@/lib/leads/whatsapp-lead-display";
import { openWhatsAppAndLog } from "@/lib/whatsapp-opener";
import { timeAgo } from "@/lib/sales-priority-lead";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useSalesMobileChrome } from "@/components/sales/navigation/SalesMobileChromeContext";
import {
  Avatar,
  Badge,
  Button,
  Skeleton,
  useSalesToast,
} from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";

type DrawerPayload = {
  deal: DealRow;
  lead: LeadRow | null;
  quotes: QuotationRow[];
  commercial: DealCommercialValue;
  nextAction: ReturnType<typeof getDealNextActionState>;
  timeline: DealTimelineItem[];
};

const actionSquare =
  "inline-flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-[10px] border border-sales-border bg-sales-surface-raised text-[10px] font-medium text-sales-text-secondary transition-colors hover:border-sales-border-strong hover:bg-sales-surface-hover";

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function money(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function DealDetailDrawer({
  dealId,
  open,
  seed,
  repName = "",
  onClose,
  onDealUpdated,
}: {
  dealId: string | null;
  open: boolean;
  /** Lightweight board row used for instant header while detail loads */
  seed?: {
    deal: DealRow;
    customerName: string | null;
    customerPhone: string | null;
    customerCompany: string | null;
    leadSource: string | null;
    leadScore: number | null;
    commercial: DealCommercialValue;
  } | null;
  repName?: string;
  onClose: () => void;
  onDealUpdated?: (deal: DealRow) => void;
}) {
  const router = useRouter();
  const { toast } = useSalesToast();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const { setHideBottomNav } = useSalesMobileChrome();
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DrawerPayload | null>(null);
  const [stageConfirm, setStageConfirm] = useState<DealActiveStage | null>(null);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    setPortalEl(document.body);
  }, []);

  useEffect(() => {
    const hide = Boolean(open && dealId && isMobile);
    setHideBottomNav(hide);
    return () => setHideBottomNav(false);
  }, [open, dealId, isMobile, setHideBottomNav]);

  useEffect(() => {
    if (!open || !isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, isMobile]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/deals/${id}`);
      if (!res.ok) throw new Error("load_failed");
      const json = (await res.json()) as DrawerPayload;
      setData(json);
      if (json.deal) onDealUpdated?.(json.deal);
    } catch {
      setError("We couldn't load this Deal.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [onDealUpdated]);

  useEffect(() => {
    if (!open || !dealId) {
      setData(null);
      setError(null);
      setStageConfirm(null);
      return;
    }
    void load(dealId);
  }, [open, dealId, load]);

  const deal = data?.deal ?? seed?.deal ?? null;
  const lead = data?.lead ?? null;
  const customerName =
    lead?.name?.trim() || seed?.customerName?.trim() || "Customer";
  const customerPhone = lead?.phone ?? seed?.customerPhone ?? null;
  const company =
    seed?.customerCompany ||
    (typeof lead?.form_data?.company === "string" ? lead.form_data.company : null) ||
    deal?.location ||
    null;
  const leadSource = lead?.source ?? seed?.leadSource ?? null;
  const commercial = data?.commercial ?? seed?.commercial ?? null;
  const nextAction = data?.nextAction ?? (deal ? getDealNextActionState(deal) : null);
  const attention = deal ? getDealAttentionState(deal) : null;
  const closed = deal ? isDealClosedStage(deal.stage) : false;
  const sourceLabel = formatLeadSource(leadSource).label;
  const quotes = data?.quotes ?? [];
  const latestQuote = quotes[0] ?? null;
  const age = deal ? dealAgeDays(deal.created_at) : 0;

  const discoveryRows = useMemo(() => {
    if (!deal) return [];
    const rows: { label: string; value: string | null; addHref?: string }[] = [
      {
        label: "Need",
        value: (lead?.customer_need || deal.service_summary || "").trim() || null,
      },
      {
        label: "Buying timeframe",
        value: deal.buying_timeframe?.trim() || lead?.timeline?.trim() || null,
      },
      {
        label: "Budget",
        value:
          money(deal.customer_budget) ||
          (deal.estimated_value_min != null && deal.estimated_value_max != null
            ? `${money(deal.estimated_value_min)}–${money(deal.estimated_value_max)}`
            : null),
      },
      {
        label: "Decision maker",
        value:
          deal.decision_maker_name?.trim() ||
          (deal.decision_maker_status === "YES" ? customerName : null),
      },
      {
        label: "Location",
        value: deal.location?.trim() || null,
      },
      {
        label: "Expected decision",
        value: deal.expected_decision_at
          ? new Date(deal.expected_decision_at).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : null,
      },
    ];
    return rows;
  }, [deal, lead, customerName]);

  async function moveStage(stage: DealActiveStage) {
    if (!deal || closed || moving || stage === deal.stage) {
      setStageConfirm(null);
      return;
    }
    setMoving(true);
    try {
      const res = await fetch(`/api/deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      const json = (await res.json().catch(() => ({}))) as { deal?: DealRow; error?: string };
      if (!res.ok || !json.deal) {
        toast({
          tone: "error",
          title: "We couldn't move this Deal. Try again.",
        });
        return;
      }
      setData((prev) => (prev ? { ...prev, deal: json.deal! } : prev));
      onDealUpdated?.(json.deal);
      setStageConfirm(null);
    } finally {
      setMoving(false);
    }
  }

  async function handleWhatsApp() {
    if (!deal) return;
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
      formData: lead?.form_data ?? {},
      tier: "neutral",
    });
  }

  if (!open || !dealId || !portalEl) return null;

  // Mobile: bottom sheet with dimmed backdrop. Desktop: fixed right sidebar (no overlay).
  const overlay = isMobile;
  const badgeTone = attentionBadgeTone(attention?.badge ?? null);
  const panelShell = cn(
    "pipeline-drawer-light pointer-events-auto relative z-10 flex min-w-0 flex-col overflow-hidden border-sales-border bg-sales-surface text-sales-text-primary shadow-sales-modal transition-transform duration-200",
    isMobile
      ? "w-full max-h-[min(96dvh,100dvh)] rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
      : "h-[100dvh] max-h-[100dvh] w-[400px] max-w-[400px] shrink-0 rounded-none border-l"
  );

  if (!deal) {
    const loadingPanel = (
      <div className={cn(panelShell, "p-4")} data-course-target="pipeline-deal-drawer">
        <div className="flex items-center justify-between">
          <Skeleton className="h-11 w-11 rounded-full" />
          <button type="button" onClick={onClose} aria-label="Close" className="p-2">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
    return createPortal(
      <div
        className={cn(
          "pointer-events-none fixed inset-0 z-[70] flex",
          isMobile ? "items-end justify-center" : "items-stretch justify-end"
        )}
      >
        {overlay ? (
          <button
            type="button"
            className="pointer-events-auto absolute inset-0 bg-black/25"
            aria-label="Close drawer"
            onClick={onClose}
          />
        ) : null}
        {loadingPanel}
      </div>,
      portalEl
    );
  }

  const panel = (
    <div
      className={panelShell}
      data-course-target="pipeline-deal-drawer"
      role="dialog"
      aria-modal={isMobile}
      aria-label="Deal details"
    >
      {/* Header */}
      <header className="shrink-0 border-b border-sales-border px-4 pb-3 pt-4 ">
        <div className="flex items-start gap-3">
          {isMobile ? (
            <button
              type="button"
              onClick={onClose}
              className="mt-1 flex h-9 w-9 items-center justify-center rounded-[8px] text-sales-text-secondary hover:bg-sales-surface-hover "
              aria-label="Back"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
          <Avatar name={customerName} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-[18px] font-semibold tracking-[-0.02em]">
                {customerName}
              </h2>
              {attention?.badge ? (
                <Badge
                  tone={
                    badgeTone === "danger"
                      ? "danger"
                      : badgeTone === "warning"
                        ? "warning"
                        : "info"
                  }
                >
                  {attention.badge}
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-[13px] text-sales-text-secondary ">
              {[deal?.name, company].filter(Boolean).join(" · ")}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-sales-text-muted">
              {company ? <span>{company}</span> : null}
              {sourceLabel ? (
                isWhatsAppInboundLead(leadSource) ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-medium text-sales-whatsapp"
                    onClick={() => void handleWhatsApp()}
                  >
                    <SiWhatsapp className="h-3 w-3" />
                    WhatsApp
                  </button>
                ) : (
                  <span>{sourceLabel}</span>
                )
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Link
              href={`/sales/deals/${dealId}`}
              className="inline-flex h-9 items-center gap-1 rounded-[8px] px-2 text-[12px] font-semibold text-sales-text-label hover:bg-sales-surface-hover  "
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View full Deal
            </Link>
            {!isMobile ? (
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-[8px] text-sales-text-secondary hover:bg-sales-surface-hover "
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {error ? (
          <div className="rounded-[12px] border border-sales-border bg-sales-surface-subtle p-4 text-center  ">
            <p className="text-[13px] font-medium">{error}</p>
            <Button
              className="mt-3"
              size="sm"
              variant="secondary"
              onClick={() => dealId && void load(dealId)}
            >
              Retry
            </Button>
          </div>
        ) : null}

        {attention?.needsAttention && attention.reason ? (
          <section className="mb-3 rounded-[12px] border border-sales-danger/25 bg-sales-danger-soft px-3 py-2.5">
            <p className="text-[12px] font-semibold text-sales-danger-fg">
              Needs attention
            </p>
            <p className="mt-0.5 text-[12px] text-sales-danger-fg/90">
              {attention.reason}
            </p>
          </section>
        ) : null}

        {/* Deal intelligence */}
        <section className="mb-3 rounded-[12px] border border-sales-border bg-sales-surface p-3.5  ">
          <h3 className="text-[13px] font-semibold text-sales-text-primary ">
            Deal intelligence
          </h3>
          {loading && !commercial ? (
            <div className="mt-3 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            <>
              {seed?.leadScore != null || lead?.score != null ? (
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-[22px] font-semibold tabular-nums">
                    {Math.round(lead?.score ?? seed?.leadScore ?? 0)}
                  </span>
                  <span className="text-[12px] text-sales-text-secondary">Lead score · acquisition context</span>
                </div>
              ) : null}
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div>
                  <p className="text-[11px] text-sales-text-muted">Est. value</p>
                  <p className="mt-0.5 text-[13px] font-semibold tabular-nums">
                    {commercial?.kind === "pending"
                      ? "Pending"
                      : commercial?.display ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-sales-text-muted">Deal age</p>
                  <p className="mt-0.5 text-[13px] font-semibold">
                    {age === 0 ? "Today" : `${age}d`}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-sales-text-muted">Last activity</p>
                  <p className="mt-0.5 text-[13px] font-semibold">
                    {deal?.last_meaningful_activity_at
                      ? timeAgo(deal.last_meaningful_activity_at)
                      : timeAgo(deal?.updated_at ?? new Date().toISOString())}
                  </p>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Discovery */}
        <section className="mb-3 rounded-[12px] border border-sales-border bg-sales-surface p-3.5  ">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[13px] font-semibold">Deal details</h3>
            <Link
              href={`/sales/deals/${dealId}`}
              className="text-[12px] font-semibold text-sales-text-label hover:underline"
            >
              Edit
            </Link>
          </div>
          <dl className="mt-3 space-y-2.5">
            {discoveryRows.map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-3">
                <dt className="text-[12px] text-sales-text-muted">{row.label}</dt>
                <dd className="max-w-[60%] text-right text-[12px] font-medium text-sales-text-primary ">
                  {row.value ? (
                    row.value
                  ) : (
                    <Link
                      href={`/sales/deals/${dealId}`}
                      className="font-semibold text-sales-text-secondary underline-offset-2 hover:underline"
                    >
                      Not added · Add
                    </Link>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Pipeline stage */}
        <section
          className="mb-3 rounded-[12px] border border-sales-border bg-sales-surface p-3.5  "
          data-course-target="pipeline-stage-progress"
        >
          <h3 className="text-[13px] font-semibold">Pipeline stage</h3>
          {!closed ? (
            <div className="mt-4 flex items-center justify-between px-1">
              {DEAL_ACTIVE_STAGES.map((stage, idx) => {
                const currentIdx = DEAL_ACTIVE_STAGES.indexOf(
                  deal.stage as DealActiveStage
                );
                const done = currentIdx > idx;
                const current = deal.stage === stage;
                return (
                  <div key={stage} className="relative flex flex-1 flex-col items-center">
                    {idx < DEAL_ACTIVE_STAGES.length - 1 ? (
                      <span
                        className={cn(
                          "absolute left-1/2 top-[11px] h-[2px] w-full",
                          done || current ? "bg-sales-brand" : "bg-sales-border"
                        )}
                        aria-hidden
                      />
                    ) : null}
                    <button
                      type="button"
                      disabled={moving}
                      onClick={() => {
                        if (stage === deal.stage) return;
                        setStageConfirm(stage);
                      }}
                      className={cn(
                        "relative z-[1] flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-colors",
                        current
                          ? "border-sales-brand bg-sales-brand text-sales-brand-text"
                          : done
                            ? "border-sales-brand bg-sales-brand text-sales-brand-text"
                            : "border-sales-border bg-sales-surface text-sales-text-muted"
                      )}
                      aria-label={`Move to ${DEAL_STAGE_LABEL[stage]}`}
                    >
                      {done ? <Check className="h-3 w-3" strokeWidth={2.5} /> : idx + 1}
                    </button>
                    <span
                      className={cn(
                        "mt-2 max-w-[4.5rem] text-center text-[10px] font-medium leading-tight",
                        current
                          ? "text-sales-text-primary "
                          : "text-sales-text-muted"
                      )}
                    >
                      {DEAL_STAGE_LABEL[stage]}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 text-[13px] font-medium">{formatDealStage(deal.stage)}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-sales-text-secondary">
            <span>
              Stage since ·{" "}
              {new Date(deal.updated_at).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
            {deal.expected_decision_at ? (
              <span>
                Expected decision ·{" "}
                {new Date(deal.expected_decision_at).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            ) : null}
          </div>
          {stageConfirm ? (
            <div className="mt-3 rounded-[10px] border border-sales-border bg-sales-surface-subtle p-3  ">
              <p className="text-[12px] font-medium">
                Move Deal to {DEAL_STAGE_LABEL[stageConfirm]}?
              </p>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  loading={moving}
                  onClick={() => void moveStage(stageConfirm)}
                >
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setStageConfirm(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        {/* Next action */}
        <section
          className="mb-3 rounded-[12px] border border-sales-border bg-sales-surface p-3.5  "
          data-course-target="pipeline-next-action"
        >
          <h3 className="text-[13px] font-semibold">Next action</h3>
          {nextAction?.hasNextAction ? (
            <>
              <p className="mt-2 text-[14px] font-semibold">
                {nextAction.label || "Follow up"}
              </p>
              <p className="mt-0.5 text-[12px] text-sales-text-secondary">
                {formatWhen(nextAction.at)}
                {nextAction.isOverdue ? " · Overdue" : ""}
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-[14px] font-semibold">No next action scheduled</p>
              <p className="mt-0.5 text-[12px] text-sales-text-secondary">
                {nextAction?.emptyMessage ||
                  "This active Deal doesn't have another action planned."}
              </p>
            </>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {(isWhatsAppInboundLead(leadSource) || customerPhone) && (
              <button type="button" className={actionSquare} onClick={() => void handleWhatsApp()}>
                <SiWhatsapp className="h-4 w-4" style={{ color: "#25D366" }} />
                WA
              </button>
            )}
            {customerPhone ? (
              <a href={`tel:${customerPhone}`} className={actionSquare}>
                <Phone className="h-4 w-4" strokeWidth={1.8} />
                Call
              </a>
            ) : null}
            <Link href={`/sales/calendar?deal=${dealId}`} className={actionSquare}>
              <Calendar className="h-4 w-4" strokeWidth={1.8} />
              {nextAction?.hasNextAction ? "Reschedule" : "Schedule"}
            </Link>
            <Link href={`/sales/deals/${dealId}`} className={actionSquare}>
              <FileText className="h-4 w-4" strokeWidth={1.8} />
              Log
            </Link>
          </div>
          {!nextAction?.hasNextAction && !closed ? (
            <Button
              className="mt-3 w-full"
              size="sm"
              onClick={() => router.push(`/sales/calendar?deal=${dealId}`)}
            >
              Schedule follow-up
            </Button>
          ) : null}
        </section>

        {/* Quotation */}
        <section className="mb-3 rounded-[12px] border border-sales-border bg-sales-surface p-3.5  ">
          <h3 className="text-[13px] font-semibold">Quotation status</h3>
          {latestQuote ? (
            <>
              <div className="mt-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-[13px] font-semibold">
                    {latestQuote.quote_number || "Quote"}
                  </p>
                  <p className="text-[12px] text-sales-text-secondary">
                    {[
                      money(latestQuote.total),
                      formatQuoteStatus(latestQuote.status),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <Badge tone="neutral" appearance="outline">
                  {formatQuoteStatus(latestQuote.status)}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  onClick={() =>
                    router.push(
                      `/sales/quotes?leadId=${deal.originating_lead_id}&dealId=${dealId}`
                    )
                  }
                >
                  Open Quote
                </Button>
                {quotes.length > 1 ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      router.push(
                        `/sales/quotes?leadId=${deal.originating_lead_id}&dealId=${dealId}`
                      )
                    }
                  >
                    View all {quotes.length} Quotes
                  </Button>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 text-[13px] text-sales-text-secondary">No Quote created yet.</p>
              <Button
                className="mt-3 w-full"
                size="sm"
                data-course-target="pipeline-create-quote"
                onClick={() =>
                  router.push(
                    `/sales/quotes?leadId=${deal.originating_lead_id}&dealId=${dealId}`
                  )
                }
              >
                Create Quote
              </Button>
            </>
          )}
        </section>

        {/* Recent activity */}
        <section className="mb-2 rounded-[12px] border border-sales-border bg-sales-surface p-3.5  ">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold">Recent activity</h3>
            <Link
              href={`/sales/deals/${dealId}`}
              className="text-[12px] font-semibold text-sales-text-label hover:underline"
            >
              View all
            </Link>
          </div>
          {loading && !data ? (
            <div className="mt-3 space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
              {(data?.timeline ?? []).slice(0, 5).map((ev) => (
                <li key={ev.id} className="flex gap-2.5">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sales-brand" />
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium">{ev.label}</p>
                    {ev.detail ? (
                      <p className="truncate text-[11px] text-sales-text-secondary">{ev.detail}</p>
                    ) : null}
                    <p className="mt-0.5 text-[11px] text-sales-text-muted">{timeAgo(ev.at)}</p>
                  </div>
                </li>
              ))}
              {(data?.timeline ?? []).length === 0 ? (
                <li className="text-[12px] text-sales-text-secondary">No activity recorded yet.</li>
              ) : null}
            </ul>
          )}
        </section>
      </div>

      {isMobile ? (
        <div className="flex shrink-0 gap-2 border-t border-sales-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] ">
          {(isWhatsAppInboundLead(leadSource) || customerPhone) && (
            <button type="button" className={cn(actionSquare, "flex-1")} onClick={() => void handleWhatsApp()}>
              <SiWhatsapp className="h-4 w-4" style={{ color: "#25D366" }} />
            </button>
          )}
          {customerPhone ? (
            <a href={`tel:${customerPhone}`} className={cn(actionSquare, "flex-1")}>
              <Phone className="h-4 w-4" />
            </a>
          ) : null}
          <Link href={`/sales/calendar?deal=${dealId}`} className={cn(actionSquare, "flex-1")}>
            <Calendar className="h-4 w-4" />
          </Link>
          <Link href={`/sales/deals/${dealId}`} className={cn(actionSquare, "flex-1")}>
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      ) : null}
    </div>
  );

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[70] flex pointer-events-none",
        isMobile ? "items-end justify-center" : "items-stretch justify-end"
      )}
    >
      {overlay ? (
        <button
          type="button"
          className="pointer-events-auto absolute inset-0 bg-black/25 backdrop-blur-[1px]"
          aria-label="Close drawer"
          onClick={onClose}
        />
      ) : null}
      {panel}
    </div>,
    portalEl
  );
}
