"use client";

import { useMemo, useState } from "react";
import type { InboxFilter, InboxConversation } from "@/lib/inbox/types";
import { applyInboxFilter } from "@/lib/inbox/apply-filter";
import {
  CONVERSATION_SORT_LABELS,
  sortConversationsClient,
  type ConversationSort,
} from "@/lib/inbox/format-display";
import { ConversationRow } from "./ConversationRow";
import { FilterTabs } from "./FilterTabs";
import { ArrowUpDown, Check, Search } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";

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
  roleSubtitle?: string;
  filterCounts?: Record<InboxFilter, number>;
  onFilterChange?: (filter: InboxFilter) => void;
  panelWidth?: number;
  panelAnimated?: boolean;
  chromeInParent?: boolean;
};

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
  roleSubtitle,
  filterCounts,
  onFilterChange,
  panelWidth,
  panelAnimated = false,
  chromeInParent = false,
}: Props) {
  const [sort, setSort] = useState<ConversationSort>("newest");
  const [sortOpen, setSortOpen] = useState(false);

  const filtered = useMemo(() => {
    const base = applyInboxFilter(conversations, filter, search, currentUserId);
    return sortConversationsClient(base, sort);
  }, [conversations, filter, search, currentUserId, sort]);

  const mobileTop = whatsappMode
    ? mobileFullScreen
      ? "max-[1099px]:top-0"
      : "max-[860px]:top-0"
    : "max-[860px]:top-16";
  const mobilePanelClass = mobileFullScreen
    ? open
      ? "max-[1099px]:fixed max-[1099px]:inset-0 max-[1099px]:z-40 max-[1099px]:flex max-[1099px]:w-full max-[1099px]:translate-x-0 max-[1099px]:shadow-none"
      : "max-[1099px]:hidden"
    : open
      ? "max-[860px]:translate-x-0"
      : "max-[860px]:-translate-x-full";

  const listWidthClass =
    panelWidth != null ? "shrink-0" : whatsappMode ? "w-[360px]" : "w-[360px]";

  const emptyTitle =
    conversations.length === 0
      ? "No WhatsApp conversations yet"
      : search.trim()
        ? `No conversations match “${search.trim()}”`
        : `No conversations in ${filter.replace(/_/g, " ")}`;

  const emptyBody =
    conversations.length === 0
      ? "Incoming WhatsApp leads will appear here."
      : search.trim()
        ? "Try a different name, phone or location."
        : "Try another filter or clear your search.";

  return (
    <div
      id="convPanel"
      style={panelWidth != null ? { width: panelWidth } : undefined}
      className={[
        "flex h-full min-h-0 flex-col",
        panelAnimated ? "inbox-panel-animated" : "",
        listWidthClass,
        whatsappMode
          ? "bg-white wa-panel max-[1099px]:w-full"
          : "border-r border-[var(--border)] bg-[var(--bg-tertiary)]",
        mobileFullScreen
          ? ""
          : `max-[860px]:fixed max-[860px]:bottom-0 max-[860px]:left-0 ${mobileTop} max-[860px]:z-40 max-[860px]:w-[min(320px,88vw)] max-[860px]:shadow-[4px_0_24px_rgba(0,0,0,0.15)] max-[860px]:transition-transform max-[860px]:duration-200`,
        mobilePanelClass,
      ].join(" ")}
    >
      {whatsappMode ? (
        <div className="sticky top-0 z-10 shrink-0 bg-white wa-panel-header max-[1099px]:pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="text-[15px] font-semibold tracking-tight text-[#101828]">
                  Sales conversations
                </div>
                <span className="rounded-md bg-[#F2F4F7] px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-[#667085]">
                  {filtered.length}
                </span>
              </div>
              {roleSubtitle ? (
                <div className="mt-0.5 truncate text-[12px] text-[#98A2B3]">
                  WhatsApp Sales Hub · {roleSubtitle}
                </div>
              ) : null}
            </div>
            <div className="relative">
              <button
                type="button"
                className="wa-icon-btn !h-8 !w-8"
                aria-label="Sort conversations"
                aria-expanded={sortOpen}
                onClick={() => setSortOpen((v) => !v)}
              >
                <ArrowUpDown size={14} strokeWidth={1.8} />
              </button>
              {sortOpen ? (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-20 cursor-default"
                    aria-label="Close sort menu"
                    onClick={() => setSortOpen(false)}
                  />
                  <div
                    role="menu"
                    className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-[10px] border border-[#E4E7EC] bg-white py-1 shadow-[0_8px_24px_rgba(16,24,40,0.08)]"
                  >
                    {(Object.keys(CONVERSATION_SORT_LABELS) as ConversationSort[]).map((key) => (
                      <button
                        key={key}
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12px] text-[#101828] hover:bg-[#F9FAFB]"
                        onClick={() => {
                          setSort(key);
                          setSortOpen(false);
                        }}
                      >
                        {CONVERSATION_SORT_LABELS[key]}
                        {sort === key ? <Check size={14} className="text-[#4D7C0F]" aria-hidden /> : null}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </div>
          {!chromeInParent && filterCounts && onFilterChange ? (
            <div className="overflow-x-auto border-t border-[#E4E7EC] px-4 py-2.5 inbox-scroll [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <FilterTabs
                filter={filter}
                counts={filterCounts}
                onChange={onFilterChange}
                variant="panel"
              />
            </div>
          ) : null}
          {!chromeInParent ? (
            <div className="border-t border-[#E4E7EC] px-4 py-3">
              <div className="wa-search">
                <Search size={16} className="shrink-0 text-[#98A2B3]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  placeholder="Search by name, phone, location..."
                  className="w-full bg-transparent text-[14px] text-[#101828] placeholder:text-[#98A2B3] focus:outline-none"
                />
              </div>
            </div>
          ) : null}
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
      <div
        className={`inbox-scroll min-h-0 flex-1 overflow-y-auto ${
          whatsappMode ? "bg-white" : "bg-[var(--bg-secondary)]"
        }`}
      >
        {filtered.length === 0 ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center px-8 py-10 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[12px] border border-[#E4E7EC] bg-[#F7F8FA] text-[#25D366]">
              <SiWhatsapp size={22} aria-hidden />
            </div>
            <p className="text-[14px] font-semibold text-[#101828]">{emptyTitle}</p>
            <p className="mt-1.5 max-w-[240px] text-[12px] leading-relaxed text-[#667085]">{emptyBody}</p>
            {search.trim() ? (
              <button
                type="button"
                onClick={() => onSearchChange?.("")}
                className="mt-3 text-[12px] font-medium text-[#4D7C0F] hover:underline"
              >
                Clear search
              </button>
            ) : null}
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
