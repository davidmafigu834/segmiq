"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { KpiCard } from "@/components/dashboard/sales/KpiCard";
import { CompanyWorkspaceShell } from "../CompanyWorkspaceShell";
import { CompanyDashboardHeader } from "../CompanyDashboardHeader";
import { CompanyLeadsTableCard } from "./CompanyLeadsTableCard";
import { CompanyLeadsLeadPanel } from "./CompanyLeadsLeadPanel";
import { useMediaQuery } from "@/components/dashboard/company/team/CompanyTeamInviteDialog";
import { Button, useSalesToast } from "@/components/sales/ui";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { useAddHubSheet } from "@/components/sales/AddToHubSheet";
import { CreateDealSheet } from "@/components/sales/deals/CreateDealSheet";
import { LogCallForm } from "@/components/leads/LogCallForm";
import {
  COMPANY_LEADS_PAGE_SIZE,
  companyLeadsFiltersActive,
  matchesCompanyLeadsFilters,
  matchesCompanyLeadsSearch,
  matchesCompanyLeadsTab,
  parseCompanyLeadsTab,
  sortCompanyLeadsRows,
} from "@/lib/sales/company-leads-metrics";
import type { LeadRow, UserRole } from "@/types";
import type {
  CompanyLeadDetail,
  CompanyLeadsFilters,
  CompanyLeadsPageData,
  CompanyLeadsSort,
  CompanyLeadsTab,
} from "./types";
import { DEFAULT_COMPANY_LEADS_FILTERS } from "./types";

type DialogKind =
  | { type: "log"; leadId: string }
  | { type: "schedule"; leadId: string }
  | { type: "owner"; leadIds: string[]; ownerId: string | null }
  | { type: "not_qualified"; leadId: string }
  | null;

