"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CircleCheck,
  CircleX,
  Download,
  Eye,
  FileText,
  Plus,
  Send,
  WalletCards,
} from "lucide-react";
import { CompanyWorkspaceShell } from "@/components/dashboard/company/CompanyWorkspaceShell";
import { CompanyDashboardHeader } from "@/components/dashboard/company/CompanyDashboardHeader";
import { useMediaQuery } from "@/components/dashboard/company/team/CompanyTeamInviteDialog";
import { Button, Skeleton, useSalesToast } from "@/components/sales/ui";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import {
  CreateQuoteDialog,
  type QuotationWithItems,
} from "@/components/sales/quotes/CreateQuoteDialog";
import { QuotationBuilder } from "@/components/leads/QuotationBuilder";
import { CompanyQuotationKpi } from "./CompanyQuotationKpi";
import { CompanyQuotationDetailPanel } from "./CompanyQuotationDetailPanel";
import {
  CompanyQuotationsTable,
  type QuotationDensity,
} from "./CompanyQuotationsTable";
import {
  COMPANY_QUOTATIONS_PAGE_SIZE,
  DEFAULT_COMPANY_QUOTATION_FILTERS,
  buildCompanyQuotationsCsv,
  companyQuotationEmptyKind,
  companyQuotationFiltersActive,
  companyQuotationMatchesFilters,
  companyQuotationMatchesSearch,
  companyQuotationMatchesTab,
  companyQuotationSendLabel,
  sortCompanyQuotations,
  type CompanyQuotationFilters,
  type CompanyQuotationsSort,
} from "@/lib/sales/company-quotations";
import { formatQuoteAmount } from "@/lib/sales/quotes";
import { fetchQuotationPdfBlob } from "@/lib/share-quotation-pdf";
import type { QuotationStatus, UserRole } from "@/types";
import type {
  CompanyQuotationRow,
  CompanyQuotationTab,
  CompanyQuotationsPageData,
} from "./types";

