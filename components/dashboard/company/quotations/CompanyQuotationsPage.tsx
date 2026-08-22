"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CircleCheck,
  Clock3,
  Download,
  Plus,
  Send,
  Settings2,
  WalletCards,
} from "lucide-react";
import { CompanyWorkspaceShell } from "@/components/dashboard/company/CompanyWorkspaceShell";
import { CompanyDashboardHeader } from "@/components/dashboard/company/CompanyDashboardHeader";
import { useMediaQuery } from "@/components/dashboard/company/team/CompanyTeamInviteDialog";
import { Button, Skeleton, useSalesToast } from "@/components/sales/ui";
import { CreateQuoteDialog } from "@/components/sales/quotes/CreateQuoteDialog";
import { CompanyQuotationKpi } from "./CompanyQuotationKpi";
import { CompanyQuotationDetailPanel } from "./CompanyQuotationDetailPanel";
import { CompanyQuotationsTable } from "./CompanyQuotationsTable";
import {
  COMPANY_QUOTATIONS_PAGE_SIZE,
  COMPANY_QUOTATION_TABS,
  DEFAULT_COMPANY_QUOTATION_FILTERS,
  buildCompanyQuotationsCsv,
  companyQuotationEmptyKind,
  companyQuotationFiltersActive,
  companyQuotationIsPendingApproval,
  companyQuotationMatchesFilters,
  companyQuotationMatchesSearch,
  companyQuotationMatchesTab,
  formatAttentionValue,
  sortCompanyQuotations,
  type CompanyQuotationFilters,
  type CompanyQuotationsSort,
} from "@/lib/sales/company-quotations";
import { fetchQuotationPdfBlob } from "@/lib/share-quotation-pdf";
import { cn } from "@/lib/ui/cn";
import type { QuotationWorkspacePayload } from "@/lib/quotations/workspace-data";
import type { UserRole } from "@/types";
import type {
  CompanyQuotationRow,
  CompanyQuotationTab,
  CompanyQuotationsPageData,
} from "./types";

