"use client";

import Link from "next/link";
import type { InboxFilter, InboxConversation } from "@/lib/inbox/types";
import { initials } from "@/lib/inbox/assignee-colors";
import { SCORE_HOT_MIN } from "@/lib/inbox/scoring";
import { ConversationRow } from "./ConversationRow";
import { FilterTabs } from "./FilterTabs";
import { ArrowLeft, Search } from "lucide-react";

type Props = {
  conversations: InboxConversation[];
  activeId: string | null;
  filter: InboxFilter;
  search: string;
  currentRepName: string;
  currentUserId: string;
  onSelect: (id: string) => void;
  onClaim: (leadId: string) => void;
  claimingId: string | null;
  open: boolean;
  canClaim: boolean;
  whatsappMode?: boolean;
  mobileFullScreen?: boolean;
  onSearchChange?: (value: string) => void;
  backHref?: string;
  roleSubtitle?: string;
  filterCounts?: Record<InboxFilter, number>;
  onFilterChange?: (filter: InboxFilter) => void;
};

function matchesSearch(conversation: InboxConversation, q: string): boolean {
  if (!q) return true;
  const haystack = [
    conversation.name,
    conversation.whatsappProfileName,
    conversation.phone,
    conversation.location,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function applyFilter(
  rows: InboxConversation[],
  filter: InboxFilter,
  search: string,
  currentUserId: string
): InboxConversation[] {
  const q = search.trim().toLowerCase();
  return rows.filter((l) => {
    if (filter === "unassigned" && l.assignedToId) return false;
    if (filter === "mine" && l.assignedToId !== currentUserId) return false;
    if (filter === "hot" && l.score < SCORE_HOT_MIN) return false;
    if (!matchesSearch(l, q)) return false;
    return true;
  });
}

export function ConversationList({
  conversations,
  activeId,
  filter,
  search,
  currentRepName,
  currentUserId,
  onSelect,
  onClaim,
  claimingId,
  open,
  canClaim,
  whatsappMode = false,
  mobileFullScreen = false,
  onSearchChange,
  backHref,
  roleSubtitle,
  filterCounts,
  onFilterChange,
}: Props) {
  const filtered = applyFilter(conversations, filter, search, currentUserId);
  const mobileTop = whatsappMode ? "max-[860px]:top-0" : "max-[860px]:top-16";
  const mobilePanelClass = mobileFullScreen
    ? open
      ? "max-[860px]:fixed max-[860px]:inset-0 max-[860px]:z-40 max-[860px]:flex max-[860px]:w-full max-[860px]:translate-x-0 max-[860px]:shadow-none"
      : "max-[860px]:hidden"
    : open
      ? "max-[860px]:translate-x-0"
      : "max-[860px]:-translate-x-full";

  return (
    <div
      id="convPanel"
      className={[
        "flex h-full min-h-0 shrink-0 flex-col",
        whatsappMode ? "w-[340px] border-r border-[#D1D7DB] bg-white shadow-[1px_0_0_#E9EDEF]" : "w-[360px] border-r border-[var(--border)] bg-[var(--bg-tertiary)]",
        mobileFullScreen
          ? ""
          : `max-[860px]:fixed max-[860px]:bottom-0 max-[860px]:left-0 ${mobileTop} max-[860px]:z-40 max-[860px]:w-[min(320px,88vw)] max-[860px]:shadow-[4px_0_24px_rgba(0,0,0,0.15)] max-[860px]:transition-transform max-[860px]:duration-200`,
        mobilePanelClass,
      ].join(" ")}
    >
      {whatsappMode ? (
        <div className="shrink-0 border-b border-[#E9EDEF] bg-[#F0F2F5]">
          <div className="flex items-center gap-2 px-3 py-3">
            {backHref ? (
              <Link
                href={backHref}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#54656F] transition-colors hover:bg-[#E9EDEF]"
                title="Back to dashboard"
              >
                <ArrowLeft size={20} />
              </Link>
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="text-[17px] font-medium text-[#111B21]">Chats</div>
              {roleSubtitle ? (
                <div className="truncate text-[12px] text-[#667781]">{roleSubtitle}</div>
              ) : null}
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00A884] text-xs font-semibold text-white">
              {initials(currentRepName)}
            </div>
          </div>
          {filterCounts && onFilterChange ? (
            <div className="overflow-x-auto border-t border-[#E9EDEF] px-3 py-2 inbox-scroll">
              <FilterTabs
                filter={filter}
                counts={filterCounts}
                onChange={onFilterChange}
                variant="panel"
              />
            </div>
          ) : null}
          <div className="border-t border-[#E9EDEF] px-3 py-2.5">
            <div className="flex items-center gap-2 rounded-lg border border-[#E9EDEF] bg-white px-3 py-2 shadow-sm">
              <Search size={16} className="shrink-0 text-[#8696A0]" />
              <input
                type="text"
                value={search}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="Search or start new chat"
                className="w-full bg-transparent text-[16px] text-[#111B21] placeholder:text-[#667781] focus:outline-none sm:text-[14px]"
              />
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              Team Inbox
            </span>
            <span className="text-xs text-[var(--text-tertiary)]">Sorted by recent</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 border-b border-[var(--border)] px-4 py-2 text-[11px] text-[var(--text-tertiary)]">
            <span
              className="inline-block h-[10px] w-[10px] rounded-full"
              style={{ background: "var(--accent)" }}
            />
            Your leads
            <span
              className="ml-2 inline-block h-[10px] w-[10px] rounded-full"
              style={{ border: "1.5px dashed var(--text-tertiary)" }}
            />
            Unassigned — tap badge to claim
          </div>
        </>
      )}
      <div className="inbox-scroll min-h-0 flex-1 overflow-y-auto bg-white">
        {filtered.length === 0 ? (
          <div className="space-y-3 p-5 text-left text-xs leading-relaxed text-[#667781]">
            {conversations.length === 0 ? (
              <>
                <p className="text-sm font-medium text-[#111B21]">No WhatsApp conversations yet</p>
                <p>The inbox only shows chats created when a customer messages your company WhatsApp number.</p>
                <ol className="list-decimal space-y-1.5 pl-4">
                  <li>Apply DB migrations 056 + 057 + 068</li>
                  <li>Save Phone number ID on the client (Agency → Settings → WhatsApp)</li>
                  <li>Webhook on Meta → <code className="font-mono">messages</code> subscribed</li>
                  <li>Send a test WhatsApp to the business number (not from the API console alone)</li>
                </ol>
              </>
            ) : (
              <p className="text-center text-sm">No chats match this filter.</p>
            )}
          </div>
        ) : (
          filtered.map((c) => (
            <ConversationRow
              key={c.id}
              conversation={c}
              active={c.id === activeId}
              currentRepName={currentRepName}
              onSelect={() => onSelect(c.id)}
              onClaim={onClaim}
              claiming={claimingId === c.id}
              canClaim={canClaim}
            />
          ))
        )}
      </div>
    </div>
  );
}
