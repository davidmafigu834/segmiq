"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Inbox, Star } from "lucide-react";
import { ConvertLaterPickCard } from "@/components/sales/ConvertLaterPickCard";
import { SalesLeadCard } from "@/components/sales/SalesLeadCard";
import { useSalesLogSheet } from "@/components/sales/SalesLogFab";
import {
  isActiveConvertLaterPick,
  sortConvertLaterPicks,
  type PickCallLogContext,
} from "@/lib/convert-later-picks";
import { sortKanbanLeads } from "@/lib/kanbanSort";
import type { LeadWithClientResponseLimit } from "@/lib/leadStatus";
import type { PriorityLead } from "@/lib/sales-priority-lead";
import type { LeadRow, LeadStatus } from "@/types";
import { StatusPill } from "@/components/StatusPill";
import { openLeadPanel } from "@/store/uiStore";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { ResponsiveTable, type ResponsiveTableColumn } from "@/components/ui/ResponsiveTable";
import { LeadDetailPanel } from "./LeadDetailPanel";

const COLS = ["NEW", "CONTACTED", "NEGOTIATING", "PROPOSAL_SENT"] as const satisfies readonly LeadStatus[];

type BoardColumn = (typeof COLS)[number];

const COL_LABEL: Record<BoardColumn, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  NEGOTIATING: "Negotiating",
  PROPOSAL_SENT: "Proposal sent",
};

const COL_DOT: Record<BoardColumn, string> = {
  NEW: "var(--info)",
  CONTACTED: "var(--success)",
  NEGOTIATING: "var(--warning)",
  PROPOSAL_SENT: "#8b5cf6",
};

const COL_ACCENT: Record<string, string> = {
  NEW: "border-t-[var(--info)]",
  CONTACTED: "border-t-[var(--success)]",
  NEGOTIATING: "border-t-[var(--warning)]",
  PROPOSAL_SENT: "border-t-violet-500",
};

function toQuickLogLeads(leads: LeadWithClientResponseLimit[]): PriorityLead[] {
  return leads.map((l) => ({
    id: l.id,
    name: l.name,
    phone: l.phone,
    status: l.status,
    created_at: l.created_at,
    follow_up_date: l.follow_up_date,
    client_id: l.client_id,
    source: l.source,
    budget: l.budget,
    project_type: l.project_type,
    timeline: l.timeline,
    form_data: l.form_data,
    is_stale: l.is_stale,
    priorityLabel: "",
    priorityColor: "var(--text-disabled)",
    priorityOrder: 6,
    followUpDue: false,
  }));
}