export function CompanyQuotationsPage({
  data,
  loadError = null,
  unreadNotifications,
  notificationRole,
  userName,
  avatarUrl,
  companyLogoUrl,
  whatsappBadge = 0,
}: {
  data: CompanyQuotationsPageData;
  loadError?: string | null;
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
  const stackedPanel = useMediaQuery("(max-width: 767px)");
  const permissions = data.permissions;

  const [tab, setTab] = useState<CompanyQuotationTab>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<CompanyQuotationFilters>(
    DEFAULT_COMPANY_QUOTATION_FILTERS
  );
  const [sort, setSort] = useState<CompanyQuotationsSort>("updated_desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(COMPANY_QUOTATIONS_PAGE_SIZE);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [workspace, setWorkspace] = useState<QuotationWorkspacePayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const selectedId = searchParams.get("quotation");
  const selectedRow = useMemo(
    () => data.rows.find((row) => row.id === selectedId) ?? null,
    [data.rows, selectedId]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const setQuotationParam = useCallback(
    (id: string | null, push = false) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set("quotation", id);
      else params.delete("quotation");
      const next = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      if (push) router.push(next, { scroll: false });
      else router.replace(next, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const filtered = useMemo(() => {
    const matched = data.rows.filter(
      (row) =>
        companyQuotationMatchesTab(row, tab) &&
        companyQuotationMatchesSearch(row, debouncedSearch) &&
        companyQuotationMatchesFilters(row, filters)
    );
    return sortCompanyQuotations(matched, sort);
  }, [data.rows, tab, debouncedSearch, filters, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const emptyKind = companyQuotationEmptyKind({
    allCount: data.rows.length,
    filteredCount: filtered.length,
    search: debouncedSearch,
    filtersActive: companyQuotationFiltersActive(filters),
  });

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [tab, debouncedSearch, filters, pageSize, sort]);

  useEffect(() => {
    if (selectedId && !data.rows.some((row) => row.id === selectedId)) {
      setQuotationParam(null);
    }
  }, [data.rows, selectedId, setQuotationParam]);

  const loadWorkspace = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailError(false);
    try {
      const response = await fetch(`/api/quotations/${id}/workspace`);
      const json = (await response.json()) as QuotationWorkspacePayload & { error?: string };
      if (!response.ok || !json.quotation) throw new Error(json.error || "Failed");
      setWorkspace(json);
      return json;
    } catch {
      setWorkspace(null);
      setDetailError(true);
      return null;
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setWorkspace(null);
      setDetailError(false);
      return;
    }
    void loadWorkspace(selectedId);
  }, [selectedId, loadWorkspace]);

  const attention = data.attention;
  const kpis = [
    {
      label: "Pending approval",
      value: String(attention.pendingApproval),
      supporting:
        attention.pendingApproval > 0
          ? `${formatAttentionValue(attention.pendingApprovalValue, data.currency)} awaiting approval`
          : "Queue is clear",
      icon: Clock3,
      tone: "warning" as const,
      onClick: () => setTab("pending_approval"),
    },
    {
      label: "Needs attention",
      value: String(attention.needsAttention),
      supporting: "Follow-up, expiry or changes",
      icon: AlertTriangle,
      tone: "neutral" as const,
      onClick: () => setTab("needs_attention"),
    },
    {
      label: "Awaiting customer",
      value: String(attention.awaitingCustomer),
      supporting: "Sent or viewed",
      icon: Send,
      tone: "blue" as const,
      onClick: () => setTab("sent"),
    },
    {
      label: "Accepted quotation value",
      value: formatAttentionValue(attention.acceptedValue, data.currency),
      supporting: "Accepted offers, not revenue",
      icon: CircleCheck,
      tone: "success" as const,
      onClick: () => setTab("accepted"),
    },
    {
      label: "Expiring soon",
      value: String(attention.expiringSoon),
      supporting: "Next 7 days",
      icon: WalletCards,
      tone: "warning" as const,
      onClick: () => setTab("needs_attention"),
    },
  ];

  function downloadCsv(rows: CompanyQuotationRow[], suffix = "filtered") {
    if (rows.length === 0) {
      toast({ title: "No quotations to export", tone: "info" });
      return;
    }
    const blob = new Blob([buildCompanyQuotationsCsv(rows)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `segmiq-quotations-${suffix}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast({ title: `${rows.length} quotations exported`, tone: "success" });
  }

  async function duplicate(row: CompanyQuotationRow) {
    try {
      const response = await fetch(`/api/quotations/${row.id}/duplicate`, { method: "POST" });
      const json = (await response.json()) as { quotation?: { id: string }; error?: string };
      if (!response.ok || !json.quotation) throw new Error(json.error || "Failed");
      toast({ title: "Draft duplicated", tone: "success" });
      router.push(`/sales/quotes/${json.quotation.id}`);
    } catch {
      toast({ title: "Couldn’t duplicate quotation", tone: "error" });
    }
  }

  async function revise(row: CompanyQuotationRow) {
    try {
      const response = await fetch(`/api/quotations/${row.id}/revise`, { method: "POST" });
      const json = (await response.json()) as { quotation?: { id: string }; error?: string };
      if (!response.ok || !json.quotation) throw new Error(json.error || "Failed");
      toast({ title: "Revision created", description: "The original remains locked.", tone: "success" });
      router.push(`/sales/quotes/${json.quotation.id}`);
    } catch {
      toast({ title: "Couldn’t create a revision", tone: "error" });
    }
  }

  async function viewPdf(row: CompanyQuotationRow) {
    try {
      const blob = await fetchQuotationPdfBlob(row.id, "api");
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast({
        title: "We couldn't prepare this quotation PDF. Try again.",
        tone: "error",
      });
    }
  }

  const openDeal = (row: CompanyQuotationRow) => {
    if (row.dealId) router.push(`/client/deals/${row.dealId}`);
  };
  const openCustomer = (row: CompanyQuotationRow) => {
    if (row.contactId) router.push(`/client/contacts/${row.contactId}`);
  };
  const openWorkspace = (row: CompanyQuotationRow) => {
    if (permissions.alsoSells) {
      router.push(`/sales/quotes/${row.id}`);
      return;
    }
    setQuotationParam(row.id, true);
  };

  const selectedRows = data.rows.filter((row) => selectedIds.has(row.id));
  const approvalSelected = selectedRow ? companyQuotationIsPendingApproval(selectedRow) : false;

  const table = (
    <CompanyQuotationsTable
      data={data}
      rows={pageRows}
      tab={tab}
      search={search}
      onSearchChange={setSearch}
      filters={filters}
      onFiltersChange={setFilters}
      page={safePage}
      pageCount={pageCount}
      pageSize={pageSize}
      total={filtered.length}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      sort={sort}
      onSortChange={setSort}
      emptyKind={emptyKind}
      loadError={loadError}
      searchQuery={debouncedSearch}
      onRetry={() => router.refresh()}
      onCreate={() => setCreateOpen(true)}
      selectedId={selectedId}
      selectedIds={selectedIds}
      onToggleRow={(id, checked) =>
        setSelectedIds((previous) => {
          const next = new Set(previous);
          if (checked) next.add(id);
          else next.delete(id);
          return next;
        })
      }
      onTogglePage={(checked) =>
        setSelectedIds((previous) => {
          const next = new Set(previous);
          for (const row of pageRows) {
            if (checked) next.add(row.id);
            else next.delete(row.id);
          }
          return next;
        })
      }
      onSelect={(id) => setQuotationParam(id, true)}
      onViewPdf={viewPdf}
      onEdit={(row) => openWorkspace(row)}
      onDuplicate={(row) => void duplicate(row)}
      onRevise={(row) => void revise(row)}
      onOpenDeal={openDeal}
      onOpenCustomer={openCustomer}
      onOpenWorkspace={openWorkspace}
      onExportSelected={() => downloadCsv(selectedRows, "selected")}
      onClearSearch={() => setSearch("")}
      onClear={() => {
        setSearch("");
        setTab("all");
        setFilters(DEFAULT_COMPANY_QUOTATION_FILTERS);
      }}
    />
  );

  const panel = selectedRow ? (
    <CompanyQuotationDetailPanel
      row={selectedRow}
      workspace={workspace}
      loading={detailLoading}
      error={detailError}
      overlay={overlayPanel}
      stacked={stackedPanel}
      permissions={permissions}
      onRetry={() => void loadWorkspace(selectedRow.id)}
      onClose={() => setQuotationParam(null)}
      onViewPdf={() => viewPdf(selectedRow)}
      onOpenDeal={() => openDeal(selectedRow)}
      onOpenCustomer={() => openCustomer(selectedRow)}
      onOpenWorkspace={() => openWorkspace(selectedRow)}
      onDecided={() => {
        void loadWorkspace(selectedRow.id);
        router.refresh();
      }}
    />
  ) : null;

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
        breadcrumb="Company / Quotations"
        title="Quotations"
        description="Manage your team's commercial offers, approvals and customer responses."
        primaryAction={
          <>
            <Button
              variant="secondary"
              size="md"
              className="hidden min-[1180px]:inline-flex"
              leftIcon={<Download size={15} />}
              onClick={() => downloadCsv(filtered)}
            >
              Export
            </Button>
            {permissions.canManageSettings ? (
              <Button
                variant="secondary"
                size="md"
                className="hidden min-[1180px]:inline-flex"
                leftIcon={<Settings2 size={15} />}
                onClick={() => router.push("/client/quote-settings")}
              >
                Quotation settings
              </Button>
            ) : null}
            {permissions.alsoSells ? (
              <Button
                variant="secondary"
                size="md"
                leftIcon={<Plus size={16} />}
                data-course-target="quotation-create"
                onClick={() => setCreateOpen(true)}
              >
                Create quotation
              </Button>
            ) : null}
          </>
        }
      />

      <div className="flex items-center gap-2 layout:hidden">
        {permissions.alsoSells ? (
          <Button
            variant="secondary"
            size="md"
            className="flex-1"
            leftIcon={<Plus size={16} />}
            onClick={() => setCreateOpen(true)}
          >
            Create quotation
          </Button>
        ) : null}
        <Button
          variant="secondary"
          size="md"
          leftIcon={<Download size={15} />}
          onClick={() => downloadCsv(filtered)}
        >
          Export
        </Button>
        {permissions.canManageSettings ? (
          <Button
            variant="secondary"
            size="md"
            leftIcon={<Settings2 size={15} />}
            onClick={() => router.push("/client/quote-settings")}
          >
            Settings
          </Button>
        ) : null}
      </div>

      <div
        className="overflow-x-auto"
        data-course-target="company-quotations-tabs"
      >
        <div className="flex min-w-max items-end gap-5 border-b border-sales-border-subtle">
          {COMPANY_QUOTATION_TABS.map((item) => (
            <button
              type="button"
              key={item.id}
              className={cn(
                "relative flex h-10 items-center gap-2 whitespace-nowrap text-[12px] font-medium text-sales-text-secondary",
                tab === item.id && "font-semibold text-sales-text-primary"
              )}
              onClick={() => setTab(item.id)}
            >
              {item.label}
              <span className="inline-flex min-w-4 items-center justify-center text-[11px] tabular-nums text-sales-text-muted">
                {data.counts[item.id]}
              </span>
              {tab === item.id ? (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-sales-brand" />
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div
        className="grid w-full min-w-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"
        data-course-target="company-quotations-kpis"
      >
        {loadError
          ? kpis.map((item) => (
              <article
                key={item.label}
                className="sd-card flex h-full min-h-[76px] min-w-0 flex-col justify-between p-3 sm:min-h-[84px] sm:p-3.5"
              >
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-12" />
              </article>
            ))
          : kpis.map((item) => <CompanyQuotationKpi key={item.label} {...item} />)}
      </div>

      {selectedRow && !overlayPanel ? (
        <div
          className={cn(
            "grid min-w-0 grid-cols-1 items-start gap-4",
            approvalSelected
              ? "xl:grid-cols-[minmax(0,1fr)_minmax(400px,460px)]"
              : "xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]"
          )}
        >
          <div className="min-w-0 max-w-full">{table}</div>
          <div className="min-h-0 min-w-0 xl:sticky xl:top-0">{panel}</div>
        </div>
      ) : (
        <div className="min-w-0 max-w-full">{table}</div>
      )}

      {selectedRow && overlayPanel ? panel : null}

      {permissions.alsoSells ? (
        <CreateQuoteDialog
          open={createOpen}
          candidates={data.createCandidates}
          hasTemplates={data.hasTemplates}
          onClose={() => setCreateOpen(false)}
          onCreated={(quotation) => {
            setCreateOpen(false);
            toast({
              title: "Quotation draft created",
              description: "Continue in the quotation workspace.",
              tone: "success",
            });
            router.push(`/sales/quotes/${quotation.id}`);
          }}
        />
      ) : null}
    </CompanyWorkspaceShell>
  );
}
