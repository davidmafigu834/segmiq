"use client";

import type { InboxFilter, InboxConversation } from "@/lib/inbox/types";
import { matchesInboxFilter, sortInboxConversations } from "@/lib/inbox/queue-filters";

export function applyInboxFilter(
  rows: InboxConversation[],
  filter: InboxFilter,
  search: string,
  userId: string
): InboxConversation[] {
  const q = search.trim().toLowerCase();
  const filtered = rows.filter((l) => {
    if (!matchesInboxFilter(l, filter, userId)) return false;
    if (!q) return true;
    const haystack = [
      l.name,
      l.whatsappProfileName,
      l.phone,
      l.location,
      l.company,
      l.projectType,
      l.dealName,
      l.dealStage,
      l.leadBudget,
      l.sourceLabel,
      l.assignee?.name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
  return sortInboxConversations(filtered, filter);
}
