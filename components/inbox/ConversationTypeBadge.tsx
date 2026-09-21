"use client";

import type { ConversationType } from "@/lib/inbox/conversation-type";
import { CONVERSATION_TYPE_LABEL } from "@/lib/inbox/conversation-type";

export function ConversationTypeBadge({ type }: { type: ConversationType }) {
  const className =
    type === "SUPPORT"
      ? "text-sales-info"
      : type === "GENERAL"
        ? "text-sales-text-secondary"
        : "text-sales-text-secondary";

  return (
    <span className={`inline-flex shrink-0 text-[11px] font-medium ${className}`}>
      {CONVERSATION_TYPE_LABEL[type]}
    </span>
  );
}
