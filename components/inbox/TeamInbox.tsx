"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  useInboxCompact,
  useInboxExtraWideWorkspace,
  useInboxMobile,
  useInboxWideWorkspace,
} from "@/lib/inbox/use-inbox-mobile";
import { countInboxFilters } from "@/lib/inbox/queue-filters";
import type { InboxConversation, InboxFilter } from "@/lib/inbox/types";
import { useSalesMobileChrome } from "@/components/sales/navigation/SalesMobileChromeContext";
import { ChatThread } from "./ChatThread";
import { ConversationList } from "./ConversationList";
import { LeadIntelligencePanel } from "./LeadIntelligencePanel";
import { InboxPanelResizeHandle } from "./InboxPanelResizeHandle";
import { InboxSkeleton } from "./InboxSkeleton";
import { useInboxPanelWidths } from "@/lib/inbox/use-inbox-panel-widths";
import {
  COMPANY_INBOX_PANEL_WIDTHS_KEY,
  SALESPERSON_INBOX_PANEL_WIDTHS_KEY,
} from "@/lib/inbox/inbox-panel-widths";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { CompanyWhatsAppHeader } from "./CompanyWhatsAppHeader";
import { CompanyConversationInsightRail } from "./CompanyConversationInsightRail";
import { SalesIntelligenceRail } from "./SalesIntelligenceRail";
import type { SafeWhatsAppConnection } from "@/lib/whatsapp/providers/types";
import { WhatsAppConnectionBadge } from "./WhatsAppConnectionBadge";

type Props = {
  userName: string;
  userId: string;
  role: "SALESPERSON" | "CLIENT_MANAGER" | "SUPER_ADMIN";
  alsoSells?: boolean;
  clientId: string;
  roleSubtitle?: string;
  pipelineHref?: string;
  teamHref?: string;
  settingsHref?: string;
  inboxHref?: string;
  initialSalespeople?: { id: string; name: string }[];
  initialFilter?: InboxFilter;
  backHref?: string;
  pageTitle?: string;
  breadcrumb?: string;
  companyMode?: boolean;
  unreadNotifications?: number;
  avatarUrl?: string | null;
  onMobilePaneChange?: (pane: MobilePane) => void;
};

type MobilePane = "list" | "thread" | "intel";

function activeConversationStorageKey(clientId: string, companyMode: boolean): string {
  return companyMode
    ? `segmiq-company-whatsapp-active:${clientId}`
    : `segmiq-salesperson-whatsapp-active:${clientId}`;
}

