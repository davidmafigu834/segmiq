"use client";

import { useEffect, useMemo, useState } from "react";
import type { InboxFilter, InboxConversation } from "@/lib/inbox/types";
import { applyInboxFilter } from "@/lib/inbox/apply-filter";
import { COMPANY_INBOX_FILTER_ORDER, INBOX_FILTER_LABELS } from "@/lib/inbox/queue-filters";
import {
  CONVERSATION_SORT_LABELS,
  sortConversationsClient,
  type ConversationSort,
} from "@/lib/inbox/format-display";
import { ConversationRow } from "./ConversationRow";
import { FilterTabs } from "./FilterTabs";
import { ArrowUpDown, Check, ChevronLeft, ChevronRight, Search, SlidersHorizontal } from "lucide-react";
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
  ownerOptions?: { id: string; name: string }[];
  panelWidth?: number;
  panelAnimated?: boolean;
  chromeInParent?: boolean;
  companyMode?: boolean;
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
  ownerOptions = [],
  panelWidth,
  panelAnimated = false,
  chromeInParent = false,
  companyMode = false,
}: Props) {
  const [sort, setSort] = useState<ConversationSort>("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const base = applyInboxFilter(conversations, filter, search, currentUserId).filter((row) => {
      if (ownerFilter === "all") return true;
      if (ownerFilter === "unassigned") return !row.assignedToId;
      return row.assignedToId === ownerFilter;
    });
    return sortConversationsClient(base, sort);
  }, [conversations, filter, search, currentUserId, ownerFilter, sort]);

  const pageSize = companyMode ? 8 : Math.max(filtered.length, 1);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleRows = companyMode
    ? filtered.slice((page - 1) * pageSize, page * pageSize)
    : filtered;

  useEffect(() => {
    setPage(1);
  }, [filter, ownerFilter, search, sort]);

  useEffect(() => {
    if (filter === "unassigned") setOwnerFilter("all");
  }, [filter]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

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
    panelWidth != null
      ? "shrink-0"
      : companyMode
        ? "w-full min-w-0 min-[1100px]:w-[clamp(300px,24vw,320px)] min-[1100px]:shrink-0"
        : whatsappMode
          ? "w-[360px]"
          : "w-[360px]";

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
                  {companyMode ? "Conversations" : "Sales conversations"}
                </div>
                <span className="rounded-md bg-[#F2F4F7] px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-[#667085]">
                  {companyMode ? conversations.length : filtered.length}
                </span>
              </div>
              {roleSubtitle && !companyMode ? (
                <div className="mt-0.5 truncate text-[12px] text-[#98A2B3]">
                  WhatsApp Sales Hub · {roleSubtitle}
                </div>
              ) : null}
            </div>
            {!companyMode ? <div className="relative">
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
            </div> : null}
          </div>
          {companyMode && filterCounts && onFilterChange ? (
            <div className="flex border-t border-[#E4E7EC] px-3">
              {COMPANY_INBOX_FILTER_ORDER.map((key) => {
                const active = filter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onFilterChange(key)}
                    className={`relative flex min-w-0 flex-1 items-center justify-center gap-1 px-1 py-2.5 text-[10px] font-medium transition-colors ${
                      active ? "text-[#101828]" : "text-[#667085] hover:text-[#101828]"
                    }`}
                  >
                    {key === "awaiting_reply" ? "Waiting" : INBOX_FILTER_LABELS[key]}
                    <span className="text-[9px] tabular-nums text-[#98A2B3]">{filterCounts[key] ?? 0}</span>
                    {active ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#B7E432]" /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
          {!companyMode && !chromeInParent && filterCounts && onFilterChange ? (
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
            <div className="border-t border-[#E4E7EC] px-3 py-3">
              <div className="flex items-center gap-2">
                <div className="wa-search min-w-0 flex-1">
                <Search size={16} className="shrink-0 text-[#98A2B3]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  placeholder={companyMode ? "Search conversations..." : "Search by name, phone, location..."}
                  className="w-full bg-transparent text-[14px] text-[#101828] placeholder:text-[#98A2B3] focus:outline-none"
                />
                </div>
                {companyMode && onFilterChange ? (
                  <div className="relative">
                    <button type="button" className="wa-icon-btn !h-[38px] !w-[38px] border-[#E4E7EC]" onClick={() => setFilterOpen((value) => !value)} aria-label="Filter conversations" aria-expanded={filterOpen}>
                      <SlidersHorizontal size={15} strokeWidth={1.8} />
                    </button>
                    {filterOpen ? (
                      <>
                        <button type="button" className="fixed inset-0 z-20 cursor-default" aria-label="Close filters" onClick={() => setFilterOpen(false)} />
                        <div className="absolute right-0 z-30 mt-1 max-h-[min(70vh,420px)] w-56 overflow-y-auto rounded-[10px] border border-[#E4E7EC] bg-white py-1 shadow-[0_8px_24px_rgba(16,24,40,0.08)] inbox-scroll">
                          {(["all", "unassigned", "awaiting_reply", "waiting_customer", "unread", "resolved", "quotes_sent"] as InboxFilter[]).map((key) => (
                            <button key={key} type="button" className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] text-[#101828] hover:bg-[#F9FAFB]" onClick={() => { onFilterChange(key); setFilterOpen(false); }}>
                              {key === "awaiting_reply" ? "Waiting on Team" : INBOX_FILTER_LABELS[key]}
                              {filter === key ? <Check size={13} className="text-[#4D7C0F]" /> : null}
                            </button>
                          ))}
                          <div className="my-1 border-t border-[#E4E7EC] px-3 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
                            Owner
                          </div>
                          {[
                            { id: "all", name: "Any owner" },
                            { id: "unassigned", name: "Unassigned" },
                            ...ownerOptions,
                          ].map((owner) => (
                            <button
                              key={owner.id}
                              type="button"
                              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[11px] text-[#101828] hover:bg-[#F9FAFB]"
                              onClick={() => {
                                setOwnerFilter(owner.id);
                                setFilterOpen(false);
                              }}
                            >
                              <span className="truncate">{owner.name}</span>
                              {ownerFilter === owner.id ? <Check size={13} className="shrink-0 text-[#4D7C0F]" /> : null}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}
                {companyMode ? (
                  <div className="relative">
                    <button type="button" className="wa-icon-btn !h-[38px] !w-[38px] border-[#E4E7EC]" aria-label="Sort conversations" aria-expanded={sortOpen} onClick={() => setSortOpen((value) => !value)}>
                      <ArrowUpDown size={15} strokeWidth={1.8} />
                    </button>
                    {sortOpen ? (
                      <>
                        <button type="button" className="fixed inset-0 z-20 cursor-default" aria-label="Close sort menu" onClick={() => setSortOpen(false)} />
                        <div className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-[10px] border border-[#E4E7EC] bg-white py-1 shadow-[0_8px_24px_rgba(16,24,40,0.08)]">
                          {(Object.keys(CONVERSATION_SORT_LABELS) as ConversationSort[]).map((key) => (
                            <button key={key} type="button" className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[11px] text-[#101828] hover:bg-[#F9FAFB]" onClick={() => { setSort(key); setSortOpen(false); }}>
                              {CONVERSATION_SORT_LABELS[key]}
                              {sort === key ? <Check size={13} className="text-[#4D7C0F]" /> : null}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}
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
          visibleRows.map((c) => (
            <ConversationRow
              key={c.id}
              conversation={c}
              active={c.id === activeId}
              currentRepName={currentRepName}
              onSelect={() => onSelect(c.id)}
              onClaim={onClaim}
              claiming={claimingId === c.id}
              canClaim={canClaim}
              companyMode={companyMode}
            />
          ))
        )}
      </div>
      {companyMode && filtered.length > 0 ? (
        <div className="flex min-h-[40px] shrink-0 items-center justify-between gap-2 border-t border-[#E4E7EC] bg-white px-3">
          <span className="truncate text-[9.5px] text-[#667085]">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="wa-icon-btn !h-7 !w-7 disabled:opacity-35" aria-label="Previous page"><ChevronLeft size={13} /></button>
            <span className="min-w-7 text-center text-[10px] font-semibold tabular-nums text-[#344054]">{page}/{pageCount}</span>
            <button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="wa-icon-btn !h-7 !w-7 disabled:opacity-35" aria-label="Next page"><ChevronRight size={13} /></button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
