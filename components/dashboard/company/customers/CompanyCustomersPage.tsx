"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { KpiCard } from "@/components/dashboard/sales/KpiCard";
import { CompanyWorkspaceShell } from "../CompanyWorkspaceShell";
import { CompanyDashboardHeader } from "../CompanyDashboardHeader";
import { CompanyCustomersTableCard } from "./CompanyCustomersTableCard";
import { CompanyCustomerDetailPanel } from "./CompanyCustomerDetailPanel";
import { useMediaQuery } from "@/components/dashboard/company/team/CompanyTeamInviteDialog";
import { Button, useSalesToast } from "@/components/sales/ui";
import { useAddHubSheet } from "@/components/sales/AddToHubSheet";
import {
  COMPANY_CUSTOMERS_PAGE_SIZE,
  companyCustomersFiltersActive,
  matchesCompanyCustomersFilters,
  matchesCompanyCustomersSearch,
  matchesCompanyCustomersTab,
  parseCompanyCustomersTab,
  sortCompanyCustomersRows,
} from "@/lib/sales/company-customers-metrics";
import type { UserRole } from "@/types";
import type {
  CompanyCustomerDetail,
  CompanyCustomerRow,
  CompanyCustomersFilters,
  CompanyCustomersPageData,
  CompanyCustomersSort,
  CompanyCustomersTab,
} from "./types";
import { DEFAULT_COMPANY_CUSTOMERS_FILTERS } from "./types";

