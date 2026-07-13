"use client";

import { MessageCircle, Phone } from "lucide-react";
import {
  chatContactSubtitle,
  displayChatContactName,
  formatChatPhone,
  formatChatSince,
} from "@/lib/inbox/whatsapp-display";
import type { InboxConversation } from "@/lib/inbox/types";
import { WhatsAppAvatar } from "./WhatsAppAvatar";
import { LeadIntentBadge } from "./LeadIntentBadge";

type Props = {
  conversation: InboxConversation;
};

export function WhatsAppChatLeadCard({ conversation }: Props) {
  const name = displayChatContactName(conversation);
  const subtitle = chatContactSubtitle(conversation);
  const phone = formatChatPhone(conversation.phone);
  const chatSince = formatChatSince(conversation.createdAt);

  return (
    <div className="relative overflow-hidden rounded-xl border border-[#E9EDEF] bg-white shadow-[0_1px_2px_rgba(17,27,33,0.04)]">
      <div className="absolute inset-y-0 left-0 w-1 bg-[#00A884]" aria-hidden />
      <div className="flex items-start gap-3 p-4 pl-5">
        <WhatsAppAvatar
          name={name}
          phone={conversation.phone}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-[17px] font-medium text-[#111B21]">{name}</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#E7FCE3] px-2 py-0.5 text-[10px] font-semibold text-[#008069]">
              <MessageCircle size={10} />
              WhatsApp chat
            </span>
            <LeadIntentBadge
              score={conversation.score}
              label={conversation.scoreLabel}
              variant="list"
            />
          </div>
          {subtitle ? (
            <p className="mt-0.5 truncate text-[13px] text-[#667781]">{subtitle}</p>
          ) : null}
          {phone ? (
            <div className="mt-1 flex items-center gap-1.5 text-[12px] text-[#8696A0]">
              <Phone size={12} className="shrink-0" />
              <span className="truncate">{phone}</span>
            </div>
          ) : null}
          {chatSince ? (
            <p className="mt-1 text-[11px] text-[#8696A0]">Chatting since {chatSince}</p>
          ) : null}
          {conversation.lastMessage && conversation.lastMessage !== "No messages yet" ? (
            <p className="mt-2 line-clamp-2 rounded-lg bg-[#F0F2F5] px-2.5 py-2 text-[12px] leading-snug text-[#54656F]">
              {conversation.lastMessage}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
