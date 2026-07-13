"use client";

import { useEffect, useState } from "react";
import { addDays, format } from "date-fns";
import {
  Activity,
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
import { formatSource } from "@/lib/inbox/fetch-conversations";
import { scoreColor, scoreLabel, stageLabel } from "@/lib/inbox/scoring";
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
}: Props) {
  const [briefing, setBriefing] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassigning, setReassigning] = useState(false);
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
    setFollowUpOpen(false);
    setFollowUpDate("");
    setActionMessage("");
    setEditingQuote(null);
    setStageOpen(false);
    setUpdatingStage(null);
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
        }),
      });
      if (res.ok) {
        setReassignOpen(false);
        onReassigned();
      }
    } finally {
      setReassigning(false);
    }
  }

  const panelShell = whatsappMode
    ? `flex h-full min-h-0 w-[340px] shrink-0 flex-col border-l border-[#D1D7DB] bg-white shadow-[-1px_0_0_#E9EDEF] ${
        mobileFullScreen
          ? ""
          : `max-[1180px]:fixed max-[1180px]:bottom-0 max-[1180px]:right-0 ${mobileTopClass} max-[1180px]:z-40 max-[1180px]:w-[min(340px,92vw)] max-[1180px]:shadow-[-4px_0_24px_rgba(0,0,0,0.15)] max-[1180px]:transition-transform max-[1180px]:duration-200`
      }`
    : `flex h-full min-h-0 w-[360px] shrink-0 flex-col border-l border-[var(--border)] bg-[var(--bg-tertiary)] max-[1180px]:fixed max-[1180px]:bottom-0 max-[1180px]:right-0 ${mobileTopClass} max-[1180px]:z-40 max-[1180px]:w-[340px] max-[1180px]:shadow-[-12px_0_30px_rgba(0,0,0,0.6)] max-[1180px]:transition-transform max-[1180px]:duration-200`;

  const mobilePanelClass = mobileFullScreen
    ? open
      ? "max-[860px]:fixed max-[860px]:inset-0 max-[860px]:z-50 max-[860px]:flex max-[860px]:w-full max-[860px]:translate-x-0 max-[860px]:shadow-none"
      : "max-[860px]:hidden"
    : open
      ? "max-[1180px]:translate-x-0"
      : "max-[1180px]:translate-x-full";

  const card = whatsappMode
    ? "rounded-lg border border-[#E9EDEF] bg-white"
    : "rounded-xl border border-[var(--border)] bg-[var(--surface-card)]";
  const sectionTitle = whatsappMode
    ? "text-[11px] font-semibold uppercase tracking-wide text-[#8696A0]"
    : "text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]";
  const textPrimary = whatsappMode ? "text-[#111B21]" : "text-[var(--text-primary)]";
  const textSecondary = whatsappMode ? "text-[#667781]" : "text-[var(--text-secondary)]";
  const textMuted = whatsappMode ? "text-[#8696A0]" : "text-[var(--text-tertiary)]";

  const intelHeader = (
    <div className={`shrink-0 border-b px-3 py-3 sm:px-4 ${whatsappMode ? "border-[#E9EDEF] bg-[#F0F2F5]" : "border-[var(--border)] bg-[var(--bg-primary)]"}`}>
      <div className="flex items-center gap-2">
        {onMobileBack ? (
          <button
            type="button"
            onClick={onMobileBack}
            title="Back to conversation"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
              whatsappMode ? "text-[#54656F] hover:bg-[#E9EDEF]" : "text-[var(--text-tertiary)] hover:bg-[var(--bg-quaternary)]"
            }`}
          >
            <ArrowLeft size={20} />
          </button>
        ) : null}
        <div className="min-w-0">
          <div className={`text-[15px] font-medium ${textPrimary}`}>Lead intelligence</div>
          <div className={`text-[12px] ${textSecondary}`}>Score, actions & contact</div>
        </div>
      </div>
    </div>
  );

  if (!conversation) {
    return (
      <div
        id="intelPanel"
        className={`${panelShell} ${mobilePanelClass}`}
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
        ? "border-[#008069] bg-[#E7FCE3] text-[#008069]"
        : "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)]"
      : whatsappMode
        ? "border-[#E9EDEF] text-[#54656F] hover:bg-[#F5F6F6]"
        : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]";

  return (
    <div
      id="intelPanel"
      className={`${panelShell} ${mobilePanelClass}`}
    >
      {intelHeader}
      <div className="inbox-scroll min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
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
                    ? "border-[#E9EDEF] text-[#54656F] hover:bg-[#F5F6F6]"
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
                        <div className={`mt-0.5 text-[10px] ${isCurrent ? "opacity-80" : "opacity-70"}`}>
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

        <div className={`p-5 text-center ${card}`}>
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
            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[var(--error)]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--error)]" />
              5-min SLA active
            </div>
          ) : null}
        </div>

        <div className={`flex flex-col gap-3 p-5 ${card}`}>
          <div className={sectionTitle}>
            Score Breakdown
          </div>
          <ScoreBreakdownBar label="Urgency" value={conversation.breakdown.urgency} max={25} icon={Zap} />
          <ScoreBreakdownBar label="Budget" value={conversation.breakdown.budget} max={25} icon={DollarSign} />
          <ScoreBreakdownBar label="Location" value={conversation.breakdown.location} max={15} icon={MapPin} />
          <ScoreBreakdownBar
            label="Product Interest"
            value={conversation.breakdown.productInterest}
            max={20}
            icon={Target}
          />
          <ScoreBreakdownBar
            label="Engagement"
            value={conversation.breakdown.engagement}
            max={15}
            icon={Activity}
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
          className={`rounded-lg p-5 ${whatsappMode ? "border border-[#00A884]/25 bg-[#E7FCE3]" : ""}`}
          style={
            whatsappMode
              ? undefined
              : {
                  background: "rgba(212,255,79,0.08)",
                  border: "1px solid rgba(212,255,79,0.25)",
                }
          }
        >
          <div className={`mb-2 ${sectionTitle} ${whatsappMode ? "text-[#008069]" : "text-[var(--accent)]"}`}>
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
              className={`flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50 ${
                whatsappMode
                  ? "bg-[#008069] text-white"
                  : "bg-[var(--accent)] text-[var(--accent-foreground)]"
              }`}
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
              className={`flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                whatsappMode
                  ? "border-[#E9EDEF] bg-white text-[#111B21] hover:bg-[#F5F6F6]"
                  : "border-[var(--border)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
              }`}
            >
              <CalendarClock size={16} />
              Schedule a follow-up
            </button>
          </div>
          {followUpOpen ? (
            <div className={`mt-3 space-y-2 rounded-lg border p-3 ${whatsappMode ? "border-[#E9EDEF] bg-white" : "border-[var(--border)] bg-[var(--surface-card)]"}`}>
              <div className="grid grid-cols-3 gap-1.5">
                {FOLLOW_UP_QUICK_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    disabled={schedulingFollowUp}
                    onClick={() => void handleScheduleFollowUp(toDateInputValue(addDays(new Date(), opt.days)))}
                    className={`rounded-md border px-2 py-2 text-[11px] disabled:opacity-50 ${
                      whatsappMode
                        ? "border-[#E9EDEF] text-[#54656F] hover:bg-[#F5F6F6]"
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
                      ? "border-[#E9EDEF] bg-white text-[#111B21]"
                      : "border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
                  }`}
                />
                <button
                  type="button"
                  disabled={!followUpDate || schedulingFollowUp}
                  onClick={() => void handleScheduleFollowUp(followUpDate)}
                  className={`rounded-md px-3 py-2 text-xs font-medium disabled:opacity-50 ${
                    whatsappMode
                      ? "bg-[#008069] text-white"
                      : "bg-[var(--accent)] text-[var(--accent-foreground)]"
                  }`}
                >
                  {schedulingFollowUp ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          ) : null}
          {actionMessage ? (
            <p className={`mt-3 text-xs ${whatsappMode ? "text-[#008069]" : "text-[var(--accent)]"}`}>
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
                className="flex cursor-pointer items-center gap-1 text-xs text-[var(--text-tertiary)]"
              >
                Reassign
                <ChevronDown size={14} />
              </button>
            ) : null}
          </div>
          {reassignOpen && canReassign ? (
            <div className="flex flex-col gap-1">
              <button
                type="button"
                disabled={reassigning}
                onClick={() => void handleReassign(null)}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
              >
                Unassigned (pool)
              </button>
              {salespeople.map((sp) => (
                <button
                  key={sp.id}
                  type="button"
                  disabled={reassigning}
                  onClick={() => void handleReassign(sp.id)}
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
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
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <Phone size={14} />
              {conversation.phone}
            </div>
          ) : null}
          {conversation.location ? (
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <MapPin size={14} />
              {conversation.location}
            </div>
          ) : null}
          {conversation.projectType ? (
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <Target size={14} />
              {conversation.projectType}
            </div>
          ) : null}
          <div className="text-sm text-[var(--text-secondary)]">
            Source: {formatSource(conversation.source as string)}
          </div>
        </div>

        {conversation.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {conversation.tags.map((t) => (
              <span
                key={t}
                className="flex items-center gap-1 rounded-full bg-[var(--bg-quaternary)] px-2 py-1 text-[11px] text-[var(--text-secondary)]"
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
