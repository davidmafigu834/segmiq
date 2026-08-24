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
import { CompanyWhatsAppHeader } from "./CompanyWhatsAppHeader";
import { SalespersonHubHeader } from "./SalespersonHubHeader";
import type { SafeWhatsAppConnection } from "@/lib/whatsapp/providers/types";
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
  hubConnection?: SafeWhatsAppConnection | null;
  hubTitle?: string;
  showHubBranding?: boolean;
  agentActive?: boolean;
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
  filterCounts,
  onFilterChange,
  ownerOptions = [],
  panelWidth,
  panelAnimated = false,
  chromeInParent = false,
  companyMode = false,
  hubConnection = null,
  hubTitle = "WhatsApp Sales Hub",
  showHubBranding = false,
  agentActive = false,
}: Props) {
  const [sort, setSort] = useState<ConversationSort>("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "SALES" | "SUPPORT" | "GENERAL">("all");
  const [page, setPage] = useState(1);
  const [visibleCount, setVisibleCount] = useState(50);

  const filtered = useMemo(() => {
    const base = applyInboxFilter(conversations, filter, search, currentUserId).filter((row) => {
      if (ownerFilter === "all") {
        /* keep */
      } else if (ownerFilter === "unassigned") {
        if (row.assignedToId) return false;
      } else if (row.assignedToId !== ownerFilter) {
        return false;
      }
      if (typeFilter !== "all" && row.conversationType !== typeFilter) return false;
      return true;
    });
    return sortConversationsClient(base, sort);
  }, [conversations, filter, search, currentUserId, ownerFilter, typeFilter, sort]);

  const pageSize = companyMode ? 8 : Math.max(filtered.length, 1);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleRows = companyMode
    ? filtered.slice((page - 1) * pageSize, page * pageSize)
    : filtered.slice(0, visibleCount);

  const showMine = conversations.some((row) => row.assignedToId !== currentUserId);
  const salespersonPrimaryFilters: InboxFilter[] = [
    "all",
    ...(showMine ? (["mine"] as InboxFilter[]) : []),
    "awaiting_reply",
    "human_needed",
    "follow_up_due",
  ];
  const salespersonAdvancedFilters: InboxFilter[] = [
    "hot",
    "warm",
    "cold",
    "waiting_customer",
    "quotes_sent",
    ...(canClaim && conversations.some((row) => !row.assignedToId)
      ? (["unassigned"] as InboxFilter[])
      : []),
    "no_deal",
    "deal_qualified",
    "deal_scoping",
    "deal_proposal_sent",
    "deal_negotiating",
    "unread",
  ];

  useEffect(() => {
    setPage(1);
    setVisibleCount(50);
  }, [filter, ownerFilter, typeFilter, search, sort]);

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
        ? "w-full min-w-0 min-[1100px]:w-[clamp(320px,24vw,360px)] min-[1100px]:shrink-0"
        : whatsappMode
          ? "w-[310px] min-[1536px]:w-[350px]"
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
          ? "bg-sales-surface wa-panel max-[1099px]:w-full"
          : "border-r border-[var(--border)] bg-[var(--bg-tertiary)]",
        mobileFullScreen
          ? ""
          : `max-[860px]:fixed max-[860px]:bottom-0 max-[860px]:left-0 ${mobileTop} max-[860px]:z-40 max-[860px]:w-[min(320px,88vw)] max-[860px]:shadow-[4px_0_24px_rgba(0,0,0,0.15)] max-[860px]:transition-transform max-[860px]:duration-200`,
        mobilePanelClass,
      ].join(" ")}
      data-course-target={whatsappMode && !companyMode ? "whatsapp-conversations" : undefined}
    >
      {whatsappMode ? (
        <div className="sticky top-0 z-10 shrink-0 bg-sales-surface wa-panel-header max-[1099px]:pt-[env(safe-area-inset-top)]">
          {showHubBranding ? (
            companyMode ? (
              <CompanyWhatsAppHeader connection={hubConnection} variant="list" agentActive={agentActive} />
            ) : (
              <SalespersonHubHeader connection={hubConnection} title={hubTitle} variant="list" agentActive={agentActive} />
            )
          ) : (
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-[15px] font-semibold tracking-tight text-sales-text-primary">
                    Conversations
                  </div>
                  <span className="rounded-md bg-sales-surface-subtle px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-sales-text-secondary">
                    {conversations.length}
                  </span>
                </div>
              </div>
            </div>
          )}
          {companyMode && filterCounts && onFilterChange ? (
            <div className="flex border-t border-sales-border px-3">
              {COMPANY_INBOX_FILTER_ORDER.map((key) => {
                const active = filter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onFilterChange(key)}
                    className={`relative flex min-w-0 flex-1 items-center justify-center gap-1 px-1 py-2.5 text-[10px] font-medium transition-colors ${
                      active ? "text-sales-text-primary" : "text-sales-text-secondary hover:text-sales-text-primary"
                    }`}
                  >
                    {key === "awaiting_reply" ? "Waiting" : key === "human_needed" ? "Needed" : INBOX_FILTER_LABELS[key]}
                    <span className="text-[9px] tabular-nums text-sales-text-muted">{filterCounts[key] ?? 0}</span>
                    {active ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#B7E432]" /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
          {!companyMode && !chromeInParent && filterCounts && onFilterChange ? (
            <div className="flex border-t border-sales-border px-2" role="tablist" aria-label="Primary conversation filters">
              {salespersonPrimaryFilters.map((key) => {
                const activeFilter = filter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={activeFilter}
                    onClick={() => onFilterChange(key)}
                    className={`relative flex min-w-0 flex-1 items-center justify-center gap-1 px-1 py-2.5 text-[10px] font-medium transition-colors ${
                      activeFilter
                        ? "text-sales-text-primary"
                        : "text-sales-text-secondary hover:text-sales-text-primary"
                    }`}
                  >
                    {INBOX_FILTER_LABELS[key]}
                    <span className="text-[9px] tabular-nums text-sales-text-muted">{filterCounts[key] ?? 0}</span>
                    {activeFilter ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-sales-brand" /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
          {!chromeInParent ? (
            <div className="border-t border-sales-border px-3 py-3">
              <div className="flex items-center gap-2">
                <div className="wa-search min-w-0 flex-1">
                <Search size={16} className="shrink-0 text-sales-text-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  placeholder="Search conversations…"
                  className="w-full bg-transparent text-[14px] text-sales-text-primary placeholder:text-sales-text-muted focus:outline-none"
                />
                </div>
                {onFilterChange ? (
                  <div className="relative">
                    <button
                      type="button"
                      className={`wa-icon-btn !h-[38px] !min-w-[38px] !w-auto !px-2.5 gap-1.5 ${
                        !companyMode && salespersonAdvancedFilters.includes(filter)
                          ? "!border-sales-brand-border !bg-sales-brand-soft text-sales-text-primary"
                          : companyMode && (ownerFilter !== "all" || typeFilter !== "all")
                            ? "!border-sales-brand-border !bg-sales-brand-soft text-sales-text-primary"
                            : "border-sales-border"
                      }`}
                      onClick={() => setFilterOpen((value) => !value)}
                      aria-label="Filter conversations"
                      aria-expanded={filterOpen}
                    >
                      <SlidersHorizontal size={15} strokeWidth={1.8} />
                      {companyMode ? <span className="text-[11px] font-medium">Filters</span> : null}
                    </button>
                    {filterOpen ? (
                      <>
                        <button type="button" className="fixed inset-0 z-20 cursor-default" aria-label="Close filters" onClick={() => setFilterOpen(false)} />
                        <div className="absolute right-0 z-30 mt-1 max-h-[min(70vh,420px)] w-56 overflow-y-auto rounded-[10px] border border-sales-border bg-sales-surface py-1 shadow-[0_8px_24px_rgba(16,24,40,0.08)] inbox-scroll">
                          {(companyMode
                            ? (["all", "unassigned", "awaiting_reply", "human_needed", "waiting_customer", "unread", "resolved", "quotes_sent"] as InboxFilter[])
                            : salespersonAdvancedFilters
                          ).map((key) => (
                            <button key={key} type="button" className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] text-sales-text-primary hover:bg-sales-surface-hover" onClick={() => { onFilterChange(key); setFilterOpen(false); }}>
                              {key === "awaiting_reply" ? "Waiting on Team" : INBOX_FILTER_LABELS[key]}
                              {filter === key ? <Check size={13} className="text-[#4D7C0F]" /> : null}
                            </button>
                          ))}
                          {companyMode ? (
                            <>
                              <div className="my-1 border-t border-sales-border px-3 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
                                Conversation type
                              </div>
                              {(
                                [
                                  { id: "all", name: "All types" },
                                  { id: "SALES", name: "Sales" },
                                  { id: "SUPPORT", name: "Support" },
                                  { id: "GENERAL", name: "General" },
                                ] as const
                              ).map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[11px] text-sales-text-primary hover:bg-sales-surface-hover"
                                  onClick={() => {
                                    setTypeFilter(item.id);
                                    setFilterOpen(false);
                                  }}
                                >
                                  <span className="truncate">{item.name}</span>
                                  {typeFilter === item.id ? <Check size={13} className="shrink-0 text-[#4D7C0F]" /> : null}
                                </button>
                              ))}
                              <div className="my-1 border-t border-sales-border px-3 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
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
                                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[11px] text-sales-text-primary hover:bg-sales-surface-hover"
                                  onClick={() => {
                                    setOwnerFilter(owner.id);
                                    setFilterOpen(false);
                                  }}
                                >
                                  <span className="truncate">{owner.name}</span>
                                  {ownerFilter === owner.id ? <Check size={13} className="shrink-0 text-[#4D7C0F]" /> : null}
                                </button>
                              ))}
                            </>
                          ) : null}
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}
                <div className="relative">
                    <button type="button" className="wa-icon-btn !h-[38px] !w-[38px] border-sales-border" aria-label="Sort conversations" aria-expanded={sortOpen} onClick={() => setSortOpen((value) => !value)}>
                      <ArrowUpDown size={15} strokeWidth={1.8} />
                    </button>
                    {sortOpen ? (
                      <>
                        <button type="button" className="fixed inset-0 z-20 cursor-default" aria-label="Close sort menu" onClick={() => setSortOpen(false)} />
                        <div className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-[10px] border border-sales-border bg-sales-surface py-1 shadow-[0_8px_24px_rgba(16,24,40,0.08)]">
                          {(Object.keys(CONVERSATION_SORT_LABELS) as ConversationSort[]).map((key) => (
                            <button key={key} type="button" className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[11px] text-sales-text-primary hover:bg-sales-surface-hover" onClick={() => { setSort(key); setSortOpen(false); }}>
                              {CONVERSATION_SORT_LABELS[key]}
                              {sort === key ? <Check size={13} className="text-sales-success" /> : null}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex shrink-0 items-center border-b border-sales-border px-4 py-3">
          <span className="text-[15px] font-semibold text-sales-text-primary">Conversations</span>
        </div>
      )}
      <div
        className={`inbox-scroll min-h-0 flex-1 overflow-y-auto ${
          whatsappMode ? "bg-sales-surface" : "bg-[var(--bg-secondary)]"
        }`}
      >
        {filtered.length === 0 ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center px-8 py-10 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[12px] border border-sales-border bg-sales-bg text-[#25D366]">
              <SiWhatsapp size={22} aria-hidden />
            </div>
            <p className="text-[14px] font-semibold text-sales-text-primary">{emptyTitle}</p>
            <p className="mt-1.5 max-w-[240px] text-[12px] leading-relaxed text-sales-text-secondary">{emptyBody}</p>
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
        <div className="flex min-h-[40px] shrink-0 items-center justify-between gap-2 border-t border-sales-border bg-sales-surface px-3">
          <span className="truncate text-[9.5px] text-sales-text-secondary">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="wa-icon-btn !h-7 !w-7 disabled:opacity-35" aria-label="Previous page"><ChevronLeft size={13} /></button>
            <span className="min-w-7 text-center text-[10px] font-semibold tabular-nums text-sales-text-primary">{page}/{pageCount}</span>
            <button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="wa-icon-btn !h-7 !w-7 disabled:opacity-35" aria-label="Next page"><ChevronRight size={13} /></button>
          </div>
        </div>
      ) : null}
      {!companyMode && whatsappMode && filtered.length > 0 ? (
        <div className="flex min-h-[42px] shrink-0 items-center justify-between gap-2 border-t border-sales-border bg-sales-surface px-3">
          <span className="truncate text-[10px] text-sales-text-secondary">
            Showing {Math.min(visibleCount, filtered.length)} of {filtered.length}
          </span>
          {visibleCount < filtered.length ? (
            <button
              type="button"
              onClick={() => setVisibleCount((value) => value + 50)}
              className="rounded-[7px] border border-sales-border bg-sales-surface px-2.5 py-1.5 text-[10px] font-semibold text-sales-text-primary hover:bg-sales-surface-hover"
            >
              Load more
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
