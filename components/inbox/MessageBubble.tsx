"use client";

import { format, parseISO } from "date-fns";
import type { InboxChatMessage } from "@/lib/inbox/types";
import { CheckCheck } from "lucide-react";

type Props = {
  message: InboxChatMessage;
};

function formatTime(iso: string): string {
  try {
    const d = parseISO(iso);
    const now = new Date();
    const sameDay =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    if (sameDay) return format(d, "h:mm a");
    return format(d, "MMM d, h:mm a");
  } catch {
    return "";
  }
}

export function MessageBubble({ message }: Props) {
  const isRep = message.direction === "rep";
  const isSystem = message.kind === "system";

  if (isSystem) {
    return (
      <div className="ag-fade-in flex justify-center">
        <span className="rounded-full border border-[var(--border)] bg-[var(--surface-card)] px-3 py-1 text-[11px] text-[var(--text-tertiary)]">
          {message.text}
        </span>
      </div>
    );
  }

  return (
    <div className={`ag-fade-in flex ${isRep ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[70%] px-3.5 py-2.5 text-sm text-[var(--text-primary)] ${
          isRep
            ? "rounded-[14px_14px_3px_14px] border border-[rgba(212,255,79,0.25)] bg-[rgba(212,255,79,0.1)]"
            : "rounded-[14px_14px_14px_3px] border border-[var(--border)] bg-[var(--surface-card)]"
        }`}
      >
        <div>{message.text}</div>
        <div className="mt-1 flex items-center justify-end gap-1">
          <span className="text-[10px] text-[var(--text-tertiary)]">{formatTime(message.createdAt)}</span>
          {isRep ? <CheckCheck size={12} className="text-[var(--text-tertiary)]" /> : null}
        </div>
      </div>
    </div>
  );
}
