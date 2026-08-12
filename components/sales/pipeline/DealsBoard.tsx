"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Inbox, Search, X } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { SegmentedControl } from "@/components/sales/ui";
import {
  PipelineDealCard,
  type PipelineDealCardItem,
} from "@/components/sales/pipeline/PipelineDealCard";
import {
  DEAL_ACTIVE_STAGES,
  DEAL_STAGE_ACCENT,
  DEAL_STAGE_LABEL,
  formatDealStage,
  isDealActiveStage,
  isDealClosedStage,
  type DealActiveStage,
} from "@/lib/sales/deals/display";
import type { DealRow } from "@/types";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";

export type DealBoardItem = PipelineDealCardItem;

const COLS = DEAL_ACTIVE_STAGES;

function matchesSearch(item: DealBoardItem, q: string): boolean {
  const hay = [
    item.customerName,
    item.customerPhone,
    item.deal.name,
    item.deal.service_summary,
    item.deal.location,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function parseStageParam(raw: string | null): DealActiveStage | null {
  if (!raw) return null;
  return isDealActiveStage(raw) ? raw : null;
}

export function DealsBoard({
  initialItems,
  initialTab = "active",
  initialStage = null,
}: {
  initialItems: DealBoardItem[];
  initialTab?: "active" | "closed";
  initialStage?: DealActiveStage | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stageFromUrl = parseStageParam(searchParams.get("stage")) ?? initialStage;
  const isNarrow = useMediaQuery("(max-width: 900px)");
  const [items, setItems] = useState(initialItems);
  const [tab, setTab] = useState<"active" | "closed">(initialTab);
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<DealActiveStage | null>(stageFromUrl);
  const [mobileCol, setMobileCol] = useState<DealActiveStage>(stageFromUrl ?? "QUALIFIED");

  useEffect(() => {
    const next = parseStageParam(searchParams.get("stage"));
    if (next) {
      setStageFilter(next);
      setMobileCol(next);
      setTab("active");
    }
  }, [searchParams]);

  const clearStageFilter = useCallback(() => {
    setStageFilter(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("stage");
    const qs = params.toString();
    router.replace(qs ? `/sales/leads?${qs}` : "/sales/leads");
  }, [router, searchParams]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      const closed = isDealClosedStage(it.deal.stage);
      if (tab === "active" && closed) return false;
      if (tab === "closed" && !closed) return false;
      if (tab === "active" && stageFilter && it.deal.stage !== stageFilter) return false;
      if (q && !matchesSearch(it, q)) return false;
      return true;
    });
  }, [items, tab, query, stageFilter]);

  const byColumn = useMemo(() => {
    const map: Record<DealActiveStage, DealBoardItem[]> = {
      QUALIFIED: [],
      SCOPING: [],
      PROPOSAL_SENT: [],
      NEGOTIATING: [],
    };
    for (const it of filtered) {
      if ((COLS as readonly string[]).includes(it.deal.stage)) {
        map[it.deal.stage as DealActiveStage].push(it);
      }
    }
    return map;
  }, [filtered]);

  const closedItems = useMemo(
    () => filtered.filter((it) => isDealClosedStage(it.deal.stage)),
    [filtered]
  );

  const onMoved = useCallback((deal: DealRow) => {
    setItems((prev) =>
      prev.map((it) => (it.deal.id === deal.id ? { ...it, deal } : it))
    );
  }, []);

  const onDragEnd = useCallback(
    async (result: DropResult) => {
      if (!result.destination) return;
      const from = result.source.droppableId as DealActiveStage;
      const to = result.destination.droppableId as DealActiveStage;
      if (from === to) return;
      const dealId = result.draggableId;
      const prev = items;
      setItems((cur) =>
        cur.map((it) =>
          it.deal.id === dealId ? { ...it, deal: { ...it.deal, stage: to } } : it
        )
      );
      const res = await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: to }),
      });
      if (!res.ok) {
        setItems(prev);
        return;
      }
      const json = (await res.json().catch(() => ({}))) as { deal?: DealRow };
      if (json.deal) onMoved(json.deal);
    },
    [items, onMoved]
  );

  const pipelineValue = useMemo(() => {
    let sum = 0;
    let pending = 0;
    for (const it of filtered) {
      if (isDealClosedStage(it.deal.stage)) continue;
      const c = it.commercial;
      if (c.kind === "amount") sum += c.amount;
      else if (c.kind === "range") sum += (c.min + c.max) / 2;
      else pending += 1;
    }
    return { sum, pending };
  }, [filtered]);

  const visibleCols = stageFilter ? ([stageFilter] as readonly DealActiveStage[]) : COLS;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 layout:flex-row layout:items-center">
        <SegmentedControl
          value={tab}
          onChange={(v) => setTab(v as "active" | "closed")}
          options={[
            { value: "active", label: "Active deals" },
            { value: "closed", label: "Closed" },
          ]}
        />
        <div className="relative min-w-0 flex-1 layout:max-w-sm layout:ml-auto">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sales-text-tertiary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search deals"
            className="min-h-[44px] w-full rounded-[10px] border border-sales-border bg-sales-surface pl-9 pr-3 text-[13px] text-sales-text-primary outline-none focus:ring-2 focus:ring-sales-brand"
            aria-label="Search deals"
          />
        </div>
      </div>

      {tab === "active" && stageFilter ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-sales-sm border border-sales-border bg-sales-surface px-2 py-1 text-[12px] font-medium text-sales-text-primary">
            Stage: {DEAL_STAGE_LABEL[stageFilter]}
          </span>
          <button
            type="button"
            onClick={clearStageFilter}
            className="inline-flex min-h-9 items-center gap-1 rounded-sales-md px-2 text-[12px] font-semibold text-sales-text-secondary hover:bg-sales-surface-hover hover:text-sales-text-primary"
          >
            <X size={14} aria-hidden />
            Clear filter
          </button>
        </div>
      ) : null}

      {tab === "active" ? (
        <p className="text-[12px] text-sales-text-secondary">
          Pipeline value{" "}
          <span className="font-semibold text-sales-text-primary">
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            }).format(pipelineValue.sum)}
          </span>
          {pipelineValue.pending > 0
            ? ` · ${pipelineValue.pending} deal${pipelineValue.pending === 1 ? "" : "s"} without estimate`
            : null}
        </p>
      ) : null}

      {tab === "closed" ? (
        closedItems.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No closed deals yet"
            description="Won and lost deals will appear here."
          />
        ) : (
          <ul className="space-y-2">
            {closedItems.map((it) => (
              <li key={it.deal.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/sales/deals/${it.deal.id}`)}
                  className="flex w-full items-center justify-between rounded-[12px] border border-sales-border bg-sales-surface px-4 py-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-sales-text-primary">
                      {it.customerName || "Customer"}
                    </p>
                    <p className="truncate text-[12px] text-sales-text-secondary">{it.deal.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[12px] font-medium text-sales-text-primary">
                      {formatDealStage(it.deal.stage)}
                    </p>
                    <p className="text-[12px] text-sales-text-secondary">
                      {it.commercial.display}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={stageFilter ? `No deals in ${DEAL_STAGE_LABEL[stageFilter]}` : "No active deals yet"}
          description={
            stageFilter
              ? "Try another stage or clear the filter."
              : "Qualified opportunities will appear here once you create a Deal from a Lead."
          }
          action={
            stageFilter ? (
              <button
                type="button"
                onClick={clearStageFilter}
                className="inline-flex min-h-[44px] items-center rounded-[10px] bg-[#101828] px-4 text-[13px] font-semibold text-white dark:bg-[#D4FF4F] dark:text-[#101828]"
              >
                Show all stages
              </button>
            ) : (
              <Link
                href="/sales/call-now"
                className="inline-flex min-h-[44px] items-center rounded-[10px] bg-[#101828] px-4 text-[13px] font-semibold text-white dark:bg-[#D4FF4F] dark:text-[#101828]"
              >
                View leads
              </Link>
            )
          }
        />
      ) : isNarrow ? (
        <div className="space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(stageFilter ? [stageFilter] : COLS).map((col) => (
              <button
                key={col}
                type="button"
                onClick={() => setMobileCol(col)}
                className={`min-h-[40px] shrink-0 rounded-full px-3 text-[12px] font-medium ${
                  mobileCol === col
                    ? "bg-[#101828] text-white dark:bg-[#D4FF4F] dark:text-[#101828]"
                    : "border border-sales-border bg-sales-surface text-sales-text-secondary"
                }`}
              >
                {DEAL_STAGE_LABEL[col]} · {byColumn[col].length}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {byColumn[mobileCol].map((it) => (
              <PipelineDealCard
                key={it.deal.id}
                item={it}
                compact
                onOpen={(id) => router.push(`/sales/deals/${id}`)}
                onMoved={onMoved}
              />
            ))}
          </div>
        </div>
      ) : (
        <DragDropContext onDragEnd={(r) => void onDragEnd(r)}>
          <div
            className={`grid gap-3 ${
              visibleCols.length === 1 ? "grid-cols-1 layout:max-w-md" : "grid-cols-4"
            }`}
          >
            {visibleCols.map((col) => (
              <div key={col} className="min-w-0" id={`pipeline-stage-${col}`}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: DEAL_STAGE_ACCENT[col] }}
                  />
                  <h3 className="text-[12px] font-semibold text-sales-text-primary">
                    {DEAL_STAGE_LABEL[col]}
                  </h3>
                  <span className="text-[11px] text-sales-text-tertiary">
                    {byColumn[col].length}
                  </span>
                </div>
                <Droppable droppableId={col}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="min-h-[12rem] space-y-2 rounded-[12px] border border-dashed border-sales-border/80 bg-[#F8F9FB]/40 p-2 dark:bg-[#111411]/40"
                    >
                      {byColumn[col].map((it, index) => (
                        <Draggable key={it.deal.id} draggableId={it.deal.id} index={index}>
                          {(drag) => (
                            <div
                              ref={drag.innerRef}
                              {...drag.draggableProps}
                              {...drag.dragHandleProps}
                            >
                              <PipelineDealCard
                                item={it}
                                onOpen={(id) => router.push(`/sales/deals/${id}`)}
                                onMoved={onMoved}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      )}
    </div>
  );
}
