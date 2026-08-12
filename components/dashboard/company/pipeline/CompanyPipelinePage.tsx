"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { KpiCard } from "@/components/dashboard/sales/KpiCard";
import { CompanyWorkspaceShell } from "../CompanyWorkspaceShell";
import { CompanyDashboardHeader } from "../CompanyDashboardHeader";
import { CompanyPipelineTableCard } from "./CompanyPipelineTableCard";
import { CompanyPipelineDealPanel } from "./CompanyPipelineDealPanel";
import { useMediaQuery } from "@/components/dashboard/company/team/CompanyTeamInviteDialog";
import { Button, useSalesToast } from "@/components/sales/ui";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { LogCallForm } from "@/components/leads/LogCallForm";
import { LOST_REASONS } from "@/lib/call-log-constants";
import { NEXT_ACTION_OPTIONS } from "@/lib/sales/deals/create-deal-form";
import {
  COMPANY_PIPELINE_PAGE_SIZE,
  companyPipelineFiltersActive,
  matchesCompanyPipelineFilters,
  matchesCompanyPipelineSearch,
  matchesCompanyPipelineTab,
  sortCompanyPipelineRows,
} from "@/lib/sales/company-pipeline-metrics";
import type { DealStage } from "@/types";
import type {
  CompanyPipelineDealDetail,
  CompanyPipelineFilters,
  CompanyPipelineGroupBy,
  CompanyPipelinePageData,
  CompanyPipelineSort,
  CompanyPipelineTab,
} from "./types";
import { DEFAULT_COMPANY_PIPELINE_FILTERS } from "./types";
import type { UserRole } from "@/types";

type DialogKind =
  | { type: "log"; leadId: string }
  | { type: "schedule"; dealId: string }
  | { type: "owner"; dealId: string; ownerId: string | null }
  | { type: "stage"; dealId: string; stage: DealStage }
  | { type: "won"; dealId: string; valueLabel: string }
  | { type: "lost"; dealId: string }
  | null;

