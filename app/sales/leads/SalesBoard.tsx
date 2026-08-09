"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Inbox, Info, Search, Star } from "lucide-react";
import { ConvertLaterPickCard } from "@/components/sales/ConvertLaterPickCard";
import { PipelineLeadCard } from "@/components/sales/pipeline/PipelineLeadCard";
import { useSalesLogSheet } from "@/components/sales/SalesLogFab";
import {
  isActiveConvertLaterPick,
  sortConvertLaterPicks,
  type PickCallLogContext,
} from "@/lib/convert-later-picks";
import { sortKanbanLeads } from "@/lib/kanbanSort";
import type { LeadWithClientResponseLimit } from "@/lib/leadStatus";
import type { PriorityLead } from "@/lib/sales-priority-lead";
import { openLeadPanel, useLeadPanel } from "@/store/uiStore";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { ResponsiveTable, type ResponsiveTableColumn } from "@/components/ui/ResponsiveTable";
import { EmptyState } from "@/components/ui";
import { SegmentedControl } from "@/components/sales/ui";
import { LeadDetailPanel } from "./LeadDetailPanel";
import {
  PIPELINE_ACTIVE_STAGES,
  PIPELINE_STAGE_ACCENT,
  PIPELINE_STAGE_LABEL,
  closedStatusPillClass,
  formatPipelineStage,
  type PipelineActiveStage,
} from "@/lib/sales/pipeline-display";
import { format } from "date-fns";
import { formatDealValue, resolveNumericDealValue } from "@/lib/sales/sales-dashboard-display";

const COLS = PIPELINE_ACTIVE_STAGES;

