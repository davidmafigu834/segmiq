"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  Check,
  ChevronRight,
  Filter,
  Inbox,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Search,
  Trophy,
  X,
  XCircle,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { Avatar, Button, IconButton } from "@/components/sales/ui";
import { OverlayPortal } from "@/components/sales/ui/OverlayPortal";
import { useFocusTrap } from "@/components/sales/ui/useFocusTrap";
import {
  DEAL_ACTIVE_STAGES,
  DEAL_STAGE_LABEL,
  formatDealStage,
  isDealClosedStage,
  type DealActiveStage,
} from "@/lib/sales/deals";
import { formatLeadSource } from "@/lib/sales/leads-directory/format";
import { isWhatsAppInboundLead, whatsappInboxHref } from "@/lib/leads/whatsapp-lead-display";
import { openWhatsAppAndLog } from "@/lib/whatsapp-opener";
import {
  EMPTY_FILTERS,
  dealTemperature,
  nextActionBucket,
  type BoardFilters,
  type DealBoardSort,
  type DealTemperature,
  type NextActionBucket,
} from "@/lib/sales/pipeline-board-query";
import type { PipelineDealCardItem as DealBoardItem } from "@/components/sales/pipeline/PipelineDealCard";
import { cn } from "@/lib/ui/cn";

type Chip = { key: string; label: string; value: string; clear: () => void };

const NEXT_OPTIONS: { value: NextActionBucket; label: string }[] = [
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "none", label: "No next action planned" },
];

