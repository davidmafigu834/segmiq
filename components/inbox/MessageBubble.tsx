"use client";

import { format, isToday, isYesterday, parseISO } from "date-fns";
import type { InboxChatMessage } from "@/lib/inbox/types";
import { isMediaMessageType, isMediaPlaceholderBody } from "@/lib/inbox/media-placeholders";
import { Check, CheckCheck, FileText, Mic, Image as ImageIcon } from "lucide-react";

type Props = {
  message: InboxChatMessage;
  onTeach?: () => void;
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
        <div className="mb-1 flex items-center gap-2 text-sales-text-secondary">
          <Mic size={16} />
          <span className="text-[13px]">Voice message — media unavailable</span>
        </div>
      );
    }
    if (type === "image") {
      return (
        <div className="mb-1 flex items-center gap-2 text-sales-text-primary">
          <ImageIcon size={16} />
          <span className="text-[13px]">Photo</span>
        </div>
      );
    }
    if (type === "document") {
      return (
        <div className="mb-1 flex items-center gap-2 text-sales-text-primary">
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

export function MessageBubble({ message, onTeach }: Props) {
  const isRep = message.direction === "rep";
  const isSystem = message.kind === "system";
  const hasMediaUi =
    Boolean(message.mediaUrl) || isMediaMessageType(message.messageType);
  const showText =
    Boolean(message.text?.trim()) &&
    !(hasMediaUi && isMediaPlaceholderBody(message.text, message.messageType));

  if (isSystem) {
    return (
      <div className="flex justify-center px-2 py-0.5">
        <div className="wa-timeline-card max-w-[min(92%,520px)] rounded-[10px] border border-[#E4E7EC] bg-[#F8FAFC] px-3.5 py-2.5 text-left">
          {message.systemTitle ? (
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#475467]">
              {message.systemTitle}
            </div>
          ) : null}
          <div className="text-[12.5px] leading-snug text-sales-text-primary">{message.text}</div>
          <div className="mt-1.5 flex items-center justify-between gap-3">
            <span className="text-[10px] tabular-nums text-sales-text-muted">{formatTime(message.createdAt)}</span>
            {message.href ? (
              <a
                href={message.href}
                className="text-[11px] font-medium text-sales-text-secondary underline-offset-2 hover:text-sales-text-primary hover:underline"
              >
                {message.hrefLabel || "Open"}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (message.kind === "internal") {
    const author = message.actorName ?? "Team";
    return (
      <div className="flex justify-center px-2 py-0.5">
        <div className="wa-internal-note max-w-[min(88%,480px)] rounded-[10px] border border-[#E7DCC8] bg-[#FBF7F0] px-3.5 py-2.5 text-left">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8A6D3B]">
            Internal note · {author} · {formatTime(message.createdAt)}
          </div>
          <div className="whitespace-pre-wrap text-[12.5px] leading-snug text-[#3F3A33]">{message.text}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex px-1 py-0.5 ${isRep ? "justify-end" : "justify-start"}`}>
      <div className={`relative max-w-[min(68%,480px)] ${isRep ? "wa-bubble-out" : "wa-bubble-in"}`}>
        <MediaBlock message={message} />
        {showText ? <div className="whitespace-pre-wrap break-words pr-1 text-[13.5px] leading-[1.45] sm:text-[14px]">{message.text}</div> : null}
        <div className="-mb-0.5 mt-0.5 flex items-center justify-end gap-1">
          {onTeach ? (
            <button
              type="button"
              onClick={onTeach}
              className="mr-auto text-[10px] font-medium text-sales-text-muted hover:text-sales-text-primary"
            >
              Teach SegmiQ
            </button>
          ) : null}
          <span className="text-[11px] tabular-nums leading-none text-sales-text-muted">{formatTime(message.createdAt)}</span>
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
