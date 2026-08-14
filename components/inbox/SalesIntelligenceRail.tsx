"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  Circle,
  Clock3,
  ExternalLink,
  FileText,
  Loader2,
  PanelRightClose,
  Pencil,
  UserRoundPlus,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import type { DealRow, LeadRow, QuotationLineItemRow, QuotationRow } from "@/types";
import type { DealCommercialValue } from "@/lib/sales/deals/commercial-value";
import type { DealTimelineItem } from "@/lib/sales/deals/timeline";
import {
  DEAL_ACTIVE_STAGES,
  formatDealStage,
  getDealAttentionState,
  getDealReadiness,
} from "@/lib/sales/deals";
import { extractQualificationDisplayFields } from "@/lib/inbox/qualification-display";
import {
  formatCurrencyAmount,
  formatFollowUpDate,
  formatQuoteStatus,
  getScoreTone,
  hasMeaningfulScore,
  scoreInsightLine,
} from "@/lib/inbox/format-display";
import { formatSource } from "@/lib/inbox/format-source";
import type { InboxConversation } from "@/lib/inbox/types";
import { CreateDealSheet } from "@/components/sales/deals/CreateDealSheet";
import { QuotationBuilder } from "@/components/leads/QuotationBuilder";
import { ScoreBreakdownBar } from "./ScoreBreakdownBar";
import { TransferDialog } from "./TransferDialog";
import { displayContactName, WhatsAppAvatar } from "./WhatsAppAvatar";

type QuotationWithItems = QuotationRow & { items?: QuotationLineItemRow[] };

type DealPayload = {
  deal: DealRow;
  lead: LeadRow | null;
  quotes: QuotationRow[];
  commercial: DealCommercialValue;
  nextAction: {
    hasNextAction: boolean;
    isOverdue: boolean;
    label: string | null;
    at: string | null;
    emptyMessage: string;
  };
  timeline: DealTimelineItem[];
};

type Props = {
  conversation: InboxConversation;
  clientId: string;
  userId: string;
  salespeople: { id: string; name: string }[];
  canReassign: boolean;
  canTransfer: boolean;
  canModifyDeal: boolean;
  canCreateDeal: boolean;
  canClaim: boolean;
  claiming: boolean;
  onClaim: (leadId: string) => void;
  onUpdated: () => void;
  open: boolean;
  onCollapse: () => void;
  onMobileBack?: () => void;
  mobileFullScreen?: boolean;
  mobileTopClass?: string;
  panelWidth?: number;
  panelAnimated?: boolean;
  refreshKey?: number;
};

const QUICK_FOLLOW_UPS = [
  { label: "Tomorrow", days: 1 },
  { label: "3 days", days: 3 },
  { label: "1 week", days: 7 },
] as const;

function toDateInput(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function sectionTitle(label: string, action?: React.ReactNode) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.055em] text-sales-text-muted">
        {label}
      </h3>
      {action}
    </div>
  );
}

function RailSection({
  children,
  courseTarget,
}: {
  children: React.ReactNode;
  courseTarget?: string;
}) {
  return (
    <section
      className="border-b border-sales-border px-4 py-3.5"
      data-course-target={courseTarget}
    >
      {children}
    </section>
  );
}

function formatDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function SalesIntelligenceRail({
  conversation,
  clientId,
  userId,
  salespeople,
  canReassign,
  canTransfer,
  canModifyDeal,
  canCreateDeal,
  canClaim,
  claiming,
  onClaim,
  onUpdated,
  open,
  onCollapse,
  onMobileBack,
  mobileFullScreen = false,
  mobileTopClass = "max-[1099px]:top-0",
  panelWidth,
  panelAnimated = false,
  refreshKey = 0,
}: Props) {
  const [lead, setLead] = useState<LeadRow | null>(null);
  const [dealData, setDealData] = useState<DealPayload | null>(null);
  const [briefing, setBriefing] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [customDateOpen, setCustomDateOpen] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [createDealOpen, setCreateDealOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<QuotationWithItems | null>(null);

  const dealId = dealData?.deal.id ?? conversation.activeDealId;
  const isDeal = Boolean(dealId);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    setLead(null);
    setDealData(null);

    async function load() {
      try {
        const leadRes = await fetch(`/api/leads/${conversation.id}`, {
          signal: controller.signal,
        });
        if (!leadRes.ok) throw new Error("lead_context_failed");
        const leadJson = (await leadRes.json()) as { lead?: LeadRow };
        const nextLead = leadJson.lead ?? null;
        if (cancelled) return;
        setLead(nextLead);

        const nextDealId = nextLead?.active_deal_id ?? conversation.activeDealId;
        if (nextDealId) {
          const dealRes = await fetch(`/api/deals/${nextDealId}`, { signal: controller.signal });
          if (!dealRes.ok) throw new Error("deal_context_failed");
          const payload = (await dealRes.json()) as DealPayload;
          if (!cancelled) setDealData(payload);
        }
      } catch (error) {
        if (!cancelled && (error as Error).name !== "AbortError") setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [conversation.activeDealId, conversation.id, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    setBriefing("");
    setSuggestion("");
    fetch(`/api/leads/${conversation.id}/briefing`)
      .then((response) => (response.ok ? response.json() : null))
      .then((json: { briefing?: string; suggestion?: string } | null) => {
        if (cancelled || !json) return;
        setBriefing(json.briefing ?? "");
        setSuggestion(json.suggestion ?? "");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [conversation.id, refreshKey]);

  useEffect(() => {
    setActionMessage("");
    setCustomDateOpen(false);
    setCustomDate("");
    setCreateDealOpen(false);
    setTransferOpen(false);
    setEditingQuote(null);
  }, [conversation.id]);

  useEffect(() => {
    if (!actionMessage) return;
    const timeout = window.setTimeout(() => setActionMessage(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [actionMessage]);

  async function reloadDeal(id: string) {
    const response = await fetch(`/api/deals/${id}`);
    if (!response.ok) return;
    setDealData((await response.json()) as DealPayload);
  }

  async function patchDeal(patch: Record<string, unknown>, success: string) {
    if (!dealId || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as { error?: string };
        setActionMessage(json.error ?? "Could not update Deal");
        return;
      }
      await reloadDeal(dealId);
      setActionMessage(success);
      onUpdated();
    } finally {
      setBusy(false);
    }
  }

  async function scheduleFollowUp(dateValue: string) {
    if (busy) return;
    if (isDeal && dealId) {
      const due = new Date(`${dateValue}T10:00:00`);
      await patchDeal(
        {
          next_action_at: due.toISOString(),
          next_action_label: dealData?.deal.next_action_label || "Follow up with customer",
        },
        `Next action scheduled for ${format(due, "MMM d")}`
      );
      setCustomDateOpen(false);
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/leads/${conversation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ follow_up_date: dateValue }),
      });
      if (!response.ok) {
        setActionMessage("Could not schedule follow-up");
        return;
      }
      setLead((current) => (current ? { ...current, follow_up_date: dateValue } : current));
      setActionMessage(`Follow-up scheduled for ${format(new Date(`${dateValue}T12:00:00`), "MMM d")}`);
      setCustomDateOpen(false);
      onUpdated();
    } finally {
      setBusy(false);
    }
  }

  async function openQuotation(createIfMissing: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      const listRes = await fetch(`/api/leads/${conversation.id}/quotations`);
      const listJson = (await listRes.json()) as { quotations?: QuotationWithItems[]; error?: string };
      const existing = listJson.quotations?.[0];
      if (existing) {
        const fullRes = await fetch(`/api/quotations/${existing.id}`);
        const fullJson = (await fullRes.json()) as { quotation?: QuotationWithItems };
        setEditingQuote(fullJson.quotation ?? existing);
        return;
      }
      if (!createIfMissing) {
        setActionMessage("No quotation found");
        return;
      }
      const createRes = await fetch(`/api/leads/${conversation.id}/quotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const createJson = (await createRes.json()) as { quotation?: QuotationWithItems; error?: string };
      if (createJson.quotation) setEditingQuote(createJson.quotation);
      else setActionMessage(createJson.error ?? "Could not create quotation");
    } finally {
      setBusy(false);
    }
  }

  async function handleTransfer(assigneeId: string, handoverNotes: string) {
    const response = await fetch(`/api/leads/${conversation.id}/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assigned_to_id: assigneeId,
        handover_notes: handoverNotes || null,
      }),
    });
    const json = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) throw new Error(json.error ?? "Transfer failed");
    onUpdated();
  }

  const name = displayContactName(conversation);
  const ownerName = conversation.assignee?.name ?? null;
  const ownerDisplay = !ownerName
    ? "Unassigned"
    : conversation.assignedToId === userId
      ? `You (${ownerName.split(" ")[0] || ownerName})`
      : ownerName;
  const leadSummary = briefing;
  const scoreTone = getScoreTone(conversation.scoreLabel);
  const showScore = hasMeaningfulScore(conversation.score, conversation.breakdown);
  const scoreInsight = showScore
    ? scoreInsightLine(conversation.score, conversation.breakdown)
    : null;
  const capturedFields = useMemo(
    () => extractQualificationDisplayFields(lead?.form_data ?? null),
    [lead?.form_data]
  );
  const qualificationRows = useMemo(() => {
    const rows = [
      lead?.project_type ? { label: "Project type", value: lead.project_type } : null,
      conversation.location ? { label: "Location", value: conversation.location } : null,
      lead?.budget ? { label: "Budget", value: lead.budget } : null,
      (lead?.buying_timeframe || lead?.timeline)
        ? { label: "Timeline", value: lead.buying_timeframe || lead.timeline || "" }
        : null,
      lead?.decision_maker_status
        ? { label: "Decision maker", value: lead.decision_maker_status === "YES" ? name : lead.decision_maker_status.replace(/_/g, " ") }
        : null,
      ...capturedFields,
    ];
    const seen = new Set<string>();
    return rows.filter((row): row is { label: string; value: string } => {
      if (!row?.value?.trim()) return false;
      const key = `${row.label.toLowerCase()}:${row.value.trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [capturedFields, conversation.location, lead, name]);
  const readiness = useMemo(() => (lead ? getDealReadiness({ lead }) : null), [lead]);

  const panelClass = panelWidth == null ? "w-[380px] shrink-0" : "shrink-0";
  const mobileClass = mobileFullScreen
    ? open
      ? "max-[1099px]:fixed max-[1099px]:inset-0 max-[1099px]:z-50 max-[1099px]:flex max-[1099px]:w-full"
      : "max-[1099px]:hidden"
    : open
      ? "max-[1279px]:translate-x-0"
      : "max-[1279px]:translate-x-full";

  const latestQuote = dealData?.quotes?.[0] ?? null;
  const quoteNumber = latestQuote?.quote_number ?? conversation.latestQuoteNumber;
  const quoteStatus = formatQuoteStatus(latestQuote?.status ?? conversation.latestQuoteStatus);
  const quoteTotal = formatCurrencyAmount(
    latestQuote?.total ?? conversation.latestQuoteTotal,
    latestQuote?.currency ?? conversation.dealCurrency ?? "USD"
  );
  const attention = dealData ? getDealAttentionState(dealData.deal) : null;
  const dealAge = dealData
    ? Math.max(0, differenceInCalendarDays(new Date(), new Date(dealData.deal.created_at)))
    : null;

  return (
    <aside
      id="intelPanel"
      style={panelWidth != null ? { width: panelWidth } : undefined}
      className={`salesperson-wa-context-pane flex h-full min-h-0 flex-col border-l border-sales-border bg-sales-surface ${panelClass} ${mobileClass} ${
        panelAnimated ? "inbox-panel-animated" : ""
      } max-[1279px]:fixed max-[1279px]:bottom-0 max-[1279px]:right-0 ${mobileTopClass} max-[1279px]:z-40 max-[1279px]:w-[min(390px,94vw)] max-[1279px]:shadow-[-12px_0_28px_rgba(16,24,40,0.14)] max-[1279px]:transition-transform`}
      data-course-target={isDeal ? "whatsapp-deal-intelligence" : "whatsapp-lead-intelligence"}
    >
      <header className="flex min-h-[54px] shrink-0 items-center gap-2 border-b border-sales-border px-3.5">
        {onMobileBack ? (
          <button type="button" onClick={onMobileBack} className="wa-icon-btn-muted shrink-0" aria-label="Back to conversation">
            <ArrowLeft size={19} />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-semibold tracking-[-0.015em] text-sales-text-primary">
            {isDeal ? "Deal intelligence" : "Lead intelligence"}
          </h2>
          <p className="mt-0.5 text-[10px] text-sales-text-muted">
            {isDeal ? "Commercial context and next action" : "Qualification and Deal readiness"}
          </p>
        </div>
        <button type="button" onClick={onCollapse} className="wa-icon-btn !h-8 !w-8" aria-label="Hide sales intelligence">
          <PanelRightClose size={15} />
        </button>
      </header>

      <div className="inbox-scroll min-h-0 flex-1 overflow-y-auto bg-sales-surface pb-[env(safe-area-inset-bottom)]">
        {loading ? (
          <div className="space-y-3 p-4" aria-busy aria-label="Loading sales intelligence">
            <div className="h-20 animate-pulse rounded-[10px] bg-sales-surface-hover" />
            <div className="h-32 animate-pulse rounded-[10px] bg-sales-surface-hover" />
            <div className="h-24 animate-pulse rounded-[10px] bg-sales-surface-hover" />
          </div>
        ) : loadError && !lead && !dealData ? (
          <div className="p-4">
            <div className="flex items-center gap-3">
              <WhatsAppAvatar name={name} phone={conversation.phone} size="md" />
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold text-sales-text-primary">{name}</div>
                <div className="mt-1 flex items-center gap-1.5 text-[12px] text-sales-whatsapp">
                  <SiWhatsapp size={12} /> {conversation.phone || "WhatsApp contact"}
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-[10px] border border-sales-border bg-sales-surface-subtle p-3 text-[12px] text-sales-text-secondary">
              CRM context is temporarily unavailable. Messaging remains active.
            </div>
          </div>
        ) : isDeal && dealData ? (
          <>
            <RailSection>
              <div className="flex items-start gap-3">
                <WhatsAppAvatar name={name} phone={conversation.phone} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold text-sales-text-primary">{dealData.deal.name}</div>
                  <div className="mt-0.5 truncate text-[12px] text-sales-text-secondary">{name}</div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] text-sales-text-muted">
                    <span>Owner <strong className="font-medium text-sales-text-primary">{ownerDisplay}</strong></span>
                    <span>Source <strong className="font-medium text-sales-text-primary">{formatSource(conversation.source as string)}</strong></span>
                  </div>
                </div>
                <Link href={`/sales/deals/${dealData.deal.id}`} className="wa-icon-btn !h-8 !w-8" aria-label="Open full Deal">
                  <ExternalLink size={14} />
                </Link>
              </div>
            </RailSection>

            <RailSection>
              {sectionTitle("Commercial summary")}
              <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2.5">
                <div><dt className="text-[10.5px] text-sales-text-muted">Deal value</dt><dd className="mt-0.5 text-[13px] font-semibold text-sales-text-primary">{dealData.commercial.display}</dd></div>
                <div><dt className="text-[10.5px] text-sales-text-muted">Expected decision</dt><dd className="mt-0.5 text-[12px] font-medium text-sales-text-primary">{formatDate(dealData.deal.expected_decision_at) || "Not set"}</dd></div>
                <div><dt className="text-[10.5px] text-sales-text-muted">Deal age</dt><dd className="mt-0.5 text-[12px] font-medium text-sales-text-primary">{dealAge} day{dealAge === 1 ? "" : "s"}</dd></div>
                <div><dt className="text-[10.5px] text-sales-text-muted">Latest activity</dt><dd className="mt-0.5 text-[12px] font-medium text-sales-text-primary">{formatDate(dealData.deal.last_meaningful_activity_at || dealData.deal.updated_at) || "Not recorded"}</dd></div>
              </dl>
            </RailSection>

            <RailSection>
              {sectionTitle("Deal health")}
              <div className={`mt-2.5 flex items-start gap-2 rounded-[9px] border px-3 py-2.5 ${attention?.atRisk ? "border-sales-danger/30 bg-sales-danger-soft" : attention?.needsAttention ? "border-sales-warning/30 bg-sales-warning-soft" : "border-sales-success/30 bg-sales-success-soft"}`}>
                {attention?.needsAttention ? <AlertTriangle size={15} className="mt-0.5 shrink-0" /> : <Check size={15} className="mt-0.5 shrink-0" />}
                <div><div className="text-[12px] font-semibold text-sales-text-primary">{attention?.needsAttention ? attention.badge || "Needs attention" : "On track"}</div><p className="mt-0.5 text-[11px] leading-relaxed text-sales-text-secondary">{attention?.reason || "The Deal has a clear next step and no current risk signal."}</p></div>
              </div>
            </RailSection>

            <RailSection courseTarget="whatsapp-deal-stage">
              {sectionTitle("Pipeline stage")}
              <div className="mt-3 grid grid-cols-4 gap-1">
                {DEAL_ACTIVE_STAGES.map((stage, index) => {
                  const currentIndex = DEAL_ACTIVE_STAGES.indexOf(dealData.deal.stage as (typeof DEAL_ACTIVE_STAGES)[number]);
                  const current = stage === dealData.deal.stage;
                  const complete = currentIndex >= 0 && index < currentIndex;
                  return (
                    <button key={stage} type="button" disabled={!canModifyDeal || busy || current} onClick={() => void patchDeal({ stage }, `Deal moved to ${formatDealStage(stage)}`)} className={`min-w-0 rounded-[7px] border px-1 py-2 text-[9px] font-semibold leading-tight transition-colors ${current ? "border-sales-brand-border bg-sales-brand-soft text-sales-text-primary" : complete ? "border-sales-success/30 bg-sales-success-soft text-sales-success" : "border-sales-border bg-sales-surface text-sales-text-muted"} disabled:cursor-default`}>
                      {formatDealStage(stage)}
                    </button>
                  );
                })}
              </div>
            </RailSection>

            <RailSection courseTarget="whatsapp-next-action">
              {sectionTitle("Next action")}
              {dealData.nextAction.hasNextAction ? (
                <div className="mt-2.5 flex items-start gap-2.5">
                  <Clock3 size={16} className={`mt-0.5 shrink-0 ${dealData.nextAction.isOverdue ? "text-sales-danger" : "text-sales-text-label"}`} />
                  <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-sales-text-primary">{dealData.nextAction.label || "Follow up"}</div><div className={`mt-0.5 text-[11px] ${dealData.nextAction.isOverdue ? "font-medium text-sales-danger" : "text-sales-text-secondary"}`}>{formatDateTime(dealData.nextAction.at)}</div></div>
                  {canModifyDeal ? <button type="button" disabled={busy} onClick={() => void patchDeal({ next_action_at: null, next_action_label: null }, "Next action completed")} className="text-[10.5px] font-semibold text-sales-text-label hover:underline">Complete</button> : null}
                </div>
              ) : (
                <p className="mt-2 text-[12px] text-sales-text-secondary">No next action scheduled.</p>
              )}
              {canModifyDeal ? <FollowUpControls busy={busy} currentDate={dealData.nextAction.at} customDateOpen={customDateOpen} customDate={customDate} setCustomDateOpen={setCustomDateOpen} setCustomDate={setCustomDate} onSchedule={scheduleFollowUp} /> : null}
            </RailSection>

            <RailSection courseTarget="whatsapp-quotation">
              {sectionTitle("Quotation")}
              {quoteNumber || quoteStatus ? (
                <div className="mt-2.5 flex items-center gap-3 rounded-[9px] border border-sales-border bg-sales-surface-subtle p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-sales-surface text-sales-text-label"><FileText size={16} /></div>
                  <div className="min-w-0 flex-1"><div className="truncate text-[12px] font-semibold text-sales-text-primary">{quoteNumber ? `Quote #${quoteNumber}` : "Quotation"}</div><div className="mt-0.5 text-[10.5px] text-sales-text-secondary">{[quoteStatus, quoteTotal].filter(Boolean).join(" · ")}</div></div>
                  <button type="button" disabled={busy} onClick={() => void openQuotation(false)} className="rounded-[7px] border border-sales-border bg-sales-surface px-2 py-1.5 text-[10.5px] font-semibold text-sales-text-primary">View</button>
                </div>
              ) : (
                <div className="mt-2.5 flex items-center justify-between gap-3"><p className="text-[12px] text-sales-text-secondary">No quotation created yet.</p><button type="button" disabled={busy} onClick={() => void openQuotation(true)} className="rounded-[8px] bg-sales-brand px-2.5 py-1.5 text-[11px] font-semibold text-sales-brand-text">Create quote</button></div>
              )}
            </RailSection>

            {dealData.timeline.length > 0 ? (
              <RailSection>
                {sectionTitle("Recent Deal activity")}
                <div className="mt-2.5 space-y-2.5">
                  {dealData.timeline.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex items-start gap-2.5"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sales-brand" /><div className="min-w-0 flex-1"><div className="text-[11.5px] font-medium text-sales-text-primary">{item.label}</div><div className="mt-0.5 text-[10px] text-sales-text-muted">{formatDateTime(item.at)}</div></div></div>
                  ))}
                </div>
              </RailSection>
            ) : null}

            {(canTransfer || canReassign) ? (
              <RailSection>
                {sectionTitle("Ownership & handover")}
                <button type="button" onClick={() => setTransferOpen(true)} className="mt-2.5 inline-flex items-center gap-1.5 rounded-[8px] border border-sales-border bg-sales-surface px-3 py-2 text-[11px] font-semibold text-sales-text-primary hover:bg-sales-surface-hover"><ArrowLeftRight size={14} /> Transfer with notes</button>
              </RailSection>
            ) : null}
          </>
        ) : (
          <>
            <RailSection>
              <div className="flex items-start gap-3">
                <WhatsAppAvatar name={name} phone={conversation.phone} size="md" />
                <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-semibold text-sales-text-primary">{name}</div><div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-sales-whatsapp"><SiWhatsapp size={11} /> {conversation.phone || "WhatsApp"}</div></div>
                <div className="shrink-0 text-right"><div className="text-[9px] uppercase tracking-[0.04em] text-sales-text-muted">Owner</div><div className="mt-0.5 max-w-28 truncate text-[11px] font-medium text-sales-text-primary">{ownerDisplay}</div><div className="mt-1.5 text-[9px] uppercase tracking-[0.04em] text-sales-text-muted">Source</div><div className="mt-0.5 text-[10.5px] text-sales-text-secondary">{formatSource(conversation.source as string)}</div></div>
              </div>
              {!conversation.assignedToId && canClaim ? <button type="button" disabled={claiming} onClick={() => onClaim(conversation.id)} className="mt-3 inline-flex items-center gap-1.5 rounded-[8px] bg-sales-brand px-3 py-2 text-[11px] font-semibold text-sales-brand-text"><UserRoundPlus size={14} />{claiming ? "Claiming…" : "Claim lead"}</button> : null}
            </RailSection>

            <RailSection>
              {sectionTitle("Lead score")}
              {showScore ? (
                <><div className="mt-3 flex items-start gap-4"><div className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(${scoreTone.bar} ${conversation.score * 3.6}deg, var(--sales-border) 0deg)` }}><div className="flex h-[58px] w-[58px] flex-col items-center justify-center rounded-full bg-sales-surface"><span className="text-[22px] font-semibold tabular-nums text-sales-text-primary">{conversation.score}</span><span className="text-[9.5px] font-semibold" style={{ color: scoreTone.text }}>{conversation.scoreLabel}</span></div></div><div className="min-w-0 flex-1 space-y-2"><ScoreBreakdownBar label="Urgency" value={conversation.breakdown.urgency} max={25} light barColor={scoreTone.bar} /><ScoreBreakdownBar label="Budget" value={conversation.breakdown.budget} max={25} light barColor={scoreTone.bar} /><ScoreBreakdownBar label="Location" value={conversation.breakdown.location} max={15} light barColor={scoreTone.bar} /><ScoreBreakdownBar label="Product interest" value={conversation.breakdown.productInterest} max={20} light barColor={scoreTone.bar} /><ScoreBreakdownBar label="Engagement" value={conversation.breakdown.engagement} max={15} light barColor={scoreTone.bar} /></div></div>{scoreInsight ? <p className="mt-2.5 text-[11px] text-sales-text-secondary">{scoreInsight}</p> : null}</>
              ) : <p className="mt-2 text-[12px] text-sales-text-secondary">Not enough qualification data yet.</p>}
            </RailSection>

            {leadSummary ? <RailSection>{sectionTitle("AI briefing", <span className="rounded-[5px] bg-sales-info-soft px-1.5 py-0.5 text-[9px] font-semibold text-sales-info">Beta</span>)}<p className="mt-2 text-[12px] leading-relaxed text-sales-text-secondary">{leadSummary}</p>{suggestion ? <p className="mt-1.5 text-[11px] text-sales-text-muted"><strong className="font-medium text-sales-text-primary">Recommended: </strong>{suggestion}</p> : null}</RailSection> : null}

            {(qualificationRows.length > 0 || conversation.tags.length > 0) ? <RailSection>{sectionTitle("Qualification details", <Link href={`/sales/leads?lead=${conversation.id}`} className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-sales-text-label"><Pencil size={11} /> Edit</Link>)}<dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2.5">{qualificationRows.slice(0, 8).map((row) => <div key={`${row.label}-${row.value}`} className="min-w-0"><dt className="text-[10px] text-sales-text-muted">{row.label}</dt><dd className="mt-0.5 truncate text-[11.5px] font-medium text-sales-text-primary">{row.value}</dd></div>)}</dl>{conversation.tags.length > 0 ? <div className="mt-2.5 flex flex-wrap gap-1">{conversation.tags.map((tag) => <span key={tag} className="rounded-[5px] bg-sales-info-soft px-1.5 py-1 text-[9.5px] font-medium text-sales-info">{tag.replace(/_/g, " ")}</span>)}</div> : null}</RailSection> : null}

            {readiness ? <RailSection courseTarget="whatsapp-deal-readiness">{sectionTitle("Deal readiness")}<p className="mt-1 text-[11px] text-sales-text-secondary">{readiness.requiredDone} of {readiness.requiredTotal} required details ready · {readiness.statusLabel}</p><ul className="mt-2.5 space-y-1.5">{readiness.items.map((item) => <li key={item.id} className="flex items-start gap-2 text-[11px]">{item.done ? <Check size={13} className="mt-0.5 shrink-0 text-sales-success" /> : <Circle size={13} className="mt-0.5 shrink-0 text-sales-text-muted" />}<span className={item.done ? "text-sales-text-primary" : "text-sales-text-secondary"}>{item.label}{!item.required ? <span className="text-sales-text-muted"> (optional)</span> : null}</span></li>)}</ul>{canCreateDeal && lead ? <button type="button" onClick={() => setCreateDealOpen(true)} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-[8px] bg-sales-brand px-3 py-2.5 text-[12px] font-semibold text-sales-brand-text" data-course-target="whatsapp-create-deal"><BriefcaseBusiness size={15} /> Create Deal</button> : null}</RailSection> : null}

            <RailSection courseTarget="whatsapp-next-action">{sectionTitle("Next follow-up")}{lead?.follow_up_date || conversation.followUpDate ? <p className="mt-2 text-[12px] text-sales-text-secondary">Scheduled for <strong className="font-semibold text-sales-text-primary">{formatFollowUpDate(lead?.follow_up_date || conversation.followUpDate)}</strong></p> : <p className="mt-2 text-[12px] text-sales-text-secondary">No follow-up scheduled.</p>}<FollowUpControls busy={busy} currentDate={lead?.follow_up_date || conversation.followUpDate} customDateOpen={customDateOpen} customDate={customDate} setCustomDateOpen={setCustomDateOpen} setCustomDate={setCustomDate} onSchedule={scheduleFollowUp} /></RailSection>

            {(canTransfer || canReassign) ? <RailSection>{sectionTitle("Ownership & handover")}<button type="button" onClick={() => setTransferOpen(true)} className="mt-2.5 inline-flex items-center gap-1.5 rounded-[8px] border border-sales-border bg-sales-surface px-3 py-2 text-[11px] font-semibold text-sales-text-primary"><ArrowLeftRight size={14} /> Transfer with notes</button></RailSection> : null}
          </>
        )}
        {actionMessage ? <div role="status" className="px-4 py-3 text-[11px] font-semibold text-sales-text-label">{actionMessage}</div> : null}
      </div>

      {lead ? <CreateDealSheet lead={lead} open={createDealOpen} onClose={() => setCreateDealOpen(false)} onCreated={(deal) => { setCreateDealOpen(false); onUpdated(); void reloadDeal(deal.id); }} currency={conversation.dealCurrency ?? "USD"} /> : null}
      <TransferDialog open={transferOpen} salespeople={salespeople} currentAssigneeId={conversation.assignedToId} onClose={() => setTransferOpen(false)} onTransfer={handleTransfer} whatsappMode />
      {editingQuote ? <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center"><div className="max-h-[96dvh] w-full max-w-4xl overflow-y-auto rounded-t-2xl border border-sales-border bg-sales-surface p-5 sm:rounded-xl"><QuotationBuilder quotation={editingQuote} clientId={clientId} leadPhone={conversation.phone} whatsappApiSend={conversation.source === "WHATSAPP_INBOUND"} onSaved={(quote) => setEditingQuote(quote)} onSent={() => { setEditingQuote(null); onUpdated(); if (dealId) void reloadDeal(dealId); }} onClose={() => setEditingQuote(null)} /></div></div> : null}
    </aside>
  );
}

function FollowUpControls({
  busy,
  currentDate,
  customDateOpen,
  customDate,
  setCustomDateOpen,
  setCustomDate,
  onSchedule,
}: {
  busy: boolean;
  currentDate: string | null | undefined;
  customDateOpen: boolean;
  customDate: string;
  setCustomDateOpen: (value: boolean) => void;
  setCustomDate: (value: string) => void;
  onSchedule: (value: string) => void;
}) {
  return (
    <>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {QUICK_FOLLOW_UPS.map((option) => {
          const date = addDays(new Date(), option.days);
          const value = toDateInput(date);
          const selected = currentDate?.startsWith(value) === true;
          return <button key={option.label} type="button" disabled={busy} onClick={() => void onSchedule(value)} className={`rounded-[8px] border px-1.5 py-2 text-left ${selected ? "border-sales-brand-border bg-sales-brand-soft" : "border-sales-border bg-sales-surface"}`}><span className="block truncate text-[9.5px] font-semibold text-sales-text-primary">{option.label}</span><span className="mt-0.5 block text-[9px] text-sales-text-muted">{format(date, "MMM d")}</span></button>;
        })}
        <button type="button" onClick={() => { setCustomDateOpen(!customDateOpen); if (!customDate) setCustomDate(toDateInput(addDays(new Date(), 1))); }} className={`rounded-[8px] border px-1.5 py-2 text-left ${customDateOpen ? "border-sales-brand-border bg-sales-brand-soft" : "border-sales-border bg-sales-surface"}`}><span className="flex items-center gap-1 text-[9.5px] font-semibold text-sales-text-primary"><CalendarDays size={10} /> Custom</span><span className="mt-0.5 block text-[9px] text-sales-text-muted">Pick date</span></button>
      </div>
      {customDateOpen ? <div className="mt-2 flex gap-2"><input type="date" value={customDate} min={toDateInput(new Date())} onChange={(event) => setCustomDate(event.target.value)} className="min-w-0 flex-1 rounded-[8px] border border-sales-border bg-sales-surface px-2 py-2 text-[11px] text-sales-text-primary" /><button type="button" disabled={!customDate || busy} onClick={() => void onSchedule(customDate)} className="rounded-[8px] bg-sales-brand px-3 py-2 text-[11px] font-semibold text-sales-brand-text">{busy ? <Loader2 size={13} className="animate-spin" /> : "Save"}</button></div> : null}
    </>
  );
}
