"use client";

import type { InboxFilter, InboxConversation } from "@/lib/inbox/types";
import { applyInboxFilter } from "@/lib/inbox/apply-filter";
import { ConversationRow } from "./ConversationRow";
import { FilterTabs } from "./FilterTabs";
import { MessageCircleMore, Search } from "lucide-react";

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
}: Props) {
  const filtered = applyInboxFilter(conversations, filter, search, currentUserId);
  const mobileTop = whatsappMode
    ? mobileFullScreen
      ? "max-[1180px]:top-0"
      : "max-[860px]:top-0"
    : "max-[860px]:top-16";
  const mobilePanelClass = mobileFullScreen
    ? open
      ? "max-[1180px]:fixed max-[1180px]:inset-0 max-[1180px]:z-40 max-[1180px]:flex max-[1180px]:w-full max-[1180px]:translate-x-0 max-[1180px]:shadow-none"
      : "max-[1180px]:hidden"
    : open
      ? "max-[860px]:translate-x-0"
      : "max-[860px]:-translate-x-full";

  const listWidthClass =
    panelWidth != null ? "shrink-0" : whatsappMode ? "w-[360px]" : "w-[360px]";

  return (
    <div
      id="convPanel"
      style={panelWidth != null ? { width: panelWidth } : undefined}
      className={[
        "flex h-full min-h-0 flex-col",
        panelAnimated ? "inbox-panel-animated" : "",
        listWidthClass,
        whatsappMode ? "bg-[var(--surface-card)] wa-panel max-[1180px]:w-full" : "border-r border-[var(--border)] bg-[var(--bg-tertiary)]",
        mobileFullScreen
          ? ""
          : `max-[860px]:fixed max-[860px]:bottom-0 max-[860px]:left-0 ${mobileTop} max-[860px]:z-40 max-[860px]:w-[min(320px,88vw)] max-[860px]:shadow-[4px_0_24px_rgba(0,0,0,0.15)] max-[860px]:transition-transform max-[860px]:duration-200`,
        mobilePanelClass,
      ].join(" ")}
    >
      {whatsappMode ? (
        <div className="shrink-0 wa-panel-header max-[1180px]:pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="text-[17px] font-semibold tracking-tight text-[var(--wa-ink)]">Sales conversations</div>
                <span className="rounded-full bg-[var(--wa-accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--wa-accent-strong)]">
                  {conversations.length}
                </span>
              </div>
              {roleSubtitle ? (
                <div className="mt-0.5 truncate text-[12px] text-[var(--wa-muted)]">WhatsApp Sales Hub · {roleSubtitle}</div>
              ) : null}
            </div>
          </div>
          {filterCounts && onFilterChange ? (
            <div className="overflow-x-auto border-t border-[var(--wa-border)] px-4 py-2.5 inbox-scroll">
              <FilterTabs
                filter={filter}
                counts={filterCounts}
                onChange={onFilterChange}
                variant="panel"
              />
            </div>
          ) : null}
          <div className="border-t border-[var(--wa-border)] px-4 py-3">
            <div className="wa-search">
              <Search size={16} className="shrink-0 text-[var(--wa-muted)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="Search contacts, phone or project"
                className="w-full bg-transparent text-[16px] text-[var(--wa-ink)] placeholder:text-[var(--wa-muted)] focus:outline-none sm:text-[14px]"
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
      <div className={`inbox-scroll min-h-0 flex-1 overflow-y-auto py-1 ${whatsappMode ? "bg-[var(--wa-surface)]" : "bg-[var(--bg-secondary)]"}`}>
        {filtered.length === 0 ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center px-8 py-10 text-center text-xs leading-relaxed text-[var(--text-tertiary)]">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--channel-whatsapp-muted)] text-[var(--channel-whatsapp)]">
              <MessageCircleMore size={22} />
            </div>
            {conversations.length === 0 ? (
              <>
                <p className="text-sm font-semibold text-[var(--text-primary)]">No conversations yet</p>
                <p className="mt-1.5 max-w-[240px]">New customer messages to your connected WhatsApp number will appear here.</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-[var(--text-primary)]">No matching conversations</p>
                <p className="mt-1.5">Try another filter or a broader search.</p>
              </>
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
