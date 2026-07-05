"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Inbox, Search } from "lucide-react";
import { initials } from "@/lib/inbox/assignee-colors";
import type { InboxConversation, InboxFilter } from "@/lib/inbox/types";
import { ChatThread } from "./ChatThread";
import { ConversationList } from "./ConversationList";
import { FilterTabs } from "./FilterTabs";
import { InboxIconRail } from "./InboxIconRail";
import { LeadIntelligencePanel } from "./LeadIntelligencePanel";

type Props = {
  userName: string;
  userId: string;
  role: "SALESPERSON" | "CLIENT_MANAGER" | "AGENCY_ADMIN";
  clientId: string;
  roleSubtitle: string;
  pipelineHref: string;
  teamHref?: string;
  settingsHref: string;
  inboxHref: string;
  initialSalespeople?: { id: string; name: string }[];
};

function filterCounts(
  rows: InboxConversation[],
  search: string,
  userId: string
): Record<InboxFilter, number> {
  const q = search.trim().toLowerCase();
  const base = rows.filter((l) => {
    if (
      q &&
      !(
        (l.name ?? "").toLowerCase().includes(q) ||
        (l.phone ?? "").includes(q) ||
        (l.location ?? "").toLowerCase().includes(q)
      )
    ) {
      return false;
    }
    return true;
  });
  return {
    all: base.length,
    unassigned: base.filter((l) => !l.assignedToId).length,
    mine: base.filter((l) => l.assignedToId === userId).length,
    hot: base.filter((l) => l.score >= 70).length,
  };
}

export function TeamInbox({
  userName,
  userId,
  role,
  clientId,
  roleSubtitle,
  pipelineHref,
  teamHref,
  settingsHref,
  inboxHref,
  initialSalespeople = [],
}: Props) {
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [search, setSearch] = useState("");
  const [convOpen, setConvOpen] = useState(false);
  const [intelOpen, setIntelOpen] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [salespeople, setSalespeople] = useState(initialSalespeople);

  const loadConversations = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (role !== "CLIENT_MANAGER" && role !== "AGENCY_ADMIN") return;
    if (initialSalespeople.length) return;
    fetch(`/api/clients/${clientId}/users`)
      .then((r) => r.json())
      .then((d: { users?: { id: string; name: string; role?: string }[] }) => {
        const reps = (d.users ?? []).filter((u) => u.role === "SALESPERSON" || !u.role);
        setSalespeople(reps.map((u) => ({ id: u.id, name: u.name })));
      })
      .catch(() => {});
  }, [clientId, role, initialSalespeople.length]);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId]
  );

  const counts = useMemo(
    () => filterCounts(conversations, search, userId),
    [conversations, search, userId]
  );

  const canReassign = role === "CLIENT_MANAGER" || role === "AGENCY_ADMIN";
  const canSend =
    role === "SALESPERSON" && !!active && active.assignedToId === userId;

  async function handleClaim(leadId: string) {
    if (role !== "SALESPERSON") return;
    setClaimingId(leadId);
    try {
      const res = await fetch(`/api/leads/${leadId}/claim`, { method: "POST" });
      if (res.ok) {
        await loadConversations();
        setActiveId(leadId);
      }
    } finally {
      setClaimingId(null);
    }
  }

  function handleSelect(id: string) {
    setActiveId(id);
    if (typeof window !== "undefined" && window.innerWidth <= 860) {
      setConvOpen(false);
    }
  }

  function closePanels() {
    setConvOpen(false);
    setIntelOpen(false);
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--bg-primary)]">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border)] bg-black px-5">
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
                className="text-2xl font-normal tracking-tight text-[var(--accent)]"
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

      <div className="flex min-h-0 flex-1 overflow-hidden lg:hidden border-b border-[var(--border)] px-4 py-2">
        <FilterTabs filter={filter} counts={counts} onChange={setFilter} />
      </div>

      <div className="flex min-h-0 flex-1">
        <InboxIconRail
          pipelineHref={pipelineHref}
          teamHref={teamHref}
          settingsHref={settingsHref}
          inboxHref={inboxHref}
        />

        {loading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-[var(--text-tertiary)]">
            Loading inbox…
          </div>
        ) : (
          <>
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
              open={convOpen}
              canClaim={role === "SALESPERSON"}
            />
            <ChatThread
              conversation={active}
              clientId={clientId}
              canSend={canSend}
              showLogCall={role === "SALESPERSON" && !!active?.assignedToId && active.assignedToId === userId}
              onToggleIntel={() => {
                setConvOpen(false);
                setIntelOpen((v) => !v);
              }}
              onMessagesChange={() => void loadConversations()}
            />
            <LeadIntelligencePanel
              conversation={active}
              canReassign={canReassign}
              salespeople={salespeople}
              onReassigned={() => void loadConversations()}
              open={intelOpen}
            />
          </>
        )}
      </div>

      <div
        id="backdrop"
        role="presentation"
        onClick={closePanels}
        className={`fixed inset-0 z-[35] hidden bg-black/60 ${convOpen || intelOpen ? "max-[1180px]:block" : ""}`}
      />
    </div>
  );
}