export function CompanyPipelinePage({
  data,
  unreadNotifications,
  notificationRole,
  userName,
  avatarUrl,
  companyLogoUrl,
  whatsappBadge = 0,
}: {
  data: CompanyPipelinePageData;
  unreadNotifications: number;
  notificationRole: UserRole;
  userName: string;
  avatarUrl?: string | null;
  companyLogoUrl?: string | null;
  whatsappBadge?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useSalesToast();
  const overlayPanel = useMediaQuery("(max-width: 1279px)");
  const stackedSplit = useMediaQuery("(max-width: 767px)");

  const [tab, setTab] = useState<CompanyPipelineTab>(() => {
    const id = searchParams.get("deal");
    const row = data.rows.find((r) => r.id === id);
    if (row?.stage === "WON" || row?.stage === "LOST") return row.stage;
    return "all";
  });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<CompanyPipelineFilters>(() => {
    const health = searchParams.get("health");
    if (health === "at_risk" || health === "needs_attention" || health === "on_track") {
      return { ...DEFAULT_COMPANY_PIPELINE_FILTERS, health };
    }
    return DEFAULT_COMPANY_PIPELINE_FILTERS;
  });
  const [groupBy, setGroupBy] = useState<CompanyPipelineGroupBy>("stage");
  const [sort, setSort] = useState<CompanyPipelineSort>("next_action");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(COMPANY_PIPELINE_PAGE_SIZE);
  const [detail, setDetail] = useState<CompanyPipelineDealDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [busy, setBusy] = useState(false);

  const selectedId = searchParams.get("deal");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const health = searchParams.get("health");
    if (health === "at_risk" || health === "needs_attention" || health === "on_track") {
      setFilters((prev) => ({ ...prev, health }));
    }
  }, [searchParams]);

  const setDealParam = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set("deal", id);
      else params.delete("deal");
      const q = params.toString();
      const href = q ? `${pathname}?${q}` : pathname;
      if (id) router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const filtered = useMemo(() => {
    return data.rows.filter(
      (row) =>
        matchesCompanyPipelineTab(row, tab) &&
        matchesCompanyPipelineSearch(row, debouncedSearch) &&
        matchesCompanyPipelineFilters(row, filters)
    );
  }, [data.rows, tab, debouncedSearch, filters]);

  const sorted = useMemo(() => sortCompanyPipelineRows(filtered, sort), [filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [tab, debouncedSearch, filters, groupBy, sort, pageSize]);

  const selectedRow = useMemo(
    () => data.rows.find((r) => r.id === selectedId) ?? null,
    [data.rows, selectedId]
  );

  useEffect(() => {
    if (!selectedId) return;
    if (!filtered.some((r) => r.id === selectedId)) {
      setDealParam(null);
      setDetail(null);
    }
  }, [selectedId, filtered, setDealParam]);

  const loadDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const res = await fetch(`/api/client/pipeline/${id}`);
        if (!res.ok) throw new Error("failed");
        const json = (await res.json()) as { detail: CompanyPipelineDealDetail };
        setDetail(json.detail);
      } catch {
        setDetail(null);
        setDetailError("failed");
      } finally {
        setDetailLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError(null);
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const panelOpen = Boolean(selectedId);
  const tabScoped = data.rows.filter((r) => matchesCompanyPipelineTab(r, tab));
  const emptyKind: "none" | "search" | "filters" | "rows" =
    tabScoped.length === 0 && !debouncedSearch.trim() && !companyPipelineFiltersActive(filters)
      ? "none"
      : filtered.length === 0
        ? debouncedSearch.trim()
          ? "search"
          : "filters"
        : "rows";

  async function patchDeal(dealId: string, body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/client/pipeline/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast({ title: json.error || "Could not update this Deal.", tone: "error" });
        return false;
      }
      toast({ title: "Deal updated", tone: "success" });
      router.refresh();
      if (selectedId === dealId) void loadDetail(dealId);
      return true;
    } finally {
      setBusy(false);
    }
  }

  function openRow(id: string) {
    setDealParam(id);
  }

  const left = (
    <CompanyPipelineTableCard
      rows={paged}
      total={sorted.length}
      tab={tab}
      tabCounts={data.tabCounts}
      onTabChange={setTab}
      search={search}
      onSearchChange={setSearch}
      filters={filters}
      onFiltersChange={setFilters}
      groupBy={groupBy}
      onGroupByChange={setGroupBy}
      sort={sort}
      onSortChange={setSort}
      page={safePage}
      pageSize={pageSize}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      selectedId={selectedId}
      onSelect={openRow}
      owners={data.owners}
      sources={data.sources}
      canReassign={data.canReassign}
      onViewDeal={(row) => router.push(`/client/deals/${row.id}`)}
      onLogActivity={(row) => setDialog({ type: "log", leadId: row.originatingLeadId })}
      onSchedule={(row) => setDialog({ type: "schedule", dealId: row.id })}
      onChangeOwner={(row) => setDialog({ type: "owner", dealId: row.id, ownerId: row.ownerId })}
      onChangeStage={(row) => setDialog({ type: "stage", dealId: row.id, stage: row.stage })}
      onMarkWon={(row) => setDialog({ type: "won", dealId: row.id, valueLabel: row.valueLabel })}
      onMarkLost={(row) => setDialog({ type: "lost", dealId: row.id })}
      onClearSearch={() => setSearch("")}
      onClearFilters={() => setFilters(DEFAULT_COMPANY_PIPELINE_FILTERS)}
      emptyKind={emptyKind}
      searchQuery={debouncedSearch}
    />
  );

  const panel = (
    <CompanyPipelineDealPanel
      row={selectedRow}
      detail={detail}
      loading={detailLoading}
      error={detailError}
      onRetry={() => selectedId && void loadDetail(selectedId)}
      onClose={() => setDealParam(null)}
      onViewDeal={() => selectedId && router.push(`/client/deals/${selectedId}`)}
      onLogActivity={() =>
        selectedRow && setDialog({ type: "log", leadId: selectedRow.originatingLeadId })
      }
      onSchedule={() => selectedId && setDialog({ type: "schedule", dealId: selectedId })}
      onChangeOwner={() =>
        selectedRow &&
        setDialog({ type: "owner", dealId: selectedRow.id, ownerId: selectedRow.ownerId })
      }
      onChangeStage={(stage) => selectedId && void patchDeal(selectedId, { stage })}
      overlay={overlayPanel}
      stacked={stackedSplit}
    />
  );

  return (
    <CompanyWorkspaceShell
      companyName={data.clientName}
      companyLogoUrl={companyLogoUrl}
      userName={userName}
      avatarUrl={avatarUrl}
      unreadNotifications={unreadNotifications}
      notificationRole={notificationRole}
      whatsappBadge={whatsappBadge}
    >
      <CompanyDashboardHeader
        unreadNotifications={unreadNotifications}
        notificationRole={notificationRole}
        userName={userName}
        avatarUrl={avatarUrl}
        canAddLead
        breadcrumb="Company / Pipeline"
        title="Pipeline"
        description="Track and manage active Deals across your sales team."
        primaryAction={
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus size={16} strokeWidth={1.8} />}
            onClick={() => router.push(data.qualifiedLeadsHref)}
          >
            Create Deal
          </Button>
        }
      />

      <div
        className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
        data-course-target="company-pipeline-kpis"
      >
        {data.kpis.map((item) => (
          <KpiCard key={item.id} item={item} />
        ))}
      </div>

      {panelOpen && !overlayPanel ? (
        <div className="grid grid-cols-1 items-stretch gap-4 transition-[grid-template-columns] duration-200 xl:grid-cols-[minmax(0,1fr)_minmax(360px,30%)] xl:gap-4">
          {left}
          <div className="min-h-0 xl:sticky xl:top-0">{panel}</div>
        </div>
      ) : (
        left
      )}

      {panelOpen && overlayPanel ? panel : null}

      {dialog?.type === "log" ? (
        <PremiumSheet title="Log Activity" onClose={() => setDialog(null)} size="md">
          <LogCallForm
            leadId={dialog.leadId}
            appearance="premium"
            variant="compact"
            hasActiveDeal
            clientId={data.clientId}
            onLogged={() => {
              setDialog(null);
              router.refresh();
              if (selectedId) void loadDetail(selectedId);
            }}
            onSubmitSuccess={() => {
              setDialog(null);
              router.refresh();
              if (selectedId) void loadDetail(selectedId);
            }}
          />
        </PremiumSheet>
      ) : null}

      {dialog?.type === "schedule" ? (
        <ScheduleDialog
          busy={busy}
          onClose={() => setDialog(null)}
          onSave={async (label, at) => {
            const ok = await patchDeal(dialog.dealId, {
              next_action_label: label,
              next_action_at: at,
            });
            if (ok) setDialog(null);
          }}
        />
      ) : null}

      {dialog?.type === "owner" ? (
        <OwnerDialog
          owners={data.owners}
          currentId={dialog.ownerId}
          busy={busy}
          onClose={() => setDialog(null)}
          onSave={async (ownerId) => {
            const ok = await patchDeal(dialog.dealId, { ownerId });
            if (ok) setDialog(null);
          }}
        />
      ) : null}

      {dialog?.type === "stage" ? (
        <StageDialog
          stage={dialog.stage}
          busy={busy}
          onClose={() => setDialog(null)}
          onSave={async (stage) => {
            const ok = await patchDeal(dialog.dealId, { stage });
            if (ok) setDialog(null);
          }}
        />
      ) : null}

      {dialog?.type === "won" ? (
        <WonDialog
          hint={dialog.valueLabel}
          busy={busy}
          onClose={() => setDialog(null)}
          onSave={async (wonValue) => {
            const ok = await patchDeal(dialog.dealId, {
              close: { outcome: "WON", wonValue },
            });
            if (ok) setDialog(null);
          }}
        />
      ) : null}

      {dialog?.type === "lost" ? (
        <LostDialog
          busy={busy}
          onClose={() => setDialog(null)}
          onSave={async (lostReason) => {
            const ok = await patchDeal(dialog.dealId, {
              close: { outcome: "LOST", lostReason },
            });
            if (ok) setDialog(null);
          }}
        />
      ) : null}
    </CompanyWorkspaceShell>
  );
}

