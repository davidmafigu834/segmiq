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
        <div className="mb-1 flex items-center gap-2 text-[#111B21]">
          <Mic size={16} />
          <span className="text-[13px]">Voice message</span>
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

  if (message.mediaMimeType?.startsWith("audio/")) {
    return <audio controls src={message.mediaUrl} className="mb-1 max-w-full" />;
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
        <span className="max-w-[85%] rounded-xl border border-dashed border-[#C9D4DC] bg-white/90 px-3.5 py-2.5 text-center text-[11px] text-[#61707E] shadow-[0_3px_10px_rgba(34,48,61,0.06)] backdrop-blur-sm">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-[#7B8996]">
            Internal note
          </span>
          {message.text}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex px-1 ${isRep ? "justify-end" : "justify-start"}`}>
      <div className={`relative max-w-[min(78%,520px)] ${isRep ? "wa-bubble-out" : "wa-bubble-in"}`}>
        <MediaBlock message={message} />
        {showText ? <div className="whitespace-pre-wrap break-words pr-1">{message.text}</div> : null}
        <div className="-mb-0.5 mt-0.5 flex items-center justify-end gap-1">
          <span className="text-[11px] leading-none text-[#667781]">{formatTime(message.createdAt)}</span>
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
