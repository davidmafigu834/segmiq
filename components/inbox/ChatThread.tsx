"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  MoreHorizontal,
  PanelRight,
  Paperclip,
  Phone,
  Send,
  StickyNote,
  Trophy,
  UserRound,
  Zap,
  XCircle,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import type { InboxChatMessage, InboxConversation } from "@/lib/inbox/types";
import { formatAwaitingReply, formatDealValue } from "@/lib/inbox/queue-filters";
import { getSalesSignal } from "@/lib/inbox/format-display";
import { applyQuickReplyVariables } from "@/lib/inbox/quick-reply-vars";
import { LogCallForm } from "@/components/leads/LogCallForm";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { groupMessagesByDay, MessageBubble } from "./MessageBubble";
import { LeadStageBadge } from "./LeadStageBadge";
import { LeadIntentBadge } from "./LeadIntentBadge";
import { QuickReplyBar, type QuickReplyAction, type SavedQuickReply } from "./QuickReplyBar";
import { displayContactName, WhatsAppAvatar } from "./WhatsAppAvatar";
import { TransferDialog } from "./TransferDialog";
import { CreateDealSheet } from "@/components/sales/deals/CreateDealSheet";
import type { LeadRow } from "@/types";
import { initials } from "@/lib/inbox/assignee-colors";

type Props = {
  conversation: InboxConversation | null;
  clientId: string;
  userName: string;
  companyName?: string;
  canSend: boolean;
  canTransfer?: boolean;
  canUpdateStatus?: boolean;
  salespeople?: { id: string; name: string }[];
  showLogCall: boolean;
  onBack?: () => void;
  onToggleIntel: () => void;
  onMessagesChange: () => void;
  onConversationUpdate?: () => void;
  onSessionChange?: (open: boolean | null) => void;
  companyMode?: boolean;
  canReassign?: boolean;
  canCreateDeal?: boolean;
  leadHref?: string;
  dealHref?: string;
  contextOpen?: boolean;
};

