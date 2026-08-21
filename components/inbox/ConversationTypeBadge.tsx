"use client";

import type { ConversationType } from "@/lib/inbox/conversation-type";
import { CONVERSATION_TYPE_LABEL } from "@/lib/inbox/conversation-type";

export function ConversationTypeBadge({ type }: { type: ConversationType }) {
  const className =
    type === "SUPPORT"
      ? "bg-[#EFF8FF] text-[#175CD3]"
      : type === "GENERAL"
        ? "bg-sales-surface-subtle text-sales-text-secondary"
        : "bg-[rgba(37,211,102,0.1)] text-[#168A42]";

  return (
    <span
      className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.04em] ${className}`}
    >
      {CONVERSATION_TYPE_LABEL[type]}
    </span>
  );
}
