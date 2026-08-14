"use client";

import type { InboxConversation } from "@/lib/inbox/types";
import { formatAwaitingReply } from "@/lib/inbox/queue-filters";
import {
  conversationMetaLine,
  formatRelativeMessageTime,
  getWaitingTone,
  waitingToneClass,
} from "@/lib/inbox/format-display";
import { displayContactName, WhatsAppAvatar } from "./WhatsAppAvatar";
import { LeadStageBadge } from "./LeadStageBadge";
import { LeadIntentBadge } from "./LeadIntentBadge";
import { initials } from "@/lib/inbox/assignee-colors";
import { Image as ImageIcon, Mic } from "lucide-react";

type Props = {
  conversation: InboxConversation;
  active: boolean;
  currentRepName: string;
  onSelect: () => void;
  onClaim: (leadId: string) => void;
  claiming: boolean;
  canClaim: boolean;
  companyMode?: boolean;
};

function previewIcon(messageType: string | null | undefined) {
  if (messageType === "image") return <ImageIcon size={14} className="shrink-0 text-[#98A2B3]" />;
  if (messageType === "audio") return <Mic size={14} className="shrink-0 text-[#98A2B3]" />;
  return null;
}

export function ConversationRow({
  conversation,
  active,
  currentRepName,
  onSelect,
  onClaim,
  claiming,
  canClaim,
  companyMode = false,
}: Props) {
  const name = displayContactName(conversation);
  const waitingLabel = formatAwaitingReply(conversation.awaitingReplyMinutes);
  const waitingTone = getWaitingTone(conversation.awaitingReplyMinutes);
  const metaLine = companyMode ? null : conversationMetaLine(conversation, currentRepName);
  const isUnassigned = !conversation.assignedToId;
  const unread = conversation.unread > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`wa-conv-row ${active ? "wa-conv-row-active" : ""}`}
      aria-current={active ? "true" : undefined}
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <WhatsAppAvatar name={name} phone={conversation.phone} size="sm" />
          <LeadIntentBadge
            score={conversation.score}
            label={conversation.scoreLabel}
            variant="dot"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={`min-w-0 flex-1 truncate text-[13px] tracking-[-0.01em] text-[#101828] ${
                unread ? "font-semibold" : "font-medium"
              }`}
            >
              {name}
            </span>
            <span
              className={`shrink-0 text-[11px] tabular-nums font-medium ${
                unread ? "text-[#25D366]" : "text-[#98A2B3]"
              }`}
            >
              {formatRelativeMessageTime(conversation.lastMessageAt)}
            </span>
          </div>

          <div className={`${companyMode ? "mt-0.5" : "mt-1"} flex items-center gap-1.5 text-[12px] text-[#667085]`}>
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
              {previewIcon(conversation.lastMessageType)}
              <span className={`truncate ${unread ? "font-medium text-[#344054]" : ""}`}>
                {conversation.lastMessage}
              </span>
            </div>
            {unread ? (
              <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-[#25D366] px-1 text-[10px] font-bold tabular-nums text-white">
                {conversation.unread > 9 ? "9+" : conversation.unread}
              </span>
            ) : null}
          </div>

          <div className={`${companyMode ? "mt-1" : "mt-1.5"} flex min-w-0 flex-wrap items-center gap-1.5`}>
            <LeadStageBadge
              status={conversation.status}
              followUpDate={conversation.followUpDate}
              variant="list"
            />
            {waitingLabel ? (
              <span
                className={`text-[10px] font-medium tabular-nums ${waitingToneClass(waitingTone)}`}
                title="Customer is waiting for a reply"
              >
                {waitingLabel}
              </span>
            ) : null}
            {isUnassigned && canClaim ? (
              <button
                type="button"
                disabled={claiming}
                onClick={(e) => {
                  e.stopPropagation();
                  onClaim(conversation.id);
                }}
                className="rounded-md border border-[#E4E7EC] bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#101828] hover:bg-[#F4FCE8] disabled:opacity-50"
              >
                {claiming ? "Claiming…" : "Claim"}
              </button>
            ) : isUnassigned ? (
              <span className="text-[10px] font-medium text-[#98A2B3]">Unassigned</span>
            ) : null}
            {companyMode && conversation.assignee ? (
              <span
                className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F2F4F7] px-1 text-[8px] font-semibold text-[#667085]"
                title={`Owner: ${conversation.assignee.name}`}
                aria-label={`Owner: ${conversation.assignee.name}`}
              >
                {initials(conversation.assignee.name)}
              </span>
            ) : null}
          </div>

          {metaLine ? (
            <div className="mt-1 truncate text-[11px] text-[#98A2B3]" title={metaLine}>
              {metaLine}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
