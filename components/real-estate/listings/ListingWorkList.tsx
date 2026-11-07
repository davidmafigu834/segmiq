"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ReEmptyState, ReErrorState, ReSkeletonRows, ReStatusBadge } from "@/components/real-estate/ui";
import { salesMenuTriggerClass } from "@/components/sales/ui/Button";
import { listingLabel } from "@/lib/real-estate/helpers";
import { LISTING_TYPE_LABEL } from "@/lib/real-estate/listings";
import {
  listingWorkBadge,
  listingWorkCounts,
  listingWorkVisible,
  type ListingWorkFilter,
  type ListingWorkRow,
} from "@/lib/real-estate/listing-work";
import { cn } from "@/lib/ui/cn";

const FILTERS: Array<{ id: ListingWorkFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "finish", label: "Still to finish" },
  { id: "ready", label: "Ready" },
  { id: "under_offer", label: "Under offer" },
  { id: "closed", label: "Sold or rented" },
];

function typeLabel(value: string): string {
  return (LISTING_TYPE_LABEL as Record<string, string>)[value] ?? "Sale";
}

function priceLabel(value: number | null): string {
  return value == null ? "Price not set" : `$${value.toLocaleString()}`;
}

export function ListingWorkList({
  clientId,
  surface,
}: {
  clientId: string;
  surface: "sales" | "client";
}) {
  const root = surface === "sales" ? "/sales" : "/client";
  const [rows, setRows] = useState<ListingWorkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ListingWorkFilter>("all");
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await fetch(`/api/clients/${clientId}/listings?view=work`, { cache: "no-store" });
      const json = await response.json().catch(() => ({}));
      if (cancelled) return;
      if (!response.ok) {
        setError(json.error ?? "Listings could not be loaded.");
        setRows([]);
      } else {
        setRows((json.listings as ListingWorkRow[] | undefined) ?? []);
        setError(null);
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [clientId, reloadKey]);

  if (loading) return <ReSkeletonRows rows={6} label="Loading listings" />;
  if (error) return <ReErrorState title="Listings didn't load" description={error} onRetry={() => { setLoading(true); setReloadKey((value) => value + 1); }} />;

  const visible = rows.filter((row) => listingWorkVisible(row, filter, query));

  return (
    <section className="space-y-3" aria-label="Listings">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Listing filters">
        {FILTERS.map((item) => {
          const count = rows.filter((row) => listingWorkVisible(row, item.id, "")).length;
          const active = filter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              className={`min-h-11 rounded-[10px] border px-3 text-[13px] font-medium focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)] ${active ? "border-sales-text-primary bg-sales-text-primary text-sales-surface" : "border-sales-border bg-sales-surface text-sales-text-primary hover:bg-sales-surface-hover"}`}
              onClick={() => setFilter(item.id)}
            >
              {item.label} <span className="tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>
      <label className="block">
        <span className="sr-only">Search listings</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search address, suburb or seller"
          className="h-11 w-full rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[14px] text-sales-text-primary focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
        />
      </label>
      {rows.length === 0 ? (
        <ReEmptyState
          framed
          title="No listings yet"
          description="A house appears here after the seller's mandate is approved."
          action={<Link href={`${root}/mandates`} className={cn(salesMenuTriggerClass({ variant: "secondary", size: "md" }), "min-h-11")}>Open mandates</Link>}
        />
      ) : visible.length === 0 ? (
        <ReEmptyState framed title="No listings in this view" description="Nothing in this filter." />
      ) : (
        <ul className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
          {visible.map((row) => {
            const badge = listingWorkBadge(row);
            const sellerHref = row.sellerId ? `${root}/owners/${row.sellerId}` : null;
            return (
              <li key={row.id} className="border-b border-sales-border-subtle last:border-b-0">
                <div className="flex items-start justify-between gap-3 px-4 py-3">
                  <Link href={`${root}/listings/${row.id}`} className="re-focus min-w-0 flex-1 rounded-[8px]">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-semibold text-sales-text-primary">{listingLabel(row)}</span>
                      <ReStatusBadge label={badge.label} tone={badge.tone} />
                    </span>
                    <span className="mt-1 block text-[13px] text-sales-text-secondary">{typeLabel(row.transactionType)} · {priceLabel(row.price)}</span>
                    <span className="mt-1 block text-[12px] text-sales-text-muted">{listingWorkCounts(row)}</span>
                  </Link>
                  {sellerHref ? (
                    <Link href={sellerHref} className="re-focus mt-0.5 shrink-0 text-[13px] font-semibold text-sales-text-secondary">{row.sellerName || "Seller"}</Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
