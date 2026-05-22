"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { format, formatDistanceToNow, isBefore, isToday, startOfDay } from "date-fns";
import { Inbox } from "lucide-react";
import { sortKanbanLeads } from "@/lib/kanbanSort";
import { isLeadSlow } from "@/lib/leadStatus";
import type { LeadWithClientResponseLimit } from "@/lib/leadStatus";
import type { LeadRow, LeadSource, LeadStatus } from "@/types";
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

function kanbanLeadIsSlow(l: LeadWithClientResponseLimit): boolean {
  if (l.clients == null) {
    console.warn("[SalesBoard] Lead missing client relation", l.id);
    return false;
  }
  return isLeadSlow(l.status, l.created_at, l.clients.response_time_limit_hours);
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
}: {
  initialLeads: LeadWithClientResponseLimit[];
  initialTab?: "active" | "closed";
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
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(searchQuery.trim().toLowerCase()), 150);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    if (tab === "active") setActiveColumn("NEW");
  }, [tab]);

  const activeInPipeline = useMemo(
    () => leads.filter((l) => (COLS as readonly string[]).includes(l.status)),
    [leads]
  );

  const filteredActive = useMemo(() => {
    if (!debouncedQuery) return activeInPipeline;
    return activeInPipeline.filter((l) => matchesSearch(l, debouncedQuery));
  }, [activeInPipeline, debouncedQuery]);

  const sortedForKanban = useMemo(() => sortKanbanLeads(filteredActive), [filteredActive]);

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
        .filter((l) => l.status === "WON" || l.status === "LOST")
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

  const handleLeadUpdated = useCallback((updated: LeadRow) => {
    setLeads((prev) =>
      prev.map((l) => {
        if (l.id !== updated.id) return l;
        return { ...updated, clients: l.clients } as LeadWithClientResponseLimit;
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
        <div className="overflow-x-auto rounded-lg border border-border bg-surface-card p-2 md:p-0">
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
          <span className="shrink-0 self-start rounded-sm border border-border bg-surface-card-alt px-2 py-1 font-mono text-[11px] text-ink-tertiary sm:self-center">
            Board
          </span>
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
        <div className="mb-6 flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface-card-alt px-4 py-10 text-center">
          <p className="text-sm text-ink-secondary">
            No leads match <span className="font-medium text-ink-primary">&quot;{searchQuery.trim()}&quot;</span>
          </p>
          <button type="button" className="btn-ghost mt-3 text-sm" onClick={() => setSearchQuery("")}>
            Clear search
          </button>
        </div>
      ) : isMobileKanban ? (
        <div>
          <div
            className="border-b border-border pb-3 scrollbar-hide"
            style={{ overflowX: "scroll", overscrollBehaviorX: "contain", WebkitOverflowScrolling: "touch" }}
          >
            <div className="flex w-max gap-1">
            {COLS.map((col) => {
              const count = grouped[col].length;
              const isActive = activeColumn === col;
              return (
                <button
                  key={col}
                  type="button"
                  onClick={() => setActiveColumn(col)}
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
            </div>
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
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => openLeadPanel(l.id)}
                    className={`w-full border border-border bg-surface-card p-3.5 text-left active:scale-[0.98] ${
                      kanbanLeadIsSlow(l) ? "border-l-[3px] border-l-[var(--danger)]" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <SourceDot source={l.source} />
                      <span className="text-ink-tertiary">⋯</span>
                    </div>
                    <div className="mt-2 text-sm font-medium leading-snug text-ink-primary">{l.name}</div>
                    <div className="mt-1 font-mono text-xs text-ink-tertiary">{l.phone}</div>
                    <div className="my-3 h-px bg-border" />
                    <div className="text-sm text-ink-secondary">
                      {l.budget ?? "—"} · {l.project_type ?? "Project"}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className={`rounded-sm px-2 py-0.5 font-mono text-[10px] ${
                          kanbanLeadIsSlow(l)
                            ? "bg-[var(--danger)] text-white"
                            : "bg-surface-card-alt text-ink-tertiary"
                        }`}
                      >
                        {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}
                      </span>
                      <FollowUpKanbanPill followUpDate={l.follow_up_date} />
                      <span className="rounded-sm bg-surface-card-alt px-2 py-0.5 font-mono text-[10px] text-ink-secondary">
                        {l.source === "FACEBOOK" ? "FB" : l.source === "LANDING_PAGE" ? "LP" : "—"}
                      </span>
                    </div>
                  </button>
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
                    className={`w-[280px] shrink-0 snap-start rounded-sm border border-border bg-transparent sm:w-[320px] ${
                      snapshot.isDraggingOver ? "ring-2 ring-dashed ring-[var(--accent)]" : ""
                    }`}
                  >
                    <div className={`border-t-2 ${COL_ACCENT[col] ?? "border-t-border"} px-1 pb-2 pt-3`}>
                      <div className="flex items-center justify-between px-2">
                        <span className="font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
                          {col.replace("_", " ")}
                        </span>
                        <span className="rounded-sm bg-surface-card-alt px-2 py-0.5 font-mono text-[11px] text-ink-secondary">
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
                              className={`cursor-grab border border-border bg-surface-card p-4 active:cursor-grabbing ${
                                kanbanLeadIsSlow(l) ? "border-l-[3px] border-l-[var(--danger)]" : ""
                              }`}
                              onClick={() => openLeadPanel(l.id)}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <SourceDot source={l.source} />
                                <button type="button" className="text-ink-tertiary" aria-label="More">
                                  ⋯
                                </button>
                              </div>
                              <div className="mt-2 text-sm font-medium leading-snug text-ink-primary">{l.name}</div>
                              <div className="mt-1 font-mono text-xs text-ink-tertiary">{l.phone}</div>
                              <div className="my-3 h-px bg-border" />
                              <div className="text-sm text-ink-secondary">
                                {l.budget ?? "—"} · {l.project_type ?? "Project"}
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <span
                                  className={`rounded-sm px-2 py-0.5 font-mono text-[10px] ${
                                    kanbanLeadIsSlow(l)
                                      ? "bg-[var(--danger)] text-white"
                                      : "bg-surface-card-alt text-ink-tertiary"
                                  }`}
                                >
                                  {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}
                                </span>
                                <FollowUpKanbanPill followUpDate={l.follow_up_date} />
                                <span className="rounded-sm bg-surface-card-alt px-2 py-0.5 font-mono text-[10px] text-ink-secondary">
                                  {l.source === "FACEBOOK" ? "FB" : l.source === "LANDING_PAGE" ? "LP" : "—"}
                                </span>
                              </div>
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

      <LeadDetailPanel leads={leads} onLeadUpdated={handleLeadUpdated} onClose={handleUrlAfterPanelClose} />
    </div>
  );
}

function FollowUpKanbanPill({ followUpDate }: { followUpDate: string | null }) {
  if (!followUpDate) return null;
  const d = new Date(followUpDate);
  const startToday = startOfDay(new Date());
  if (isBefore(d, startToday)) {
    return (
      <span className="rounded-sm bg-[var(--danger)] px-2 py-0.5 font-mono text-[10px] uppercase text-white">
        Overdue · {format(d, "MMM d")}
      </span>
    );
  }
  if (isToday(d)) {
    return (
      <span
        className="rounded-sm px-2 py-0.5 font-mono text-[10px]"
        style={{
          background: "var(--status-followup-bg)",
          color: "var(--status-followup-fg)",
        }}
      >
        Due today
      </span>
    );
  }
  return (
    <span
      className="rounded-sm px-2 py-0.5 font-mono text-[10px]"
      style={{
        background: "var(--status-followup-bg)",
        color: "var(--status-followup-fg)",
      }}
    >
      Follow-up {format(d, "MMM d")}
    </span>
  );
}

function SourceDot({ source }: { source: LeadSource }) {
  if (source === "FACEBOOK") return <span className="h-2 w-2 rounded-full bg-[var(--info)]" />;
  if (source === "LANDING_PAGE") return <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />;
  return <span className="h-2 w-2 rounded-full bg-ink-tertiary" />;
}
