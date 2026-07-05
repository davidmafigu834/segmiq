"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import {
  MoreHorizontal,
  Paperclip,
  Phone,
  Send,
  Smile,
  Target,
} from "lucide-react";
import { initials } from "@/lib/inbox/assignee-colors";
import { stageStyle } from "@/lib/inbox/scoring";
import type { InboxChatMessage, InboxConversation } from "@/lib/inbox/types";
import { LogCallForm } from "@/components/leads/LogCallForm";
import { MessageBubble } from "./MessageBubble";
import { QuickReplyBar, type QuickReplyAction } from "./QuickReplyBar";

type Props = {
  conversation: InboxConversation | null;
  clientId: string;
  canSend: boolean;
  showLogCall: boolean;
  onToggleIntel: () => void;
  onMessagesChange: () => void;
};

export function ChatThread({
  conversation,
  clientId,
  canSend,
  showLogCall,
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

  useEffect(() => {
    if (!conversation?.id) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/inbox/conversations/${conversation.id}/messages`)
      .then((r) => r.json())
      .then((d: { messages?: InboxChatMessage[]; sessionOpen?: boolean }) => {
        if (!cancelled) {
          setMessages(d.messages ?? []);
          setSessionOpen(d.sessionOpen === true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conversation?.id]);

  useEffect(() => {
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
        setInput("");
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
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center bg-[var(--bg-primary)] text-sm text-[var(--text-tertiary)]">
        Select a lead to view the conversation
      </div>
    );
  }

  const st = stageStyle(conversation.status, conversation.followUpDate);
  const name = conversation.name ?? "Unknown";

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-[var(--bg-primary)]">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border)] px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg-quaternary)] text-xs font-semibold text-[var(--text-secondary)]">
            {initials(name)}
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
              {name}
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                style={{ background: st.bg, color: st.text, border: `1px solid ${st.border}` }}
              >
                {conversation.stageLabel}
              </span>
            </div>
            <div className="text-xs text-[var(--text-tertiary)]">
              {[conversation.phone, conversation.location].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {showLogCall ? (
            <button
              type="button"
              onClick={() => setLogCallOpen(true)}
              title="Log call"
              className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[var(--text-tertiary)] transition-all hover:bg-[var(--bg-quaternary)] hover:text-[var(--text-secondary)]"
            >
              <Phone size={16} />
            </button>
          ) : null}
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[var(--text-tertiary)] transition-all hover:bg-[var(--bg-quaternary)] hover:text-[var(--text-secondary)]"
          >
            <MoreHorizontal size={16} />
          </button>
          <button
            type="button"
            onClick={onToggleIntel}
            title="Lead details"
            className="toggle-intel flex h-8 w-8 items-center justify-center rounded-[10px] text-[var(--text-tertiary)] transition-all hover:bg-[var(--bg-quaternary)] hover:text-[var(--text-secondary)] max-[1180px]:flex min-[1181px]:hidden"
          >
            <Target size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 py-5">
        <div className="mb-1 text-center text-[11px] text-[var(--text-tertiary)]">
          {format(new Date(), "MMMM d, yyyy")}
        </div>
        {loading ? (
          <div className="text-center text-sm text-[var(--text-tertiary)]">Loading messages…</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm text-[var(--text-tertiary)]">No messages yet</div>
        ) : (
          messages.map((m, i) => (
            <div key={m.id} className={`ag-fade-in ag-delay-${Math.min(i + 1, 5)}`}>
              <MessageBubble message={m} />
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {canSend ? (
        <>
          <QuickReplyBar onAction={(a) => void handleQuickAction(a)} disabled={sending} />
          {conversation.source === "WHATSAPP_INBOUND" && !sessionOpen ? (
            <div className="border-t border-[var(--border)] px-4 py-2 text-center text-[11px] text-[var(--warning)]">
              Session closed — use a quick reply template or wait for the customer to message again
            </div>
          ) : null}
          <div className="flex shrink-0 items-center gap-2 border-t border-[var(--border)] px-4 py-3">
            <button
              type="button"
              className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] text-[var(--text-tertiary)] hover:bg-[var(--bg-quaternary)]"
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
                  ? "Session closed — quick replies still work"
                  : "Type a message…"
              }
              disabled={sending || (conversation.source === "WHATSAPP_INBOUND" && !sessionOpen)}
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
            />
            <button
              type="button"
              className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] text-[var(--text-tertiary)] hover:bg-[var(--bg-quaternary)]"
            >
              <Smile size={16} />
            </button>
            <button
              type="button"
              disabled={
                !input.trim() ||
                sending ||
                (conversation.source === "WHATSAPP_INBOUND" && !sessionOpen)
              }
              onClick={() => void sendCustomMessage(input)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </div>
        </>
      ) : (
        <div className="border-t border-[var(--border)] px-5 py-3 text-center text-xs text-[var(--text-tertiary)]">
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
