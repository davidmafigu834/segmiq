"use client";

import type { InboxConversation } from "@/lib/inbox/types";
import { formatAwaitingReply } from "@/lib/inbox/queue-filters";
import {
  formatRelativeMessageTime,
  getWaitingTone,
  waitingToneClass,
} from "@/lib/inbox/format-display";
import { displayContactName, WhatsAppAvatar } from "./WhatsAppAvatar";
import { LeadStageBadge } from "./LeadStageBadge";
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
      data-course-target="whatsapp-conversation-row"
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <WhatsAppAvatar name={name} phone={conversation.phone} size="sm" />
          {!conversation.activeDealId ? (
            <LeadIntentBadge
              score={conversation.score}
              label={conversation.scoreLabel}
              variant="dot"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={`min-w-0 flex-1 truncate text-[13px] tracking-[-0.01em] text-sales-text-primary ${
                unread ? "font-semibold" : "font-medium"
              }`}
            >
              {name}
            </span>
            <span
              className={`shrink-0 text-[11px] tabular-nums font-medium ${
                unread ? "text-sales-whatsapp" : "text-sales-text-muted"
              }`}
            >
              {formatRelativeMessageTime(conversation.lastMessageAt)}
            </span>
          </div>

          <div className={`${companyMode ? "mt-0.5" : "mt-1"} flex items-center gap-1.5 text-[12px] text-sales-text-secondary`}>
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

          <div className={`${companyMode ? "mt-1" : "mt-1.5"} flex min-w-0 flex-wrap items-center gap-1.5`}>
            {conversation.activeDealId && conversation.dealStage ? (
              <span className="inline-flex max-w-full items-center truncate rounded-full bg-sales-info-soft px-2 py-0.5 text-[10px] font-semibold leading-none text-sales-info">
                {formatDealStage(conversation.dealStage)}
              </span>
            ) : (
              <LeadStageBadge
                status={conversation.status}
                followUpDate={companyMode ? conversation.followUpDate : null}
                variant="list"
              />
            )}
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
                className="rounded-md border border-sales-border bg-sales-surface px-1.5 py-0.5 text-[10px] font-semibold text-sales-text-primary hover:bg-sales-brand-soft disabled:opacity-50"
              >
                {claiming ? "Claiming…" : "Claim"}
              </button>
            ) : isUnassigned ? (
              <span className="text-[10px] font-medium text-sales-text-muted">Unassigned</span>
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
        </div>
      </div>
    </div>
  );
}
