"use client";

import { useEffect, useState } from "react";
import { addDays, format } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  ArrowLeftRight,
  CalendarDays,
  Check,
  Clock,
  Ellipsis,
  FileText,
  Loader2,
  MessageSquare,
  MoreVertical,
  Pencil,
  Sparkles,
  UserRoundPlus,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { formatSource } from "@/lib/inbox/format-source";
import { scoreLabel } from "@/lib/inbox/scoring";
import {
  formatCurrencyAmount,
  formatFollowUpDate,
  formatQuoteStatus,
  followUpContextLine,
  getSalesSignal,
  getScoreTone,
  hasMeaningfulScore,
  scoreInsightLine,
} from "@/lib/inbox/format-display";
import { extractQualificationDisplayFields } from "@/lib/inbox/qualification-display";
import { MANUAL_LEAD_STAGES } from "@/lib/customer-hub/manual-lead-stages";
import type { InboxConversation } from "@/lib/inbox/types";
import { QuotationBuilder } from "@/components/leads/QuotationBuilder";
import type { LeadStatus, QuotationLineItemRow, QuotationRow } from "@/types";
import { ScoreBreakdownBar } from "./ScoreBreakdownBar";
import { displayContactName, WhatsAppAvatar } from "./WhatsAppAvatar";

type QuotationWithItems = QuotationRow & { items?: QuotationLineItemRow[] };

type Props = {
  conversation: InboxConversation | null;
  clientId: string;
  userId: string;
  role: "SALESPERSON" | "CLIENT_MANAGER" | "SUPER_ADMIN";
  canReassign: boolean;
  salespeople: { id: string; name: string }[];
  onReassigned: () => void;
  onUpdated?: () => void;
  open: boolean;
  whatsappMode?: boolean;
  mobileTopClass?: string;
  mobileFullScreen?: boolean;
  onMobileBack?: () => void;
  panelWidth?: number;
  panelAnimated?: boolean;
  canClaim?: boolean;
  onClaim?: (leadId: string) => void;
  claiming?: boolean;
};

const FOLLOW_UP_QUICK_OPTIONS = [
  { label: "Tomorrow", days: 1 },
  { label: "3 days", days: 3 },
  { label: "1 week", days: 7 },
] as const;

const PIPELINE_STAGES = MANUAL_LEAD_STAGES.filter((s) =>
  ["NEW", "CONTACTED", "NEGOTIATING", "PROPOSAL_SENT"].includes(s.value)
);

function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function sectionLabel(children: string) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
      {children}
    </div>
  );
}