function ScheduleDialog({
  busy,
  onClose,
  onSave,
}: {
  busy: boolean;
  onClose: () => void;
  onSave: (label: string, at: string) => Promise<void>;
}) {
  const [label, setLabel] = useState<string>(NEXT_ACTION_OPTIONS[0]);
  const [at, setAt] = useState("");
  return (
    <PremiumSheet title="Schedule follow-up" onClose={onClose} size="sm">
      <label className="mb-1.5 block text-[12px] font-medium text-sales-text-secondary">Action</label>
      <select
        className="mb-3 h-10 w-full rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[13px] text-sales-text-primary"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      >
        {NEXT_ACTION_OPTIONS.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <label className="mb-1.5 block text-[12px] font-medium text-sales-text-secondary">When</label>
      <input
        type="datetime-local"
        className="mb-4 h-10 w-full rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[13px] text-sales-text-primary"
        value={at}
        onChange={(e) => setAt(e.target.value)}
      />
      <Button
        variant="primary"
        disabled={busy || !at}
        onClick={() => {
          const iso = new Date(at).toISOString();
          void onSave(label, iso);
        }}
      >
        Save
      </Button>
    </PremiumSheet>
  );
}

function OwnerDialog({
  owners,
  currentId,
  busy,
  onClose,
  onSave,
}: {
  owners: CompanyPipelinePageData["owners"];
  currentId: string | null;
  busy: boolean;
  onClose: () => void;
  onSave: (ownerId: string) => Promise<void>;
}) {
  const [ownerId, setOwnerId] = useState(currentId ?? owners[0]?.id ?? "");
  return (
    <PremiumSheet title="Change Owner" onClose={onClose} size="sm">
      <select
        className="mb-4 h-10 w-full rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[13px] text-sales-text-primary"
        value={ownerId}
        onChange={(e) => setOwnerId(e.target.value)}
      >
        {owners.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <Button variant="primary" disabled={busy || !ownerId} onClick={() => void onSave(ownerId)}>
        Reassign
      </Button>
    </PremiumSheet>
  );
}

function StageDialog({
  stage,
  busy,
  onClose,
  onSave,
}: {
  stage: DealStage;
  busy: boolean;
  onClose: () => void;
  onSave: (stage: DealStage) => Promise<void>;
}) {
  const [next, setNext] = useState(stage);
  return (
    <PremiumSheet title="Change Stage" onClose={onClose} size="sm">
      <select
        className="mb-4 h-10 w-full rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[13px] text-sales-text-primary"
        value={next}
        onChange={(e) => setNext(e.target.value as DealStage)}
      >
        {(["QUALIFIED", "SCOPING", "PROPOSAL_SENT", "NEGOTIATING"] as const).map((s) => (
          <option key={s} value={s}>
            {s === "PROPOSAL_SENT" ? "Proposal sent" : s === "NEGOTIATING" ? "Negotiating" : s === "SCOPING" ? "Scoping" : "Qualified"}
          </option>
        ))}
      </select>
      <Button variant="primary" disabled={busy} onClick={() => void onSave(next)}>
        Update stage
      </Button>
    </PremiumSheet>
  );
}

function WonDialog({
  hint,
  busy,
  onClose,
  onSave,
}: {
  hint: string;
  busy: boolean;
  onClose: () => void;
  onSave: (wonValue: number) => Promise<void>;
}) {
  const parsed = Number(String(hint).replace(/[^0-9.]/g, ""));
  const [value, setValue] = useState(Number.isFinite(parsed) && parsed > 0 ? String(parsed) : "");
  return (
    <PremiumSheet title="Mark Won" description="Enter the final Won value." onClose={onClose} size="sm">
      <input
        inputMode="decimal"
        className="mb-4 h-10 w-full rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[13px] text-sales-text-primary"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Final value"
      />
      <Button
        variant="primary"
        disabled={busy || !Number.isFinite(Number(value)) || Number(value) < 0}
        onClick={() => void onSave(Number(value))}
      >
        Mark Won
      </Button>
    </PremiumSheet>
  );
}

function LostDialog({
  busy,
  onClose,
  onSave,
}: {
  busy: boolean;
  onClose: () => void;
  onSave: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  return (
    <PremiumSheet title="Mark Lost" description="A lost reason is required." onClose={onClose} size="sm">
      <select
        className="mb-4 h-10 w-full rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[13px] text-sales-text-primary"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      >
        <option value="">Select a reason</option>
        {LOST_REASONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <Button variant="primary" disabled={busy || !reason} onClick={() => void onSave(reason)}>
        Mark Lost
      </Button>
    </PremiumSheet>
  );
}
