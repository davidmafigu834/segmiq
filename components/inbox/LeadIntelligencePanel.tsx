"use client";

import { useEffect, useState } from "react";
import { addDays, format } from "date-fns";
import {
  Activity,
  ArrowLeft,
  CalendarClock,
  ChevronDown,
  DollarSign,
  FileText,
  Loader2,
  MapPin,
  Phone,
  Sparkles,
  Tag,
  Target,
  Zap,
} from "lucide-react";
import { formatSource } from "@/lib/inbox/format-source";
import { scoreColor, scoreLabel, stageLabel } from "@/lib/inbox/scoring";
import { extractQualificationDisplayFields } from "@/lib/inbox/qualification-display";
import { MANUAL_LEAD_STAGES } from "@/lib/customer-hub/manual-lead-stages";
import type { InboxConversation } from "@/lib/inbox/types";
import { QuotationBuilder } from "@/components/leads/QuotationBuilder";
import type { LeadStatus, QuotationLineItemRow, QuotationRow } from "@/types";
import { ScoreBreakdownBar } from "./ScoreBreakdownBar";
import { LeadStageBadge } from "./LeadStageBadge";
import { displayContactName, WhatsAppAvatar } from "./WhatsAppAvatar";

type QuotationWithItems = QuotationRow & { items?: QuotationLineItemRow[] };

type Props = {
  conversation: InboxConversation | null;
  clientId: string;
  userId: string;
  role: "SALESPERSON" | "CLIENT_MANAGER" | "AGENCY_ADMIN";
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
};

const FOLLOW_UP_QUICK_OPTIONS = [
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "In 1 week", days: 7 },
] as const;

