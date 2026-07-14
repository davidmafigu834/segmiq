"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  MoreHorizontal,
  Phone,
  Plus,
  Send,
  Smile,
  StickyNote,
  Target,
  Trophy,
  XCircle,
} from "lucide-react";
import type { InboxChatMessage, InboxConversation } from "@/lib/inbox/types";
import { formatAwaitingReply, formatDealValue } from "@/lib/inbox/queue-filters";
import { applyQuickReplyVariables } from "@/lib/inbox/quick-reply-vars";
import { LogCallForm } from "@/components/leads/LogCallForm";
import { groupMessagesByDay, MessageBubble } from "./MessageBubble";
import { LeadStageBadge } from "./LeadStageBadge";
import { LeadIntentBadge } from "./LeadIntentBadge";
import { QuickReplyBar, type QuickReplyAction, type SavedQuickReply } from "./QuickReplyBar";
import { displayContactName, WhatsAppAvatar } from "./WhatsAppAvatar";
import { TransferDialog } from "./TransferDialog";

type Props = {
  conversation: InboxConversation | null;
  clientId: string;
  userId: string;
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
};

export function ChatThread({
  conversation,
  clientId,
  userId,
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
  const [savedReplies, setSavedReplies] = useState<SavedQuickReply[]>([]);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const onMessagesChangeRef = useRef(onMessagesChange);
  onMessagesChangeRef.current = onMessagesChange;

  useEffect(() => {
    stickToBottomRef.current = true;
    setQuickActionsOpen(false);
    setMenuOpen(false);
  }, [conversation?.id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function onScroll() {
      const node = scrollRef.current;
      if (!node) return;
      const threshold = 96;
      stickToBottomRef.current =
        node.scrollHeight - node.scrollTop - node.clientHeight < threshold;
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
        const d = (await res.json()) as { messages?: InboxChatMessage[]; sessionOpen?: boolean };
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
          setSessionOpen(d.sessionOpen === true);
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
    if (!stickToBottomRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, conversation?.id]);

  async function sendCustomMessage(text: string) {
    if (!conversation || !text.trim() || sending) return;
    setSending(true);
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
        setSessionOpen(data.sessionOpen === true);
      } else if (isWhatsApp) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        window.alert(err.error ?? "Could not send message");
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
        window.alert(err.error ?? "Could not send message");
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

  if (!conversation) {
    return (
      <div className="wa-chat-wallpaper flex h-full min-h-0 min-w-0 flex-1 flex-col items-center justify-center text-sm text-[#667781]">
        <div className="wa-empty-hint text-center">
          <div className="mb-1 text-[15px] font-medium text-[#111B21]">Your WhatsApp inbox</div>
          Select a conversation from the list to view messages and reply
        </div>
      </div>
    );
  }

  const name = displayContactName(conversation);
  const messageGroups = groupMessagesByDay(messages);
  const isWhatsApp = conversation.source === "WHATSAPP_INBOUND";
  const dealLabel = formatDealValue(conversation.dealValue, conversation.dealCurrency ?? "USD");
  const waitingLabel = formatAwaitingReply(conversation.awaitingReplyMinutes);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <div
        className={`flex h-[60px] shrink-0 items-center justify-between px-2 sm:px-4 max-[1180px]:min-h-[calc(60px+env(safe-area-inset-top))] max-[1180px]:pt-[env(safe-area-inset-top)] ${
          isWhatsApp ? "wa-header text-white" : "border-b border-[var(--border)] bg-[var(--bg-primary)]"
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              title="Back to chats"
              className={isWhatsApp ? "wa-icon-btn shrink-0" : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--text-tertiary)] transition-all hover:bg-[var(--bg-quaternary)]"}
            >
              <ArrowLeft size={20} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onToggleIntel}
            className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left transition-colors sm:gap-3 sm:px-0 ${
              isWhatsApp ? "hover:bg-white/10" : "hover:bg-[var(--bg-quaternary)]"
            }`}
          >
            <WhatsAppAvatar name={name} phone={conversation.phone} size="sm" />
            <div className="min-w-0">
              <div className={`flex flex-wrap items-center gap-1.5 truncate text-[16px] font-medium ${isWhatsApp ? "text-white" : "text-[var(--text-primary)]"}`}>
                <span className="truncate">{name}</span>
                <LeadIntentBadge
                  score={conversation.score}
                  label={conversation.scoreLabel}
                  variant={isWhatsApp ? "header" : "default"}
                  showScore
                />
                <LeadStageBadge
                  status={conversation.status}
                  followUpDate={conversation.followUpDate}
                  variant={isWhatsApp ? "header" : "default"}
                />
              </div>
              <div className={`truncate text-[13px] ${isWhatsApp ? "text-[#D9FDD3]" : "text-[var(--text-tertiary)]"}`}>
                {conversation.phone}
                {conversation.location ? ` · ${conversation.location}` : ""}
                {dealLabel ? ` · ${dealLabel}` : ""}
                {waitingLabel ? ` · ${waitingLabel}` : ""}
                {isWhatsApp ? " · tap for lead info" : ""}
              </div>
            </div>
          </button>
        </div>
        <div className="relative flex items-center gap-1">
          {showLogCall ? (
            <button
              type="button"
              onClick={() => setLogCallOpen(true)}
              title="Log call"
              className={isWhatsApp ? "wa-icon-btn !h-9 !w-9" : "flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-tertiary)] transition-all hover:bg-[var(--bg-quaternary)]"}
            >
              <Phone size={16} />
            </button>
          ) : null}
          {canSend ? (
            <button
              type="button"
              onClick={() => void handleInternalNote()}
              title="Internal note"
              className={isWhatsApp ? "wa-icon-btn !h-9 !w-9" : "flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-tertiary)] transition-all hover:bg-[var(--bg-quaternary)]"}
            >
              <StickyNote size={16} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            title="Actions"
            className={isWhatsApp ? "wa-icon-btn !h-9 !w-9" : "flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-tertiary)] transition-all hover:bg-[var(--bg-quaternary)]"}
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen ? (
            <div className={`absolute right-0 top-11 z-20 min-w-[200px] ${isWhatsApp ? "wa-dropdown" : "rounded-lg border border-[var(--border)] bg-[var(--surface-card)] py-1 shadow-lg"}`}>
              {canTransfer ? (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setTransferOpen(true);
                  }}
                  className="flex w-full px-3 py-2 text-left text-sm text-[#111B21] hover:bg-[#F5F6F6]"
                >
                  Transfer conversation
                </button>
              ) : null}
              {canUpdateStatus ? (
                <>
                  <button
                    type="button"
                    disabled={statusUpdating}
                    onClick={() => void handleStatusUpdate("WON")}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#008069] hover:bg-[#F5F6F6] disabled:opacity-50"
                  >
                    <Trophy size={14} />
                    Mark as won
                  </button>
                  <button
                    type="button"
                    disabled={statusUpdating}
                    onClick={() => void handleStatusUpdate("LOST")}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-[#F5F6F6] disabled:opacity-50"
                  >
                    <XCircle size={14} />
                    Mark as lost
                  </button>
                </>
              ) : null}
              {!canTransfer && !canUpdateStatus ? (
                <div className="px-3 py-2 text-xs text-[#8696A0]">No actions available</div>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            onClick={onToggleIntel}
            title="Lead details"
            className={`toggle-intel max-[1180px]:flex min-[1181px]:hidden ${
              isWhatsApp ? "wa-icon-btn !h-9 !w-9" : "flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-tertiary)] transition-all hover:bg-[var(--bg-quaternary)]"
            }`}
          >
            <Target size={16} />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="wa-chat-wallpaper inbox-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-4 sm:px-5"
      >
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="wa-empty-hint">Loading messages…</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="wa-empty-hint">No messages yet — say hello to start the conversation</span>
          </div>
        ) : (
          messageGroups.map((group) => (
            <div key={group.label} className="space-y-1.5">
              <div className="flex justify-center py-1">
                <span className="wa-day-pill">{group.label}</span>
              </div>
              {group.messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {canSend ? (
        <div className={`shrink-0 ${isWhatsApp ? "wa-composer" : "border-t border-[var(--border)] bg-[var(--bg-tertiary)]"}`}>
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
          {conversation.source === "WHATSAPP_INBOUND" && !sessionOpen ? (
            <div className={`border-t px-4 py-2.5 text-center text-[11px] leading-snug ${
              isWhatsApp
                ? "border-[#E9EDEF] bg-[#FFF8E6] text-[#B45309]"
                : "border-[var(--border)] bg-[var(--accent-muted)] text-[var(--accent)]"
            }`}
            >
              Outside the 24-hour WhatsApp window — your message will be sent as an approved template
            </div>
          ) : null}
          <div className={`flex items-center gap-2 px-2 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:px-3 ${
            isWhatsApp ? "" : "border-t border-[var(--border)]"
          }`}
          >
            <button
              type="button"
              onClick={() => setQuickActionsOpen((open) => !open)}
              title={quickActionsOpen ? "Hide quick actions" : "Quick actions"}
              aria-expanded={quickActionsOpen}
              className={
                isWhatsApp
                  ? `wa-plus-btn ${quickActionsOpen ? "wa-plus-btn-open" : ""}`
                  : `flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all ${
                      quickActionsOpen
                        ? "rotate-45 bg-[var(--accent)] text-[var(--accent-foreground)]"
                        : "text-[var(--text-tertiary)] hover:bg-[var(--bg-quaternary)]"
                    }`
              }
            >
              <Plus size={20} strokeWidth={2.25} />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void sendCustomMessage(input);
              }}
              placeholder={
                conversation.source === "WHATSAPP_INBOUND" && !sessionOpen
                  ? "Type your message — sent as a WhatsApp template"
                  : "Type a message"
              }
              disabled={sending}
              className={
                isWhatsApp
                  ? "wa-composer-input sm:text-[15px]"
                  : "min-w-0 flex-1 rounded-full border border-[var(--border)] bg-[var(--surface-input)] px-4 py-2.5 text-[16px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--border-focus)] sm:text-[15px]"
              }
            />
            <button
              type="button"
              className={
                isWhatsApp
                  ? "wa-icon-btn-muted !h-10 !w-10"
                  : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-quaternary)]"
              }
            >
              <Smile size={18} />
            </button>
            <button
              type="button"
              disabled={!input.trim() || sending}
              onClick={() => void sendCustomMessage(input)}
              className={
                isWhatsApp
                  ? "wa-send-btn"
                  : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] transition-opacity disabled:opacity-40"
              }
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      ) : (
        <div className="wa-composer shrink-0 px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] text-center text-xs text-[#667781]">
          Read-only — assign this lead to send messages
        </div>
      )}

      {pricingPicker ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
          <div className="w-full max-w-sm rounded-t-2xl border border-[var(--border)] bg-[var(--surface-card)] p-5 sm:rounded-xl">
            <p className="mb-3 text-sm font-medium text-[var(--text-primary)]">Select package</p>
            <div className="flex flex-col gap-2">
              {pricingPicker.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void sendAsset("PRICING_PACKAGE", p.id)}
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                >
                  {p.name}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPricingPicker(null)}
              className="mt-3 w-full text-xs text-[var(--text-tertiary)]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {logCallOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLogCallOpen(false);
          }}
        >
          <div className="max-h-[min(92dvh,100dvh)] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--surface-card)] p-5 sm:rounded-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Log call</h3>
              <button
                type="button"
                onClick={() => setLogCallOpen(false)}
                className="text-sm text-[var(--text-tertiary)]"
              >
                Close
              </button>
            </div>
            <LogCallForm
              leadId={conversation.id}
              variant="compact"
              onLogged={() => {
                setLogCallOpen(false);
                onMessagesChange();
                void fetch(`/api/inbox/conversations/${conversation.id}/messages`)
                  .then((r) => r.json())
                  .then((d: { messages?: InboxChatMessage[] }) => setMessages(d.messages ?? []));
              }}
            />
          </div>
        </div>
      ) : null}

      <TransferDialog
        open={transferOpen}
        salespeople={salespeople}
        currentAssigneeId={conversation.assignedToId}
        onClose={() => setTransferOpen(false)}
        onTransfer={handleTransfer}
        whatsappMode={isWhatsApp}
      />
    </div>
  );
}
