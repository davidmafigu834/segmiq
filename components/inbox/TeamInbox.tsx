"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Inbox, Search } from "lucide-react";
import { initials } from "@/lib/inbox/assignee-colors";
import { useInboxCompact, useInboxMobile } from "@/lib/inbox/use-inbox-mobile";
import { countInboxFilters } from "@/lib/inbox/queue-filters";
import type { InboxConversation, InboxFilter } from "@/lib/inbox/types";
import { ChatThread } from "./ChatThread";
import { ConversationList } from "./ConversationList";
import { FilterTabs } from "./FilterTabs";
import { InboxIconRail } from "./InboxIconRail";
import { LeadIntelligencePanel } from "./LeadIntelligencePanel";
import { InboxPanelResizeHandle } from "./InboxPanelResizeHandle";
import { useInboxPanelWidths } from "@/lib/inbox/use-inbox-panel-widths";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";

type Props = {
  userName: string;
  userId: string;
  role: "SALESPERSON" | "CLIENT_MANAGER" | "AGENCY_ADMIN";
  alsoSells?: boolean;
  clientId: string;
  roleSubtitle: string;
  pipelineHref: string;
  teamHref?: string;
  settingsHref: string;
  inboxHref: string;
  initialSalespeople?: { id: string; name: string }[];
  initialFilter?: InboxFilter;
  backHref?: string;
};

type MobilePane = "list" | "thread" | "intel";