function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
  mobileTopClass = "max-[1180px]:top-16",
  mobileFullScreen = false,
  onMobileBack,
  panelWidth,
  panelAnimated = false,
}: Props) {
  const [briefing, setBriefing] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [capturedFields, setCapturedFields] = useState<{ label: string; value: string }[]>([]);
  const [leadBudget, setLeadBudget] = useState<string | null>(null);
  const [leadTimeline, setLeadTimeline] = useState<string | null>(null);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [handoverNotes, setHandoverNotes] = useState("");
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [schedulingFollowUp, setSchedulingFollowUp] = useState(false);
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [editingQuote, setEditingQuote] = useState<QuotationWithItems | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [stageOpen, setStageOpen] = useState(false);
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
    setFollowUpOpen(false);
    setFollowUpDate("");
    setActionMessage("");
    setEditingQuote(null);
    setStageOpen(false);
    setUpdatingStage(null);
    setHandoverNotes("");
    setReassignOpen(false);
  }, [conversation?.id]);

  useEffect(() => {
    if (!actionMessage) return;
    const t = window.setTimeout(() => setActionMessage(""), 3000);
    return () => window.clearTimeout(t);
  }, [actionMessage]);

  async function handleCreateQuotation() {
    if (!conversation || creatingQuote) return;
    setCreatingQuote(true);
    try {
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
        setFollowUpOpen(false);
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
        setStageOpen(false);
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
        setHandoverNotes("");
        onReassigned();
      }
    } finally {
      setReassigning(false);
    }
  }

  const panelWidthClass = panelWidth != null ? "shrink-0" : "w-[360px] shrink-0";

  const panelShell = whatsappMode
    ? `flex h-full min-h-0 ${panelWidthClass} flex-col bg-[var(--wa-surface)] wa-panel ${
        mobileFullScreen
          ? ""
          : `max-[1180px]:fixed max-[1180px]:bottom-0 max-[1180px]:right-0 ${mobileTopClass} max-[1180px]:z-40 max-[1180px]:w-[min(360px,92vw)] max-[1180px]:shadow-[-4px_0_24px_rgba(0,0,0,0.15)] max-[1180px]:transition-transform max-[1180px]:duration-200`
      }`
    : `flex h-full min-h-0 ${panelWidthClass} flex-col border-l border-[var(--border)] bg-[var(--bg-tertiary)] max-[1180px]:fixed max-[1180px]:bottom-0 max-[1180px]:right-0 ${mobileTopClass} max-[1180px]:z-40 max-[1180px]:w-[340px] max-[1180px]:shadow-[-12px_0_30px_rgba(0,0,0,0.6)] max-[1180px]:transition-transform max-[1180px]:duration-200`;

  const mobilePanelClass = mobileFullScreen
    ? open
      ? "max-[1180px]:fixed max-[1180px]:inset-0 max-[1180px]:z-50 max-[1180px]:flex max-[1180px]:w-full max-[1180px]:translate-x-0 max-[1180px]:shadow-none"
      : "max-[1180px]:hidden"
    : open
      ? "max-[1180px]:translate-x-0"
      : "max-[1180px]:translate-x-full";

  const card = whatsappMode ? "wa-card" : "rounded-xl border border-[var(--border)] bg-[var(--surface-card)]";
  const sectionTitle = whatsappMode
    ? "text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wa-muted)]"
    : "text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]";
  const textPrimary = whatsappMode ? "text-[var(--wa-ink)]" : "text-[var(--text-primary)]";
  const textSecondary = whatsappMode ? "text-[var(--text-secondary)]" : "text-[var(--text-secondary)]";
  const textMuted = whatsappMode ? "text-[var(--wa-muted)]" : "text-[var(--text-tertiary)]";
  const surfaceMuted = whatsappMode ? "bg-[var(--wa-surface-subtle)]" : "bg-[var(--bg-quaternary)]";
  const actionBtn = whatsappMode
    ? "rounded-lg border border-[var(--wa-border)] bg-[var(--wa-surface)] px-3 py-2 text-left text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:bg-[var(--wa-surface-subtle)]"
    : "rounded-lg border border-[var(--border)] px-3 py-2 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]";

  const intelHeader = (
    <div className={`shrink-0 px-3 py-3 sm:px-4 max-[1180px]:pt-[max(0.75rem,env(safe-area-inset-top))] ${whatsappMode ? "wa-panel-header" : "border-b border-[var(--border)] bg-[var(--bg-primary)]"}`}>
      <div className="flex items-center gap-2">
        {onMobileBack ? (
          <button
            type="button"
            onClick={onMobileBack}
            title="Back to conversation"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
              whatsappMode ? "wa-icon-btn-muted" : "text-[var(--text-tertiary)] hover:bg-[var(--bg-quaternary)]"
            }`}
          >
            <ArrowLeft size={20} />
          </button>
        ) : null}
        <div className="min-w-0">
          <div className={`text-[15px] font-semibold tracking-tight ${textPrimary}`}>Lead workspace</div>
          <div className={`mt-0.5 text-[12px] ${textSecondary}`}>Intelligence, actions and contact</div>
        </div>
      </div>
    </div>
  );

  const panelStyle = panelWidth != null ? { width: panelWidth } : undefined;

  const panelAnimatedClass = panelAnimated ? "inbox-panel-animated" : "";

  if (!conversation) {
    return (
      <div
        id="intelPanel"
        style={panelStyle}
        className={`${panelShell} ${mobilePanelClass} ${panelAnimatedClass}`}
      >
        {whatsappMode ? intelHeader : null}
        <div className={`flex flex-1 items-center justify-center p-6 text-sm ${textMuted}`}>
          Select a conversation
        </div>
      </div>
    );
  }

  const color = scoreColor(conversation.score);
  const label = scoreLabel(conversation.score);
  const summary = conversation.leadSummary || briefing;
  const nextAction = suggestion || "Create a quotation or schedule a follow-up to keep this lead moving.";
  const slaActive =
    conversation.status === "NEW" &&
    Date.now() - new Date(conversation.createdAt).getTime() < 5 * 60 * 1000;
  const canChangeStage =
    role !== "CLIENT_MANAGER" &&
    (role === "AGENCY_ADMIN" || conversation.assignedToId === userId);
  const stageButtonClass = (active: boolean) =>
    active
      ? whatsappMode
        ? "border-[var(--channel-whatsapp)] bg-[var(--channel-whatsapp-muted)] text-[var(--channel-whatsapp)]"
        : "border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--accent-fg)]"
      : whatsappMode
        ? "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
        : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]";

  return (
    <div
      id="intelPanel"
      style={panelStyle}
      className={`${panelShell} ${mobilePanelClass} ${panelAnimatedClass}`}
    >
      {intelHeader}
      <div className={`inbox-scroll min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)] ${whatsappMode ? "bg-[var(--wa-surface-subtle)]" : ""}`}>
      <div className="ag-fade-in flex flex-col gap-4 p-4">
        <div className={`flex items-center gap-3 p-4 ${card}`}>
          <WhatsAppAvatar
            name={displayContactName(conversation)}
            phone={conversation.phone}
            size="md"
          />
          <div className="min-w-0">
            <div className={`truncate text-base font-medium ${textPrimary}`}>
              {displayContactName(conversation)}
            </div>
            {conversation.whatsappProfileName && conversation.name && conversation.whatsappProfileName !== conversation.name ? (
              <div className={`truncate text-xs ${textMuted}`}>
                WhatsApp: {conversation.whatsappProfileName}
              </div>
            ) : null}
            {conversation.phone ? (
              <div className={`truncate text-xs ${textMuted}`}>{conversation.phone}</div>
            ) : null}
          </div>
        </div>

        <div className={`flex flex-col gap-3 p-4 ${card}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className={sectionTitle}>Lead stage</div>
              <div className={`mt-1 text-sm font-medium ${textPrimary}`}>
                {stageLabel(conversation.status, conversation.followUpDate)}
              </div>
            </div>
            <LeadStageBadge
              status={conversation.status}
              followUpDate={conversation.followUpDate}
              variant={whatsappMode ? "list" : "default"}
            />
          </div>

          {canChangeStage ? (
            <>
              <button
                type="button"
                onClick={() => setStageOpen((v) => !v)}
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-xs font-medium ${
                  whatsappMode
                    ? "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                    : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                }`}
              >
                Update stage manually
                <ChevronDown size={14} className={stageOpen ? "rotate-180 transition-transform" : "transition-transform"} />
              </button>
              {stageOpen ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {MANUAL_LEAD_STAGES.map((stage) => {
                    const isCurrent = conversation.status === stage.value;
                    const busy = updatingStage === stage.value;
                    return (
                      <button
                        key={stage.value}
                        type="button"
                        disabled={isCurrent || updatingStage !== null}
                        onClick={() => void handleStageChange(stage.value)}
                        title={stage.hint}
                        className={`rounded-md border px-2 py-2 text-left disabled:opacity-50 ${stageButtonClass(isCurrent)}`}
                      >
                        <div className="text-[11px] font-semibold">{stage.label}</div>
                        <div className={`mt-0.5 text-[10px] ${isCurrent ? "opacity-80" : textMuted}`}>
                          {busy ? "Saving…" : stage.hint}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </>
          ) : role === "CLIENT_MANAGER" ? (
            <p className={`text-xs ${textMuted}`}>Managers can view stage but cannot change it here.</p>
          ) : !conversation.assignedToId ? (
            <p className={`text-xs ${textMuted}`}>Claim this lead to update its stage.</p>
          ) : (
            <p className={`text-xs ${textMuted}`}>Only the assigned salesperson can update stage.</p>
          )}
        </div>

        <div
          className={`p-5 text-center ${card} ${
            whatsappMode ? "bg-[var(--wa-surface-subtle)]" : ""
          }`}
        >
          <div className={`mb-2 text-xs uppercase tracking-wide ${textMuted}`}>
            Lead Intent Score
          </div>
          <div
            className="text-5xl font-normal"
            style={{ fontFamily: "var(--font-instrument-serif)", color }}
          >
            {conversation.score}
          </div>
          <div
            className="mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ background: `${color}22`, color }}
          >
            {label} Lead
          </div>
          {slaActive ? (
            <div className={`mt-3 flex items-center justify-center gap-1.5 text-xs ${whatsappMode ? "text-[var(--error)]" : "text-[var(--error)]"}`}>
              <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${whatsappMode ? "bg-[var(--error)]" : "bg-[var(--error)]"}`} />
              5-min SLA active
            </div>
          ) : null}
        </div>

        <div className={`flex flex-col gap-3 p-5 ${card}`}>
          <div className={sectionTitle}>
            Score Breakdown
          </div>
          <ScoreBreakdownBar label="Urgency" value={conversation.breakdown.urgency} max={25} icon={Zap} light={whatsappMode} />
          <ScoreBreakdownBar label="Budget" value={conversation.breakdown.budget} max={25} icon={DollarSign} light={whatsappMode} />
          <ScoreBreakdownBar label="Location" value={conversation.breakdown.location} max={15} icon={MapPin} light={whatsappMode} />
          <ScoreBreakdownBar
            label="Product Interest"
            value={conversation.breakdown.productInterest}
            max={20}
            icon={Target}
            light={whatsappMode}
          />
          <ScoreBreakdownBar
            label="Engagement"
            value={conversation.breakdown.engagement}
            max={15}
            icon={Activity}
            light={whatsappMode}
          />
        </div>

        {summary ? (
          <div className={`p-5 ${card}`}>
            <div className={`mb-2 flex items-center gap-1.5 ${sectionTitle}`}>
              <Sparkles size={14} />
              AI Qualification
            </div>
            <p className={`text-sm leading-relaxed ${textSecondary}`}>{summary}</p>
          </div>
        ) : null}

        <div
          className={`rounded-xl p-5 ${
            whatsappMode
              ? "border border-[var(--wa-border)] bg-[var(--wa-accent-soft)]"
              : "border border-[var(--accent-border)] bg-[var(--accent-muted)]"
          }`}
        >
          <div className={`mb-2 ${sectionTitle} ${whatsappMode ? "text-[var(--wa-accent-strong)]" : "text-[var(--accent-fg)]"}`}>
            Suggested Next Action
          </div>
          <p className={`mb-3 text-sm ${textPrimary}`}>{nextAction}</p>
          {conversation.followUpDate ? (
            <p className={`mb-3 text-xs ${textMuted}`}>
              Follow-up scheduled:{" "}
              <span className={`font-medium ${textSecondary}`}>
                {format(new Date(conversation.followUpDate + "T12:00:00"), "MMM d, yyyy")}
              </span>
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void handleCreateQuotation()}
              disabled={creatingQuote}
              className={whatsappMode ? "wa-btn-primary" : "flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2.5 text-sm font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"}
            >
              {creatingQuote ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
              Create a quotation
            </button>
            <button
              type="button"
              onClick={() => {
                setFollowUpOpen((v) => !v);
                if (!followUpDate) setFollowUpDate(toDateInputValue(addDays(new Date(), 1)));
              }}
              className={whatsappMode ? "wa-btn-secondary" : "flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)]"}
            >
              <CalendarClock size={16} />
              Schedule a follow-up
            </button>
          </div>
          {followUpOpen ? (
            <div className={`mt-3 space-y-2 rounded-lg border p-3 ${whatsappMode ? "border-[var(--border)] bg-[var(--wa-surface)]" : "border-[var(--border)] bg-[var(--surface-card)]"}`}>
              <div className="grid grid-cols-3 gap-1.5">
                {FOLLOW_UP_QUICK_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    disabled={schedulingFollowUp}
                    onClick={() => void handleScheduleFollowUp(toDateInputValue(addDays(new Date(), opt.days)))}
                    className={`rounded-md border px-2 py-2 text-[11px] disabled:opacity-50 ${
                      whatsappMode
                        ? "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                        : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={followUpDate}
                  min={toDateInputValue(new Date())}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className={`flex-1 rounded-md border px-2 py-2 text-sm ${
                    whatsappMode
                      ? "border-[var(--border)] bg-[var(--wa-surface)] text-[var(--text-primary)]"
                      : "border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
                  }`}
                />
                <button
                  type="button"
                  disabled={!followUpDate || schedulingFollowUp}
                  onClick={() => void handleScheduleFollowUp(followUpDate)}
                  className={`rounded-md px-3 py-2 text-xs font-medium disabled:opacity-50 ${
                    whatsappMode
                      ? "bg-[var(--channel-whatsapp)] text-white"
                      : "bg-[var(--accent)] text-[var(--accent-foreground)]"
                  }`}
                >
                  {schedulingFollowUp ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          ) : null}
          {actionMessage ? (
            <p className={`mt-3 text-xs ${whatsappMode ? "text-[var(--wa-accent-strong)]" : "text-[var(--accent-fg)]"}`}>
              {actionMessage}
            </p>
          ) : null}
        </div>

        <div className={`flex flex-col gap-3 p-5 ${card}`}>
          <div className={sectionTitle}>
            Assignment
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-sm ${textPrimary}`}>
              {conversation.assignee?.name ?? "Unassigned"}
            </span>
            {canReassign ? (
              <button
                type="button"
                onClick={() => setReassignOpen((v) => !v)}
                className={`flex cursor-pointer items-center gap-1 text-xs ${textMuted}`}
              >
                Reassign
                <ChevronDown size={14} />
              </button>
            ) : null}
          </div>
          {reassignOpen && canReassign ? (
            <div className="flex flex-col gap-1">
              <textarea
                value={handoverNotes}
                onChange={(e) => setHandoverNotes(e.target.value)}
                rows={2}
                placeholder="Handover note for the new rep (optional)"
                className={`mb-1 w-full resize-none rounded-md border px-2 py-1.5 text-xs ${
                  whatsappMode ? "border-[var(--border)] bg-[var(--wa-surface)] text-[var(--text-primary)]" : "border-[var(--border)] bg-[var(--bg-primary)]"
                }`}
              />
              <button
                type="button"
                disabled={reassigning}
                onClick={() => void handleReassign(null)}
                className={actionBtn}
              >
                Unassigned (pool)
              </button>
              {salespeople.map((sp) => (
                <button
                  key={sp.id}
                  type="button"
                  disabled={reassigning}
                  onClick={() => void handleReassign(sp.id)}
                  className={actionBtn}
                >
                  {sp.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className={`flex flex-col gap-3 p-5 ${card}`}>
          <div className={sectionTitle}>
            Contact Details
          </div>
          {conversation.phone ? (
            <div className={`flex items-center gap-2 text-sm ${textSecondary}`}>
              <Phone size={14} className={textMuted} />
              {conversation.phone}
            </div>
          ) : null}
          {conversation.location ? (
            <div className={`flex items-center gap-2 text-sm ${textSecondary}`}>
              <MapPin size={14} className={textMuted} />
              {conversation.location}
            </div>
          ) : null}
          {conversation.projectType ? (
            <div className={`flex items-center gap-2 text-sm ${textSecondary}`}>
              <Target size={14} className={textMuted} />
              {conversation.projectType}
            </div>
          ) : null}
          {leadBudget ? (
            <div className={`flex items-center gap-2 text-sm ${textSecondary}`}>
              <DollarSign size={14} className={textMuted} />
              {leadBudget}
            </div>
          ) : null}
          {leadTimeline ? (
            <div className={`flex items-center gap-2 text-sm ${textSecondary}`}>
              <CalendarClock size={14} className={textMuted} />
              {leadTimeline}
            </div>
          ) : null}
          <div className={`text-sm ${textSecondary}`}>
            Source: {formatSource(conversation.source as string)}
          </div>
        </div>

        {capturedFields.length > 0 ? (
          <div className={`flex flex-col gap-3 p-5 ${card}`}>
            <div className={sectionTitle}>Captured from chat</div>
            {capturedFields.map((field) => (
              <div key={`${field.label}-${field.value}`} className="min-w-0">
                <div className={`text-[11px] font-medium ${textMuted}`}>{field.label}</div>
                <div className={`mt-0.5 text-sm ${textPrimary}`}>{field.value}</div>
              </div>
            ))}
          </div>
        ) : null}

        {conversation.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {conversation.tags.map((t) => (
              <span
                key={t}
                className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] ${surfaceMuted} ${textSecondary}`}
              >
                <Tag size={10} />
                {t.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      </div>

      {editingQuote ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75 sm:items-center">
          <div className="max-h-[min(96dvh,100dvh)] w-full max-w-4xl overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--surface-card)] p-5 sm:rounded-xl">
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