export function TeamInbox({
  userName,
  userId,
  role,
  alsoSells = false,
  clientId,
  initialSalespeople = [],
  initialFilter = "all",
  backHref,
  pageTitle = "WhatsApp Sales Hub",
  companyMode = false,
  unreadNotifications = 0,
  avatarUrl,
  onMobilePaneChange,
}: Props) {
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<InboxFilter>(initialFilter);
  const [search, setSearch] = useState("");
  const [convOpen, setConvOpen] = useState(false);
  const [intelOpen, setIntelOpen] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimToast, setClaimToast] = useState<string | null>(null);
  const [contextRevision, setContextRevision] = useState(0);
  const [salespeople, setSalespeople] = useState(initialSalespeople);
  const [companyName, setCompanyName] = useState("");
  const [whatsappConnection, setWhatsAppConnection] = useState<SafeWhatsAppConnection | null>(null);
  const [mobilePane, setMobilePane] = useState<MobilePane>("list");
  const isMobile = useInboxMobile();
  const isCompact = useInboxCompact();
  const isWideWorkspace = useInboxWideWorkspace();
  const isExtraWideWorkspace = useInboxExtraWideWorkspace();
  const { setHideBottomNav } = useSalesMobileChrome();
  const searchParams = useSearchParams();
  const leadFromUrl = searchParams.get("conversation") ?? searchParams.get("lead");
  const whatsappMode = !!backHref;

  const loadConversations = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const res = await fetch("/api/inbox/conversations");
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as { conversations?: InboxConversation[] };
      const rows = data.conversations ?? [];
      setConversations(rows);
      setLoadError(false);
      setActiveId((prev) => {
        if (prev && rows.some((r) => r.id === prev)) return prev;
        try {
          const stored = localStorage.getItem(activeConversationStorageKey(clientId, companyMode));
          if (stored && rows.some((row) => row.id === stored)) return stored;
        } catch {
          /* ignore unavailable storage */
        }
        return null;
      });
    } catch {
      if (!options?.silent) setLoadError(true);
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [clientId, companyMode]);

  useEffect(() => {
    void loadConversations();
    const interval = window.setInterval(() => void loadConversations({ silent: true }), 3_000);
    return () => window.clearInterval(interval);
  }, [loadConversations]);

  useEffect(() => {
    if (!leadFromUrl || conversations.length === 0) return;
    if (!conversations.some((c) => c.id === leadFromUrl)) return;
    setActiveId(leadFromUrl);
    try {
      localStorage.setItem(activeConversationStorageKey(clientId, companyMode), leadFromUrl);
    } catch {
      /* ignore unavailable storage */
    }
    if (isCompact && backHref) setMobilePane("thread");
  }, [leadFromUrl, conversations, isCompact, backHref, clientId, companyMode]);

  useEffect(() => {
    if (!isMobile) {
      setMobilePane("list");
    }
  }, [isMobile]);

  useEffect(() => {
    if (!claimToast) return;
    const t = window.setTimeout(() => setClaimToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [claimToast]);

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
  const canReassign = role === "CLIENT_MANAGER" || role === "SUPER_ADMIN";
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
        setClaimToast("Lead claimed — you can reply now");
        if (isCompact && backHref) setMobilePane("thread");
      }
    } finally {
      setClaimingId(null);
    }
  }

  useEffect(() => {
    if (!whatsappMode) return;
    let cancelled = false;
    const loadConnection = async () => {
      try {
        const response = await fetch("/api/whatsapp/connection", { cache: "no-store" });
        const data = (await response.json()) as { connection?: SafeWhatsAppConnection };
        if (!cancelled && response.ok && data.connection) setWhatsAppConnection(data.connection);
      } catch {
        // Conversation history remains available if transport status cannot be refreshed.
      }
    };
    void loadConnection();
    const timer = window.setInterval(() => void loadConnection(), 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [whatsappMode]);

  function handleSelect(id: string) {
    setActiveId(id);
    if (whatsappMode) {
      try {
        localStorage.setItem(activeConversationStorageKey(clientId, companyMode), id);
        const url = new URL(window.location.href);
        url.searchParams.set("conversation", id);
        window.history.replaceState(window.history.state, "", url);
      } catch {
        /* selection remains functional without persistence */
      }
    }
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

  const mobileIntelTop = whatsappMode ? "max-[1099px]:top-0" : "max-[1099px]:top-16";
  const paneNav = isCompact && whatsappMode;
  const listOpenEffective = paneNav ? mobilePane === "list" : convOpen;

  useEffect(() => {
    const hide = paneNav && mobilePane !== "list";
    setHideBottomNav(hide);
    onMobilePaneChange?.(mobilePane);
    return () => setHideBottomNav(false);
  }, [paneNav, mobilePane, onMobilePaneChange, setHideBottomNav]);

  const {
    listWidth,
    intelWidth,
    listCollapsed,
    intelCollapsed,
    resizeList,
    resizeIntel,
    toggleIntelCollapsed,
    resizable,
  } = useInboxPanelWidths(
    whatsappMode && !paneNav && isWideWorkspace,
    companyMode
      ? {
          storageKey: COMPANY_INBOX_PANEL_WIDTHS_KEY,
          defaultListWidth: 330,
          defaultIntelWidth: 350,
          allowListCollapse: false,
        }
      : {
          storageKey: SALESPERSON_INBOX_PANEL_WIDTHS_KEY,
          defaultListWidth: isExtraWideWorkspace ? 350 : 310,
          defaultIntelWidth: isExtraWideWorkspace ? 410 : 350,
          allowListCollapse: false,
        }
  );

  const intelOpenEffective = paneNav
    ? mobilePane === "intel"
    : resizable
      ? !intelCollapsed
      : intelOpen;

  const showHubChrome = whatsappMode && !companyMode && (!paneNav || mobilePane === "list");

  return (
    <div
      className={
        whatsappMode
          ? "relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-sales-bg"
          : "flex h-full min-h-[calc(100dvh-11rem)] flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] layout:min-h-[calc(100dvh-7.5rem)]"
      }
    >
      {claimToast ? (
        <div
          role="status"
          className="absolute left-1/2 top-3 z-50 -translate-x-1/2 rounded-[10px] border border-[#E4E7EC] bg-white px-4 py-2 text-[13px] font-medium text-[#101828] shadow-[0_8px_24px_rgba(16,24,40,0.08)]"
        >
          {claimToast}
        </div>
      ) : null}

      {companyMode && (!paneNav || mobilePane === "list") ? (
        <CompanyWhatsAppHeader
          unreadNotifications={unreadNotifications}
          notificationRole={role}
          userName={userName}
          avatarUrl={avatarUrl}
          connection={whatsappConnection}
        />
      ) : null}

      {showHubChrome ? (
        <div className="salesperson-wa-page-header flex min-h-[52px] shrink-0 items-center justify-between gap-3 border-b border-sales-border bg-sales-bg px-4 py-2 layout:px-5 sm:px-5">
          <h1 className="truncate text-[18px] font-semibold tracking-[-0.03em] text-sales-text-primary sm:text-[20px]">
            {pageTitle}
          </h1>
          {whatsappConnection && !whatsappConnection.connected ? (
            <WhatsAppConnectionBadge connection={whatsappConnection} compact />
          ) : null}
        </div>
      ) : null}

      <div
        className={`min-h-0 flex-1 overflow-hidden ${
          companyMode
            ? "company-wa-workspace wa-hub-shell wa-hub-premium mx-3 mb-3 flex overflow-hidden rounded-[11px] border border-sales-border bg-sales-surface sm:mx-4 sm:mb-4"
            : whatsappMode
              ? "salesperson-wa-workspace wa-hub-shell wa-hub-premium mx-3 mb-3 flex overflow-hidden rounded-[11px] border border-sales-border bg-sales-surface sm:mx-4 sm:mb-4"
              : "flex"
        }`}
      >
        {loading ? (
          <InboxSkeleton />
        ) : loadError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-[15px] font-semibold text-[#101828]">Couldn&apos;t load conversations</p>
            <p className="text-[13px] text-[#667085]">Check your connection and try again.</p>
            <button
              type="button"
              onClick={() => void loadConversations()}
              className="rounded-[10px] bg-[#D4FF4F] px-4 py-2 text-[13px] font-semibold text-[#101828] hover:bg-[#c8f244]"
            >
              Try again
            </button>
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
                filterCounts={whatsappMode || companyMode ? counts : undefined}
                onFilterChange={whatsappMode || companyMode ? setFilter : undefined}
                ownerOptions={companyMode ? salespeople : undefined}
                panelWidth={resizable ? listWidth : undefined}
                panelAnimated={resizable}
                chromeInParent={false}
                companyMode={companyMode}
              />
            ) : null}
            {resizable ? (
              <InboxPanelResizeHandle
                panel="list"
                collapsed={listCollapsed}
                onResize={resizeList}
                onToggleCollapse={undefined}
                label="Resize conversations panel"
                desktopClassName={whatsappMode ? "min-[1280px]:flex" : undefined}
              />
            ) : null}
            <div
              className={`company-wa-chat-pane flex min-h-0 min-w-0 flex-1 flex-col wa-panel ${
                paneNav && mobilePane !== "thread" ? "max-[1099px]:hidden" : ""
              }`}
              data-course-target={whatsappMode && !companyMode ? "whatsapp-chat" : undefined}
            >
              <ChatThread
                conversation={active}
                clientId={clientId}
                userName={userName}
                companyName={companyName}
                canSend={canSend}
                transportAvailable={whatsappConnection ? whatsappConnection.connected : true}
                connectionLabel={whatsappConnection?.providerLabel ?? "WhatsApp"}
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
                  if (resizable) {
                    toggleIntelCollapsed();
                    return;
                  }
                  setConvOpen(false);
                  setIntelOpen((v) => !v);
                }}
                onMessagesChange={() => {
                  setContextRevision((value) => value + 1);
                  void loadConversations({ silent: true });
                }}
                onConversationUpdate={() => {
                  setContextRevision((value) => value + 1);
                  void loadConversations({ silent: true });
                }}
                companyMode={companyMode}
                canReassign={canReassign}
                canCreateDeal={(canReassign || (salesCapable && ownsActive)) && !active?.activeDealId}
                leadHref={active ? `${companyMode ? "/client/leads" : "/sales/leads"}?lead=${active.id}` : undefined}
                dealHref={active?.activeDealId ? `${companyMode ? "/client/deals" : "/sales/deals"}/${active.activeDealId}` : undefined}
                contextOpen={intelOpenEffective}
                canClaim={salesCapable}
                onClaim={(id) => void handleClaim(id)}
                claiming={claimingId === active?.id}
              />
            </div>
            {resizable && active ? (
              <InboxPanelResizeHandle
                panel="intel"
                collapsed={intelCollapsed}
                onResize={resizeIntel}
                onToggleCollapse={toggleIntelCollapsed}
                label="Resize customer context panel"
                desktopClassName={whatsappMode ? "min-[1280px]:flex" : undefined}
              />
            ) : null}
            {companyMode ? (
              active && (!resizable || !intelCollapsed) ? (
                <CompanyConversationInsightRail
                  conversation={active}
                  open={intelOpenEffective}
                  refreshKey={contextRevision}
                  panelWidth={resizable ? intelWidth : undefined}
                  onCollapse={() => {
                    if (paneNav) {
                      setMobilePane("thread");
                    } else if (resizable) {
                      toggleIntelCollapsed();
                    } else {
                      setIntelOpen(false);
                    }
                  }}
                  onMobileBack={paneNav ? () => setMobilePane("thread") : undefined}
                />
              ) : null
            ) : whatsappMode && active && (!resizable || !intelCollapsed) ? (
              <SalesIntelligenceRail
                conversation={active}
                clientId={clientId}
                userId={userId}
                salespeople={salespeople}
                canReassign={canReassign}
                canTransfer={canTransfer}
                canModifyDeal={canUpdateStatus}
                canCreateDeal={(canReassign || (salesCapable && ownsActive)) && !active.activeDealId}
                canClaim={salesCapable}
                claiming={claimingId === active.id}
                onClaim={(id) => void handleClaim(id)}
                onUpdated={() => {
                  setContextRevision((value) => value + 1);
                  void loadConversations({ silent: true });
                }}
                open={intelOpenEffective}
                onCollapse={() => {
                  if (paneNav) setMobilePane("thread");
                  else if (resizable) toggleIntelCollapsed();
                  else setIntelOpen(false);
                }}
                onMobileBack={paneNav ? () => setMobilePane("thread") : undefined}
                mobileFullScreen={paneNav}
                mobileTopClass={mobileIntelTop}
                panelWidth={resizable ? intelWidth : undefined}
                panelAnimated={resizable}
                refreshKey={contextRevision}
              />
            ) : !whatsappMode && (!resizable || !intelCollapsed) ? (
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
                canClaim={salesCapable}
                onClaim={(id) => void handleClaim(id)}
                claiming={claimingId === active?.id}
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
          !paneNav && (convOpen || intelOpen) ? "min-[861px]:max-[1279px]:block" : ""
        }`}
      />
    </div>
  );
}
