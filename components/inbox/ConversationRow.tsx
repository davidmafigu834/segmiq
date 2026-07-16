"use client";

import { formatInboxTime } from "@/lib/inbox/fetch-conversations";
import type { InboxConversation } from "@/lib/inbox/types";
import { formatAwaitingReply, formatDealValue } from "@/lib/inbox/queue-filters";
import { AssigneeBadge } from "./AssigneeBadge";
import { displayContactName, WhatsAppAvatar } from "./WhatsAppAvatar";
import { LeadStageBadge } from "./LeadStageBadge";
import { LeadIntentBadge } from "./LeadIntentBadge";
import { Image as ImageIcon, Mic } from "lucide-react";

type Props = {
  conversation: InboxConversation;
  active: boolean;
  currentRepName: string;
  onSelect: () => void;
  onClaim: (leadId: string) => void;
  claiming: boolean;
  canClaim: boolean;
};

function previewIcon(messageType: string | null | undefined) {
  if (messageType === "image") return <ImageIcon size={14} className="shrink-0 text-[var(--text-tertiary)]" />;
  if (messageType === "audio") return <Mic size={14} className="shrink-0 text-[var(--text-tertiary)]" />;
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
}: Props) {
  const name = displayContactName(conversation);
  const assigneeName = conversation.assignee?.name ?? null;
  const dealLabel = formatDealValue(conversation.dealValue, conversation.dealCurrency ?? "USD");
  const waitingLabel = formatAwaitingReply(conversation.awaitingReplyMinutes);
  const metaParts = [
    conversation.projectType,
    dealLabel,
    conversation.sourceLabel !== "WhatsApp" ? conversation.sourceLabel : null,
    assigneeName && assigneeName !== currentRepName ? assigneeName : null,
    conversation.company,
  ].filter(Boolean);
  const metaLine = metaParts.join(" · ");

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
      className={`wa-conv-row ${active ? "wa-conv-row-active" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <WhatsAppAvatar name={name} phone={conversation.phone} size="sm" />
          <LeadIntentBadge
            score={conversation.score}
            label={conversation.scoreLabel}
            variant="dot"
          />
          <AssigneeBadge
            assigneeName={assigneeName}
            currentRepName={currentRepName}
            claiming={claiming}
            onClaim={canClaim ? () => onClaim(conversation.id) : undefined}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">{name}</span>
            <span className={`shrink-0 text-[11px] font-medium ${conversation.unread > 0 ? "text-[var(--channel-whatsapp)]" : "text-[var(--text-tertiary)]"}`}>
              {formatInboxTime(conversation.lastMessageAt)}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)]">
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
              {previewIcon(conversation.lastMessageType)}
              <span className="truncate">{conversation.lastMessage}</span>
            </div>
            {(waitingLabel || conversation.unread > 0) ? (
              <div className="flex shrink-0 items-center gap-1">
                {waitingLabel ? (
                  <span className="rounded-md border border-[var(--warning-border)] bg-[var(--warning-muted)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--warning)]">
                    {waitingLabel}
                  </span>
                ) : null}
                {conversation.unread > 0 ? (
                  <span className="flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-[var(--channel-whatsapp)] px-1.5 text-[10px] font-bold text-white">
                    {conversation.unread > 9 ? "9+" : conversation.unread}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
            <LeadStageBadge
              status={conversation.status}
              followUpDate={conversation.followUpDate}
              variant="list"
            />
            {metaLine ? (
              <span className="min-w-0 truncate text-[11px] text-[var(--text-tertiary)]" title={metaLine}>
                {metaLine}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
