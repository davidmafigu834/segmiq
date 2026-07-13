"use client";

import { formatInboxTime } from "@/lib/inbox/fetch-conversations";
import type { InboxConversation } from "@/lib/inbox/types";
import { chatContactSubtitle, displayChatContactName, isWhatsAppChatLead } from "@/lib/inbox/whatsapp-display";
import { AssigneeBadge } from "./AssigneeBadge";
import { WhatsAppAvatar } from "./WhatsAppAvatar";
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
  if (messageType === "image") return <ImageIcon size={14} className="shrink-0 text-[#8696A0]" />;
  if (messageType === "audio") return <Mic size={14} className="shrink-0 text-[#8696A0]" />;
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
  const name = displayChatContactName(conversation);
  const subtitle = chatContactSubtitle(conversation);
  const isChat = isWhatsAppChatLead(conversation.source);
  const assigneeName = conversation.assignee?.name ?? null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
      className={`cursor-pointer border-b border-[#E9EDEF] px-3 py-3 transition-colors ${
        active ? "bg-[#F0F2F5]" : "bg-white hover:bg-[#F5F6F6]"
      }`}
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
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1">
              <span className="truncate text-[16px] font-normal text-[#111B21]">{name}</span>
              <LeadIntentBadge
                score={conversation.score}
                label={conversation.scoreLabel}
                variant="list"
              />
            </div>
            <span className={`shrink-0 text-[12px] ${conversation.unread > 0 ? "text-[#00A884] font-medium" : "text-[#667781]"}`}>
              {formatInboxTime(conversation.lastMessageAt)}
            </span>
          </div>
          {subtitle || isChat ? (
            <div className="mt-0.5 truncate text-[12px] text-[#8696A0]">
              {subtitle || "WhatsApp chat"}
            </div>
          ) : null}
          <div className="mt-0.5 flex items-center gap-1 truncate text-[13px] text-[#667781]">
            {previewIcon(conversation.lastMessageType)}
            <span className="truncate">{conversation.lastMessage}</span>
            {conversation.unread > 0 ? (
              <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#00A884] px-1.5 text-[11px] font-semibold text-white">
                {conversation.unread > 9 ? "9+" : conversation.unread}
              </span>
            ) : null}
          </div>
          <div className="mt-1.5">
            <LeadStageBadge
              status={conversation.status}
              followUpDate={conversation.followUpDate}
              variant="list"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