export function CompanyLeadsPage({
  data,
  unreadNotifications,
  notificationRole,
  userName,
  avatarUrl,
  companyLogoUrl,
  whatsappBadge = 0,
}: {
  data: CompanyLeadsPageData;
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
  const { openAddHubSheet, addHubSheetProps } = useAddHubSheet();
  const { hubSheet } = addHubSheetProps("direct", {
    mode: "manager",
    clientId: data.clientId,
  });

  const [tab, setTab] = useState<CompanyLeadsTab>(() => {
    return (
      parseCompanyLeadsTab(searchParams.get("tab")) ||
      parseCompanyLeadsTab(searchParams.get("status")) ||
      "all"
    );
  });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<CompanyLeadsFilters>(() => {
    const assigned = searchParams.get("assignedToId");
    if (assigned) return { ...DEFAULT_COMPANY_LEADS_FILTERS, ownerId: assigned };
    return DEFAULT_COMPANY_LEADS_FILTERS;
  });
  const [sort, setSort] = useState<CompanyLeadsSort>("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(COMPANY_LEADS_PAGE_SIZE);
  const [detail, setDetail] = useState<CompanyLeadDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [busy, setBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [createDealLead, setCreateDealLead] = useState<LeadRow | null>(null);

  const selectedId = searchParams.get("lead");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const next =
      parseCompanyLeadsTab(searchParams.get("tab")) ||
      parseCompanyLeadsTab(searchParams.get("status"));
    if (next) setTab(next);
  }, [searchParams]);

  useEffect(() => {
    const assigned = searchParams.get("assignedToId");
    if (assigned) {
      setFilters((prev) => ({ ...prev, ownerId: assigned }));
    }
  }, [searchParams]);

  const setLeadParam = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set("lead", id);
      else params.delete("lead");
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
        matchesCompanyLeadsTab(row, tab) &&
        matchesCompanyLeadsSearch(row, debouncedSearch) &&
        matchesCompanyLeadsFilters(row, filters)
    );
  }, [data.rows, tab, debouncedSearch, filters]);

  const sorted = useMemo(() => sortCompanyLeadsRows(filtered, sort), [filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [tab, debouncedSearch, filters, sort, pageSize]);

  const selectedRow = useMemo(
    () => data.rows.find((r) => r.id === selectedId) ?? null,
    [data.rows, selectedId]
  );

  useEffect(() => {
    if (!selectedId) return;
    if (!filtered.some((r) => r.id === selectedId)) {
      const inAll = data.rows.some((r) => r.id === selectedId);
      if (inAll && tab !== "all") {
        setTab("all");
        return;
      }
      if (!inAll) {
        setLeadParam(null);
        setDetail(null);
      }
    }
  }, [selectedId, filtered, data.rows, tab, setLeadParam]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await fetch(
        `/api/client/leads/${id}?clientId=${encodeURIComponent(data.clientId)}`
      );
      if (!res.ok) throw new Error("failed");
      const json = (await res.json()) as { detail: CompanyLeadDetail };
      setDetail(json.detail);
    } catch {
      setDetail(null);
      setDetailError("failed");
    } finally {
      setDetailLoading(false);
    }
  }, [data.clientId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError(null);
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const panelOpen = Boolean(selectedId);
  const tabScoped = data.rows.filter((r) => matchesCompanyLeadsTab(r, tab));
  const emptyKind: "none" | "search" | "filters" | "rows" =
    tabScoped.length === 0 && !debouncedSearch.trim() && !companyLeadsFiltersActive(filters)
      ? "none"
      : filtered.length === 0
        ? debouncedSearch.trim()
          ? "search"
          : "filters"
        : "rows";

  function openRow(id: string) {
    setLeadParam(id);
  }

  function whatsappFor(row: { id: string; sourceRaw: string | null; phone: string | null }) {
    if (String(row.sourceRaw ?? "").toUpperCase().includes("WHATSAPP")) {
      router.push(`/client/inbox?lead=${row.id}`);
      return;
    }
    const digits = (row.phone ?? "").replace(/[^\d]/g, "");
    if (digits) window.open(`https://wa.me/${digits}`, "_blank", "noopener,noreferrer");
    else router.push(`/client/inbox?lead=${row.id}`);
  }

  async function reassign(leadIds: string[], ownerId: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/leads/bulk/reassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds, assigned_to_id: ownerId }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast({ title: json.error || "Could not reassign.", tone: "error" });
        return false;
      }
      toast({ title: "Owner updated", tone: "success" });
      setSelectedIds(new Set());
      router.refresh();
      if (selectedId && leadIds.includes(selectedId)) void loadDetail(selectedId);
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function patchLead(
    leadId: string,
    patch: {
      status?: "NOT_QUALIFIED";
      not_qualified_reason?: string | null;
      follow_up_date?: string | null;
    }
  ) {
    setBusy(true);
    try {
      // Company managers have a tenant-scoped qualification endpoint. Follow-up
      // changes use the canonical salesperson endpoint so ownership permissions
      // remain enforced by the server.
      const companyQualification = patch.status === "NOT_QUALIFIED" && data.canReassign;
      const res = await fetch(
        companyQualification ? `/api/client/leads/${leadId}` : `/api/leads/${leadId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }
      );
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast({ title: json.error || "Could not update this Lead.", tone: "error" });
        return false;
      }

      toast({
        title:
          patch.status === "NOT_QUALIFIED"
            ? "Lead marked Not Qualified"
            : patch.follow_up_date === null
              ? "Next action completed"
              : "Follow-up scheduled",
        tone: "success",
      });
      router.refresh();
      if (selectedId === leadId) void loadDetail(leadId);
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function openCreateDeal(leadId: string) {
    if (detail?.id === leadId && detail.leadForDeal) {
      setCreateDealLead(detail.leadForDeal);
      return;
    }
    const res = await fetch(
      `/api/client/leads/${leadId}?clientId=${encodeURIComponent(data.clientId)}`
    );
    if (!res.ok) {
      toast({ title: "Could not open Create Deal.", tone: "error" });
      return;
    }
    const json = (await res.json()) as { detail: CompanyLeadDetail };
    if (!json.detail.leadForDeal) {
      toast({
        title: json.detail.hasDeal
          ? "This Lead already has a Deal."
          : "You don’t have permission to create a Deal from this Lead.",
        tone: "error",
      });
      if (json.detail.openDealHref) router.push(json.detail.openDealHref);
      return;
    }
    setDetail(json.detail);
    setCreateDealLead(json.detail.leadForDeal);
  }

  const left = (
    <CompanyLeadsTableCard
      rows={paged}
      total={sorted.length}
      tab={tab}
      tabCounts={data.tabCounts}
      onTabChange={setTab}
      search={search}
      onSearchChange={setSearch}
      filters={filters}
      onFiltersChange={setFilters}
      sort={sort}
      onSortChange={setSort}
      page={safePage}
      pageSize={pageSize}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      selectedId={selectedId}
      onSelect={openRow}
      selectedIds={selectedIds}
      onToggleRow={(id, checked) => {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (checked) next.add(id);
          else next.delete(id);
          return next;
        });
      }}
      onTogglePage={(checked) => {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (const row of paged) {
            if (checked) next.add(row.id);
            else next.delete(row.id);
          }
          return next;
        });
      }}
      owners={data.owners}
      sources={data.sources}
      canReassign={data.canReassign}
      onView={(row) => openRow(row.id)}
      onCall={(row) => setDialog({ type: "log", leadId: row.id })}
      onWhatsApp={(row) => whatsappFor(row)}
      onAssign={(row) =>
        setDialog({
          type: "owner",
          leadIds: selectedIds.size > 1 && selectedIds.has(row.id) ? [...selectedIds] : [row.id],
          ownerId: row.ownerId,
        })
      }
      onSchedule={(row) => setDialog({ type: "schedule", leadId: row.id })}
      onCreateDeal={(row) => void openCreateDeal(row.id)}
      onOpenDeal={(row) => row.activeDealId && router.push(`/client/deals/${row.activeDealId}`)}
      onNotQualified={(row) => setDialog({ type: "not_qualified", leadId: row.id })}
      onClearSearch={() => setSearch("")}
      onClearFilters={() => setFilters(DEFAULT_COMPANY_LEADS_FILTERS)}
      onAddLead={openAddHubSheet}
      canAddLead={data.canAddLead}
      emptyKind={emptyKind}
      searchQuery={debouncedSearch}
    />
  );

  const panel = (
    <CompanyLeadsLeadPanel
      row={selectedRow}
      detail={detail}
      loading={detailLoading}
      error={detailError}
      onRetry={() => selectedId && void loadDetail(selectedId)}
      onClose={() => setLeadParam(null)}
      onCall={() => selectedId && setDialog({ type: "log", leadId: selectedId })}
      onWhatsApp={() => selectedRow && whatsappFor(selectedRow)}
      onAssign={() =>
        selectedRow &&
        setDialog({ type: "owner", leadIds: [selectedRow.id], ownerId: selectedRow.ownerId })
      }
      onSchedule={() => selectedId && setDialog({ type: "schedule", leadId: selectedId })}
      onNotQualified={() => selectedId && setDialog({ type: "not_qualified", leadId: selectedId })}
      onCreateDeal={() => selectedId && void openCreateDeal(selectedId)}
      onOpenDeal={() => {
        const href = detail?.openDealHref ?? (selectedRow?.activeDealId ? `/client/deals/${selectedRow.activeDealId}` : null);
        if (href) router.push(href);
      }}
      onViewDetails={() => {
        if (detail?.viewDetailsHref) router.push(detail.viewDetailsHref);
        else toast({ title: "This Lead is not linked to a contact profile yet.", tone: "info" });
      }}
      onCompleteNext={() => selectedId && void patchLead(selectedId, { follow_up_date: null })}
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
        canAddLead={data.canAddLead}
        breadcrumb="Company / Leads"
        title="Leads"
        description="Manage and follow up on new business enquiries."
        primaryAction={
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus size={16} strokeWidth={1.8} />}
            onClick={openAddHubSheet}
          >
            Add Lead
          </Button>
        }
      />

      <div
        className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
        data-course-target="company-leads-kpis"
      >
        {data.kpis.map((item) => {
          const href =
            notificationRole === "SUPER_ADMIN" && item.href
              ? `${item.href}${item.href.includes("?") ? "&" : "?"}clientId=${encodeURIComponent(data.clientId)}`
              : item.href;
          return <KpiCard key={item.id} item={href === item.href ? item : { ...item, href }} />;
        })}
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

      {hubSheet}

      {dialog?.type === "log" ? (
        <PremiumSheet title="Log call" onClose={() => setDialog(null)} size="md">
          <LogCallForm
            leadId={dialog.leadId}
            appearance="premium"
            variant="compact"
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
          onSave={async (at) => {
            const ok = await patchLead(dialog.leadId, { follow_up_date: at });
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
            const ok = await reassign(dialog.leadIds, ownerId);
            if (ok) setDialog(null);
          }}
        />
      ) : null}

      {dialog?.type === "not_qualified" ? (
        <NotQualifiedDialog
          busy={busy}
          onClose={() => setDialog(null)}
          onSave={async (reason) => {
            const ok = await patchLead(dialog.leadId, {
              status: "NOT_QUALIFIED",
              not_qualified_reason: reason || null,
            });
            if (ok) setDialog(null);
          }}
        />
      ) : null}

      {createDealLead ? (
        <CreateDealSheet
          lead={createDealLead}
          open
          onClose={() => setCreateDealLead(null)}
          onCreated={(deal, meta) => {
            setCreateDealLead(null);
            toast({
              title: meta?.alreadyExisted ? "Deal already exists" : "Deal created",
              tone: "success",
            });
            router.refresh();
            if (selectedId) void loadDetail(selectedId);
            if (deal?.id) router.push(`/client/deals/${deal.id}`);
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
  onSave: (at: string) => Promise<void>;
}) {
  const [at, setAt] = useState("");
  return (
    <PremiumSheet title="Schedule follow-up" onClose={onClose} size="sm">
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
          void onSave(iso);
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
  owners: CompanyLeadsPageData["owners"];
  currentId: string | null;
  busy: boolean;
  onClose: () => void;
  onSave: (ownerId: string) => Promise<void>;
}) {
  const [ownerId, setOwnerId] = useState(currentId ?? owners[0]?.id ?? "");
  return (
    <PremiumSheet title="Assign owner" onClose={onClose} size="sm">
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

function NotQualifiedDialog({
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
    <PremiumSheet title="Mark Not Qualified" onClose={onClose} size="sm">
      <p className="mb-3 text-[13px] text-sales-text-secondary">
        This Lead will stay in Leads. It will not become a Lost Deal.
      </p>
      <label className="mb-1.5 block text-[12px] font-medium text-sales-text-secondary">
        Reason (optional)
      </label>
      <textarea
        className="mb-4 min-h-[80px] w-full rounded-[10px] border border-sales-border bg-sales-surface px-3 py-2 text-[13px] text-sales-text-primary"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <Button variant="primary" disabled={busy} onClick={() => void onSave(reason.trim())}>
        Mark Not Qualified
      </Button>
    </PremiumSheet>
  );
}
