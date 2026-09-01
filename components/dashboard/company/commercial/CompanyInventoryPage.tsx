"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CommercialModulePage } from "./CommercialModulePage";
import { Badge, Button, EmptyState, ErrorState, Skeleton } from "@/components/sales/ui";
import type { UserRole } from "@/types";

export function CompanyInventoryPage({
  clientId,
  chrome,
}: {
  clientId: string;
  chrome: Parameters<typeof CommercialModulePage>[0]["chrome"] & { notificationRole: UserRole };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [data, setData] = useState<{
    overview?: { stockedSkus: number; lowStock: number; outOfStock: number; locations: number };
    attention?: Array<{ name: string; available: number; reorderLevel: number | null; status: string }>;
    settings?: { provider: string };
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/clients/${clientId}/inventory`);
      if (!res.ok) throw new Error("Failed");
      setData(await res.json());
    } catch {
      setError(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const overview = data?.overview;
  const attention = data?.attention ?? [];

  return (
    <CommercialModulePage
      chrome={chrome}
      breadcrumb="Company / Inventory"
      title="Inventory"
      description="See what is available, what is running low and where stock is held."
      primaryAction={
        <div className="flex gap-2">
          <Button variant="secondary" size="md" onClick={() => router.push("/client/inventory/locations")}>
            Locations
          </Button>
          <Button variant="secondary" size="md" onClick={() => router.push("/client/inventory/movements")}>
            Movements
          </Button>
          <Button variant="secondary" size="md" onClick={() => router.push("/client/inventory/settings")}>
            Settings
          </Button>
        </div>
      }
    >
      {loading ? (
        <Skeleton className="mt-6 h-64 w-full" />
      ) : error ? (
        <ErrorState
          title="Unable to load inventory"
          description="We couldn't retrieve inventory data right now."
          onRetry={() => void load()}
          retryLoading={loading}
          className="mt-6"
        />
      ) : !overview || overview.stockedSkus === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No inventory is being tracked yet."
            description="Enable inventory on physical Products to start tracking stock by location."
            action={
              <Button size="md" onClick={() => router.push("/client/products")}>
                Open Products
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Stocked SKUs", overview.stockedSkus],
              ["Low stock", overview.lowStock],
              ["Out of stock", overview.outOfStock],
              ["Locations", overview.locations],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-[10px] border border-sales-border px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">{label}</div>
                <div className="mt-1 text-[22px] font-semibold tabular-nums">{value}</div>
              </div>
            ))}
          </div>
          <section className="mt-8">
            <h2 className="text-[15px] font-semibold">Needs attention</h2>
            <div className="mt-3 space-y-2">
              {attention.map((item, i) => (
                <div key={i} className="flex items-center justify-between rounded-[8px] border border-sales-border px-3 py-2.5">
                  <div>
                    <div className="text-[13px] font-medium">{item.name}</div>
                    <div className="text-[12px] text-sales-text-muted">
                      {item.available} available
                      {item.reorderLevel != null ? ` · Reorder level: ${item.reorderLevel}` : ""}
                    </div>
                  </div>
                  <Badge tone={item.status === "OUT_OF_STOCK" ? "danger" : "warning"}>{item.status.replace("_", " ")}</Badge>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </CommercialModulePage>
  );
}
