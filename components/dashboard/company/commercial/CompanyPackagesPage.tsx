"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { CommercialModulePage } from "./CommercialModulePage";
import { Badge, Button, EmptyState, SearchInput } from "@/components/sales/ui";
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
  const [items, setItems] = useState<Pkg[]>([]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      fetch(`/api/clients/${clientId}/commercial-packages?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((j: { packages?: Pkg[] }) => setItems(j.packages ?? []));
    }, 250);
    return () => window.clearTimeout(t);
  }, [clientId, q]);

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
      {items.length === 0 ? (
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