const KPI_MOBILE_ORDER: Record<string, string> = {
  "Total Quotations": "order-1 xl:order-none",
  Sent: "order-2 xl:order-none",
  Accepted: "order-3 xl:order-none",
  "Total Value": "order-4 xl:order-none",
  Draft: "order-5 xl:order-none",
  Viewed: "order-6 xl:order-none",
  Declined: "order-7 xl:order-none",
};

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

  const [tab, setTab] = useState<CompanyQuotationTab>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<CompanyQuotationFilters>(
    DEFAULT_COMPANY_QUOTATION_FILTERS
  );
  const [sort, setSort] = useState<CompanyQuotationsSort>("updated_desc");
  const [density, setDensity] = useState<QuotationDensity>("compact");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(COMPANY_QUOTATIONS_PAGE_SIZE);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<QuotationWithItems | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<{
    quotation: QuotationWithItems;
    leadPhone: string | null;
  } | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

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

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailError(false);
    try {
      const response = await fetch(`/api/quotations/${id}`);
      const json = (await response.json()) as {
        quotation?: QuotationWithItems;
        error?: string;
      };
      if (!response.ok || !json.quotation) throw new Error(json.error || "Failed");
      setDetail(json.quotation);
      return json.quotation;
    } catch {
      setDetail(null);
      setDetailError(true);
      return null;
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError(false);
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const pct = (count: number) =>
    data.counts.all > 0 ? `${Math.round((count / data.counts.all) * 100)}%` : "0%";

  const kpis = [
    {
      label: "Total Quotations",
      value: String(data.counts.all),
      supporting: "All time",
      icon: FileText,
      tone: "blue" as const,
    },
    {
      label: "Draft",
      value: String(data.counts.draft),
      supporting: pct(data.counts.draft),
      icon: WalletCards,
      tone: "neutral" as const,
    },
    {
      label: "Sent",
      value: String(data.counts.sent),
      supporting: pct(data.counts.sent),
      icon: Send,
      tone: "blue" as const,
    },
    {
      label: "Viewed",
      value: String(data.counts.viewed),
      supporting: pct(data.counts.viewed),
      icon: Eye,
      tone: "purple" as const,
    },
    {
      label: "Accepted",
      value: String(data.counts.accepted),
      supporting: pct(data.counts.accepted),
      icon: CircleCheck,
      tone: "success" as const,
    },
    {
      label: "Declined",
      value: String(data.counts.declined),
      supporting: pct(data.counts.declined),
      icon: CircleX,
      tone: "danger" as const,
    },
    {
      label: "Total Value",
      value: formatQuoteAmount(data.totalValue, data.currency),
      supporting: "All statuses · All time",
      icon: WalletCards,
      tone: "brand" as const,
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

  async function quotationFor(row: CompanyQuotationRow) {
    if (detail?.id === row.id) return detail;
    return loadDetail(row.id);
  }

  async function openBuilder(row: CompanyQuotationRow) {
    const quotation = await quotationFor(row);
    if (!quotation) {
      toast({ title: "Couldn’t open quotation", tone: "error" });
      return;
    }
    setEditing({ quotation, leadPhone: row.customerPhone });
  }

  async function duplicate(row: CompanyQuotationRow) {
    try {
      const response = await fetch(`/api/quotations/${row.id}/duplicate`, { method: "POST" });
      const json = (await response.json()) as {
        quotation?: QuotationWithItems;
        error?: string;
      };
      if (!response.ok || !json.quotation) throw new Error(json.error || "Failed");
      setEditing({ quotation: json.quotation, leadPhone: row.customerPhone });
      toast({ title: "Draft duplicated", tone: "success" });
      router.refresh();
    } catch {
      toast({ title: "Couldn’t duplicate quotation", tone: "error" });
    }
  }

  async function revise(row: CompanyQuotationRow) {
    try {
      const response = await fetch(`/api/quotations/${row.id}/revise`, { method: "POST" });
      const json = (await response.json()) as {
        quotation?: QuotationWithItems;
        error?: string;
      };
      if (!response.ok || !json.quotation) throw new Error(json.error || "Failed");
      setEditing({ quotation: json.quotation, leadPhone: row.customerPhone });
      toast({ title: "Revision created", description: "The original remains locked.", tone: "success" });
      router.refresh();
    } catch {
      toast({ title: "Couldn’t create a revision", tone: "error" });
    }
  }

  async function setStatus(row: CompanyQuotationRow, status: QuotationStatus) {
    try {
      const response = await fetch(`/api/quotations/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Failed");
      toast({
        title: status === "accepted" ? "Quotation accepted" : "Quotation declined",
        description:
          status === "accepted"
            ? "The related Deal was not automatically marked Won."
            : "The related Deal remains independent and was not marked Lost.",
        tone: "success",
      });
      router.refresh();
    } catch {
      toast({ title: "Couldn’t update quotation", tone: "error" });
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

  async function sendOrResend(row: CompanyQuotationRow) {
    const label = companyQuotationSendLabel(row.effectiveStatus);
    if (!label) return;
    if (row.effectiveStatus === "draft") {
      await openBuilder(row);
      return;
    }
    setSendingId(row.id);
    try {
      const response = await fetch(`/api/quotations/${row.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendViaWhatsApp: true }),
      });
      const json = (await response.json().catch(() => ({}))) as {
        error?: string;
        whatsappSent?: boolean;
      };
      if (!response.ok || json.whatsappSent === false) {
        toast({
          title: json.error || "Quotation was not delivered.",
          description: "The quotation status was not changed.",
          tone: "error",
        });
        return;
      }
      toast({ title: "Quotation sent on WhatsApp", tone: "success" });
      router.refresh();
    } catch {
      toast({ title: "Quotation was not delivered.", tone: "error" });
    } finally {
      setSendingId(null);
    }
  }

  const openDeal = (row: CompanyQuotationRow) => {
    if (row.dealId) router.push(`/client/deals/${row.dealId}`);
  };
  const openCustomer = (row: CompanyQuotationRow) => {
    if (row.contactId) router.push(`/client/contacts/${row.contactId}`);
  };

  const selectedRows = data.rows.filter((row) => selectedIds.has(row.id));

  const table = (
    <CompanyQuotationsTable
      data={data}
      rows={pageRows}
      tab={tab}
      onTabChange={setTab}
      search={search}
      onSearchChange={setSearch}
      filters={filters}
      onFiltersChange={setFilters}
      density={density}
      onDensityChange={setDensity}
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
      onEdit={(row) => void openBuilder(row)}
      onSend={(row) => void sendOrResend(row)}
      onDuplicate={(row) => void duplicate(row)}
      onRevise={(row) => void revise(row)}
      onMarkAccepted={(row) => void setStatus(row, "accepted")}
      onMarkDeclined={(row) => void setStatus(row, "rejected")}
      onOpenDeal={openDeal}
      onOpenCustomer={openCustomer}
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
      detail={detail}
      loading={detailLoading}
      error={detailError}
      overlay={overlayPanel}
      stacked={stackedPanel}
      sending={sendingId === selectedRow.id}
      onRetry={() => void loadDetail(selectedRow.id)}
      onClose={() => setQuotationParam(null)}
      onViewPdf={() => viewPdf(selectedRow)}
      onSend={() => void sendOrResend(selectedRow)}
      onEdit={() => void openBuilder(selectedRow)}
      onDuplicate={() => void duplicate(selectedRow)}
      onRevise={() => void revise(selectedRow)}
      onOpenDeal={() => openDeal(selectedRow)}
      onOpenCustomer={() => openCustomer(selectedRow)}
      onViewFull={() => void openBuilder(selectedRow)}
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
        description="Create, manage and track all sales quotations in one place."
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
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus size={16} />}
              data-course-target="quotation-create"
              onClick={() => setCreateOpen(true)}
            >
              New Quotation
            </Button>
          </>
        }
      />

      <div className="flex items-center gap-2 layout:hidden">
        <Button
          variant="primary"
          size="md"
          className="flex-1"
          leftIcon={<Plus size={16} />}
          onClick={() => setCreateOpen(true)}
        >
          New Quotation
        </Button>
        <Button
          variant="secondary"
          size="md"
          leftIcon={<Download size={15} />}
          onClick={() => downloadCsv(filtered)}
        >
          Export
        </Button>
      </div>

      <div
        className="grid w-full grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7"
        data-course-target="company-quotations-kpis"
      >
        {loadError
          ? kpis.map((item) => (
              <article
                key={item.label}
                className={`min-w-0 rounded-[14px] border border-sales-border bg-sales-surface px-3.5 py-4 ${KPI_MOBILE_ORDER[item.label] ?? ""}`}
              >
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="mt-3 h-3 w-20" />
                <Skeleton className="mt-2 h-6 w-16" />
              </article>
            ))
          : kpis.map((item) => (
              <CompanyQuotationKpi
                key={item.label}
                {...item}
                className={KPI_MOBILE_ORDER[item.label]}
              />
            ))}
      </div>

      {selectedRow && !overlayPanel ? (
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_352px] items-start gap-4 duration-200">
          {table}
          {panel}
        </div>
      ) : (
        table
      )}

      {selectedRow && overlayPanel ? panel : null}

      <CreateQuoteDialog
        open={createOpen}
        candidates={data.createCandidates}
        hasTemplates={data.hasTemplates}
        onClose={() => setCreateOpen(false)}
        onCreated={(quotation, leadPhone) => {
          setEditing({ quotation, leadPhone });
          toast({
            title: "Quotation draft created",
            description: "Add items and send when it is ready.",
            tone: "success",
          });
          router.refresh();
        }}
      />

      {editing ? (
        <PremiumSheet
          title={editing.quotation.quote_number ? `Quotation ${editing.quotation.quote_number}` : "New quotation"}
          description={
            editing.quotation.status === "draft"
              ? "Build the quotation using the canonical SegmiQ quote workflow."
              : "Sent quotations are locked; create a revision to change their contents."
          }
          size="lg"
          maxWidthClass="max-w-5xl"
          contentClassName="p-4 sm:p-5"
          onClose={() => setEditing(null)}
        >
          <QuotationBuilder
            quotation={editing.quotation}
            clientId={data.clientId}
            leadPhone={editing.leadPhone}
            readOnly={editing.quotation.status !== "draft"}
            onSaved={(quotation) => {
              setEditing((current) => (current ? { ...current, quotation } : current));
              router.refresh();
            }}
            onSent={() => {
              setEditing(null);
              toast({ title: "Quotation sent", tone: "success" });
              router.refresh();
            }}
            onClose={() => setEditing(null)}
            onRevise={
              editing.quotation.status !== "draft"
                ? () => {
                    const row = data.rows.find((item) => item.id === editing.quotation.id);
                    if (row) void revise(row);
                  }
                : undefined
            }
            onDuplicate={() => {
              const row = data.rows.find((item) => item.id === editing.quotation.id);
              if (row) void duplicate(row);
            }}
          />
        </PremiumSheet>
      ) : null}
    </CompanyWorkspaceShell>
  );
}
