"use client";

import { format, isToday, isYesterday, parseISO } from "date-fns";
import type { InboxChatMessage } from "@/lib/inbox/types";
import { isMediaMessageType, isMediaPlaceholderBody } from "@/lib/inbox/media-placeholders";
import { Check, CheckCheck, FileText, Mic, Image as ImageIcon } from "lucide-react";

type Props = {
  message: InboxChatMessage;
};

function formatTime(iso: string): string {
  try {
    return format(parseISO(iso), "h:mm a");
  } catch {
    return "";
  }
}

function StatusTicks({ status }: { status?: InboxChatMessage["status"] | null }) {
  if (!status || status === "pending") return <Check size={14} className="text-[#8696A0]" />;
  if (status === "sent") return <Check size={14} className="text-[#8696A0]" />;
  if (status === "delivered") return <CheckCheck size={14} className="text-[#8696A0]" />;
  if (status === "read") return <CheckCheck size={14} className="text-[#53BDEB]" />;
  return <Check size={14} className="text-[#E74C3C]" />;
}

function MediaBlock({ message }: { message: InboxChatMessage }) {
  if (!message.mediaUrl) {
    const type = message.messageType;
    if (type === "audio") {
      return (
        <div className="mb-1 flex items-center gap-2 text-[#667781]">
          <Mic size={16} />
          <span className="text-[13px]">Voice message — media unavailable</span>
        </div>
      );
    }
    if (type === "image") {
      return (
        <div className="mb-1 flex items-center gap-2 text-[#111B21]">
          <ImageIcon size={16} />
          <span className="text-[13px]">Photo</span>
        </div>
      );
    }
    if (type === "document") {
      return (
        <div className="mb-1 flex items-center gap-2 text-[#111B21]">
          <FileText size={16} />
          <span className="text-[13px]">Document</span>
        </div>
      );
    }
    return null;
  }

  if (message.mediaMimeType?.startsWith("image/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={message.mediaUrl}
        alt=""
        className="mb-1 max-h-72 max-w-full rounded-md object-cover"
      />
    );
  }

  if (message.mediaMimeType?.startsWith("audio/") || message.messageType === "audio") {
    return (
      <audio controls preload="metadata" src={message.mediaUrl} className="mb-1 min-w-[220px] max-w-full" />
    );
  }

  if (message.mediaMimeType?.startsWith("video/")) {
    return <video controls src={message.mediaUrl} className="mb-1 max-h-72 max-w-full rounded-md" />;
  }

  return (
    <a
      href={message.mediaUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mb-1 inline-flex items-center gap-2 text-[13px] text-[#027EB5] underline"
    >
      <FileText size={16} />
      Open attachment
    </a>
  );
}

export function MessageBubble({ message }: Props) {
  const isRep = message.direction === "rep";
  const isSystem = message.kind === "system";
  const hasMediaUi =
    Boolean(message.mediaUrl) || isMediaMessageType(message.messageType);
  const showText =
    Boolean(message.text?.trim()) &&
    !(hasMediaUi && isMediaPlaceholderBody(message.text, message.messageType));

  if (isSystem) {
    return (
      <div className="flex justify-center px-2">
        <span className="wa-system-pill max-w-[90%] text-center">{message.text}</span>
      </div>
    );
  }

  if (message.kind === "internal") {
    return (
      <div className="flex justify-center px-2">
        <span className="max-w-[min(85%,480px)] rounded-[10px] border border-[#FDE68A] bg-[#FFFBEB] px-3.5 py-2.5 text-left text-[12px] text-[#92400E]">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#A16207]">
            Internal note
          </span>
          <span className="text-[#78350F]">{message.text}</span>
          <span className="mt-1.5 block text-[10px] text-[#A16207]">Only your team can see this</span>
        </span>
      </div>
    );
  }

  return (
    <div className={`flex px-1 ${isRep ? "justify-end" : "justify-start"}`}>
      <div className={`relative max-w-[min(68%,480px)] ${isRep ? "wa-bubble-out" : "wa-bubble-in"}`}>
        <MediaBlock message={message} />
        {showText ? <div className="whitespace-pre-wrap break-words pr-1 text-[13.5px] leading-[1.45] sm:text-[14px]">{message.text}</div> : null}
        <div className="-mb-0.5 mt-0.5 flex items-center justify-end gap-1">
          <span className="text-[11px] tabular-nums leading-none text-[#98A2B3]">{formatTime(message.createdAt)}</span>
          {isRep ? <StatusTicks status={message.status} /> : null}
        </div>
      </div>
    </div>
  );
}

export function formatChatDayLabel(iso: string): string {
  try {
    const date = parseISO(iso);
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    return format(date, "MMMM d, yyyy");
  } catch {
    return "";
  }
}

export function groupMessagesByDay(messages: InboxChatMessage[]) {
  const groups: Array<{ label: string; messages: InboxChatMessage[] }> = [];
  for (const message of messages) {
    const label = formatChatDayLabel(message.createdAt);
    const last = groups[groups.length - 1];
    if (last?.label === label) {
      last.messages.push(message);
    } else {
      groups.push({ label, messages: [message] });
    }
  }
  return groups;
}
