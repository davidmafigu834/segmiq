"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { CommercialModulePage } from "./CommercialModulePage";
import { Badge, Button, EmptyState, ErrorState, FilteredEmptyState, SearchInput, Skeleton } from "@/components/sales/ui";
import { formatMoney } from "@/lib/quotations/totals";
import type { UserRole } from "@/types";

type Pkg = {
  id: string;
  name: string;
  status: string;
  pricing_mode: string;
  fixed_price: number | null;
  currency: string;
  item_count: number;
  service_count: number;
  image_url: string | null;
};

export function CompanyPackagesPage({
  clientId,
  chrome,
}: {
  clientId: string;
  chrome: Parameters<typeof CommercialModulePage>[0]["chrome"] & { notificationRole: UserRole };
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [items, setItems] = useState<Pkg[]>([]);
  const [hasAnyPackages, setHasAnyPackages] = useState<boolean | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDq(q), 250);
    return () => window.clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/clients/${clientId}/commercial-packages?q=${encodeURIComponent(dq)}`);
      if (!res.ok) throw new Error("Failed");
      const j = (await res.json()) as { packages?: Pkg[] };
      const packages = j.packages ?? [];
      setItems(packages);
      if (!dq.trim()) setHasAnyPackages(packages.length > 0);
    } catch {
      setError(true);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [clientId, dq]);

  useEffect(() => {
    void load();
  }, [load]);

  const trueEmpty = !loading && !error && items.length === 0 && hasAnyPackages === false;
  const filteredEmpty = !loading && !error && items.length === 0 && !trueEmpty;

  return (
    <CommercialModulePage
      chrome={chrome}
      breadcrumb="Company / Packages"
      title="Packages"
      description="Build reusable solutions your sales team can add to quotations in seconds."
      primaryAction={
        <Button size="md" leftIcon={<Plus size={15} />} onClick={() => router.push("/client/packages/new")}>
          New Package
        </Button>
      }
    >
      <div className="mt-4 flex justify-end">
        <SearchInput value={q} onChange={setQ} placeholder="Search packages…" className="w-full sm:w-[280px]" />
      </div>
      {loading ? (
        <Skeleton className="mt-8 h-48 w-full" />
      ) : error ? (
        <ErrorState
          title="Unable to load packages"
          description="We couldn't retrieve your packages right now."
          onRetry={() => void load()}
          retryLoading={loading}
          className="mt-8"
        />
      ) : trueEmpty ? (
        <div className="mt-8">
          <EmptyState
            title="Build reusable selling Packages"
            description="Combine Products and Services into solutions your team can quote quickly."
            action={
              <Button size="md" onClick={() => router.push("/client/packages/new")}>
                Create Package
              </Button>
            }
          />
        </div>
      ) : filteredEmpty ? (
        <FilteredEmptyState
          searchQuery={dq.trim() || undefined}
          onClearSearch={dq.trim() ? () => setQ("") : undefined}
          className="mt-8"
        />
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((pkg) => (
            <button
              key={pkg.id}
              type="button"
              onClick={() => router.push(`/client/packages/${pkg.id}`)}
              className="rounded-[12px] border border-sales-border p-4 text-left hover:bg-sales-surface-subtle"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-[14px] font-semibold">{pkg.name}</div>
                <Badge tone={pkg.status === "ACTIVE" ? "success" : "neutral"}>{pkg.status}</Badge>
              </div>
              <div className="mt-2 text-[12px] text-sales-text-muted">
                {pkg.item_count} items · {pkg.service_count} services
              </div>
              <div className="mt-3 text-[13px] font-medium tabular-nums">
                {pkg.pricing_mode === "FIXED_PRICE" && pkg.fixed_price != null
                  ? formatMoney(Number(pkg.fixed_price), pkg.currency)
                  : "Sum of items"}
              </div>
            </button>
          ))}
        </div>
      )}
    </CommercialModulePage>
  );
}