export function TeamInbox({
  userName,
  userId,
  role,
  alsoSells = false,
  clientId,
  roleSubtitle,
  pipelineHref,
  teamHref,
  settingsHref,
  inboxHref,
  initialSalespeople = [],
  initialFilter = "all",
  backHref,
}: Props) {
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<InboxFilter>(initialFilter);
  const [search, setSearch] = useState("");
  const [convOpen, setConvOpen] = useState(false);
  const [intelOpen, setIntelOpen] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [salespeople, setSalespeople] = useState(initialSalespeople);
  const [companyName, setCompanyName] = useState("");
  const [mobilePane, setMobilePane] = useState<MobilePane>("list");
  const isMobile = useInboxMobile();
  const isCompact = useInboxCompact();
  const searchParams = useSearchParams();
  const leadFromUrl = searchParams.get("lead");

  const loadConversations = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const res = await fetch("/api/inbox/conversations");
      const data = (await res.json()) as { conversations?: InboxConversation[] };
      const rows = data.conversations ?? [];
      setConversations(rows);
      setActiveId((prev) => {
        if (prev && rows.some((r) => r.id === prev)) return prev;
        return rows[0]?.id ?? null;
      });
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
    if (!backHref) return;
    const interval = window.setInterval(() => void loadConversations({ silent: true }), 10000);
    return () => window.clearInterval(interval);
  }, [loadConversations, backHref]);

  useEffect(() => {
    if (!leadFromUrl || conversations.length === 0) return;
    if (!conversations.some((c) => c.id === leadFromUrl)) return;
    setActiveId(leadFromUrl);
    if (isCompact && backHref) setMobilePane("thread");
  }, [leadFromUrl, conversations, isCompact, backHref]);

  useEffect(() => {
    if (!isMobile) {
      setMobilePane("list");
    }
  }, [isMobile]);

  useEffect(() => {
    fetch(`/api/clients/${clientId}/company-profile`)
      .then((r) => r.json())
      .then((d: { client?: { name?: string } }) => {
        if (d.client?.name) setCompanyName(d.client.name);
      })
      .catch(() => {});
  }, [clientId]);

  useEffect(() => {
    if (initialSalespeople.length) return;
    fetch(`/api/clients/${clientId}/users`)
      .then((r) => r.json())
      .then((d: { users?: { id: string; name: string; role?: string }[] }) => {
        const reps = (d.users ?? []).filter(
          (u) =>
            u.role === "SALESPERSON" ||
            (u.role === "CLIENT_MANAGER" && Boolean((u as { also_sells?: boolean }).also_sells)) ||
            !u.role
        );
        setSalespeople(reps.map((u) => ({ id: u.id, name: u.name })));
      })
      .catch(() => {});
  }, [clientId, initialSalespeople.length]);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId]
  );

  const counts = useMemo(
    () => countInboxFilters(conversations, userId),
    [conversations, userId]
  );

  const salesCapable = canActAsSalesperson({ userId, role, alsoSells });
  const ownsActive = !!active && active.assignedToId === userId;
  const canReassign = role === "CLIENT_MANAGER" || role === "AGENCY_ADMIN";
  const canTransfer = (salesCapable && ownsActive) || canReassign;
  const canSend = salesCapable && ownsActive;
  const canUpdateStatus = salesCapable && ownsActive;

  async function handleClaim(leadId: string) {
    if (!salesCapable) return;
    setClaimingId(leadId);
    try {
      const res = await fetch(`/api/leads/${leadId}/claim`, { method: "POST" });
      if (res.ok) {
        await loadConversations();
        setActiveId(leadId);
        if (isCompact && backHref) setMobilePane("thread");
      }
    } finally {
      setClaimingId(null);
    }
  }

  const whatsappMode = !!backHref;

  function handleSelect(id: string) {
    setActiveId(id);
    if (isCompact && whatsappMode) {
      setMobilePane("thread");
      return;
    }
    if (isMobile) {
      setConvOpen(false);
    }
  }

  function closePanels() {
    setConvOpen(false);
    setIntelOpen(false);
  }

  const mobileIntelTop = whatsappMode ? "max-[1180px]:top-0" : "max-[1180px]:top-16";
  const paneNav = isCompact && whatsappMode;
  const intelOpenEffective = paneNav ? mobilePane === "intel" : intelOpen;
  const listOpenEffective = paneNav ? mobilePane === "list" : convOpen;
  const {
    listWidth,
    intelWidth,
    listCollapsed,
    intelCollapsed,
    resizeList,
    resizeIntel,
    toggleListCollapsed,
    toggleIntelCollapsed,
    resizable,
  } = useInboxPanelWidths(whatsappMode && !paneNav);

  return (
    <div
      className={
        whatsappMode
          ? "flex h-full min-h-0 flex-1 flex-col overflow-hidden"
          : "flex h-full min-h-[calc(100dvh-11rem)] flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] layout:min-h-[calc(100dvh-7.5rem)]"
      }
    >
      {!whatsappMode ? (
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface-sidebar)] px-5">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setIntelOpen(false);
                  setConvOpen((v) => !v);
                }}
                className="toggle-conv flex h-[34px] w-[34px] items-center justify-center rounded-[10px] text-[var(--text-tertiary)] transition-all hover:bg-[var(--bg-quaternary)] hover:text-[var(--text-secondary)] max-[860px]:flex min-[861px]:hidden"
                title="Leads"
              >
                <Inbox size={16} />
              </button>
              <div className="flex items-center gap-0.5">
                <span
                  className="text-2xl font-normal tracking-tight text-[var(--text-primary)]"
                  style={{ fontFamily: "var(--font-instrument-serif)" }}
                >
                  Segmi
                </span>
                <span
                  className="text-2xl font-normal tracking-tight text-[var(--accent-fg)]"
                  style={{ fontFamily: "var(--font-instrument-serif)" }}
                >
                  Q
                </span>
              </div>
            </div>
            <div className="hidden w-80 items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-2 py-1 md:flex">
              <Search size={14} className="shrink-0 text-[var(--text-tertiary)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search leads, phone, location..."
                className="w-full bg-transparent px-1 py-1 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
              />
            </div>
          </div>

          <div className="hidden lg:block">
            <FilterTabs filter={filter} counts={counts} onChange={setFilter} />
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-xs font-medium text-[var(--text-primary)]">{userName}</div>
              <div className="text-xs text-[var(--text-tertiary)]">{roleSubtitle}</div>
            </div>
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold"
              style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
            >
              {initials(userName)}
            </div>
          </div>
        </header>
      ) : null}

      {!whatsappMode ? (
        <div className="flex min-h-0 flex-1 overflow-hidden border-b border-[var(--border)] px-4 py-2 lg:hidden">
          <FilterTabs filter={filter} counts={counts} onChange={setFilter} />
        </div>
      ) : null}

      <div className={`flex min-h-0 flex-1 overflow-hidden ${whatsappMode ? "wa-hub-shell wa-hub-immersive" : ""}`}>
        {!whatsappMode ? (
          <InboxIconRail
            pipelineHref={pipelineHref}
            teamHref={teamHref}
            settingsHref={settingsHref}
            inboxHref={inboxHref}
          />
        ) : null}

        {loading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-[var(--text-tertiary)]">
            Loading inbox…
          </div>
        ) : (
          <>
            {!resizable || !listCollapsed ? (
              <ConversationList
                conversations={conversations}
                activeId={activeId}
                filter={filter}
                search={search}
                currentRepName={userName}
                currentUserId={userId}
                onSelect={handleSelect}
                onClaim={(id) => void handleClaim(id)}
                claimingId={claimingId}
                open={listOpenEffective}
                canClaim={salesCapable}
                whatsappMode={whatsappMode}
                mobileFullScreen={paneNav}
                onSearchChange={setSearch}
                roleSubtitle={roleSubtitle}
                filterCounts={counts}
                onFilterChange={setFilter}
                panelWidth={resizable ? listWidth : undefined}
                panelAnimated={resizable}
              />
            ) : null}
            {resizable ? (
              <InboxPanelResizeHandle
                panel="list"
                collapsed={listCollapsed}
                onResize={resizeList}
                onToggleCollapse={toggleListCollapsed}
                label="Resize conversations panel"
              />
            ) : null}
            <div
              className={`flex min-h-0 min-w-0 flex-1 flex-col wa-panel ${
                paneNav && mobilePane !== "thread" ? "max-[1180px]:hidden" : ""
              }`}
            >
              <ChatThread
                conversation={active}
                clientId={clientId}
                userName={userName}
                companyName={companyName}
                canSend={canSend}
                canTransfer={canTransfer}
                canUpdateStatus={canUpdateStatus}
                salespeople={salespeople}
                showLogCall={salesCapable && ownsActive}
                onBack={paneNav ? () => setMobilePane("list") : undefined}
                onToggleIntel={() => {
                  if (paneNav) {
                    setMobilePane("intel");
                    return;
                  }
                  setConvOpen(false);
                  setIntelOpen((v) => !v);
                }}
                onMessagesChange={() => void loadConversations({ silent: true })}
                onConversationUpdate={() => void loadConversations({ silent: true })}
              />
            </div>
            {resizable ? (
              <InboxPanelResizeHandle
                panel="intel"
                collapsed={intelCollapsed}
                onResize={resizeIntel}
                onToggleCollapse={toggleIntelCollapsed}
                label="Resize lead workspace panel"
              />
            ) : null}
            {!resizable || !intelCollapsed ? (
              <LeadIntelligencePanel
                conversation={active}
                clientId={clientId}
                userId={userId}
                role={role}
                canReassign={canReassign}
                salespeople={salespeople}
                onReassigned={() => void loadConversations({ silent: true })}
                onUpdated={() => void loadConversations({ silent: true })}
                open={intelOpenEffective}
                whatsappMode={whatsappMode}
                mobileTopClass={mobileIntelTop}
                mobileFullScreen={paneNav}
                onMobileBack={paneNav ? () => setMobilePane("thread") : undefined}
                panelWidth={resizable ? intelWidth : undefined}
                panelAnimated={resizable}
              />
            ) : null}
          </>
        )}
      </div>

      <div
        id="backdrop"
        role="presentation"
        onClick={closePanels}
        className={`fixed inset-0 z-[35] hidden bg-black/60 ${
          !paneNav && (convOpen || intelOpen) ? "min-[861px]:max-[1180px]:block" : ""
        }`}
      />
    </div>
  );
}
