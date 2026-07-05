"use client";

import { initials } from "@/lib/inbox/assignee-colors";
import { formatInboxTime, formatSource } from "@/lib/inbox/fetch-conversations";
import { scoreColor, stageStyle } from "@/lib/inbox/scoring";
import type { InboxConversation } from "@/lib/inbox/types";
import { AssigneeBadge } from "./AssigneeBadge";

type Props = {
  conversation: InboxConversation;
  active: boolean;
  currentRepName: string;
  onSelect: () => void;
  onClaim: (leadId: string) => void;
  claiming: boolean;
  canClaim: boolean;
};

export function ConversationRow({
  conversation,
  active,
  currentRepName,
  onSelect,
  onClaim,
  claiming,
  canClaim,
}: Props) {
  const st = stageStyle(conversation.status, conversation.followUpDate);
  const name = conversation.name ?? "Unknown";
  const assigneeName = conversation.assignee?.name ?? null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
      className={`conv-row px-4 py-3 border-b border-[var(--border)] cursor-pointer transition-colors ${
        active ? "bg-[var(--bg-quaternary)] border-l-2 border-l-[var(--accent)]" : "border-l-2 border-l-transparent hover:bg-[var(--bg-quaternary)]"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-quaternary)] text-xs font-semibold text-[var(--text-secondary)]">
            {initials(name)}
          </div>
          <AssigneeBadge
            assigneeName={assigneeName}
            currentRepName={currentRepName}
            claiming={claiming}
            onClaim={canClaim ? () => onClaim(conversation.id) : undefined}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium text-[var(--text-primary)]">{name}</span>
            <span className="shrink-0 text-[11px] text-[var(--text-tertiary)]">
              {formatInboxTime(conversation.lastMessageAt)}
            </span>
          </div>
          <div className="mt-0.5 truncate text-xs text-[var(--text-tertiary)]">
            {conversation.lastMessage}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
              style={{
                fontFamily: "var(--font-instrument-serif)",
                border: `1px solid ${scoreColor(conversation.score)}`,
                color: scoreColor(conversation.score),
              }}
            >
              {conversation.score}
            </span>
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{
                background: st.bg,
                color: st.text,
                border: `1px solid ${st.border}`,
              }}
            >
              {conversation.stageLabel}
            </span>
            <span className="rounded bg-[var(--bg-quaternary)] px-1.5 py-0.5 text-[10px] text-[var(--text-tertiary)]">
              {formatSource(conversation.source as string)}
            </span>
            {conversation.unread > 0 ? (
              <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-semibold text-[var(--accent-foreground)]">
                {conversation.unread > 9 ? "9+" : conversation.unread}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