export function LeadIntelligencePanel({
  conversation,
  clientId,
  userId,
  role,
  canReassign,
  salespeople,
  onReassigned,
  onUpdated,
  open,
  whatsappMode = false,
  mobileTopClass = "max-[1099px]:top-16",
  mobileFullScreen = false,
  onMobileBack,
  panelWidth,
  panelAnimated = false,
  canClaim = false,
  onClaim,
  claiming = false,
}: Props) {
  const [briefing, setBriefing] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [capturedFields, setCapturedFields] = useState<{ label: string; value: string }[]>([]);
  const [leadBudget, setLeadBudget] = useState<string | null>(null);
  const [leadTimeline, setLeadTimeline] = useState<string | null>(null);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [handoverNotes, setHandoverNotes] = useState("");
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [customFollowUp, setCustomFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [schedulingFollowUp, setSchedulingFollowUp] = useState(false);
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [editingQuote, setEditingQuote] = useState<QuotationWithItems | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [updatingStage, setUpdatingStage] = useState<LeadStatus | null>(null);

  useEffect(() => {
    if (!conversation?.id) return;
    let cancelled = false;
    setBriefing("");
    setSuggestion("");
    fetch(`/api/leads/${conversation.id}/briefing`)
      .then((r) => r.json())
      .then((d: { briefing?: string; suggestion?: string }) => {
        if (cancelled) return;
        if (d.briefing) setBriefing(d.briefing);
        if (d.suggestion) setSuggestion(d.suggestion);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [conversation?.id]);

  useEffect(() => {
    if (!conversation?.id) {
      setCapturedFields([]);
      setLeadBudget(null);
      setLeadTimeline(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/leads/${conversation.id}`)
      .then((r) => r.json())
      .then((d: { lead?: { form_data?: Record<string, unknown>; budget?: string | null; timeline?: string | null } }) => {
        if (cancelled || !d.lead) return;
        const formData = d.lead.form_data ?? null;
        setCapturedFields(extractQualificationDisplayFields(formData));
        setLeadBudget(typeof d.lead.budget === "string" && d.lead.budget.trim() ? d.lead.budget.trim() : null);
        setLeadTimeline(typeof d.lead.timeline === "string" && d.lead.timeline.trim() ? d.lead.timeline.trim() : null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [conversation?.id, conversation?.lastMessageAt]);

  useEffect(() => {
    setCustomFollowUp(false);
    setFollowUpDate("");
    setActionMessage("");
    setEditingQuote(null);
    setUpdatingStage(null);
    setHandoverNotes("");
    setHandoverOpen(false);
    setReassignOpen(false);
  }, [conversation?.id]);

  useEffect(() => {
    if (!actionMessage) return;
    const t = window.setTimeout(() => setActionMessage(""), 3000);
    return () => window.clearTimeout(t);
  }, [actionMessage]);

  async function handleOpenQuotation(createIfMissing = false) {
    if (!conversation || creatingQuote) return;
    setCreatingQuote(true);
    try {
      const listRes = await fetch(`/api/leads/${conversation.id}/quotations`);
      const listJson = (await listRes.json()) as { quotations?: QuotationWithItems[] };
      const existing = listJson.quotations?.[0];
      if (existing?.id) {
        const fullRes = await fetch(`/api/quotations/${existing.id}`);
        const fullJson = (await fullRes.json()) as { quotation?: QuotationWithItems; error?: string };
        if (fullJson.quotation) {
          setEditingQuote(fullJson.quotation);
          return;
        }
        setEditingQuote(existing);
        return;
      }
      if (!createIfMissing) {
        setActionMessage("No quotation found");
        return;
      }
      const res = await fetch(`/api/leads/${conversation.id}/quotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as { quotation?: QuotationWithItems; error?: string };
      if (json.quotation) {
        setEditingQuote(json.quotation);
      } else {
        setActionMessage(json.error ?? "Could not create quotation");
      }
    } finally {
      setCreatingQuote(false);
    }
  }

  async function handleCreateQuotation() {
    await handleOpenQuotation(true);
  }

  async function handleScheduleFollowUp(dateValue: string) {
    if (!conversation || schedulingFollowUp) return;
    setSchedulingFollowUp(true);
    try {
      const res = await fetch(`/api/leads/${conversation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ follow_up_date: dateValue }),
      });
      if (res.ok) {
        setCustomFollowUp(false);
        setFollowUpDate("");
        setActionMessage(`Follow-up scheduled for ${format(new Date(dateValue + "T12:00:00"), "MMM d, yyyy")}`);
        onUpdated?.();
      } else {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setActionMessage(json.error ?? "Could not schedule follow-up");
      }
    } finally {
      setSchedulingFollowUp(false);
    }
  }

  async function handleStageChange(status: LeadStatus) {
    if (!conversation || updatingStage) return;
    if (status === conversation.status) return;
    setUpdatingStage(status);
    try {
      const res = await fetch(`/api/leads/${conversation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        const label = MANUAL_LEAD_STAGES.find((s) => s.value === status)?.label ?? status;
        setActionMessage(`Lead stage updated to ${label}`);
        onUpdated?.();
      } else {
        setActionMessage(json.error ?? "Could not update lead stage");
      }
    } finally {
      setUpdatingStage(null);
    }
  }

  async function handleReassign(assigneeId: string | null) {
    if (!conversation) return;
    setReassigning(true);
    try {
      const res = await fetch("/api/leads/bulk/reassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadIds: [conversation.id],
          assigned_to_id: assigneeId,
          handover_notes: handoverNotes.trim() || null,
        }),
      });
      if (res.ok) {
        setReassignOpen(false);
        setHandoverOpen(false);
        setHandoverNotes("");
        onReassigned();
      }
    } finally {
      setReassigning(false);
    }
  }

  const panelWidthClass = panelWidth != null ? "shrink-0" : "w-[380px] shrink-0";

  const panelShell = whatsappMode
    ? `flex h-full min-h-0 ${panelWidthClass} flex-col bg-white wa-panel ${
        mobileFullScreen
          ? ""
          : `max-[1099px]:fixed max-[1099px]:bottom-0 max-[1099px]:right-0 ${mobileTopClass} max-[1099px]:z-40 max-[1099px]:w-[min(380px,92vw)] max-[1099px]:shadow-[-4px_0_24px_rgba(0,0,0,0.08)] max-[1099px]:transition-transform max-[1099px]:duration-200`
      }`
    : `flex h-full min-h-0 ${panelWidthClass} flex-col border-l border-[var(--border)] bg-[var(--bg-tertiary)] max-[1099px]:fixed max-[1099px]:bottom-0 max-[1099px]:right-0 ${mobileTopClass} max-[1099px]:z-40 max-[1099px]:w-[340px] max-[1099px]:shadow-[-12px_0_30px_rgba(0,0,0,0.6)] max-[1099px]:transition-transform max-[1099px]:duration-200`;

  const mobilePanelClass = mobileFullScreen
    ? open
      ? "max-[1099px]:fixed max-[1099px]:inset-0 max-[1099px]:z-50 max-[1099px]:flex max-[1099px]:w-full max-[1099px]:translate-x-0 max-[1099px]:shadow-none"
      : "max-[1099px]:hidden"
    : open
      ? "max-[1099px]:translate-x-0"
      : "max-[1099px]:translate-x-full";

  const panelStyle = panelWidth != null ? { width: panelWidth } : undefined;
  const panelAnimatedClass = panelAnimated ? "inbox-panel-animated" : "";

  const intelHeader = (
    <div className="shrink-0 border-b border-[#E4E7EC] bg-white px-4 py-3 max-[1099px]:pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="flex items-center gap-2">
        {onMobileBack ? (
          <button
            type="button"
            onClick={onMobileBack}
            aria-label="Back to conversation"
            className="wa-icon-btn-muted shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold tracking-tight text-[#101828]">Lead intelligence</div>
        </div>
        <button type="button" className="wa-icon-btn !h-8 !w-8" aria-label="Lead intelligence options">
          <MoreVertical size={16} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );

  if (!conversation) {
    return (
      <div
        id="intelPanel"
        style={panelStyle}
        className={`${panelShell} ${mobilePanelClass} ${panelAnimatedClass}`}
      >
        {whatsappMode ? intelHeader : null}
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-[#98A2B3]">
          Select a conversation
        </div>
      </div>
    );
  }

  const name = displayContactName(conversation);
  const label = scoreLabel(conversation.score);
  const showScore = hasMeaningfulScore(conversation.score, conversation.breakdown);
  const summary = conversation.leadSummary || briefing;
  const ownerName = conversation.assignee?.name ?? null;
  const isOwnerYou = conversation.assignedToId === userId;
  const ownerDisplay = !ownerName ? "Unassigned" : isOwnerYou ? `You (${ownerName.split(" ")[0] ?? ownerName})` : ownerName;
  const canChangeStage =
    role !== "CLIENT_MANAGER" &&
    (role === "SUPER_ADMIN" || conversation.assignedToId === userId);
  const quoteStatus = formatQuoteStatus(conversation.latestQuoteStatus);
  const quoteTotal = formatCurrencyAmount(
    conversation.latestQuoteTotal,
    conversation.dealCurrency ?? "USD"
  );
  const hasQuote = Boolean(conversation.latestQuoteNumber || conversation.latestQuoteStatus);

  const qualRows: { label: string; value: string }[] = [
    conversation.projectType && !/^other\b/i.test(conversation.projectType.trim())
      ? { label: "Project type", value: conversation.projectType }
      : null,
    conversation.location ? { label: "Location", value: conversation.location } : null,
    leadBudget ? { label: "Budget", value: leadBudget } : null,
    leadTimeline ? { label: "Timeline", value: leadTimeline } : null,
    conversation.company && !/^other\b/i.test(conversation.company.trim())
      ? { label: "Company", value: conversation.company }
      : null,
    name ? { label: "Decision maker", value: name } : null,
    ...capturedFields.filter((f) => f.value && !/^other\b/i.test(f.value.trim())),
  ].filter((r): r is { label: string; value: string } => Boolean(r));

  const followUpLabel = formatFollowUpDate(conversation.followUpDate);
  const followUpContext = followUpContextLine(conversation.followUpDate);
  const salesSignal = getSalesSignal(conversation, { currentUserId: userId });
  const scoreTone = getScoreTone(label);
  const insight = showScore ? scoreInsightLine(conversation.score, conversation.breakdown) : null;
  const qualUseGrid = qualRows.length >= 2;

  return (
    <div
      id="intelPanel"
      style={panelStyle}
      className={`${panelShell} ${mobilePanelClass} ${panelAnimatedClass}`}
    >
      {intelHeader}
      <div className="inbox-scroll min-h-0 flex-1 overflow-y-auto bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="flex flex-col">
          {/* Contact / ownership */}
          <section className="border-b border-[#F2F4F7] px-4 py-4">
            <div className="flex items-start gap-3">
              <WhatsAppAvatar name={name} phone={conversation.phone} size="md" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold text-[#101828]">{name}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[#667085]">
                  <SiWhatsapp size={12} className="text-[#25D366]" aria-hidden />
                  WhatsApp
                </div>
                {conversation.phone ? (
                  <div className="mt-0.5 truncate text-[12px] tabular-nums text-[#98A2B3]">
                    {conversation.phone}
                  </div>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[10px] font-medium uppercase tracking-[0.04em] text-[#98A2B3]">Owner</div>
                <div className="mt-0.5 text-[12px] font-medium text-[#101828]">{ownerDisplay}</div>
                <div className="mt-2 text-[10px] font-medium uppercase tracking-[0.04em] text-[#98A2B3]">Source</div>
                <div className="mt-0.5 text-[12px] text-[#667085]">
                  {formatSource(conversation.source as string)}
                </div>
              </div>
            </div>
            {!conversation.assignedToId && canClaim && onClaim ? (
              <button
                type="button"
                disabled={claiming}
                onClick={() => onClaim(conversation.id)}
                className="mt-3 wa-btn-primary"
              >
                <UserRoundPlus size={15} strokeWidth={1.8} />
                {claiming ? "Claiming…" : "Claim lead"}
              </button>
            ) : null}
          </section>

          {/* Lead score */}
          <section className="border-b border-[#F2F4F7] px-4 py-3.5">
            {sectionLabel("Lead score")}
            {showScore ? (
              <>
                <div className="mt-3 flex items-start gap-4">
                  <div className="relative flex h-[68px] w-[68px] shrink-0 items-center justify-center">
                    <svg className="absolute inset-0" viewBox="0 0 72 72" aria-hidden>
                      <circle cx="36" cy="36" r="30" fill="none" stroke="#F2F4F7" strokeWidth="5" />
                      <circle
                        cx="36"
                        cy="36"
                        r="30"
                        fill="none"
                        stroke={scoreTone.bar}
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeDasharray={`${(Math.min(100, conversation.score) / 100) * 188.4} 188.4`}
                        transform="rotate(-90 36 36)"
                      />
                    </svg>
                    <div className="text-center">
                      <div className="text-[20px] font-semibold tabular-nums leading-none text-[#101828]">
                        {conversation.score}
                      </div>
                      <div className="mt-0.5 text-[11px] font-semibold" style={{ color: scoreTone.text }}>
                        {label}
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="text-[12px] font-medium text-[#344054]">Score breakdown</div>
                    <ScoreBreakdownBar label="Urgency" value={conversation.breakdown.urgency} max={25} light barColor={scoreTone.bar} />
                    <ScoreBreakdownBar label="Budget" value={conversation.breakdown.budget} max={25} light barColor={scoreTone.bar} />
                    <ScoreBreakdownBar label="Location" value={conversation.breakdown.location} max={15} light barColor={scoreTone.bar} />
                    <ScoreBreakdownBar
                      label="Product interest"
                      value={conversation.breakdown.productInterest}
                      max={20}
                      light
                      barColor={scoreTone.bar}
                    />
                    <ScoreBreakdownBar
                      label="Engagement"
                      value={conversation.breakdown.engagement}
                      max={15}
                      light
                      barColor={scoreTone.bar}
                    />
                  </div>
                </div>
                {insight ? (
                  <p className="mt-2.5 text-[12px] text-[#667085]">{insight}</p>
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-[13px] text-[#667085]">Not enough data yet</p>
            )}
          </section>

          {/* Sales signal */}
          {salesSignal ? (
            <section className="border-b border-[#F2F4F7] px-4 py-3.5">
              {sectionLabel("Sales signal")}
              <div
                className={`mt-2 flex items-start gap-2.5 rounded-[10px] border px-3 py-2.5 ${
                  salesSignal.tone === "danger"
                    ? "border-[#FECACA] bg-[#FEF2F2]"
                    : salesSignal.tone === "warning"
                      ? "border-[#FED7AA] bg-[#FFFAEB]"
                      : salesSignal.tone === "success"
                        ? "border-[#D1FADF] bg-[#ECFDF3]"
                        : "border-[#E4E7EC] bg-[#F9FAFB]"
                }`}
              >
                {salesSignal.action === "reply" || salesSignal.id === "needs_reply" ? (
                  <MessageSquare size={16} className="mt-0.5 shrink-0 text-[#B54708]" aria-hidden />
                ) : salesSignal.action === "claim" ? (
                  <UserRoundPlus size={16} className="mt-0.5 shrink-0 text-[#175CD3]" aria-hidden />
                ) : salesSignal.action === "follow_up" ? (
                  <Clock size={16} className="mt-0.5 shrink-0 text-[#B54708]" aria-hidden />
                ) : (
                  <AlertCircle size={16} className="mt-0.5 shrink-0 text-[#667085]" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-[#101828]">{salesSignal.title}</div>
                  <div className="mt-0.5 text-[12px] text-[#667085]">{salesSignal.detail}</div>
                  {salesSignal.action === "claim" && canClaim && onClaim ? (
                    <button
                      type="button"
                      disabled={claiming}
                      onClick={() => onClaim(conversation.id)}
                      className="mt-2 rounded-[8px] bg-[#D4FF4F] px-2.5 py-1.5 text-[12px] font-semibold text-[#101828] disabled:opacity-50"
                    >
                      {claiming ? "Claiming…" : "Claim lead"}
                    </button>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          {/* AI briefing */}
          {summary ? (
            <section className="border-b border-[#F2F4F7] px-4 py-3.5">
              <div className="flex items-center gap-2">
                {sectionLabel("AI briefing")}
                <span className="rounded-md bg-[#F2F4F7] px-1.5 py-0.5 text-[10px] font-semibold text-[#667085]">
                  Beta
                </span>
              </div>
              <div className="mt-2 rounded-[10px] border border-[#E4E7EC] bg-[#F9FAFB] px-3 py-3">
                <p className="text-[13px] leading-relaxed text-[#344054]">{summary}</p>
                {suggestion ? (
                  <p className="mt-2 text-[12px] text-[#667085]">
                    <span className="font-medium text-[#101828]">Recommended: </span>
                    {suggestion}
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          {/* Qualification */}
          {(qualRows.length > 0 || conversation.tags.length > 0) ? (
            <section className="border-b border-[#F2F4F7] px-4 py-3.5">
              <div className="flex items-center justify-between gap-2">
                {sectionLabel("Qualification details")}
              </div>
              {qualRows.length > 0 ? (
                <dl
                  className={`mt-2.5 gap-x-4 gap-y-2 ${
                    qualUseGrid ? "grid grid-cols-1 sm:grid-cols-2" : "flex flex-col"
                  }`}
                >
                  {qualRows.map((row) => (
                    <div key={`${row.label}-${row.value}`} className="min-w-0">
                      <dt className="text-[11px] text-[#98A2B3]">{row.label}</dt>
                      <dd className="mt-0.5 truncate text-[13px] font-medium text-[#101828]">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {conversation.tags.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {conversation.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-md bg-[#F2F4F7] px-2 py-1 text-[11px] font-medium text-[#667085]"
                    >
                      {t.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {/* Pipeline stage */}
          <section className="border-b border-[#F2F4F7] px-4 py-4">
            {sectionLabel("Pipeline stage")}
            <div className="mt-3 flex flex-wrap gap-1">
              {PIPELINE_STAGES.map((stage) => {
                const isCurrent = conversation.status === stage.value;
                const busy = updatingStage === stage.value;
                return (
                  <button
                    key={stage.value}
                    type="button"
                    disabled={!canChangeStage || isCurrent || updatingStage !== null}
                    onClick={() => void handleStageChange(stage.value)}
                    title={stage.hint}
                    className={`rounded-[8px] border px-2.5 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-60 ${
                      isCurrent
                        ? "border-[rgba(150,190,40,0.55)] bg-[#F4FCE8] text-[#101828]"
                        : "border-[#E4E7EC] bg-white text-[#667085] hover:bg-[#F9FAFB]"
                    }`}
                  >
                    {busy ? "Saving…" : stage.label}
                  </button>
                );
              })}
            </div>
            {!canChangeStage ? (
              <p className="mt-2 text-[11px] text-[#98A2B3]">
                {role === "CLIENT_MANAGER"
                  ? "Managers can view stage but cannot change it here."
                  : !conversation.assignedToId
                    ? "Claim this lead to update its stage."
                    : "Only the assigned salesperson can update stage."}
              </p>
            ) : null}
          </section>

          {/* Next follow-up */}
          <section className="border-b border-[#F2F4F7] px-4 py-3.5">
            {sectionLabel("Next follow-up")}
            {followUpLabel ? (
              <p className="mt-2 text-[13px] text-[#344054]">
                Scheduled for <span className="font-semibold text-[#101828]">{followUpLabel}</span>
              </p>
            ) : null}
            {followUpContext ? (
              <p
                className={`mt-1 text-[12px] font-medium ${
                  followUpContext.includes("overdue")
                    ? "text-[#DC2626]"
                    : followUpContext === "Due today"
                      ? "text-[#B54708]"
                      : "text-[#667085]"
                }`}
              >
                {followUpContext}
              </p>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FOLLOW_UP_QUICK_OPTIONS.map((opt) => {
                const date = addDays(new Date(), opt.days);
                const value = toDateInputValue(date);
                const selected = conversation.followUpDate === value;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    disabled={schedulingFollowUp}
                    onClick={() => void handleScheduleFollowUp(value)}
                    className={`rounded-[10px] border px-2.5 py-2.5 text-left transition-colors disabled:opacity-50 ${
                      selected
                        ? "border-[#16A34A] bg-[#ECFDF3]"
                        : "border-[#E4E7EC] bg-white hover:bg-[#F9FAFB]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-semibold text-[#101828]">{opt.label}</span>
                      {selected ? <Check size={12} className="text-[#16A34A]" aria-hidden /> : null}
                    </div>
                    <div className="mt-1 text-[11px] tabular-nums text-[#667085]">
                      {format(date, "MMM d")}
                    </div>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setCustomFollowUp((v) => !v);
                  if (!followUpDate) setFollowUpDate(toDateInputValue(addDays(new Date(), 1)));
                }}
                className={`rounded-[10px] border px-2.5 py-2.5 text-left transition-colors ${
                  customFollowUp
                    ? "border-[rgba(150,190,40,0.55)] bg-[#F4FCE8]"
                    : "border-[#E4E7EC] bg-white hover:bg-[#F9FAFB]"
                }`}
              >
                <div className="flex items-center gap-1 text-[11px] font-semibold text-[#101828]">
                  <CalendarDays size={12} strokeWidth={1.8} aria-hidden />
                  Custom
                </div>
                <div className="mt-1 text-[11px] text-[#667085]">Pick date</div>
              </button>
            </div>
            {customFollowUp ? (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="date"
                  value={followUpDate}
                  min={toDateInputValue(new Date())}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="flex-1 rounded-[8px] border border-[#E4E7EC] bg-white px-2 py-2 text-[13px] text-[#101828]"
                />
                <button
                  type="button"
                  disabled={!followUpDate || schedulingFollowUp}
                  onClick={() => void handleScheduleFollowUp(followUpDate)}
                  className="rounded-[8px] bg-[#D4FF4F] px-3 py-2 text-[12px] font-semibold text-[#101828] disabled:opacity-50"
                >
                  {schedulingFollowUp ? "Saving…" : "Save"}
                </button>
              </div>
            ) : null}
          </section>

          {/* Quotation */}
          <section className="border-b border-[#F2F4F7] px-4 py-4">
            {sectionLabel("Quotation")}
            {hasQuote ? (
              <div className="mt-3 rounded-[10px] border border-[#E4E7EC] bg-[#F9FAFB] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[13px] font-semibold text-[#101828]">
                      {conversation.latestQuoteNumber
                        ? `Quote #${conversation.latestQuoteNumber}`
                        : "Quotation"}
                    </div>
                    {quoteStatus ? (
                      <span className="mt-1 inline-flex rounded-md bg-[#ECFDF3] px-1.5 py-0.5 text-[10px] font-semibold text-[#027A48]">
                        {quoteStatus}
                      </span>
                    ) : null}
                  </div>
                  {quoteTotal ? (
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-[0.04em] text-[#98A2B3]">Total</div>
                      <div className="text-[15px] font-semibold tabular-nums text-[#101828]">{quoteTotal}</div>
                    </div>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleOpenQuotation(false)}
                    disabled={creatingQuote}
                    className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#E4E7EC] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[#101828] hover:bg-[#F2F4F7]"
                  >
                    <FileText size={13} />
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleOpenQuotation(false)}
                    disabled={creatingQuote}
                    className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#E4E7EC] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[#101828] hover:bg-[#F2F4F7]"
                  >
                    <Pencil size={13} />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#E4E7EC] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[#667085]"
                    aria-label="More quotation actions"
                  >
                    <Ellipsis size={13} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <p className="text-[13px] text-[#667085]">No quotation yet</p>
                <button
                  type="button"
                  onClick={() => void handleCreateQuotation()}
                  disabled={creatingQuote}
                  className="mt-2 wa-btn-primary"
                >
                  {creatingQuote ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
                  Create quote
                </button>
              </div>
            )}
          </section>

          {/* Ownership & handover */}
          {canReassign ? (
            <section className="px-4 py-4">
              {sectionLabel("Ownership & handover")}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setReassignOpen((v) => !v);
                    setHandoverOpen(false);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#E4E7EC] bg-white px-3 py-2 text-[12px] font-medium text-[#101828] hover:bg-[#F9FAFB]"
                >
                  <UserRoundPlus size={14} strokeWidth={1.8} />
                  Reassign
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHandoverOpen((v) => !v);
                    setReassignOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#E4E7EC] bg-white px-3 py-2 text-[12px] font-medium text-[#101828] hover:bg-[#F9FAFB]"
                >
                  <ArrowLeftRight size={14} strokeWidth={1.8} />
                  Transfer
                </button>
                <button
                  type="button"
                  onClick={() => setHandoverOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#E4E7EC] bg-white px-3 py-2 text-[12px] font-medium text-[#101828] hover:bg-[#F9FAFB]"
                >
                  <Sparkles size={14} strokeWidth={1.8} />
                  Add handover notes
                </button>
              </div>
              {(reassignOpen || handoverOpen) ? (
                <div className="mt-3 space-y-2">
                  {handoverOpen ? (
                    <textarea
                      value={handoverNotes}
                      onChange={(e) => setHandoverNotes(e.target.value)}
                      rows={2}
                      placeholder="Handover notes for the next owner…"
                      className="w-full resize-none rounded-[8px] border border-[#E4E7EC] bg-white px-3 py-2 text-[12px] text-[#101828]"
                    />
                  ) : null}
                  <button
                    type="button"
                    disabled={reassigning}
                    onClick={() => void handleReassign(null)}
                    className="wa-btn-secondary text-[12px]"
                  >
                    Unassigned (pool)
                  </button>
                  {salespeople.map((sp) => (
                    <button
                      key={sp.id}
                      type="button"
                      disabled={reassigning}
                      onClick={() => void handleReassign(sp.id)}
                      className="wa-btn-secondary text-[12px]"
                    >
                      {sp.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {actionMessage ? (
            <div className="px-4 pb-4 text-[12px] font-medium text-[#4D7C0F]">{actionMessage}</div>
          ) : null}
        </div>
      </div>

      {editingQuote ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center">
          <div className="max-h-[min(96dvh,100dvh)] w-full max-w-4xl overflow-y-auto rounded-t-2xl border border-[#E4E7EC] bg-white p-5 sm:rounded-xl">
            <QuotationBuilder
              quotation={editingQuote}
              clientId={clientId}
              leadPhone={conversation.phone}
              whatsappApiSend={conversation.source === "WHATSAPP_INBOUND"}
              onSaved={(q) => setEditingQuote(q)}
              onSent={() => {
                setEditingQuote(null);
                onUpdated?.();
              }}
              onClose={() => setEditingQuote(null)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