function matchesSearch(l: LeadWithClientResponseLimit, q: string): boolean {
  const hay = [
    l.name,
    l.phone,
    l.email,
    l.project_type,
    l.budget != null ? String(l.budget) : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function SalesBoard({
  initialLeads,
  initialTab = "active",
  pickLogContext = {},
}: {
  initialLeads: LeadWithClientResponseLimit[];
  initialTab?: "active" | "closed";
  pickLogContext?: Record<string, PickCallLogContext>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const leadFromUrl = searchParams.get("lead");

  const [leads, setLeads] = useState<LeadWithClientResponseLimit[]>(initialLeads);
  const [tab, setTab] = useState<"active" | "closed">(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  /** Single-column pipeline + column tabs below `lg` — full kanban from `lg` up (1024px+). */
  const isMobileKanban = useMediaQuery("(max-width: 1023px)");
  const [activeColumn, setActiveColumn] = useState<BoardColumn>("NEW");
  const [viewMode, setViewMode] = useState<"kanban" | "picks">("kanban");
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const openLead = useCallback((id: string) => {
    openLeadPanel(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set("lead", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const openSend = useCallback((id: string) => {
    openLeadPanel(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set("lead", id);
    params.set("tab", "send");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(searchQuery.trim().toLowerCase()), 150);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    if (tab === "active") {
      setActiveColumn("NEW");
    } else {
      setViewMode("kanban");
    }
  }, [tab]);

  const activeInPipeline = useMemo(
    () => leads.filter((l) => (COLS as readonly string[]).includes(l.status)),
    [leads]
  );

  const { openLogSheet, logSheetProps } = useSalesLogSheet();
  const { sheet } = logSheetProps(toQuickLogLeads(activeInPipeline));

  const filteredActive = useMemo(() => {
    if (!debouncedQuery) return activeInPipeline;
    return activeInPipeline.filter((l) => matchesSearch(l, debouncedQuery));
  }, [activeInPipeline, debouncedQuery]);

  const sortedForKanban = useMemo(() => sortKanbanLeads(filteredActive), [filteredActive]);

  const picksLeads = useMemo(
    () =>
      sortConvertLaterPicks(
        filteredActive.filter(isActiveConvertLaterPick),
        pickLogContext
      ),
    [filteredActive, pickLogContext]
  );

  const picksCount = useMemo(
    () => activeInPipeline.filter(isActiveConvertLaterPick).length,
    [activeInPipeline]
  );

  const grouped = useMemo(() => {
    const g: Record<string, LeadWithClientResponseLimit[]> = {};
    for (const c of COLS) g[c] = [];
    for (const l of sortedForKanban) {
      if ((COLS as readonly string[]).includes(l.status)) {
        g[l.status].push(l);
      }
    }
    return g;
  }, [sortedForKanban]);

  const closed = useMemo(
    () =>
      leads
        .filter((l) => l.status === "WON" || l.status === "LOST" || l.status === "NOT_QUALIFIED")
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [leads]
  );

  const hasSearchNoMatch =
    tab === "active" && Boolean(debouncedQuery) && activeInPipeline.length > 0 && filteredActive.length === 0;

  const showFullEmpty = leads.length === 0;
  const hasClosed = closed.length > 0;
  const noActiveButHasClosed = tab === "active" && activeInPipeline.length === 0 && hasClosed && !debouncedQuery;

  const clearLeadQuery = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("lead");
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const handleUrlAfterPanelClose = useCallback(() => {
    clearLeadQuery();
  }, [clearLeadQuery]);

  useEffect(() => {
    if (!leadFromUrl) return;
    if (!leads.some((l) => l.id === leadFromUrl)) return;
    openLeadPanel(leadFromUrl);
  }, [leadFromUrl, leads]);

  const handleLeadUpdated = useCallback((updated: LeadRow | LeadWithClientResponseLimit) => {
    setLeads((prev) =>
      prev.map((l) => {
        if (l.id !== updated.id) return l;
        const clients =
          "clients" in updated && updated.clients != null
            ? updated.clients
            : l.clients;
        return { ...updated, clients } as LeadWithClientResponseLimit;
      })
    );
  }, []);

  function handleTouchStart(e: React.TouchEvent) {
    setTouchStartX(e.touches[0].clientX);
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    const threshold = 60;
    if (Math.abs(deltaX) < threshold) {
      setTouchStartX(null);
      return;
    }
    const currentIdx = (COLS as readonly BoardColumn[]).indexOf(activeColumn);
    if (deltaX < 0 && currentIdx < COLS.length - 1) {
      setActiveColumn(COLS[currentIdx + 1]);
    } else if (deltaX > 0 && currentIdx > 0) {
      setActiveColumn(COLS[currentIdx - 1]);
    }
    setTouchStartX(null);
  }

  async function onDragEnd(result: DropResult) {
    const { destination, draggableId } = result;
    if (!destination) return;
    const nextStatus = destination.droppableId as BoardColumn;
    if (!(COLS as readonly string[]).includes(nextStatus)) return;
    setLeads((prev) => prev.map((l) => (l.id === draggableId ? { ...l, status: nextStatus } : l)));
    await fetch(`/api/leads/${draggableId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
  }

  if (tab === "closed") {
    return (
      <div className="w-full min-w-0 max-w-full">
        <div className="mb-6 flex gap-6 border-b border-border">
          <button
            type="button"
            className="relative pb-3 text-sm font-medium text-ink-secondary hover:text-ink-primary"
            onClick={() => setTab("active")}
          >
            Active
          </button>
          <button type="button" className="relative pb-3 text-sm font-medium text-ink-primary">
            Closed
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]" />
          </button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border bg-surface-card p-2 md:p-0">
          <ResponsiveTable<LeadWithClientResponseLimit>
            columns={
              [
                {
                  key: "name",
                  label: "Name",
                  mobilePrimary: true,
                  render: (l) => (
                    <div>
                      <div className="font-medium text-ink-primary">{l.name}</div>
                      <div className="font-mono text-xs text-ink-tertiary">{l.phone ?? "—"}</div>
                    </div>
                  ),
                },
                {
                  key: "status",
                  label: "Status",
                  render: (l) => <StatusPill status={l.status} />,
                },
              ] as ResponsiveTableColumn<LeadWithClientResponseLimit>[]
            }
            rows={closed}
            rowKey={(l) => l.id}
            onRowClick={(l) => openLeadPanel(l.id)}
          />
        </div>
        <LeadDetailPanel leads={leads} onLeadUpdated={handleLeadUpdated} onClose={handleUrlAfterPanelClose} />
      </div>
    );
  }

  if (showFullEmpty) {
    return (
      <div className="w-full min-w-0 max-w-full">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border">
          <div className="flex gap-6">
            <button type="button" className="relative pb-3 text-sm font-medium text-ink-primary">
              Active
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]" />
            </button>
            <button
              type="button"
              className="relative pb-3 text-sm font-medium text-ink-secondary hover:text-ink-primary"
              onClick={() => setTab("closed")}
            >
              Closed
            </button>
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center py-16">
          <div className="max-w-sm text-center">
            <Inbox className="mx-auto mb-4 h-10 w-10 text-ink-tertiary" strokeWidth={1.5} />
            <h2 className="font-display text-2xl text-ink-primary">No leads yet</h2>
            <p className="mt-2 text-sm text-ink-secondary">
              Your new leads will appear here the moment they come in. You&apos;ll also get a WhatsApp and email for each
              one.
            </p>
          </div>
        </div>
        <LeadDetailPanel leads={leads} onLeadUpdated={handleLeadUpdated} onClose={handleUrlAfterPanelClose} />
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full">
      <div className="mb-6 flex flex-col gap-4 border-b border-border sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
        <div className="flex shrink-0 gap-6">
          <button type="button" className="relative pb-3 text-sm font-medium text-ink-primary">
            Active
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]" />
          </button>
          <button
            type="button"
            className="relative pb-3 text-sm font-medium text-ink-secondary hover:text-ink-primary"
            onClick={() => setTab("closed")}
          >
            Closed
          </button>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:max-w-md sm:flex-row sm:items-center sm:justify-end sm:gap-2 sm:pl-0">
          <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={[
                "rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
                viewMode === "kanban"
                  ? "border-border bg-surface-card-alt text-ink-primary"
                  : "border-transparent text-ink-tertiary hover:text-ink-secondary",
              ].join(" ")}
            >
              Board
            </button>
            <button
              type="button"
              onClick={() => setViewMode("picks")}
              className={[
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
                viewMode === "picks"
                  ? "border-[#D4FF4F] bg-[rgba(212,255,79,0.08)] text-[#D4FF4F]"
                  : "border-transparent text-ink-tertiary hover:text-ink-secondary",
              ].join(" ")}
            >
              <Star
                className="h-3 w-3"
                strokeWidth={1.5}
                fill={viewMode === "picks" ? "#D4FF4F" : "none"}
              />
              Picks
              {picksCount > 0 ? (
                <span className="tabular-nums opacity-80">{picksCount}</span>
              ) : null}
            </button>
          </div>
          <input
            type="search"
            placeholder="Search by name, phone…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-base h-10 w-full min-w-0 text-sm sm:h-8 sm:max-w-[min(100%,20rem)] sm:text-xs"
            aria-label="Search leads"
          />
        </div>
      </div>

      {noActiveButHasClosed ? (
        <p className="mb-4 rounded-md border border-border bg-surface-card-alt px-3 py-2 text-sm text-ink-secondary">
          No active leads right now. Switch to <strong>Closed</strong> to see won and lost deals.
        </p>
      ) : null}

      {hasSearchNoMatch ? (
        <div className="mb-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-card-alt px-4 py-10 text-center">
          <p className="text-sm text-ink-secondary">
            No leads match <span className="font-medium text-ink-primary">&quot;{searchQuery.trim()}&quot;</span>
          </p>
          <button type="button" className="btn-ghost mt-3 text-sm" onClick={() => setSearchQuery("")}>
            Clear search
          </button>
        </div>
      ) : viewMode === "picks" ? (
        <div className="ag-fade-in">
          <p className="mb-4 text-[13px] text-ink-secondary">
            Leads you starred from a follow-up — your gut pile, separate from system follow-ups and
            retargeting.
          </p>
          {picksLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-card-alt px-5 py-14 text-center">
              <Star className="mb-3 h-8 w-8 text-ink-tertiary" strokeWidth={1.5} />
              <p className="text-[15px] font-medium text-ink-primary">No picks yet</p>
              <p className="mt-1 max-w-sm text-[13px] text-ink-tertiary">
                When you log a follow-up, toggle &quot;Save to my convert-later picks&quot; to add a
                lead here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {picksLeads.map((l) => (
                <ConvertLaterPickCard
                  key={l.id}
                  lead={l}
                  logContext={pickLogContext[l.id]}
                  onLeadUpdated={handleLeadUpdated}
                />
              ))}
            </div>
          )}
        </div>
      ) : isMobileKanban ? (
        <div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              paddingBottom: "12px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            {COLS.map((col) => {
              const count = grouped[col].length;
              const isActive = activeColumn === col;
              return (
                <button
                  key={col}
                  type="button"
                  onClick={() => {
                    setViewMode("kanban");
                    setActiveColumn(col);
                  }}
                  className={[
                    "flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 text-xs",
                    isActive
                      ? "bg-surface-sidebar font-medium text-[var(--text-on-dark)]"
                      : "bg-surface-card-alt text-ink-secondary",
                  ].join(" ")}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: COL_DOT[col] }} />
                  <span className="uppercase tracking-wide">{COL_LABEL[col]}</span>
                  <span className="font-mono tabular-nums opacity-70">{count}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setViewMode("picks")}
              className="flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-surface-card-alt px-3 text-xs text-ink-secondary"
            >
              <Star className="h-3 w-3 shrink-0" strokeWidth={1.5} />
              <span className="uppercase tracking-wide">Picks</span>
              {picksCount > 0 ? (
                <span className="font-mono tabular-nums opacity-80">{picksCount}</span>
              ) : null}
            </button>
          </div>
          <div
            className="pt-4"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {grouped[activeColumn].length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-surface-card-alt px-4 py-8 text-center text-sm text-ink-tertiary">
                No leads in {COL_LABEL[activeColumn]}.
              </p>
            ) : (
              <div className="space-y-3">
                {grouped[activeColumn].map((l) => (
                  <SalesLeadCard
                    key={l.id}
                    lead={l}
                    intentScore={l.score ?? null}
                    clientSlaHours={l.clients?.response_time_limit_hours}
                    repName=""
                    onOpenLogSheet={openLogSheet}
                    onOpenLead={openLead}
                    onOpenSend={openSend}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="-mx-1 flex min-w-0 snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-4 [scrollbar-gutter:stable] sm:gap-5">
            {COLS.map((col) => (
              <Droppable droppableId={col} key={col}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`w-[280px] shrink-0 snap-start rounded-lg border border-border bg-transparent sm:w-[320px] ${
                      snapshot.isDraggingOver ? "ring-2 ring-dashed ring-[var(--accent)]" : ""
                    }`}
                  >
                    <div className={`border-t-2 ${COL_ACCENT[col] ?? "border-t-border"} px-1 pb-2 pt-3`}>
                      <div className="flex items-center justify-between px-2">
                        <span className="font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
                          {col.replace("_", " ")}
                        </span>
                        <span className="rounded-md bg-surface-card-alt px-2 py-0.5 font-mono text-[11px] text-ink-secondary">
                          {grouped[col].length}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3 px-2 pb-3">
                      {grouped[col].map((l, index) => (
                        <Draggable draggableId={l.id} index={index} key={l.id}>
                          {(p, s) => (
                            <div
                              ref={p.innerRef}
                              {...p.draggableProps}
                              {...p.dragHandleProps}
                              style={{
                                ...(typeof p.draggableProps.style === "object" ? p.draggableProps.style : {}),
                                ...(s.isDragging
                                  ? { boxShadow: "var(--shadow-lg)", transform: "rotate(1deg) scale(1.02)" }
                                  : {}),
                              }}
                              className="cursor-grab active:cursor-grabbing"
                            >
                              <SalesLeadCard
                                lead={l}
                                intentScore={l.score ?? null}
                                clientSlaHours={l.clients?.response_time_limit_hours}
                                repName=""
                                onOpenLogSheet={openLogSheet}
                                onOpenLead={openLead}
                                onOpenSend={openSend}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>
      )}

      {sheet}
      <LeadDetailPanel leads={leads} onLeadUpdated={handleLeadUpdated} onClose={handleUrlAfterPanelClose} />
    </div>
  );
}
