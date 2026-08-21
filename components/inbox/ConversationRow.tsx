"use client";

import type { InboxConversation } from "@/lib/inbox/types";
import { formatAwaitingReply, isFollowUpDue } from "@/lib/inbox/queue-filters";
import {
  formatRelativeMessageTime,
  getWaitingTone,
  waitingToneClass,
} from "@/lib/inbox/format-display";
import {
  CONVERSATION_TYPE_LABEL,
  supportStageLabel,
} from "@/lib/inbox/conversation-type";
import { displayContactName, WhatsAppAvatar } from "./WhatsAppAvatar";
import { ConversationTypeBadge } from "./ConversationTypeBadge";
import { LeadIntentBadge } from "./LeadIntentBadge";
import { initials } from "@/lib/inbox/assignee-colors";
import { Image as ImageIcon, Mic } from "lucide-react";
import { formatDealStage } from "@/lib/sales/deals/display";

type Props = {
  conversation: InboxConversation;
  active: boolean;
  currentRepName?: string;
  onSelect: () => void;
  onClaim: (leadId: string) => void;
  claiming: boolean;
  canClaim: boolean;
  companyMode?: boolean;
};

function previewIcon(messageType: string | null | undefined) {
  if (messageType === "image") return <ImageIcon size={14} className="shrink-0 text-sales-text-muted" />;
  if (messageType === "audio") return <Mic size={14} className="shrink-0 text-sales-text-muted" />;
  return null;
}

function rowContextLabel(conversation: InboxConversation): string {
  const typeLabel = CONVERSATION_TYPE_LABEL[conversation.conversationType].toUpperCase();
  if (conversation.conversationType === "SUPPORT") {
    const supportLabel = supportStageLabel(conversation.supportCase?.status ?? null);
    return `${typeLabel} · ${supportLabel}`;
  }
  if (conversation.activeDealId && conversation.dealStage) {
    return `${typeLabel} · ${formatDealStage(conversation.dealStage)}`;
  }
  if (!conversation.activeDealId) {
    return `${typeLabel} · No Deal`;
  }
  return typeLabel;
}

function companyStageBadge(conversation: InboxConversation): string | null {
  if (conversation.conversationStatus === "RESOLVED") return "Resolved";
  if (conversation.conversationType === "SUPPORT") {
    return supportStageLabel(conversation.supportCase?.status ?? null);
  }
  if (conversation.activeDealId && conversation.dealStage) {
    return formatDealStage(conversation.dealStage);
  }
  if (conversation.conversationStatus === "OPEN" && conversation.lastMessageDirection === "inbound") {
    return "Waiting on team";
  }
  return null;
}

export function ConversationRow({
  conversation,
  active,
  onSelect,
  onClaim,
  claiming,
  canClaim,
  companyMode = false,
}: Props) {
  const name = displayContactName(conversation);
  const waitingLabel = formatAwaitingReply(conversation.awaitingReplyMinutes);
  const waitingTone = getWaitingTone(conversation.awaitingReplyMinutes);
  const followUpDue = isFollowUpDue(conversation);
  const isUnassigned = !conversation.assignedToId;
  const unread = conversation.unread > 0;
  const contextLabel = !companyMode ? rowContextLabel(conversation) : null;
  const stageBadge = companyMode ? companyStageBadge(conversation) : null;

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
      className={`wa-conv-row ${active ? "wa-conv-row-active" : ""} ${companyMode ? "wa-conv-row-company" : ""}`}
      aria-current={active ? "true" : undefined}
      data-course-target="whatsapp-conversation-row"
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <WhatsAppAvatar name={name} phone={conversation.phone} size="sm" />
          {!companyMode && !conversation.activeDealId && conversation.conversationType !== "SUPPORT" ? (
            <LeadIntentBadge score={conversation.score} label={conversation.scoreLabel} variant="dot" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span
                  className={`truncate text-[13px] tracking-[-0.01em] text-sales-text-primary ${
                    unread ? "font-semibold" : "font-medium"
                  }`}
                >
                  {name}
                </span>
                {companyMode ? (
                  <>
                    <ConversationTypeBadge type={conversation.conversationType} />
                    {stageBadge ? (
                      <span className="inline-flex max-w-full truncate rounded px-1.5 py-0.5 text-[9px] font-semibold text-sales-text-secondary bg-sales-surface-subtle">
                        {stageBadge}
                      </span>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
            <span
              className={`shrink-0 text-[11px] tabular-nums font-medium ${
                unread && !companyMode ? "text-sales-whatsapp" : "text-sales-text-muted"
              }`}
            >
              {companyMode
                ? formatRelativeMessageTime(conversation.lastMessageAt)
                : waitingLabel || (followUpDue ? "Follow-up due" : formatRelativeMessageTime(conversation.lastMessageAt))}
            </span>
          </div>

          {contextLabel ? (
            <div className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
              {contextLabel}
            </div>
          ) : null}

          <div className={`${companyMode ? "mt-1" : "mt-1"} flex items-center gap-1.5 text-[12px] text-sales-text-secondary`}>
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
              {previewIcon(conversation.lastMessageType)}
              <span className={`truncate ${unread ? "font-medium text-sales-text-primary" : ""}`}>
                {conversation.lastMessage}
              </span>
            </div>
            {unread ? (
              <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-sales-whatsapp px-1 text-[10px] font-bold tabular-nums text-white">
                {conversation.unread > 9 ? "9+" : conversation.unread}
              </span>
            ) : null}
          </div>

          {companyMode ? (
            <div className="mt-1.5 flex min-w-0 items-center gap-2">
              {conversation.assignee ? (
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sales-surface-subtle text-[8px] font-semibold text-sales-text-secondary">
                    {initials(conversation.assignee.name)}
                  </span>
                  <span className="truncate text-[10px] font-medium text-sales-text-secondary">
                    {conversation.assignee.name}
                  </span>
                </div>
              ) : (
                <span className="text-[10px] font-medium text-[#D97706]">Unassigned</span>
              )}
              {waitingLabel && conversation.conversationStatus === "OPEN" && conversation.lastMessageDirection === "inbound" ? (
                <span className={`ml-auto shrink-0 text-[10px] font-medium tabular-nums ${waitingToneClass(waitingTone)}`}>
                  {waitingLabel}
                </span>
              ) : null}
            </div>
          ) : waitingLabel ? (
            <div className="mt-1">
              <span className={`text-[10px] font-medium tabular-nums ${waitingToneClass(waitingTone)}`}>
                {waitingLabel}
              </span>
            </div>
          ) : null}

          {isUnassigned && canClaim && !companyMode ? (
            <button
              type="button"
              disabled={claiming}
              onClick={(e) => {
                e.stopPropagation();
                onClaim(conversation.id);
              }}
              className="mt-1.5 rounded-md border border-sales-border bg-sales-surface px-1.5 py-0.5 text-[10px] font-semibold text-sales-text-primary hover:bg-sales-brand-soft disabled:opacity-50"
            >
              {claiming ? "Claiming…" : "Claim"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
