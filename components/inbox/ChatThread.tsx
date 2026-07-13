"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  MoreHorizontal,
  Paperclip,
  Phone,
  Send,
  Smile,
  Target,
} from "lucide-react";
import type { InboxChatMessage, InboxConversation } from "@/lib/inbox/types";
import { LogCallForm } from "@/components/leads/LogCallForm";
import { groupMessagesByDay, MessageBubble } from "./MessageBubble";
import { LeadStageBadge } from "./LeadStageBadge";
import { QuickReplyBar, type QuickReplyAction } from "./QuickReplyBar";
import { displayContactName, WhatsAppAvatar } from "./WhatsAppAvatar";

type Props = {
  conversation: InboxConversation | null;
  clientId: string;
  canSend: boolean;
  showLogCall: boolean;
  onBack?: () => void;
  onToggleIntel: () => void;
  onMessagesChange: () => void;
};

export function ChatThread({
  conversation,
  clientId,
  canSend,
  showLogCall,
  onBack,
  onToggleIntel,
  onMessagesChange,
}: Props) {
  const [messages, setMessages] = useState<InboxChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [logCallOpen, setLogCallOpen] = useState(false);
  const [pricingPicker, setPricingPicker] = useState<{ id: string; name: string }[] | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const onMessagesChangeRef = useRef(onMessagesChange);
  onMessagesChangeRef.current = onMessagesChange;

  useEffect(() => {
    stickToBottomRef.current = true;
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

  if (!conversation) {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col items-center justify-center bg-[#EFEAE2] text-sm text-[#667781]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.04) 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      >
        <div className="rounded-lg bg-white/80 px-6 py-4 text-center shadow-sm">
          Select a chat to start messaging
        </div>
      </div>
    );
  }

  const name = displayContactName(conversation);
  const messageGroups = groupMessagesByDay(messages);
  const isWhatsApp = conversation.source === "WHATSAPP_INBOUND";

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-[#EFEAE2]">
      <div
        className={`flex h-16 shrink-0 items-center justify-between px-2 sm:px-4 ${
          isWhatsApp ? "bg-[#008069] text-white" : "border-b border-[var(--border)] bg-[var(--bg-primary)]"
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              title="Back to chats"
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all ${
                isWhatsApp ? "text-white hover:bg-white/10" : "text-[var(--text-tertiary)] hover:bg-[var(--bg-quaternary)]"
              }`}
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
              <div className={`flex items-center gap-2 truncate text-[16px] font-normal ${isWhatsApp ? "text-white" : "text-[var(--text-primary)]"}`}>
                <span className="truncate">{name}</span>
                <LeadStageBadge
                  status={conversation.status}
                  followUpDate={conversation.followUpDate}
                  variant={isWhatsApp ? "header" : "default"}
                />
              </div>
              <div className={`truncate text-[13px] ${isWhatsApp ? "text-[#D9FDD3]" : "text-[var(--text-tertiary)]"}`}>
                {conversation.phone}
                {conversation.location ? ` · ${conversation.location}` : ""}
                {isWhatsApp ? " · tap for lead info" : ""}
              </div>
            </div>
          </button>
        </div>
        <div className="flex items-center gap-1">
          {showLogCall ? (
            <button
              type="button"
              onClick={() => setLogCallOpen(true)}
              title="Log call"
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                isWhatsApp ? "text-white/80 hover:bg-white/10" : "text-[var(--text-tertiary)] hover:bg-[var(--bg-quaternary)]"
              }`}
            >
              <Phone size={16} />
            </button>
          ) : null}
          <button
            type="button"
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
              isWhatsApp ? "text-white/80 hover:bg-white/10" : "text-[var(--text-tertiary)] hover:bg-[var(--bg-quaternary)]"
            }`}
          >
            <MoreHorizontal size={16} />
          </button>
          <button
            type="button"
            onClick={onToggleIntel}
            title="Lead details"
            className={`toggle-intel flex h-8 w-8 items-center justify-center rounded-full transition-all max-[1180px]:flex min-[1181px]:hidden ${
              isWhatsApp ? "text-white/80 hover:bg-white/10" : "text-[var(--text-tertiary)] hover:bg-[var(--bg-quaternary)]"
            }`}
          >
            <Target size={16} />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="inbox-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.04) 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      >
        {loading ? (
          <div className="text-center text-sm text-[#667781]">Loading messages…</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm text-[#667781]">No messages yet</div>
        ) : (
          messageGroups.map((group) => (
            <div key={group.label} className="space-y-2">
              <div className="flex justify-center">
                <span className="rounded-lg bg-white/90 px-3 py-1 text-[11px] font-medium text-[#54656F] shadow-sm">
                  {group.label}
                </span>
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
        <>
          <QuickReplyBar onAction={(a) => void handleQuickAction(a)} disabled={sending} />
          {conversation.source === "WHATSAPP_INBOUND" && !sessionOpen ? (
            <div className="border-t border-[#E9EDEF] bg-[#FFF8E6] px-4 py-2 text-center text-[11px] text-[#B45309]">
              Outside the 24-hour WhatsApp window — your message will be sent as an approved template
            </div>
          ) : null}
          <div className="flex shrink-0 items-center gap-2 border-t border-[#E9EDEF] bg-[#F0F2F5] px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-3">
            <button
              type="button"
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-[#54656F] hover:bg-[#E9EDEF]"
            >
              <Paperclip size={16} />
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
                  : "Type a message…"
              }
              disabled={sending}
              className="min-w-0 flex-1 rounded-lg border border-white bg-white px-3 py-2.5 text-[16px] text-[#111B21] placeholder:text-[#667781] shadow-sm"
            />
            <button
              type="button"
              className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-[#54656F] hover:bg-[#E9EDEF]"
            >
              <Smile size={16} />
            </button>
            <button
              type="button"
              disabled={!input.trim() || sending}
              onClick={() => void sendCustomMessage(input)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00A884] text-white disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </div>
        </>
      ) : (
        <div className="border-t border-[#E9EDEF] bg-[#F0F2F5] px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-xs text-[#667781]">
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
    </div>
  );
}