export function ChatThread({
  conversation,
  clientId,
  userName,
  companyName = "",
  canSend,
  canTransfer = false,
  canUpdateStatus = false,
  salespeople = [],
  showLogCall,
  onBack,
  onToggleIntel,
  onMessagesChange,
  onConversationUpdate,
  onSessionChange,
  companyMode = false,
  canReassign = false,
  canCreateDeal = false,
  leadHref,
  dealHref,
  contextOpen = false,
}: Props) {
  const [messages, setMessages] = useState<InboxChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [logCallOpen, setLogCallOpen] = useState(false);
  const [pricingPicker, setPricingPicker] = useState<{ id: string; name: string }[] | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [composerMoreOpen, setComposerMoreOpen] = useState(false);
  const [savedReplies, setSavedReplies] = useState<SavedQuickReply[]>([]);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [createDealOpen, setCreateDealOpen] = useState(false);
  const [dealLead, setDealLead] = useState<LeadRow | null>(null);
  const [hasNewBelow, setHasNewBelow] = useState(false);
  const [campaignContext, setCampaignContext] = useState<{
    campaignName: string;
    sentAt: string | null;
    responseClassification: string | null;
  } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const composerRef = useRef<HTMLInputElement>(null);
  const onMessagesChangeRef = useRef(onMessagesChange);
  const onSessionChangeRef = useRef(onSessionChange);
  onMessagesChangeRef.current = onMessagesChange;
  onSessionChangeRef.current = onSessionChange;

  useEffect(() => {
    stickToBottomRef.current = true;
    setQuickActionsOpen(false);
    setMenuOpen(false);
    if (!conversation?.id) onSessionChangeRef.current?.(null);
  }, [conversation?.id]);

  useEffect(() => {
    const focusComposer = () => composerRef.current?.focus();
    window.addEventListener("segmiq:focus-whatsapp-composer", focusComposer);
    return () => window.removeEventListener("segmiq:focus-whatsapp-composer", focusComposer);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function onScroll() {
      const node = scrollRef.current;
      if (!node) return;
      const threshold = 96;
      const nearBottom =
        node.scrollHeight - node.scrollTop - node.clientHeight < threshold;
      stickToBottomRef.current = nearBottom;
      if (nearBottom) setHasNewBelow(false);
    }

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [conversation?.id]);

  useEffect(() => {
    if (!conversation?.id) {
      setMessages([]);
      return;
    }
    const conversationId = conversation.id;
    const conversationSource = conversation.source;
    let cancelled = false;

    async function loadMessages(isInitial = false) {
      if (isInitial) setLoading(true);
      try {
        const res = await fetch(`/api/inbox/conversations/${conversationId}/messages`);
        const d = (await res.json()) as {
          messages?: InboxChatMessage[];
          sessionOpen?: boolean;
          campaignContext?: {
            campaignName: string;
            sentAt: string | null;
            responseClassification: string | null;
          } | null;
        };
        if (!cancelled) {
          const next = d.messages ?? [];
          setMessages((prev) => {
            if (
              prev.length === next.length
              && prev.every((m, i) => {
                const n = next[i];
                return n && m.id === n.id && m.status === n.status && m.text === n.text;
              })
            ) {
              return prev;
            }
            return next;
          });
          const open = d.sessionOpen === true;
          setSessionOpen(open);
          onSessionChangeRef.current?.(open);
          setCampaignContext(d.campaignContext ?? null);
        }
      } finally {
        if (!cancelled && isInitial) setLoading(false);
      }
    }

    void loadMessages(true);
    const interval = conversationSource === "WHATSAPP_INBOUND"
      ? window.setInterval(() => void loadMessages(false), 5000)
      : null;

    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
    };
  }, [conversation?.id, conversation?.source]);

  useEffect(() => {
    if (!canSend) return;
    fetch("/api/inbox/quick-replies")
      .then((r) => r.json())
      .then((d: { replies?: SavedQuickReply[] }) => setSavedReplies(d.replies ?? []))
      .catch(() => {});
  }, [canSend, clientId]);

  useEffect(() => {
    if (stickToBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      setHasNewBelow(false);
      return;
    }
    if (messages.length > 0) setHasNewBelow(true);
  }, [messages, conversation?.id]);

  async function sendCustomMessage(text: string) {
    if (!conversation || !text.trim() || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const isWhatsApp = conversation.source === "WHATSAPP_INBOUND";
      const endpoint = isWhatsApp
        ? `/api/leads/${conversation.id}/send-message`
        : `/api/leads/${conversation.id}/send-asset`;
      const payload = isWhatsApp
        ? { text: text.trim() }
        : { assetType: "CUSTOM_MESSAGE", customMessage: text.trim() };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const sentText = text.trim();
        setInput("");
        setQuickActionsOpen(false);
        stickToBottomRef.current = true;
        setMessages((prev) => [
          ...prev,
          {
            id: `pending-${Date.now()}`,
            direction: "rep",
            text: sentText,
            createdAt: new Date().toISOString(),
            kind: "message",
            status: "sent",
          },
        ]);
        onMessagesChange();
        const msgRes = await fetch(`/api/inbox/conversations/${conversation.id}/messages`);
        const data = (await msgRes.json()) as {
          messages?: InboxChatMessage[];
          sessionOpen?: boolean;
        };
        setMessages(data.messages ?? []);
        const open = data.sessionOpen === true;
        setSessionOpen(open);
        onSessionChangeRef.current?.(open);
      } else if (isWhatsApp) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setSendError(err.error ?? "Could not send message");
      }
    } finally {
      setSending(false);
    }
  }

  async function sendAsset(
    assetType: "PORTFOLIO" | "TESTIMONIALS" | "PRICING_PACKAGE" | "DOCUMENT",
    assetId?: string
  ) {
    if (!conversation || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/leads/${conversation.id}/send-asset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetType, assetId }),
      });
      if (res.ok) {
        setQuickActionsOpen(false);
        onMessagesChange();
        const msgRes = await fetch(`/api/inbox/conversations/${conversation.id}/messages`);
        const data = (await msgRes.json()) as { messages?: InboxChatMessage[] };
        setMessages(data.messages ?? []);
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setSendError(err.error ?? "Could not send message");
      }
    } finally {
      setSending(false);
      setPricingPicker(null);
    }
  }

  async function handleQuickAction(action: QuickReplyAction) {
    if (!conversation || !canSend) return;
    if (action.type === "CUSTOM_MESSAGE") {
      if (action.preset) {
        await sendCustomMessage(action.preset);
      } else {
        const text = window.prompt("Enter your message:");
        if (text?.trim()) await sendCustomMessage(text);
      }
      return;
    }
    if (action.type === "PRICING_PACKAGE" && "needsPicker" in action) {
      const res = await fetch(`/api/clients/${clientId}/packages`);
      const data = (await res.json()) as { packages?: { id: string; name: string }[] };
      const pkgs = data.packages ?? [];
      if (pkgs.length === 1) {
        await sendAsset("PRICING_PACKAGE", pkgs[0].id);
      } else if (pkgs.length > 1) {
        setPricingPicker(pkgs);
      }
      return;
    }
    await sendAsset(action.type);
  }

  async function handleSavedReply(body: string) {
    if (!conversation) return;
    const text = applyQuickReplyVariables(body, {
      customerName: displayContactName(conversation),
      companyName,
      salespersonName: userName,
      projectType: conversation.projectType,
      location: conversation.location,
    });
    await sendCustomMessage(text);
  }

  async function handleInternalNote() {
    if (!conversation) return;
    const note = window.prompt("Add internal note (customer will not see this):");
    if (!note?.trim()) return;
    const res = await fetch(`/api/leads/${conversation.id}/internal-note`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: note.trim() }),
    });
    if (res.ok) {
      onMessagesChange();
      const msgRes = await fetch(`/api/inbox/conversations/${conversation.id}/messages`);
      const data = (await msgRes.json()) as { messages?: InboxChatMessage[] };
      setMessages(data.messages ?? []);
    }
  }

  async function handleStatusUpdate(status: "WON" | "LOST") {
    if (!conversation || statusUpdating) return;
    if (status === "LOST") {
      window.prompt("Reason lost (optional):");
    }
    setStatusUpdating(true);
    try {
      const res = await fetch(`/api/leads/${conversation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        onConversationUpdate?.();
        onMessagesChange();
      }
    } finally {
      setStatusUpdating(false);
      setMenuOpen(false);
    }
  }

  async function handleTransfer(assigneeId: string, handoverNotes: string) {
    if (!conversation) return;
    const res = await fetch(`/api/leads/${conversation.id}/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assigned_to_id: assigneeId,
        handover_notes: handoverNotes || null,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(json.error ?? "Transfer failed");
    onConversationUpdate?.();
    onMessagesChange();
  }

  async function handleConversationStatus(status: "OPEN" | "RESOLVED") {
    if (!conversation || statusUpdating) return;
    setStatusUpdating(true);
    try {
      const res = await fetch(`/api/inbox/conversations/${conversation.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        onConversationUpdate?.();
        onMessagesChange();
      }
    } finally {
      setStatusUpdating(false);
      setMenuOpen(false);
    }
  }

  async function openCreateDeal() {
    if (!conversation || !canCreateDeal) return;
    const res = await fetch(`/api/leads/${conversation.id}`);
    if (!res.ok) return;
    const data = (await res.json()) as { lead?: LeadRow };
    if (!data.lead) return;
    setDealLead(data.lead);
    setCreateDealOpen(true);
  }

  if (!conversation) {
    return (
      <div className="wa-chat-wallpaper flex h-full min-h-0 min-w-0 flex-1 flex-col items-center justify-center px-6">
        <div className="wa-empty-hint max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[12px] border border-[#E4E7EC] bg-[#F7F8FA] text-[#25D366]">
            <SiWhatsapp size={24} aria-hidden />
          </div>
          <div className="mb-1.5 text-[16px] font-semibold tracking-tight text-[#101828]">
            Select a conversation
          </div>
          <p className="text-[13px] leading-relaxed text-[#667085]">
            Choose a WhatsApp conversation to view the customer&apos;s messages and sales context.
          </p>
        </div>
      </div>
    );
  }

  const name = displayContactName(conversation);
  const messageGroups = groupMessagesByDay(messages);
  const isWhatsApp = conversation.source === "WHATSAPP_INBOUND";
  const dealLabel = formatDealValue(conversation.dealValue, conversation.dealCurrency ?? "USD");
  const waitingLabel = formatAwaitingReply(conversation.awaitingReplyMinutes);
  const prioritySignal = getSalesSignal(conversation);
  const sessionClosed = isWhatsApp && !sessionOpen;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <div
        className={`shrink-0 max-[1099px]:pt-[max(0.75rem,env(safe-area-inset-top))] ${
          isWhatsApp ? "wa-panel-header" : "border-b border-[var(--border)] bg-[var(--bg-primary)]"
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-3 sm:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                aria-label="Back to conversations"
                className={
                  isWhatsApp
                    ? "wa-icon-btn-muted shrink-0"
                    : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--text-tertiary)] transition-all hover:bg-[var(--bg-quaternary)]"
                }
              >
                <ArrowLeft size={20} />
              </button>
            ) : null}
            <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
              <WhatsAppAvatar
                name={name}
                phone={conversation.phone}
                size="sm"
                className="max-[480px]:h-9 max-[480px]:w-9"
              />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[14px] font-semibold tracking-tight text-[#101828]">
                    {name}
                  </span>
                  {isWhatsApp ? (
                    <SiWhatsapp size={14} className="shrink-0 text-[#25D366]" aria-label="WhatsApp" />
                  ) : null}
                </div>
                {conversation.phone ? (
                  <div className="mt-0.5 truncate text-[11px] tabular-nums text-[#667085]">
                    {conversation.phone}
                    {companyMode && conversation.location ? ` · ${conversation.location}` : ""}
                  </div>
                ) : null}
                {!companyMode ? <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
                  <LeadStageBadge
                    status={conversation.status}
                    followUpDate={conversation.followUpDate}
                    variant="list"
                  />
                  <LeadIntentBadge
                    score={conversation.score}
                    label={conversation.scoreLabel}
                    variant="list"
                  />
                  {dealLabel ? (
                    <span className="inline-flex items-center rounded-full border border-[#E4E7EC] bg-[#F9FAFB] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[#344054]">
                      {dealLabel}
                    </span>
                  ) : null}
                  {waitingLabel ? (
                    <span className="inline-flex items-center rounded-full border border-[#FED7AA] bg-[#FFFAEB] px-1.5 py-0.5 text-[10px] font-semibold text-[#B54708]">
                      {waitingLabel}
                    </span>
                  ) : null}
                </div> : null}
                {!companyMode && prioritySignal ? (
                  <div className="mt-1 truncate text-[11px] text-[#667085]" title={prioritySignal.detail}>
                    {prioritySignal.title}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div className="relative flex shrink-0 items-center gap-0.5 sm:gap-1">
            {companyMode ? (
              <button
                type="button"
                onClick={() => {
                  if (canReassign) setTransferOpen(true);
                }}
                disabled={!canReassign}
                className="mr-1 hidden min-w-0 items-center gap-2 rounded-[8px] px-2 py-1 text-left hover:bg-sales-surface-hover disabled:cursor-default layout:flex"
                aria-label={canReassign ? "Assign or reassign conversation" : "Conversation owner"}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sales-surface-hover text-[9px] font-semibold text-sales-text-primary">
                  {conversation.assignee ? initials(conversation.assignee.name) : <UserRound size={13} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[8px] uppercase tracking-[0.04em] text-sales-text-muted">Owner</span>
                  <span className={`block max-w-24 truncate text-[10.5px] font-medium ${conversation.assignee ? "text-sales-text-primary" : "text-[#D97706]"}`}>
                    {conversation.assignee?.name ?? "Unassigned"}
                  </span>
                </span>
                {canReassign ? <ChevronDown size={12} className="text-sales-text-muted" /> : null}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onToggleIntel}
              aria-label={contextOpen ? "Hide customer context" : "Show customer context"}
              title={contextOpen ? "Hide customer context" : "Show customer context"}
              className={isWhatsApp ? `wa-icon-btn !h-9 !w-9 ${contextOpen ? "!border-sales-brand-border !bg-sales-brand-soft" : ""}` : "flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-tertiary)] hover:bg-[var(--bg-quaternary)]"}
            >
              <PanelRight size={16} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Conversation actions"
              aria-expanded={menuOpen}
              className={isWhatsApp ? "wa-icon-btn !h-9 !w-9" : "flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-tertiary)] hover:bg-[var(--bg-quaternary)]"}
            >
              <MoreHorizontal size={16} />
            </button>
            {menuOpen ? (
              <div className={`absolute right-0 top-11 z-20 min-w-[200px] ${isWhatsApp ? "wa-dropdown" : "rounded-lg border border-[var(--border)] bg-[var(--surface-card)] py-1 shadow-lg"}`}>
                {canSend || canReassign ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      void handleInternalNote();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                  >
                    <StickyNote size={14} />
                    Add internal note
                  </button>
                ) : null}
                {showLogCall ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setLogCallOpen(true);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                  >
                    <Phone size={14} />
                    Log call
                  </button>
                ) : null}
                {canTransfer ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setTransferOpen(true);
                    }}
                    className="flex w-full px-3 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                  >
                    Transfer conversation
                  </button>
                ) : null}
                {canUpdateStatus && !companyMode ? (
                  <>
                    <button
                      type="button"
                      disabled={statusUpdating}
                      onClick={() => void handleStatusUpdate("WON")}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[var(--success)] hover:bg-[var(--success-muted)] disabled:opacity-50"
                    >
                      <Trophy size={14} />
                      Mark as won
                    </button>
                    <button
                      type="button"
                      disabled={statusUpdating}
                      onClick={() => void handleStatusUpdate("LOST")}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[var(--danger-fg)] hover:bg-[var(--danger-bg)] disabled:opacity-50"
                    >
                      <XCircle size={14} />
                      Mark as lost
                    </button>
                  </>
                ) : null}
                {companyMode && (canReassign || canUpdateStatus) ? (
                  <button
                    type="button"
                    disabled={statusUpdating}
                    onClick={() => void handleConversationStatus(conversation.conversationStatus === "RESOLVED" ? "OPEN" : "RESOLVED")}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
                  >
                    <CheckCircle2 size={14} />
                    {conversation.conversationStatus === "RESOLVED" ? "Reopen conversation" : "Resolve conversation"}
                  </button>
                ) : null}
                {!canTransfer && !canUpdateStatus && !canSend && !canReassign && !showLogCall ? (
                  <div className="px-3 py-2 text-xs text-[var(--text-tertiary)]">No actions available</div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {companyMode ? (
        <div className="flex min-h-[44px] shrink-0 items-center gap-1.5 overflow-x-auto border-b border-sales-border bg-sales-surface px-3 py-1.5 inbox-scroll [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {canSend || canReassign ? (
            <button type="button" onClick={() => void handleInternalNote()} className="wa-btn-secondary shrink-0 !h-8 !w-auto !px-3 !text-[10px] max-[520px]:hidden">
              <StickyNote size={13} strokeWidth={1.8} /> Add Note
            </button>
          ) : null}
          {dealHref ? (
            <Link href={dealHref} className="wa-btn-secondary shrink-0 !h-8 !w-auto !px-3 !text-[10px]">
              <BriefcaseBusiness size={13} strokeWidth={1.8} /> View Deal
            </Link>
          ) : canCreateDeal ? (
            <button type="button" onClick={() => void openCreateDeal()} className="wa-btn-secondary shrink-0 !h-8 !w-auto !px-3 !text-[10px] text-[#4D7C0F]">
              <BriefcaseBusiness size={13} strokeWidth={1.8} /> Create Deal
            </button>
          ) : null}
          {leadHref ? (
            <Link href={leadHref} className="wa-btn-secondary shrink-0 !h-8 !w-auto !px-3 !text-[10px] max-[480px]:hidden">
              <UserRound size={13} strokeWidth={1.8} /> View Lead
            </Link>
          ) : null}
        </div>
      ) : null}

      {campaignContext ? (
        <div className="border-b border-[var(--border)] bg-[rgba(212,255,79,0.06)] px-4 py-2 text-xs text-[var(--text-secondary)]">
          <span className="font-medium text-[var(--text-primary)]">Campaign:</span>{" "}
          {campaignContext.campaignName}
          {campaignContext.sentAt
            ? ` · Sent ${new Date(campaignContext.sentAt).toLocaleDateString("en-GB")}`
            : ""}
          {campaignContext.responseClassification
            ? ` · Response: ${campaignContext.responseClassification.replace(/_/g, " ")}`
            : ""}
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="wa-chat-wallpaper inbox-scroll relative flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-4 sm:px-5"
      >
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="wa-empty-hint">Loading messages…</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-1 items-start justify-center pt-16">
            <span className="wa-empty-hint">No messages yet — say hello to start the conversation</span>
          </div>
        ) : (
          messageGroups.map((group) => (
            <div key={group.label} className="space-y-1.5">
              <div className="flex justify-center py-1">
                <div className="wa-day-rule">
                  <span>{group.label}</span>
                </div>
              </div>
              {group.messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
            </div>
          ))
        )}
        <div ref={bottomRef} />
        {hasNewBelow ? (
          <button
            type="button"
            onClick={() => {
              stickToBottomRef.current = true;
              setHasNewBelow(false);
              bottomRef.current?.scrollIntoView({ behavior: "smooth" });
            }}
            className="sticky bottom-3 z-10 mx-auto rounded-full border border-[#E4E7EC] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#101828] shadow-[0_4px_12px_rgba(16,24,40,0.08)]"
          >
            New messages ↓
          </button>
        ) : null}
      </div>

      {canSend ? (
        <div className={`shrink-0 bg-white ${isWhatsApp ? "wa-composer" : "border-t border-[var(--border)]"}`}>
          {sendError ? (
            <div role="alert" className="border-b border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-2 text-center text-xs text-[var(--danger-fg)]">
              {sendError}
            </div>
          ) : null}
          {isWhatsApp && !companyMode ? (
            <div className="wa-action-strip relative">
              <button
                type="button"
                onClick={() => setQuickActionsOpen((v) => !v)}
                aria-expanded={quickActionsOpen}
                aria-label="Quick replies"
                className={`wa-action-chip ${quickActionsOpen ? "wa-action-chip-active" : ""}`}
              >
                <Zap size={14} strokeWidth={1.8} aria-hidden />
                Quick replies
              </button>
              <button
                type="button"
                onClick={() => setQuickActionsOpen(true)}
                aria-label="Send asset"
                className="wa-action-chip max-[520px]:hidden"
              >
                <Paperclip size={14} strokeWidth={1.8} aria-hidden />
                Send asset
              </button>
              <button
                type="button"
                onClick={() => void handleInternalNote()}
                aria-label="Add internal note"
                className="wa-action-chip max-[640px]:hidden"
              >
                <StickyNote size={14} strokeWidth={1.8} aria-hidden />
                Internal note
              </button>
              {showLogCall ? (
                <button
                  type="button"
                  onClick={() => setLogCallOpen(true)}
                  aria-label={`Log call with ${name}`}
                  className="wa-action-chip"
                >
                  <Phone size={14} strokeWidth={1.8} aria-hidden />
                  Log call
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setComposerMoreOpen((v) => !v)}
                aria-expanded={composerMoreOpen}
                aria-label="More composer actions"
                className="wa-action-chip min-[641px]:hidden"
              >
                More
                <ChevronDown size={14} strokeWidth={1.8} aria-hidden />
              </button>
              {composerMoreOpen ? (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-20 cursor-default"
                    aria-label="Close more actions"
                    onClick={() => setComposerMoreOpen(false)}
                  />
                  <div className="absolute bottom-full right-2 z-30 mb-1 min-w-[160px] rounded-[10px] border border-[#E4E7EC] bg-white py-1 shadow-[0_8px_24px_rgba(16,24,40,0.08)]">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[#101828] hover:bg-[#F9FAFB] min-[521px]:hidden"
                      onClick={() => {
                        setComposerMoreOpen(false);
                        setQuickActionsOpen(true);
                      }}
                    >
                      <Paperclip size={14} /> Send asset
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[#101828] hover:bg-[#F9FAFB]"
                      onClick={() => {
                        setComposerMoreOpen(false);
                        void handleInternalNote();
                      }}
                    >
                      <StickyNote size={14} /> Internal note
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
          {quickActionsOpen ? (
            <QuickReplyBar
              onAction={(a) => void handleQuickAction(a)}
              onSavedReply={(body) => void handleSavedReply(body)}
              savedReplies={savedReplies}
              disabled={sending}
              variant={isWhatsApp ? "whatsapp" : "default"}
              onCollapse={() => setQuickActionsOpen(false)}
            />
          ) : null}
          {sessionClosed ? (
            <div className="wa-session-banner">
              <Clock size={16} strokeWidth={1.8} className="mt-0.5 shrink-0" aria-hidden />
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-[#92400E]">WhatsApp 24h session closed</div>
                <p className="mt-0.5 text-[11px] leading-snug text-[#A16207]">
                  Free-form replies are unavailable until the customer messages again. Your message may send as an approved template when available.
                </p>
              </div>
            </div>
          ) : null}
          <div
            className={`flex items-center gap-2 px-2 pb-[max(0.375rem,env(safe-area-inset-bottom))] sm:px-3 ${
              companyMode ? "py-1.5" : "py-2.5"
            } ${
              isWhatsApp ? "" : "border-t border-[var(--border)]"
            }`}
          >
            {!isWhatsApp ? (
              <button
                type="button"
                onClick={() => setQuickActionsOpen((open) => !open)}
                title={quickActionsOpen ? "Hide quick actions" : "Quick actions"}
                aria-expanded={quickActionsOpen}
                aria-label="Quick actions"
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all ${
                  quickActionsOpen
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "text-[var(--text-tertiary)] hover:bg-[var(--bg-quaternary)]"
                }`}
              >
                <FileText size={18} />
              </button>
            ) : null}
            {isWhatsApp && companyMode ? (
              <>
                <button
                  type="button"
                  onClick={() => setQuickActionsOpen((open) => !open)}
                  aria-expanded={quickActionsOpen}
                  aria-label="Quick replies"
                  title="Quick replies"
                  className={`wa-icon-btn-muted shrink-0 ${quickActionsOpen ? "!border-sales-brand-border !bg-sales-brand-soft" : ""}`}
                >
                  <Zap size={16} strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  onClick={() => setQuickActionsOpen(true)}
                  aria-label="Send asset"
                  title="Send asset"
                  className="wa-icon-btn-muted shrink-0"
                >
                  <Paperclip size={16} strokeWidth={1.8} />
                </button>
              </>
            ) : null}
            <input
              ref={composerRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void sendCustomMessage(input);
              }}
              placeholder={
                sessionClosed
                  ? "Free-form replies unavailable — may send as template…"
                  : companyMode
                    ? "Type a message..."
                    : "Type a WhatsApp reply..."
              }
              disabled={sending}
              aria-label="Type a WhatsApp reply"
              className={
                isWhatsApp
                  ? `wa-composer-input sm:text-[14px] ${sessionClosed ? "opacity-80" : ""}`
                  : "min-w-0 flex-1 rounded-full border border-[var(--border)] bg-[var(--surface-input)] px-4 py-2.5 text-[16px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--border-focus)] sm:text-[15px]"
              }
            />
            <button
              type="button"
              disabled={!input.trim() || sending}
              onClick={() => void sendCustomMessage(input)}
              aria-label="Send WhatsApp message"
              className={
                isWhatsApp
                  ? "wa-send-btn"
                  : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] transition-opacity disabled:opacity-40"
              }
            >
              <Send size={18} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      ) : (
        <div className="wa-composer shrink-0 bg-white px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] text-center text-xs font-medium text-[#667085]">
          Read-only — claim or assign this lead to send messages
        </div>
      )}

      {pricingPicker ? (
        <PremiumSheet
          eyebrow="Assets"
          title="Select package"
          description="Choose which pricing package to send."
          onClose={() => setPricingPicker(null)}
          labelledBy="pricing-picker-title"
          maxWidthClass="max-w-sm"
        >
          <div className="flex flex-col gap-2">
            {pricingPicker.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => void sendAsset("PRICING_PACKAGE", p.id)}
                className="rounded-[10px] border border-[#E4E7EC] bg-white px-3 py-2.5 text-left text-[13px] font-medium text-[#101828] transition-colors hover:bg-[#F9FAFB]"
              >
                {p.name}
              </button>
            ))}
          </div>
        </PremiumSheet>
      ) : null}

      {logCallOpen ? (
        <PremiumSheet
          eyebrow="Call log"
          title="Log call"
          description="Record the outcome and next step."
          onClose={() => setLogCallOpen(false)}
          labelledBy="inbox-log-call-title"
          maxWidthClass="max-w-lg"
        >
          <LogCallForm
            leadId={conversation.id}
            variant="compact"
            appearance="premium"
            onLogged={() => {
              setLogCallOpen(false);
              onMessagesChange();
              void fetch(`/api/inbox/conversations/${conversation.id}/messages`)
                .then((r) => r.json())
                .then((d: { messages?: InboxChatMessage[] }) => setMessages(d.messages ?? []));
            }}
          />
        </PremiumSheet>
      ) : null}

      <TransferDialog
        open={transferOpen}
        salespeople={salespeople}
        currentAssigneeId={conversation.assignedToId}
        onClose={() => setTransferOpen(false)}
        onTransfer={handleTransfer}
        whatsappMode={isWhatsApp}
      />
      {dealLead ? (
        <CreateDealSheet
          lead={dealLead}
          open={createDealOpen}
          onClose={() => setCreateDealOpen(false)}
          onCreated={() => {
            setCreateDealOpen(false);
            onConversationUpdate?.();
          }}
          currency={conversation.dealCurrency ?? "USD"}
        />
      ) : null}
    </div>
  );
}
