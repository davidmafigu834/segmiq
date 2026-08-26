"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { CommercialModulePage } from "./CommercialModulePage";
import {
  Badge,
  Button,
  DataTable,
  DataTableBody,
  DataTableEl,
  DataTableHead,
  DataTableRow,
  DataTableTd,
  DataTableTh,
  EmptyState,
  SearchInput,
  Select,
  Skeleton,
} from "@/components/sales/ui";
import { formatMoney } from "@/lib/quotations/totals";
import type { UserRole } from "@/types";

type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  brand: string | null;
  item_type: string;
  selling_price: number;
  currency: string;
  status: string;
  track_inventory: boolean;
  category_id: string | null;
};

export function CompanyProductsPage({
  clientId,
  chrome,
}: {
  clientId: string;
  chrome: {
    companyName: string;
    companyLogoUrl?: string | null;
    userName: string;
    avatarUrl?: string | null;
    unreadNotifications: number;
    notificationRole: UserRole;
    whatsappBadge?: number;
  };
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [type, setType] = useState("ALL");
  const [status, setStatus] = useState("ACTIVE");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ProductRow[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDq(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [dq, type, status]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({
      q: dq,
      type,
      status,
      page: String(page),
      limit: "50",
    });
    fetch(`/api/clients/${clientId}/products?${params}`)
      .then((r) => r.json())
      .then((j: { items?: ProductRow[]; total?: number }) => {
        if (cancelled) return;
        setItems(j.items ?? []);
        setTotal(j.total ?? 0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, dq, type, status, page]);

  const pages = Math.max(1, Math.ceil(total / 50));

  const empty = useMemo(
    () => !loading && items.length === 0,
    [loading, items.length]
  );

  return (
    <CommercialModulePage
      chrome={chrome}
      breadcrumb="Company / Products"
      title="Products"
      description="Manage the products and services your team sells."
      primaryAction={
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="md" onClick={() => router.push("/client/products/categories")}>
            Categories
          </Button>
          <Button variant="secondary" size="md" onClick={() => router.push("/client/products/import")}>
            Import
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              window.location.href = `/api/clients/${clientId}/products/import?kind=products`;
            }}
          >
            Export
          </Button>
          <Button size="md" leftIcon={<Plus size={15} />} onClick={() => router.push("/client/products/new")}>
            New Product
          </Button>
        </div>
      }
    >
      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[220px] flex-1">
            <SearchInput value={q} onChange={setQ} placeholder="Search name, SKU, barcode, brand…" />
          </div>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="ALL">All types</option>
            <option value="PRODUCT">Products</option>
            <option value="SERVICE">Services</option>
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
        </div>

        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : empty ? (
          <EmptyState
            title="Set up your Products"
            description="Add products manually, import your existing catalogue, or connect an external inventory source."
            action={
              <div className="flex gap-2">
                <Button size="md" onClick={() => router.push("/client/products/new")}>
                  Add Product
                </Button>
                <Button variant="secondary" size="md" onClick={() => router.push("/client/products/import")}>
                  Import
                </Button>
              </div>
            }
          />
        ) : (
          <DataTable>
            <DataTableEl>
              <DataTableHead>
                <DataTableRow>
                  <DataTableTh>Product</DataTableTh>
                  <DataTableTh>SKU</DataTableTh>
                  <DataTableTh>Brand</DataTableTh>
                  <DataTableTh className="text-right">Selling price</DataTableTh>
                  <DataTableTh className="text-right">Available</DataTableTh>
                  <DataTableTh>Status</DataTableTh>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {items.map((p) => (
                  <DataTableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-sales-surface-subtle"
                    onClick={() => router.push(`/client/products/${p.id}`)}
                  >
                    <DataTableTd>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-sales-text-primary">{p.name}</div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <Badge tone={p.item_type === "SERVICE" ? "info" : "neutral"} appearance="outline">
                            {p.item_type === "SERVICE" ? "SERVICE" : "PRODUCT"}
                          </Badge>
                        </div>
                      </div>
                    </DataTableTd>
                    <DataTableTd className="font-mono text-[12px]">{p.sku || "—"}</DataTableTd>
                    <DataTableTd>{p.brand || "—"}</DataTableTd>
                    <DataTableTd className="text-right tabular-nums">
                      {formatMoney(Number(p.selling_price) || 0, p.currency)}
                    </DataTableTd>
                    <DataTableTd className="text-right tabular-nums">
                      {p.item_type === "SERVICE" || !p.track_inventory ? "—" : ""}
                    </DataTableTd>
                    <DataTableTd>
                      <Badge tone={p.status === "ACTIVE" ? "success" : p.status === "ARCHIVED" ? "neutral" : "warning"}>
                        {p.status}
                      </Badge>
                    </DataTableTd>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTableEl>
          </DataTable>
        )}
        {pages > 1 ? (
          <div className="flex items-center justify-end gap-2 text-[13px] text-sales-text-secondary">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span>
              {page} / {pages}
            </span>
            <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        ) : null}
      </div>
    </CommercialModulePage>
  );
}
