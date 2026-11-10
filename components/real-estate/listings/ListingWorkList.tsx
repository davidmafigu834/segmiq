"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ReEmptyState, ReErrorState, ReRowAction, ReSection, ReSkeletonRows } from "@/components/real-estate/ui";
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
  { id: "finish", label: "In preparation" },
  { id: "ready", label: "On the market" },
  { id: "closed", label: "Closed" },
];

function typeLabel(value: string): string {
  return (LISTING_TYPE_LABEL as Record<string, string>)[value] ?? "Sale";
}

function priceLabel(value: number | null): string {
  return value == null ? "Price not set" : `$${value.toLocaleString()}`;
}

function statusLabel(row: ListingWorkRow): string {
  const badge = listingWorkBadge(row).label;
  if (badge === "Still to finish") return "In preparation";
  if (badge === "Ready") return "On the market";
  return badge;
}

function nextAction(row: ListingWorkRow, root: string): { label: string; href: string } {
  const badge = listingWorkBadge(row).label;
  const propertyHref = `${root}/listings/${row.id}`;
  if (badge === "Under offer") return { label: "Open offer", href: `${propertyHref}#property-offers` };
  if (badge === "Still to finish") return { label: "Book inspection", href: propertyHref };
  if (badge === "Ready") return { label: "Share viewing form", href: `${propertyHref}#listing-viewing-form` };
  return { label: "Open", href: propertyHref };
}

function factLine(row: ListingWorkRow): string {
  const facts = [typeLabel(row.transactionType), priceLabel(row.price)];
  if (row.viewingCount || row.offerCount) facts.push(listingWorkCounts(row));
  return facts.join(" · ");
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
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await fetch(`/api/clients/${clientId}/listings?view=work`, { cache: "no-store" });
      const json = await response.json().catch(() => ({}));
      if (cancelled) return;
      if (!response.ok) {
        setError(json.error ?? "Properties could not be loaded.");
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

  if (error) {
    return <ReErrorState title="Properties didn't load" description={error} onRetry={() => { setLoading(true); setReloadKey((value) => value + 1); }} />;
  }

  const visible = rows.filter((row) => listingWorkVisible(row, filter, ""));

  return (
    <div className="space-y-5">
      <div className="re-chips flex gap-2 overflow-x-auto" role="group" aria-label="Property filters">
        {FILTERS.map((item) => {
          const count = rows.filter((row) => listingWorkVisible(row, item.id, "")).length;
          const active = filter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)] ${active ? "bg-sales-text-primary text-sales-surface" : "border border-sales-border text-sales-text-secondary hover:bg-sales-surface-hover"}`}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
              <span className="tabular-nums">{loading ? "" : count}</span>
            </button>
          );
        })}
      </div>
      <ReSection id="re-properties" title="Properties" count={loading ? null : visible.length} flush>
        {loading ? <ReSkeletonRows rows={1} label="Loading properties" /> : rows.length === 0 ? (
          <div className="px-4 pb-4">
            <ReEmptyState
              title="No properties yet"
              description="A house appears here after the seller's mandate is approved."
              action={<Link href={`${root}/mandates`} className={cn(salesMenuTriggerClass({ variant: "secondary", size: "md" }), "min-h-11")}>Open mandates</Link>}
            />
          </div>
        ) : visible.length === 0 ? (
          <div className="px-4 pb-4">
            <ReEmptyState title="Nothing in this view" description="No properties match this filter." />
          </div>
        ) : (
          <>
            <ul className="min-[480px]:hidden">
              {visible.map((row) => {
                const action = nextAction(row, root);
                const seller = row.sellerName?.trim() || "Seller not linked";
                return (
                  <li key={row.id} className="border-t border-sales-border-subtle px-4 py-3">
                    <Link href={`${root}/listings/${row.id}`} className="re-focus block rounded-[8px] text-[14px] font-semibold text-sales-text-primary">
                      {listingLabel(row)}
                    </Link>
                    <p className="mt-0.5 text-[13px] text-sales-text-secondary">{seller} · {statusLabel(row)}</p>
                    <p className="mt-0.5 text-[13px] text-sales-text-secondary">{factLine(row)}</p>
                    <div className="mt-3">
                      <ReRowAction label={action.label} href={action.href} srContext={listingLabel(row)} className="w-full" />
                    </div>
                  </li>
                );
              })}
            </ul>
            <table className="hidden w-full text-left min-[480px]:table">
              <thead>
                <tr className="border-y border-sales-border-subtle text-[12px] text-sales-text-muted">
                  <th className="px-4 py-2 font-medium">Property</th>
                  <th className="px-3 py-2 font-medium">Seller</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const action = nextAction(row, root);
                  const name = listingLabel(row);
                  return (
                    <tr key={row.id} className="border-b border-sales-border-subtle last:border-0">
                      <td className="px-4 py-3 align-middle">
                        <Link href={`${root}/listings/${row.id}`} className="re-focus rounded-[8px] text-[14px] font-semibold text-sales-text-primary">
                          {name}
                        </Link>
                        <p className="mt-0.5 text-[13px] text-sales-text-secondary">{factLine(row)}</p>
                      </td>
                      <td className="px-3 py-3 align-middle text-[13px] text-sales-text-secondary">
                        {row.sellerId && row.sellerName ? (
                          <Link href={`${root}/owners/${row.sellerId}`} className="re-focus rounded-[8px] font-semibold text-sales-text-secondary">{row.sellerName}</Link>
                        ) : (
                          row.sellerName || "Not linked"
                        )}
                      </td>
                      <td className="px-3 py-3 align-middle text-[13px] text-sales-text-secondary">{statusLabel(row)}</td>
                      <td className="px-3 py-3 text-right align-middle">
                        <ReRowAction label={action.label} href={action.href} srContext={name} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </ReSection>
    </div>
  );
}