type BoardColumn = PipelineActiveStage;

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
  const formBits: string[] = [];
  if (l.form_data && typeof l.form_data === "object") {
    for (const [k, v] of Object.entries(l.form_data)) {
      if (/company|business|org|email|budget|service|project|locat/i.test(k)) {
        if (typeof v === "string") formBits.push(v);
        else if (Array.isArray(v)) formBits.push(v.map(String).join(" "));
      }
    }
  }
  const hay = [
    l.name,
    l.phone,
    l.email,
    l.project_type,
    l.budget != null ? String(l.budget) : "",
    ...formBits,
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
  repName = "",
}: {
  initialLeads: LeadWithClientResponseLimit[];
  initialTab?: "active" | "closed";
  pickLogContext?: Record<string, PickCallLogContext>;
  repName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const leadFromUrl = searchParams.get("lead");
  const tabFromUrl = searchParams.get("tab");
  const { open: panelOpen, leadId: panelLeadId } = useLeadPanel();
  const drawerOpen = panelOpen && Boolean(panelLeadId);

  const [leads, setLeads] = useState<LeadWithClientResponseLimit[]>(initialLeads);
  const [tab, setTab] = useState<"active" | "closed">(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const isMobileKanban = useMediaQuery("(max-width: 1099px)");
  const [activeColumn, setActiveColumn] = useState<BoardColumn>("NEW");
  const [viewMode, setViewMode] = useState<"kanban" | "picks">("kanban");
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [dragError, setDragError] = useState<string | null>(null);

  const openLead = useCallback(
    (id: string) => {
      openLeadPanel(id);
      const params = new URLSearchParams(searchParams.toString());
      params.set("lead", id);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

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

  useEffect(() => {
    if (!dragError) return;
    const t = window.setTimeout(() => setDragError(null), 4000);
    return () => window.clearTimeout(t);
  }, [dragError]);

  const activeInPipeline = useMemo(
    () => leads.filter((l) => (COLS as readonly string[]).includes(l.status)),
    [leads]
  );

  const { openLogSheet, logSheetProps } = useSalesLogSheet();
  const { sheet } = logSheetProps(toQuickLogLeads(activeInPipeline.length ? activeInPipeline : leads));

  const filteredActive = useMemo(() => {
    if (!debouncedQuery) return activeInPipeline;
    return activeInPipeline.filter((l) => matchesSearch(l, debouncedQuery));
  }, [activeInPipeline, debouncedQuery]);

  const sortedForKanban = useMemo(() => sortKanbanLeads(filteredActive), [filteredActive]);

  const picksLeads = useMemo(
    () => sortConvertLaterPicks(filteredActive.filter(isActiveConvertLaterPick), pickLogContext),
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

  const filteredClosed = useMemo(() => {
    if (!debouncedQuery) return closed;
    return closed.filter((l) => matchesSearch(l, debouncedQuery));
  }, [closed, debouncedQuery]);

  const hasSearchNoMatch =
    tab === "active" &&
    Boolean(debouncedQuery) &&
    activeInPipeline.length > 0 &&
    filteredActive.length === 0;

  const showFullEmpty = leads.length === 0;
  const hasClosed = closed.length > 0;
  const noActiveButHasClosed =
    tab === "active" && activeInPipeline.length === 0 && hasClosed && !debouncedQuery;

  const clearLeadQuery = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("lead");
    params.delete("tab");
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const handleUrlAfterPanelClose = useCallback(() => {
    clearLeadQuery();
  }, [clearLeadQuery]);

  useEffect(() => {
    if (!leadFromUrl) return;
    if (!leads.some((l) => l.id === leadFromUrl)) return;
    const tab =
      tabFromUrl === "quote" || tabFromUrl === "send" || tabFromUrl === "timeline"
        ? tabFromUrl
        : undefined;
    openLeadPanel(leadFromUrl, tab);
  }, [leadFromUrl, tabFromUrl, leads]);

  const handleLeadUpdated = useCallback((updated: { id: string } & Record<string, unknown>) => {
    setLeads((prev) =>
      prev.map((l) => {
        if (l.id !== updated.id) return l;
        const clients =
          "clients" in updated && updated.clients != null
            ? (updated.clients as LeadWithClientResponseLimit["clients"])
            : l.clients;
        return { ...l, ...updated, clients } as LeadWithClientResponseLimit;
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
      setActiveColumn(COLS[currentIdx + 1]!);
    } else if (deltaX > 0 && currentIdx > 0) {
      setActiveColumn(COLS[currentIdx - 1]!);
    }
    setTouchStartX(null);
  }

  async function onDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const nextStatus = destination.droppableId as BoardColumn;
    if (!(COLS as readonly string[]).includes(nextStatus)) return;

    const previousLeads = leads;
    setLeads((prev) => prev.map((l) => (l.id === draggableId ? { ...l, status: nextStatus } : l)));
    setDragError(null);

    try {
      const res = await fetch(`/api/leads/${draggableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error("Failed to update lead status");
    } catch {
      setLeads(previousLeads);
      setDragError("Couldn't update stage. Lead restored — try again.");
    }
  }

  const pipelineTabs = (
    <SegmentedControl
      aria-label="Pipeline tab"
      value={tab}
      onChange={(value) => setTab(value)}
      options={[
        { value: "active", label: "Active" },
        { value: "closed", label: "Closed" },
      ]}
    />
  );

  const searchField = (
    <label className="relative block min-w-0 flex-1 sm:max-w-[min(100%,18rem)]">
      <span className="sr-only">Search leads</span>
      <Search
        size={15}
        strokeWidth={1.8}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]"
        aria-hidden
      />
      <input
        type="search"
        placeholder="Search by name, phone..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="h-9 w-full rounded-[10px] border border-[#E4E7EC] bg-white py-2 pl-9 pr-3 text-[13px] text-[#101828] placeholder:text-[#98A2B3] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[#D0D5DD] focus:ring-2 focus:ring-[#D4FF4F]/40"
        aria-label="Search leads"
      />
    </label>
  );

  const toolbar = (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      {pipelineTabs}
      {tab === "active" ? (
        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <SegmentedControl
            aria-label="Board view"
            value={viewMode}
            onChange={(value) => setViewMode(value)}
            options={[
              { value: "kanban", label: "Board" },
              {
                value: "picks",
                label: "Picks",
                badge: picksCount > 0 ? picksCount : undefined,
              },
            ]}
          />
          {searchField}
        </div>
      ) : (
        <div className="flex w-full justify-end sm:w-auto">{searchField}</div>
      )}
    </div>
  );

  const detailPanel = (
    <LeadDetailPanel leads={leads} onLeadUpdated={handleLeadUpdated} onClose={handleUrlAfterPanelClose} />
  );

  const boardPad = drawerOpen && !isMobileKanban ? "layout:pr-[min(520px,42vw)]" : "";

  if (tab === "closed") {
    return (
      <div className={`relative w-full min-w-0 max-w-full transition-[padding] duration-200 ${boardPad}`}>
        {toolbar}
        {filteredClosed.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-[#E4E7EC] bg-white">
            <EmptyState
              icon={Inbox}
              title={debouncedQuery ? `No leads match “${searchQuery.trim()}”` : "No closed deals yet"}
              description={
                debouncedQuery
                  ? "Try another name, phone number, email, project type or budget."
                  : "Won, lost, and not-qualified deals will appear here."
              }
            />
            {debouncedQuery ? (
              <div className="flex justify-center pb-6">
                <button
                  type="button"
                  className="text-[13px] font-medium text-[#2684FF]"
                  onClick={() => setSearchQuery("")}
                >
                  Clear search
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="overflow-hidden rounded-[12px] border border-[#E4E7EC] bg-white">
            <ResponsiveTable<LeadWithClientResponseLimit>
              columns={
                [
                  {
                    key: "name",
                    label: "Name",
                    mobilePrimary: true,
                    render: (l) => (
                      <div>
                        <div className="font-medium text-[#101828]">{l.name?.trim() || "Unnamed lead"}</div>
                        <div className="font-mono text-xs text-[#98A2B3]">{l.phone ?? "—"}</div>
                      </div>
                    ),
                  },
                  {
                    key: "status",
                    label: "Status",
                    render: (l) => (
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-[12px] font-medium ${closedStatusPillClass(l.status)}`}
                      >
                        {formatPipelineStage(l.status)}
                      </span>
                    ),
                  },
                  {
                    key: "closed",
                    label: "Closed",
                    mobileHidden: true,
                    render: (l) => (
                      <span className="text-[13px] text-[#667085]">
                        {format(new Date(l.updated_at), "d MMM yyyy")}
                      </span>
                    ),
                  },
                  {
                    key: "value",
                    label: "Value",
                    mobileHidden: true,
                    render: (l) => {
                      const { amount } = resolveNumericDealValue(l);
                      return (
                        <span className="tabular-nums text-[13px] text-[#667085]">
                          {amount == null ? "—" : formatDealValue(amount)}
                        </span>
                      );
                    },
                  },
                  {
                    key: "source",
                    label: "Source",
                    mobileHidden: true,
                    render: (l) => (
                      <span className="text-[13px] text-[#667085]">{l.source?.trim() || "—"}</span>
                    ),
                  },
                ] as ResponsiveTableColumn<LeadWithClientResponseLimit>[]
              }
              rows={filteredClosed}
              rowKey={(l) => l.id}
              onRowClick={(l) => openLead(l.id)}
            />
          </div>
        )}
        {sheet}
        {detailPanel}
      </div>
    );
  }

  if (showFullEmpty) {
    return (
      <div className={`relative w-full min-w-0 max-w-full ${boardPad}`}>
        {toolbar}
        <div className="flex flex-1 flex-col items-center justify-center py-12">
          <div className="w-full max-w-md rounded-[12px] border border-dashed border-[#E4E7EC] bg-white">
            <EmptyState
              icon={Inbox}
              title="No leads yet"
              description="New leads assigned to you will appear here."
            />
          </div>
        </div>
        {sheet}
        {detailPanel}
      </div>
    );
  }

  return (
    <div className={`relative w-full min-w-0 max-w-full transition-[padding] duration-200 ${boardPad}`}>
      {toolbar}

      {dragError ? (
        <div
          role="alert"
          className="mb-4 rounded-[10px] border border-[#FECDCA] bg-[#FEF3F2] px-3 py-2 text-[13px] text-[#B42318]"
        >
          {dragError}
        </div>
      ) : null}

      {noActiveButHasClosed ? (
        <div className="mb-5 flex flex-col items-start gap-3 rounded-[12px] border border-[#E4E7EC] bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[14px] font-medium text-[#101828]">No active leads</p>
            <p className="mt-0.5 text-[13px] text-[#667085]">
              Your closed deals are still available under Closed.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-[10px] border border-[#E4E7EC] bg-white px-3 text-[13px] font-medium text-[#101828] hover:bg-[#F9FAFB]"
            onClick={() => setTab("closed")}
          >
            View closed leads
          </button>
        </div>
      ) : null}

      {hasSearchNoMatch ? (
        <div className="mb-6 flex flex-col items-center justify-center rounded-[12px] border border-dashed border-[#E4E7EC] bg-white px-4 py-12 text-center">
          <p className="text-[15px] font-medium text-[#101828]">
            No leads match “{searchQuery.trim()}”
          </p>
          <p className="mt-1 max-w-sm text-[13px] text-[#667085]">
            Try another name, phone number, email, project type or budget.
          </p>
          <button
            type="button"
            className="mt-4 text-[13px] font-medium text-[#2684FF]"
            onClick={() => setSearchQuery("")}
          >
            Clear search
          </button>
        </div>
      ) : viewMode === "picks" ? (
        <div>
          <div className="mb-4">
            <h2 className="text-[16px] font-semibold text-[#101828]">Convert-later picks</h2>
            <p className="mt-1 text-[13px] text-[#667085]">
              Leads you saved during follow-ups because they may be ready to convert later.
            </p>
          </div>
          {picksLeads.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-[#E4E7EC] bg-white">
              <EmptyState
                icon={Star}
                title="No picks yet"
                description="Save a promising lead to your picks during a follow-up and it will appear here."
              />
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
          <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {COLS.map((col) => {
              const count = grouped[col]?.length ?? 0;
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
                    "inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-[10px] border px-3 text-[12px] font-medium transition-colors duration-150",
                    isActive
                      ? "border-transparent bg-[#101828] text-white"
                      : "border-[#E4E7EC] bg-white text-[#667085]",
                  ].join(" ")}
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: PIPELINE_STAGE_ACCENT[col] }}
                    aria-hidden
                  />
                  {PIPELINE_STAGE_LABEL[col]}
                  <span className="font-mono tabular-nums opacity-80">{count}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setViewMode("picks")}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-[#E4E7EC] bg-white px-3 text-[12px] font-medium text-[#667085]"
            >
              <Star size={12} strokeWidth={1.8} aria-hidden />
              Picks
              {picksCount > 0 ? (
                <span className="font-mono tabular-nums opacity-80">{picksCount}</span>
              ) : null}
            </button>
          </div>
          <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            {(grouped[activeColumn]?.length ?? 0) === 0 ? (
              <div className="rounded-[12px] border border-dashed border-[#E4E7EC] bg-[#FCFCFD] px-4 py-10 text-center text-[13px] text-[#98A2B3]">
                No leads in {PIPELINE_STAGE_LABEL[activeColumn]}
              </div>
            ) : (
              <div className="space-y-3">
                {grouped[activeColumn]!.map((l) => (
                  <PipelineLeadCard
                    key={l.id}
                    lead={l}
                    intentScore={l.score ?? null}
                    repName={repName}
                    onOpenLogSheet={openLogSheet}
                    onOpenLead={openLead}
                    onLeadUpdated={handleLeadUpdated}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="relative pb-10">
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="overflow-x-auto pb-1">
              <div
                className="grid min-w-0 gap-3"
                style={{
                  gridTemplateColumns: "repeat(4, minmax(220px, 1fr))",
                  minWidth: "min(100%, 920px)",
                }}
              >
                {COLS.map((col) => (
                  <Droppable droppableId={col} key={col}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex min-h-[14rem] min-w-0 flex-col overflow-hidden rounded-[12px] border bg-white transition-[border-color,background-color] duration-150 ${
                          snapshot.isDraggingOver
                            ? "border-[#2684FF]/60 bg-[#F8FBFF]"
                            : "border-[#E4E7EC]"
                        }`}
                      >
                        <div
                          className="h-[3px] w-full shrink-0"
                          style={{ background: PIPELINE_STAGE_ACCENT[col] }}
                          aria-hidden
                        />
                        <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
                          <span className="truncate text-[11px] font-semibold uppercase tracking-[0.06em] text-[#667085]">
                            {PIPELINE_STAGE_LABEL[col]}
                          </span>
                          <span className="inline-flex h-5 min-w-[22px] items-center justify-center rounded-md bg-[#F2F4F7] px-1.5 font-mono text-[11px] text-[#667085]">
                            {grouped[col]?.length ?? 0}
                          </span>
                        </div>
                        <div className="flex min-h-[8rem] flex-1 flex-col gap-2 px-2 pb-3">
                          {(grouped[col]?.length ?? 0) === 0 ? (
                            <div className="flex flex-1 items-center justify-center rounded-[10px] border border-dashed border-[#E4E7EC] px-2 py-8 text-center text-[12px] text-[#98A2B3]">
                              No leads in {PIPELINE_STAGE_LABEL[col]}
                            </div>
                          ) : null}
                          {grouped[col]?.map((l, index) => (
                            <Draggable draggableId={l.id} index={index} key={l.id}>
                              {(p, s) => (
                                <div
                                  ref={p.innerRef}
                                  {...p.draggableProps}
                                  {...p.dragHandleProps}
                                  className={`min-w-0 cursor-grab active:cursor-grabbing ${
                                    s.isDragging
                                      ? "relative z-50 scale-[1.02] rounded-[12px] shadow-[0_8px_24px_rgba(16,24,40,0.12)]"
                                      : ""
                                  }`}
                                >
                                  <PipelineLeadCard
                                    lead={l}
                                    compact
                                    intentScore={l.score ?? null}
                                    repName={repName}
                                    onOpenLogSheet={openLogSheet}
                                    onOpenLead={openLead}
                                    onLeadUpdated={handleLeadUpdated}
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
            </div>
          </DragDropContext>

          <div className="pointer-events-none absolute bottom-0 left-1/2 z-10 -translate-x-1/2">
            <div className="pointer-events-none inline-flex items-center gap-1.5 rounded-full border border-[#E4E7EC] bg-white/95 px-3 py-1.5 text-[12px] text-[#667085] shadow-[0_1px_2px_rgba(16,24,40,0.04)] backdrop-blur-sm">
              <Info size={13} strokeWidth={1.8} className="text-[#98A2B3]" aria-hidden />
              Drag & drop leads between stages to update status
            </div>
          </div>
        </div>
      )}

      {sheet}
      {detailPanel}
    </div>
  );
}