export function CompanyCustomersPage({ data, unreadNotifications, notificationRole, userName, avatarUrl, companyLogoUrl, whatsappBadge = 0 }: { data: CompanyCustomersPageData; unreadNotifications: number; notificationRole: UserRole; userName: string; avatarUrl?: string | null; companyLogoUrl?: string | null; whatsappBadge?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useSalesToast();
  const overlayPanel = useMediaQuery("(max-width: 1279px)");
  const stackedSplit = useMediaQuery("(max-width: 767px)");
  const { openAddHubSheet, addHubSheetProps } = useAddHubSheet();
  const { hubSheet } = addHubSheetProps("direct", { mode: "manager", clientId: data.clientId, defaultType: "customer", lockType: true });

  const [tab, setTab] = useState<CompanyCustomersTab>(() => parseCompanyCustomersTab(searchParams.get("tab")) ?? "all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<CompanyCustomersFilters>(() => {
    const ownerId = searchParams.get("ownerId");
    return ownerId ? { ...DEFAULT_COMPANY_CUSTOMERS_FILTERS, ownerId } : DEFAULT_COMPANY_CUSTOMERS_FILTERS;
  });
  const [sort, setSort] = useState<CompanyCustomersSort>("recent_interaction");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(COMPANY_CUSTOMERS_PAGE_SIZE);
  const [detail, setDetail] = useState<CompanyCustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const selectedId = searchParams.get("customer");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const setCustomerParam = useCallback((id: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("customer", id);
    else params.delete("customer");
    const query = params.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    if (id) router.push(href, { scroll: false });
    else router.replace(href, { scroll: false });
  }, [pathname, router, searchParams]);

  const filtered = useMemo(() => data.rows.filter((row) => matchesCompanyCustomersTab(row, tab) && matchesCompanyCustomersSearch(row, debouncedSearch) && matchesCompanyCustomersFilters(row, filters)), [data.rows, tab, debouncedSearch, filters]);
  const sorted = useMemo(() => sortCompanyCustomersRows(filtered, sort), [filtered, sort]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => setPage(1), [tab, debouncedSearch, filters, sort, pageSize]);

  const selectedRow = useMemo(() => data.rows.find((row) => row.id === selectedId) ?? null, [data.rows, selectedId]);
  useEffect(() => {
    if (!selectedId) return;
    if (!data.rows.some((row) => row.id === selectedId)) {
      setCustomerParam(null);
      setDetail(null);
      return;
    }
    if (!filtered.some((row) => row.id === selectedId) && tab !== "all") setTab("all");
  }, [selectedId, data.rows, filtered, tab, setCustomerParam]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const response = await fetch(`/api/client/customers/${id}?clientId=${encodeURIComponent(data.clientId)}`);
      if (!response.ok) throw new Error("failed");
      const json = (await response.json()) as { detail: CompanyCustomerDetail };
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

  function call(row: CompanyCustomerRow) {
    if (row.phone) window.location.href = `tel:${row.phone}`;
  }
  function whatsapp(row: CompanyCustomerRow) {
    const digits = row.phone?.replace(/[^\d]/g, "") ?? "";
    if (digits) window.open(`https://wa.me/${digits}`, "_blank", "noopener,noreferrer");
    else toast({ title: "No WhatsApp number is recorded for this Customer.", tone: "info" });
  }
  function viewDeals(row: CompanyCustomerRow) {
    const params = new URLSearchParams({ customerId: row.id });
    if (notificationRole === "SUPER_ADMIN") params.set("clientId", data.clientId);
    router.push(`/client/pipeline?${params.toString()}`);
  }

  const tabScoped = data.rows.filter((row) => matchesCompanyCustomersTab(row, tab));
  const emptyKind: "none" | "search" | "filters" | "rows" =
    tabScoped.length === 0 && !debouncedSearch.trim() && !companyCustomersFiltersActive(filters)
      ? "none"
      : filtered.length === 0
        ? debouncedSearch.trim()
          ? "search"
          : "filters"
        : "rows";

  const table = <CompanyCustomersTableCard rows={paged} total={sorted.length} tab={tab} tabCounts={data.tabCounts} onTabChange={setTab} search={search} onSearchChange={setSearch} filters={filters} onFiltersChange={setFilters} sort={sort} onSortChange={setSort} page={safePage} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} selectedId={selectedId} onSelect={setCustomerParam} owners={data.owners} onCall={call} onWhatsApp={whatsapp} onViewDeals={viewDeals} onClearSearch={() => setSearch("")} onClearFilters={() => setFilters(DEFAULT_COMPANY_CUSTOMERS_FILTERS)} onAddCustomer={openAddHubSheet} emptyKind={emptyKind} searchQuery={debouncedSearch} />;

  const panel = <CompanyCustomerDetailPanel row={selectedRow} detail={detail} loading={detailLoading} error={detailError} onRetry={() => selectedId && void loadDetail(selectedId)} onClose={() => setCustomerParam(null)} onCall={() => selectedRow && call(selectedRow)} onWhatsApp={() => selectedRow && whatsapp(selectedRow)} onViewDetails={() => { if (detail?.viewDetailsHref) router.push(detail.viewDetailsHref); else if (selectedRow) router.push(`/client/contacts/${selectedRow.id}`); }} onViewDeals={() => selectedRow && viewDeals(selectedRow)} overlay={overlayPanel} stacked={stackedSplit} />;

  return <CompanyWorkspaceShell companyName={data.clientName} companyLogoUrl={companyLogoUrl} userName={userName} avatarUrl={avatarUrl} unreadNotifications={unreadNotifications} notificationRole={notificationRole} whatsappBadge={whatsappBadge}>
    <CompanyDashboardHeader unreadNotifications={unreadNotifications} notificationRole={notificationRole} userName={userName} avatarUrl={avatarUrl} canAddLead={false} breadcrumb="Company / Customers" title="Customers" description="Manage your customers and track all interactions in one place." primaryAction={<Button variant="primary" size="md" leftIcon={<Plus size={16} />} onClick={openAddHubSheet}>Add Customer</Button>} />
    <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" data-course-target="company-customers-kpis">{data.kpis.map((item) => { const href = notificationRole === "SUPER_ADMIN" && item.href ? `${item.href}${item.href.includes("?") ? "&" : "?"}clientId=${encodeURIComponent(data.clientId)}` : item.href; return <KpiCard key={item.id} item={href === item.href ? item : { ...item, href }} />; })}</div>
    {selectedId && !overlayPanel ? <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(370px,30%)]">{table}<div className="min-h-0 xl:sticky xl:top-0">{panel}</div></div> : table}
    {selectedId && overlayPanel ? panel : null}
    {hubSheet}
  </CompanyWorkspaceShell>;
}