const SORT_OPTIONS: { value: DealBoardSort; label: string }[] = [
  { value: "attention", label: "Needs attention" },
  { value: "updated_desc", label: "Recently updated" },
  { value: "updated_asc", label: "Oldest updated" },
  { value: "next_soonest", label: "Next action due soonest" },
];

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MobilePipeline({
  tab,
  viewMode,
  closedFilter,
  query,
  filters,
  sortMode,
  mobileCol,
  stageCounts,
  activeDealCount,
  filterGroupCount,
  chips,
  boardItems,
  pickItems,
  closedItems,
  sourceOptions,
  selectedDealId,
  repName,
  emptyKind,
  visibleCount,
  onTab,
  onViewMode,
  onClosedFilter,
  onQuery,
  onStage,
  onApplyFilters,
  onSort,
  onClearFilters,
  onOpen,
  onMoveStage,
}: {
  tab: "active" | "closed";
  viewMode: "board" | "picks";
  closedFilter: "all" | "won" | "lost";
  query: string;
  filters: BoardFilters;
  sortMode: DealBoardSort;
  mobileCol: DealActiveStage;
  stageCounts: Record<DealActiveStage, number>;
  activeDealCount: number;
  filterGroupCount: number;
  chips: Chip[];
  boardItems: DealBoardItem[];
  pickItems: DealBoardItem[];
  closedItems: DealBoardItem[];
  sourceOptions: { key: string; label: string }[];
  selectedDealId: string | null;
  repName: string;
  emptyKind: "search" | "filter" | "none" | null;
  visibleCount: (draft: BoardFilters) => number;
  onTab: (tab: "active" | "closed") => void;
  onViewMode: (mode: "board" | "picks") => void;
  onClosedFilter: (filter: "all" | "won" | "lost") => void;
  onQuery: (value: string) => void;
  onStage: (stage: DealActiveStage) => void;
  onApplyFilters: (filters: BoardFilters) => void;
  onSort: (sort: DealBoardSort) => void;
  onClearFilters: () => void;
  onOpen: (dealId: string) => void;
  onMoveStage: (dealId: string, stage: DealActiveStage) => Promise<boolean>;
}) {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const [draftSort, setDraftSort] = useState(sortMode);
  const [actionItem, setActionItem] = useState<DealBoardItem | null>(null);
  const [moveItem, setMoveItem] = useState<DealBoardItem | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const sheetLayer = moveItem ? "move" : actionItem ? "actions" : filtersOpen ? "filters" : null;
  const sheetLayerRef = useRef(sheetLayer);
  sheetLayerRef.current = sheetLayer;

  useEffect(() => {
    const onPop = () => {
      const layer = sheetLayerRef.current;
      if (layer === "move") setMoveItem(null);
      else if (layer === "actions") setActionItem(null);
      else if (layer === "filters") setFiltersOpen(false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!sheetLayer) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeTop();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [sheetLayer]);

  function rememberLayer() {
    window.history.pushState({ pipelineSheet: true }, "");
  }

  function closeTop() {
    if (window.history.state?.pipelineSheet) {
      window.history.back();
      return;
    }
    if (sheetLayerRef.current === "move") setMoveItem(null);
    else if (sheetLayerRef.current === "actions") setActionItem(null);
    else setFiltersOpen(false);
  }

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const list = tab === "closed" ? closedItems : viewMode === "picks" ? pickItems : boardItems;
  const showStage = tab === "closed" || viewMode === "picks";

  return (
    <div className="sales-pipeline-mobile min-w-0 overflow-x-hidden">
      <div className="flex items-center gap-2">
        <h1 className="min-w-0 text-[25px] font-semibold leading-tight tracking-[-0.02em] text-sales-text-primary">
          My pipeline
        </h1>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-[11px] border border-sales-border text-sales-text-primary"
            aria-label="Search deals"
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((open) => !open)}
          >
            <Search size={18} strokeWidth={1.8} />
          </button>
          {tab === "active" ? (
            <button
              type="button"
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-[11px] border border-sales-border text-sales-text-primary"
              aria-label={filterGroupCount > 0 ? `Filter deals, ${filterGroupCount} active` : "Filter deals"}
              onClick={() => {
                setDraft(filters);
                setDraftSort(sortMode);
                rememberLayer();
                setFiltersOpen(true);
              }}
            >
              <Filter size={18} strokeWidth={1.8} />
              {filterGroupCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-sales-brand px-1 text-[10px] font-semibold text-sales-brand-text">
                  {filterGroupCount}
                </span>
              ) : null}
            </button>
          ) : null}
        </div>
      </div>

      {searchOpen ? (
        <label className="mt-3 block">
          <span className="sr-only">Search deals</span>
          <input
            ref={searchRef}
            type="search"
            value={query}
            placeholder="Search deals, customers..."
            onChange={(event) => onQuery(event.target.value)}
            className="h-11 w-full rounded-[11px] border border-sales-border bg-sales-surface px-3 text-[15px] text-sales-text-primary outline-none placeholder:text-sales-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sales-brand"
          />
        </label>
      ) : null}

      <p className="mt-3 text-[13px] text-sales-text-secondary">
        Active deals <span className="font-semibold tabular-nums text-sales-text-primary">{activeDealCount}</span>
      </p>

      <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-[12px] border border-sales-border bg-sales-surface-subtle p-1" role="tablist" aria-label="Pipeline status">
        {(["active", "closed"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className={cn(
              "min-h-11 rounded-[9px] text-[13px] font-semibold",
              tab === value ? "bg-sales-surface text-sales-brand shadow-[inset_0_0_0_1px_rgba(212,255,79,0.35)]" : "text-sales-text-secondary"
            )}
            onClick={() => onTab(value)}
          >
            {value === "active" ? "Active" : "Closed"}
          </button>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-[12px] border border-sales-border bg-sales-surface-subtle p-1" role="tablist" aria-label={tab === "active" ? "Board view" : "Closed deals"}>
        {tab === "active" ? (
          <>
            <button type="button" role="tab" aria-selected={viewMode === "board"} className={cn("min-h-11 rounded-[9px] text-[13px] font-semibold", viewMode === "board" ? "bg-sales-surface text-sales-brand" : "text-sales-text-secondary")} onClick={() => onViewMode("board")}>
              Board
            </button>
            <button type="button" role="tab" aria-selected={viewMode === "picks"} className={cn("col-span-2 min-h-11 rounded-[9px] text-[13px] font-semibold", viewMode === "picks" ? "bg-sales-surface text-sales-brand" : "text-sales-text-secondary")} onClick={() => onViewMode("picks")}>
              Picks{pickItems.length > 0 ? ` · ${pickItems.length}` : ""}
            </button>
          </>
        ) : (
          (["all", "won", "lost"] as const).map((value) => (
            <button key={value} type="button" role="tab" aria-selected={closedFilter === value} className={cn("min-h-11 rounded-[9px] text-[13px] font-semibold capitalize", closedFilter === value ? "bg-sales-surface text-sales-brand" : "text-sales-text-secondary")} onClick={() => onClosedFilter(value)}>
              {value}
            </button>
          ))
        )}
      </div>

      {tab === "active" && viewMode === "board" ? (
        <div className="mt-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-course-target="pipeline-board">
          {DEAL_ACTIVE_STAGES.map((stage) => (
            <button
              key={stage}
              type="button"
              data-course-target={`pipeline-stage-${stage.toLowerCase().replace(/_/g, "-")}`}
              aria-pressed={mobileCol === stage}
              className={cn(
                "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold",
                mobileCol === stage
                  ? "border-sales-brand bg-sales-brand text-sales-brand-text"
                  : "border-sales-border bg-sales-surface text-sales-text-secondary"
              )}
              onClick={() => onStage(stage)}
            >
              {DEAL_STAGE_LABEL[stage]}
              <span className="tabular-nums">{stageCounts[stage]}</span>
            </button>
          ))}
        </div>
      ) : null}

      {chips.length > 0 || sortMode !== "attention" ? (
        <div className="mt-3 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sortMode !== "attention" ? (
            <button type="button" className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-sales-border px-2.5 text-[12px] font-medium text-sales-text-primary" onClick={() => onSort("attention")}>
              {SORT_OPTIONS.find((option) => option.value === sortMode)?.label}
              <X size={12} aria-hidden />
              <span className="sr-only">Clear sort</span>
            </button>
          ) : null}
          {chips.map((chip) => (
            <button key={chip.key} type="button" className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-sales-border px-2.5 text-[12px] font-medium text-sales-text-primary" onClick={chip.clear}>
              {chip.value}
              <X size={12} aria-hidden />
              <span className="sr-only">Remove {chip.label} {chip.value}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-3 space-y-3">
        {list.length === 0 ? (
          <EmptyPipeline
            kind={emptyKind}
            stageLabel={DEAL_STAGE_LABEL[mobileCol]}
            tab={tab}
            viewMode={viewMode}
            onClear={() => {
              onQuery("");
              onClearFilters();
            }}
          />
        ) : (
          list.map((item) => (
            <MobileDealCard
              key={item.deal.id}
              item={item}
              selected={selectedDealId === item.deal.id}
              showStage={showStage}
              repName={repName}
              onOpen={onOpen}
              onActions={() => {
                rememberLayer();
                setActionItem(item);
              }}
            />
          ))
        )}
      </div>

      {actionItem && !moveItem ? (
        <DealActionsSheet
          item={actionItem}
          onClose={closeTop}
          onOpen={() => {
            onOpen(actionItem.deal.id);
            closeTop();
          }}
          onMove={() => {
            rememberLayer();
            setMoveItem(actionItem);
          }}
          onEdit={() => router.push(`/sales/deals/${actionItem.deal.id}?edit=details`)}
          onWon={() => router.push(`/sales/deals/${actionItem.deal.id}?close=won`)}
          onLost={() => router.push(`/sales/deals/${actionItem.deal.id}?close=lost`)}
        />
      ) : null}

      {moveItem ? (
        <MoveDealSheet
          item={moveItem}
          onClose={closeTop}
          onMoveStage={onMoveStage}
        />
      ) : null}

      {filtersOpen ? (
        <FilterDealsSheet
          draft={draft}
          draftSort={draftSort}
          sources={sourceOptions}
          count={visibleCount(draft)}
          onChange={setDraft}
          onSort={setDraftSort}
          onClose={closeTop}
          onClear={() => {
            setDraft(EMPTY_FILTERS);
            setDraftSort("attention");
            onClearFilters();
          }}
          onApply={() => {
            onApplyFilters(draft);
            onSort(draftSort);
            closeTop();
          }}
        />
      ) : null}
    </div>
  );
}

function EmptyPipeline({
  kind,
  stageLabel,
  tab,
  viewMode,
  onClear,
}: {
  kind: "search" | "filter" | "none" | null;
  stageLabel: string;
  tab: "active" | "closed";
  viewMode: "board" | "picks";
  onClear: () => void;
}) {
  const filtered = kind === "search" || kind === "filter";
  const title = filtered
    ? "No matching deals"
    : tab === "closed"
      ? "No closed deals yet"
      : viewMode === "picks"
        ? "No priority deals need attention right now"
        : `No deals in ${stageLabel}`;
  const description = filtered
    ? "Try adjusting your filters to find more opportunities."
    : tab === "closed"
      ? "Deals you win or lose will appear here."
      : viewMode === "picks"
        ? "Your active deals have clear next actions."
        : "Deals in this stage will appear here.";
  return (
    <div className="rounded-[16px] border border-sales-border bg-sales-surface px-4 py-8 text-center">
      <Inbox className="mx-auto h-5 w-5 text-sales-text-muted" strokeWidth={1.6} />
      <p className="mt-3 text-[16px] font-semibold text-sales-text-primary">{title}</p>
      <p className="mt-1 text-[13px] text-sales-text-secondary">{description}</p>
      {filtered ? (
        <button type="button" className="mt-4 min-h-11 text-[14px] font-semibold text-sales-brand" onClick={onClear}>
          Clear filters
        </button>
      ) : null}
      {kind === "none" ? (
        <Link href="/sales/leads" className="mt-4 inline-flex min-h-11 items-center text-[14px] font-semibold text-sales-brand">
          View leads
        </Link>
      ) : null}
    </div>
  );
}

function MobileDealCard({
  item,
  selected,
  showStage,
  repName,
  onOpen,
  onActions,
}: {
  item: DealBoardItem;
  selected: boolean;
  showStage: boolean;
  repName: string;
  onOpen: (dealId: string) => void;
  onActions: () => void;
}) {
  const router = useRouter();
  const name = item.customerName?.trim() || "Customer";
  const company = item.customerCompany?.trim() || "";
  const temperature = dealTemperature(item);
  const bucket = nextActionBucket(item.deal, new Date());
  const closed = isDealClosedStage(item.deal.stage);
  const hasWhatsApp = isWhatsAppInboundLead(item.leadSource) || Boolean(item.customerPhone?.trim());
  const source = formatLeadSource(item.leadSource);
  const value = item.commercial.kind === "pending" ? "Value pending" : item.commercial.display;

  async function openWhatsApp() {
    if (isWhatsAppInboundLead(item.leadSource)) {
      router.push(whatsappInboxHref(item.deal.originating_lead_id));
      return;
    }
    if (!item.customerPhone) return;
    await openWhatsAppAndLog({
      leadId: item.deal.originating_lead_id,
      clientId: item.deal.client_id,
      leadName: item.customerName,
      leadPhone: item.customerPhone,
      repName,
      formData: {},
      tier: "neutral",
    });
  }

  return (
    <article
      data-course-target="pipeline-deal-card"
      className={cn(
        "rounded-[16px] border bg-sales-surface p-4",
        selected ? "border-sales-brand" : "border-sales-border"
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar name={name} size="md" />
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(item.deal.id)}>
          <span className="block truncate text-[17px] font-semibold tracking-[-0.01em] text-sales-text-primary">{name}</span>
          <span className="mt-0.5 block truncate text-[13px] text-sales-text-secondary">
            {company || item.deal.name}
            {showStage ? ` · ${formatDealStage(item.deal.stage)}` : ""}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          {temperature ? <TemperatureBadge value={temperature} /> : null}
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-[11px] text-sales-text-secondary"
            aria-label={`Deal actions for ${name}`}
            onClick={onActions}
          >
            <MoreHorizontal size={18} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1" data-course-target="pipeline-deal-value">
        <p className="text-[18px] font-semibold tabular-nums text-sales-text-primary">{value}</p>
        {item.leadSource ? <p className="text-[13px] text-sales-text-secondary">{source.label}</p> : null}
      </div>

      <div className="mt-3" data-course-target="pipeline-next-action">
        <NextActionNote item={item} bucket={bucket} closed={closed} />
      </div>

      {!closed ? (
        <div className="mt-3 flex gap-2">
          <Button
            variant={bucket === "none" ? "primary" : "secondary"}
            size="md"
            className="min-h-11 flex-1"
            onClick={() => router.push(`/sales/calendar?deal=${item.deal.id}`)}
          >
            {bucket === "none" ? "Plan follow-up" : "View follow-up"}
          </Button>
          {hasWhatsApp ? (
            <Button variant="secondary" size="md" className="min-h-11 shrink-0" aria-label={`WhatsApp ${name}`} onClick={() => void openWhatsApp()}>
              <SiWhatsapp aria-hidden />
              WhatsApp
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function TemperatureBadge({ value }: { value: DealTemperature }) {
  const label = value.charAt(0).toUpperCase() + value.slice(1);
  return (
    <span
      className={cn(
        "rounded-full px-2 py-1 text-[11px] font-semibold",
        value === "hot" && "bg-sales-danger-soft text-sales-danger-fg",
        value === "warm" && "bg-sales-warning-soft text-sales-warning-fg",
        value === "cold" && "bg-sales-surface-subtle text-sales-text-secondary"
      )}
    >
      {label}
    </span>
  );
}

function NextActionNote({
  item,
  bucket,
  closed,
}: {
  item: DealBoardItem;
  bucket: NextActionBucket;
  closed: boolean;
}) {
  if (closed) {
    return (
      <p className="text-[13px] text-sales-text-secondary">
        {item.deal.stage === "LOST" && item.deal.lost_reason ? item.deal.lost_reason : formatDealStage(item.deal.stage)}
      </p>
    );
  }
  if (bucket === "none") {
    return (
      <div className="rounded-[12px] bg-sales-warning-soft px-3 py-2.5">
        <p className="text-[13px] font-semibold text-sales-warning-fg">No next action planned</p>
        <p className="mt-0.5 text-[12px] text-sales-text-secondary">Plan your next follow-up to keep this deal moving.</p>
      </div>
    );
  }
  const when = item.deal.next_action_at ? formatWhen(item.deal.next_action_at) : "";
  const label = item.deal.next_action_label?.trim() || "Follow-up";
  if (bucket === "overdue") {
    return (
      <div className="rounded-[12px] bg-sales-danger-soft px-3 py-2.5">
        <p className="text-[13px] font-semibold text-sales-danger-fg">Follow-up overdue</p>
        <p className="mt-0.5 text-[12px] text-sales-text-secondary">
          {label}
          {when ? ` · ${when}` : ""}
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-[12px] bg-sales-surface-subtle px-3 py-2.5">
      <p className="text-[13px] font-semibold text-sales-text-primary">{bucket === "today" ? "Follow-up due today" : "Next follow-up scheduled"}</p>
      <p className="mt-0.5 text-[12px] text-sales-text-secondary">
        {label}
        {when ? ` · ${when}` : ""}
      </p>
    </div>
  );
}

function DealActionsSheet({
  item,
  onClose,
  onOpen,
  onMove,
  onEdit,
  onWon,
  onLost,
}: {
  item: DealBoardItem;
  onClose: () => void;
  onOpen: () => void;
  onMove: () => void;
  onEdit: () => void;
  onWon: () => void;
  onLost: () => void;
}) {
  const name = item.customerName?.trim() || "Customer";
  const closed = isDealClosedStage(item.deal.stage);
  return (
    <PhoneSheet title="Deal actions" description={name} onClose={onClose}>
      <div className="flex flex-col">
        <ActionRow icon={<MessageCircle size={18} />} title="View deal details" onClick={onOpen} />
        {!closed ? <ActionRow icon={<ArrowRightLeft size={18} />} title="Move to another stage" detail="Opens the stages for this deal" onClick={onMove} /> : null}
        <ActionRow icon={<Pencil size={18} />} title="Edit deal" onClick={onEdit} />
        {!closed ? (
          <div className="mt-2 border-t border-sales-border pt-2">
            <ActionRow icon={<Trophy size={18} />} title="Mark as won" detail="Opens the existing win flow" onClick={onWon} />
            <ActionRow icon={<XCircle size={18} />} title="Mark as lost" detail="Asks for the loss reason before closing" onClick={onLost} />
          </div>
        ) : null}
      </div>
    </PhoneSheet>
  );
}

function MoveDealSheet({
  item,
  onClose,
  onMoveStage,
}: {
  item: DealBoardItem;
  onClose: () => void;
  onMoveStage: (dealId: string, stage: DealActiveStage) => Promise<boolean>;
}) {
  const [saving, setSaving] = useState<DealActiveStage | null>(null);
  const name = item.customerName?.trim() || "Customer";
  const current = item.deal.stage;

  async function choose(stage: DealActiveStage) {
    if (saving || stage === current) return;
    setSaving(stage);
    const ok = await onMoveStage(item.deal.id, stage);
    setSaving(null);
    if (ok) onClose();
  }

  return (
    <PhoneSheet title="Move deal" description={name} onClose={onClose}>
      <p className="text-[13px] text-sales-text-secondary">
        Current stage: <span className="font-semibold text-sales-text-primary">{formatDealStage(current)}</span>
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {DEAL_ACTIVE_STAGES.map((stage) => {
          const selected = stage === current;
          return (
            <button
              key={stage}
              type="button"
              disabled={Boolean(saving) || selected}
              className={cn(
                "flex min-h-11 items-center justify-between rounded-[12px] border px-3 text-left text-[15px] font-semibold",
                selected ? "border-sales-brand text-sales-brand" : "border-sales-border text-sales-text-primary"
              )}
              onClick={() => void choose(stage)}
            >
              {DEAL_STAGE_LABEL[stage]}
              {selected ? <Check size={16} aria-hidden /> : saving === stage ? <span className="text-[12px] font-medium text-sales-text-secondary">Saving</span> : null}
            </button>
          );
        })}
      </div>
    </PhoneSheet>
  );
}

function FilterDealsSheet({
  draft,
  draftSort,
  sources,
  count,
  onChange,
  onSort,
  onClose,
  onClear,
  onApply,
}: {
  draft: BoardFilters;
  draftSort: DealBoardSort;
  sources: { key: string; label: string }[];
  count: number;
  onChange: (filters: BoardFilters) => void;
  onSort: (sort: DealBoardSort) => void;
  onClose: () => void;
  onClear: () => void;
  onApply: () => void;
}) {
  function toggleTemp(value: DealTemperature) {
    const has = draft.temperatures.includes(value);
    onChange({
      ...draft,
      temperatures: has ? draft.temperatures.filter((item) => item !== value) : [...draft.temperatures, value],
    });
  }
  function toggleNext(value: NextActionBucket) {
    const has = draft.nextActions.includes(value);
    onChange({
      ...draft,
      nextActions: has ? draft.nextActions.filter((item) => item !== value) : [...draft.nextActions, value],
    });
  }
  function toggleSource(key: string) {
    const has = draft.sources.includes(key);
    onChange({
      ...draft,
      sources: has ? draft.sources.filter((item) => item !== key) : [...draft.sources, key],
    });
  }

  return (
    <PhoneSheet
      title="Filter deals"
      description="Find the opportunities that matter."
      onClose={onClose}
      tall
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" size="md" className="min-h-11 flex-1" onClick={onClear}>
            Clear all
          </Button>
          <Button variant="primary" size="md" className="min-h-11 flex-[1.4]" onClick={onApply}>
            Show {count} {count === 1 ? "deal" : "deals"}
          </Button>
        </div>
      }
    >
      <FilterGroup label="Lead temperature">
        <div className="flex flex-wrap gap-2">
          {(["hot", "warm", "cold"] as const).map((value) => (
            <ChipButton key={value} selected={draft.temperatures.includes(value)} onClick={() => toggleTemp(value)}>
              {value.charAt(0).toUpperCase() + value.slice(1)}
            </ChipButton>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup label="Next action">
        <div className="flex flex-wrap gap-2">
          {NEXT_OPTIONS.map((option) => (
            <ChipButton key={option.value} selected={draft.nextActions.includes(option.value)} onClick={() => toggleNext(option.value)}>
              {option.label}
            </ChipButton>
          ))}
          <ChipButton selected={draft.atRisk} onClick={() => onChange({ ...draft, atRisk: !draft.atRisk })}>
            At risk
          </ChipButton>
        </div>
      </FilterGroup>
      {sources.length > 0 ? (
        <FilterGroup label="Lead source">
          <div className="flex flex-wrap gap-2">
            {sources.map((source) => (
              <ChipButton key={source.key} selected={draft.sources.includes(source.key)} onClick={() => toggleSource(source.key)}>
                {source.label}
              </ChipButton>
            ))}
          </div>
        </FilterGroup>
      ) : null}
      <FilterGroup label="Quote">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["any", "Any"],
              ["yes", "Has quote"],
              ["no", "No quote"],
            ] as const
          ).map(([value, label]) => (
            <ChipButton key={value} selected={draft.hasQuote === value} onClick={() => onChange({ ...draft, hasQuote: value })}>
              {label}
            </ChipButton>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup label="Sort by">
        <div className="flex flex-col gap-2">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={cn(
                "flex min-h-11 items-center justify-between rounded-[12px] border px-3 text-left text-[14px] font-medium",
                draftSort === option.value ? "border-sales-brand text-sales-text-primary" : "border-sales-border text-sales-text-secondary"
              )}
              onClick={() => onSort(option.value)}
            >
              {option.label}
              {draftSort === option.value ? <Check size={16} className="text-sales-brand" aria-hidden /> : null}
            </button>
          ))}
        </div>
      </FilterGroup>
    </PhoneSheet>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">{label}</h3>
      {children}
    </section>
  );
}

function ChipButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "min-h-11 rounded-full border px-3 text-[13px] font-semibold",
        selected ? "border-sales-brand bg-sales-brand-soft text-sales-text-primary" : "border-sales-border text-sales-text-secondary"
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ActionRow({
  icon,
  title,
  detail,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  detail?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="flex min-h-[56px] w-full items-center gap-3 py-2 text-left" onClick={onClick}>
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-sales-surface-subtle text-sales-text-secondary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-sales-text-primary">{title}</span>
        {detail ? <span className="block text-[12px] text-sales-text-secondary">{detail}</span> : null}
      </span>
      <ChevronRight size={16} className="shrink-0 text-sales-text-muted" aria-hidden />
    </button>
  );
}

function PhoneSheet({
  title,
  description,
  onClose,
  children,
  footer,
  tall = false,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  tall?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<number | null>(null);
  useFocusTrap(panelRef, true);

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-[var(--sales-z-modal,80)] flex items-end">
        <button type="button" className="sales-modal-backdrop absolute inset-0" aria-label="Close" onClick={onClose} />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={cn(
            "sales-pipeline-sheet relative z-[1] flex w-full flex-col overflow-hidden rounded-t-[22px] border border-b-0 border-sales-border bg-sales-surface shadow-sales-modal",
            tall ? "max-h-[min(88dvh,100%)]" : "max-h-[min(70dvh,100%)]"
          )}
        >
          <button
            type="button"
            className="flex h-6 w-full items-center justify-center"
            aria-label="Drag to close"
            onPointerDown={(event) => {
              dragStart.current = event.clientY;
            }}
            onPointerUp={(event) => {
              if (dragStart.current != null && event.clientY - dragStart.current > 48) onClose();
              dragStart.current = null;
            }}
          >
            <span className="h-1 w-10 rounded-full bg-sales-border" />
          </button>
          <div className="flex items-start gap-3 px-4 pb-3">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-[18px] font-semibold tracking-[-0.02em] text-sales-text-primary">
                {title}
              </h2>
              {description ? <p className="mt-0.5 truncate text-[13px] text-sales-text-secondary">{description}</p> : null}
            </div>
            <IconButton aria-label="Close" size="md" onClick={onClose}>
              <X strokeWidth={1.8} />
            </IconButton>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
          {footer ? (
            <div className="shrink-0 border-t border-sales-border bg-sales-surface px-4 py-3" style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
              {footer}
            </div>
          ) : (
            <div style={{ height: "env(safe-area-inset-bottom)" }} />
          )}
        </div>
      </div>
    </OverlayPortal>
  );
}
