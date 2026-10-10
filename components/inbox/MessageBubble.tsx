"use client";

import { useEffect, useRef, useState } from "react";
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
        className="mb-1 max-h-72 max-w-full rounded-md object-cover max-[1099px]:mb-1.5 max-[1099px]:rounded-[14px]"
      />
    );
  }

  if (message.mediaMimeType?.startsWith("audio/") || message.messageType === "audio") {
    return (
      <audio controls preload="metadata" src={message.mediaUrl} className="mb-1 block w-full min-w-0 max-w-full" />
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

export function MessageBubble({ message, onTeach, grouped = false }: Props & { grouped?: boolean }) {
  const [menuPoint, setMenuPoint] = useState<{ x: number; y: number } | null>(null);
  const pressTimer = useRef<number | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const isRep = message.direction === "rep";
  const isSystem = message.kind === "system";
  const hasMediaUi =
    Boolean(message.mediaUrl) || isMediaMessageType(message.messageType);
  const showText =
    Boolean(message.text?.trim()) &&
    !(hasMediaUi && isMediaPlaceholderBody(message.text, message.messageType));

  useEffect(() => {
    if (!menuPoint) return;
    const close = () => setMenuPoint(null);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [menuPoint]);

  function clearPress() {
    if (pressTimer.current != null) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
    pressOrigin.current = null;
  }

  function openTeachMenu(x: number, y: number) {
    if (!onTeach) return;
    const width = 180;
    const left = Math.min(Math.max(8, x), window.innerWidth - width - 8);
    const top = Math.min(Math.max(8, y), window.innerHeight - 56);
    setMenuPoint({ x: left, y: top });
  }

  if (isSystem) {
    return (
      <div className="flex justify-center px-2 py-0.5">
        <div className="wa-timeline-card max-w-[min(92%,520px)] rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3.5 py-2.5 text-left">
          {message.systemTitle ? (
            <div className="wa-kicker mb-1">{message.systemTitle}</div>
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
        <div className="wa-internal-note max-w-[min(88%,480px)] rounded-[10px] border border-sales-warning/30 bg-sales-warning-soft px-3.5 py-2.5 text-left">
          <div className="wa-kicker mb-1 text-sales-warning-fg">
            Internal note · {author} · {formatTime(message.createdAt)}
          </div>
          <div className="whitespace-pre-wrap break-words text-[12.5px] leading-snug text-sales-text-primary">{message.text}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`wa-msg flex px-0.5 py-0.5 min-[1100px]:px-1 ${grouped ? "wa-msg-grouped" : ""} ${isRep ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative min-w-0 max-w-[min(88%,480px)] min-[1100px]:max-w-[min(68%,480px)] ${isRep ? "wa-bubble-out" : "wa-bubble-in"}`}
        onContextMenu={(event) => {
          if (!onTeach) return;
          event.preventDefault();
          openTeachMenu(event.clientX, event.clientY);
        }}
        onPointerDown={(event) => {
          if (!onTeach || event.pointerType === "mouse") return;
          pressOrigin.current = { x: event.clientX, y: event.clientY };
          pressTimer.current = window.setTimeout(() => {
            const origin = pressOrigin.current;
            if (origin) openTeachMenu(origin.x, origin.y);
          }, 520);
        }}
        onPointerMove={(event) => {
          const origin = pressOrigin.current;
          if (!origin) return;
          if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 8) clearPress();
        }}
        onPointerUp={clearPress}
        onPointerCancel={clearPress}
      >
        <MediaBlock message={message} />
        <div className="wa-bubble-copy">
          <div className="wa-bubble-meta">
            <span className="text-[11px] tabular-nums leading-none text-sales-text-muted max-[1099px]:text-[12px]">{formatTime(message.createdAt)}</span>
            {isRep ? <StatusTicks status={message.status} /> : null}
          </div>
          {showText ? (
            <div className="wa-bubble-text whitespace-pre-wrap break-words text-[13.5px] leading-[1.45] [overflow-wrap:anywhere] sm:text-[14px]">
              {message.text}
            </div>
          ) : null}
          {onTeach ? (
            <button
              type="button"
              onClick={onTeach}
              className="sr-only focus:not-sr-only focus:mt-1 focus:inline-flex focus:min-h-11 focus:items-center focus:text-[13px] focus:font-semibold focus:text-sales-text-primary"
            >
              Teach SegmiQ
            </button>
          ) : null}
        </div>
        {menuPoint && onTeach ? (
          <div
            role="menu"
            aria-label="Message actions"
            className="fixed z-30 min-w-[180px] rounded-[12px] border border-sales-border bg-sales-surface p-1 shadow-[0_8px_24px_rgba(0,0,0,0.28)]"
            style={{ left: menuPoint.x, top: menuPoint.y }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              className="flex min-h-11 w-full items-center rounded-[8px] px-3 text-left text-[14px] font-medium text-sales-text-primary hover:bg-sales-surface-hover"
              onClick={() => {
                setMenuPoint(null);
                onTeach();
              }}
            >
              Teach SegmiQ
            </button>
          </div>
        ) : null}
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
