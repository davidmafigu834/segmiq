"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Plus } from "lucide-react";
import { CommercialModulePage } from "./CommercialModulePage";
import {
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
  SegmentedControl,
  Select,
  Skeleton,
  StatusDot,
} from "@/components/sales/ui";
import { formatMoney } from "@/lib/quotations/totals";
import { statusLabel } from "./product-detail/types";
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
  category_name?: string | null;
  primary_image_url?: string | null;
  available_qty?: number | null;
  inventory_status?: string;
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
  const [type, setType] = useState<"ALL" | "PRODUCT" | "SERVICE">("ALL");
  const [status, setStatus] = useState("ACTIVE");
  const [categoryId, setCategoryId] = useState("");
  const [brand, setBrand] = useState("");
  const [inventory, setInventory] = useState("ALL");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [typeCounts, setTypeCounts] = useState({ all: 0, products: 0, services: 0 });
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [brands, setBrands] = useState<string[]>([]);

  useEffect(() => {
    const t = window.setTimeout(() => setDq(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [dq, type, status, categoryId, brand, inventory]);

  useEffect(() => {
    fetch(`/api/clients/${clientId}/products/categories`)
      .then((r) => r.json())
      .then((j: { categories?: Array<{ id: string; name: string }> }) => setCategories(j.categories ?? []))
      .catch(() => undefined);
    fetch(`/api/clients/${clientId}/products?brands=1&limit=1`)
      .then((r) => r.json())
      .then((j: { brands?: string[] }) => setBrands(j.brands ?? []))
      .catch(() => undefined);
  }, [clientId]);

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
    if (categoryId) params.set("categoryId", categoryId);
    if (brand) params.set("brand", brand);
    if (inventory !== "ALL") params.set("inventory", inventory);
    fetch(`/api/clients/${clientId}/products?${params}`)
      .then((r) => r.json())
      .then((j: { items?: ProductRow[]; total?: number; typeCounts?: { all: number; products: number; services: number } }) => {
        if (cancelled) return;
        setItems(j.items ?? []);
        setTotal(j.total ?? 0);
        if (j.typeCounts) setTypeCounts(j.typeCounts);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, dq, type, status, categoryId, brand, inventory, page]);

  const pages = Math.max(1, Math.ceil(total / 50));
  const empty = useMemo(() => !loading && items.length === 0, [loading, items.length]);

  return (
    <CommercialModulePage
      chrome={chrome}
      breadcrumb="Company / Products"
      title="Products"
      description="Manage the products and services your team sells."
      primaryAction={
        <div className="flex items-center gap-2">
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
            New product
          </Button>
        </div>
      }
    >
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl
          aria-label="Product type"
          value={type}
          onChange={setType}
          options={[
            { value: "ALL", label: "All", badge: typeCounts.all },
            { value: "PRODUCT", label: "Products", badge: typeCounts.products },
            { value: "SERVICE", label: "Services", badge: typeCounts.services },
          ]}
        />
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
        <SearchInput value={q} onChange={setQ} placeholder="Search name, SKU, barcode or brand…" className="w-full sm:w-[240px]" />
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-auto min-w-[140px]">
            <option value="">Category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select value={brand} onChange={(e) => setBrand(e.target.value)} className="w-auto min-w-[140px]">
            <option value="">Brand</option>
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
          <Select value={inventory} onChange={(e) => setInventory(e.target.value)} className="w-auto min-w-[140px]">
            <option value="ALL">Inventory</option>
            <option value="IN_STOCK">In stock</option>
            <option value="LOW_STOCK">Low stock</option>
            <option value="OUT_OF_STOCK">Out of stock</option>
            <option value="NOT_TRACKED">Not tracked</option>
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto min-w-[140px]">
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ARCHIVED">Archived</option>
            <option value="ALL">All statuses</option>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => router.push("/client/products/categories")}>
            Categories
          </Button>
        </div>
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
                    <DataTableTh>Category</DataTableTh>
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
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-sales-border bg-sales-surface-subtle">
                            {p.primary_image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.primary_image_url} alt="" className="h-full w-full object-contain" />
                            ) : (
                              <Box size={16} className="text-sales-text-muted" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-medium text-sales-text-primary">{p.name}</div>
                            <div className="mt-0.5 text-[11px] text-sales-text-muted">
                              {p.item_type === "SERVICE" ? "Service" : "Product"}
                              {p.brand ? ` · ${p.brand}` : ""}
                            </div>
                          </div>
                        </div>
                      </DataTableTd>
                      <DataTableTd className="font-mono text-[12px]">{p.sku || "—"}</DataTableTd>
                      <DataTableTd>{p.category_name || "—"}</DataTableTd>
                      <DataTableTd className="text-right tabular-nums">
                        {formatMoney(Number(p.selling_price) || 0, p.currency)}
                      </DataTableTd>
                      <DataTableTd className="text-right tabular-nums">
                        {p.item_type === "SERVICE" || !p.track_inventory
                          ? "—"
                          : p.available_qty == null
                            ? "—"
                            : Number(p.available_qty).toLocaleString()}
                      </DataTableTd>
                      <DataTableTd>
                        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium">
                          <StatusDot
                            tone={p.status === "ACTIVE" ? "brand" : p.status === "ARCHIVED" ? "neutral" : "warning"}
                            size={6}
                          />
                          {statusLabel(p.status)}
                        </span>
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
    </CommercialModulePage>
  );
}
