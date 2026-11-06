"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SellerIntakePanel } from "@/components/real-estate/seller-intake/SellerIntakePanel";
import { SaleJourney } from "@/components/real-estate/workflow/SaleJourney";
import { ReStatusBadge } from "@/components/real-estate/ui";
import type { PropertyGroup, PropertyRegisterEntry } from "@/lib/real-estate/property-register";

const GROUPS: Array<{ id: PropertyGroup; label: string }> = [
  { id: "all", label: "All" },
  { id: "drafts", label: "Drafts" },
  { id: "listings", label: "Listings" },
  { id: "inactive", label: "Inactive" },
];

type Payload = {
  entries: PropertyRegisterEntry[];
  total: number;
  page: number;
  pageSize: number;
  partial: "drafts" | "listings" | "both" | null;
};

function partialCopy(partial: Payload["partial"]): string | null {
  if (partial === "drafts") return "Seller opportunities could not be fully loaded. Listings that did load are shown.";
  if (partial === "listings") return "Listings could not be fully loaded. Seller opportunities that did load are shown.";
  if (partial === "both") return "Properties could not be fully loaded.";
  return null;
}

export function PropertyRegister({
  clientId,
  surface,
}: {
  clientId: string;
  surface: "sales" | "client";
}) {
  const [group, setGroup] = useState<PropertyGroup>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const opportunityHref = surface === "sales" ? "/sales/acquisitions?new=1" : "/client/acquisitions?new=1";

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    const params = new URLSearchParams({ surface, group, page: String(page), pageSize: "25" });
    if (query.trim()) params.set("q", query.trim());
    try {
      const res = await fetch(`/api/clients/${clientId}/properties/register?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        setFailed(true);
        setPayload(null);
        return;
      }
      setPayload((await res.json()) as Payload);
    } catch {
      setFailed(true);
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [clientId, surface, group, page, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, query ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [load, query]);

  const notice = failed
    ? "Properties could not be loaded."
    : partialCopy(payload?.partial ?? null);
  const entries = payload?.entries ?? [];
  const total = payload?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / (payload?.pageSize || 25)));

  return (
    <section className="space-y-3" aria-label="Properties">
      <SaleJourney surface={surface} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Property grouping">
          {GROUPS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={group === item.id}
              className={`min-h-11 rounded-[10px] border px-3 text-[13px] font-medium focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)] ${group === item.id ? "border-sales-text-primary bg-sales-text-primary text-sales-surface" : "border-sales-border bg-sales-surface text-sales-text-primary hover:bg-sales-surface-hover"}`}
              onClick={() => { setGroup(item.id); setPage(1); }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <Link
          href={opportunityHref}
          className="inline-flex min-h-11 items-center rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[13px] font-semibold text-sales-text-primary hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
        >
          New opportunity
        </Link>
      </div>
      <label className="block">
        <span className="sr-only">Search properties</span>
        <input
          value={query}
          onChange={(event) => { setQuery(event.target.value); setPage(1); }}
          placeholder="Search address, suburb, seller or reference"
          className="h-11 w-full rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[14px] text-sales-text-primary focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
        />
      </label>
      <SellerIntakePanel clientId={clientId} mode="send" />
      {notice ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-sales-border bg-sales-surface px-3 py-2">
          <p className="text-[13px] text-sales-text-secondary">{notice}</p>
          <button type="button" className="min-h-11 text-[13px] font-semibold text-sales-text-primary underline focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}
      {loading && !payload ? <p className="text-[13px] text-sales-text-muted">Loading properties…</p> : null}
      {!loading && entries.length === 0 ? (
        <p className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-6 text-[13px] text-sales-text-secondary">
          No properties in this view.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
          {entries.map((entry) => (
            <li key={entry.key} className="border-b border-sales-border-subtle last:border-b-0">
              <Link
                href={entry.href}
                className="flex min-h-12 flex-col gap-1 px-4 py-3 hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-semibold text-sales-text-primary">{entry.title}</span>
                  <ReStatusBadge label={entry.kind === "draft" ? "Seller opportunity" : "Listing"} tone="neutral" />
                  <ReStatusBadge label={entry.stageLabel} />
                </span>
                <span className="text-[12px] text-sales-text-secondary">
                  {[entry.personLabel, entry.nextAction].filter(Boolean).join(" · ")}
                </span>
              </Link>
              {entry.historyHref ? (
                <div className="px-4 pb-3">
                  <Link href={entry.historyHref} className="text-[12px] font-semibold text-sales-text-secondary underline focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]">
                    Seller opportunity history
                  </Link>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {total > (payload?.pageSize || 25) ? (
        <div className="flex items-center justify-between gap-2">
          <button type="button" className="min-h-11 px-2 text-[13px] font-semibold text-sales-text-primary disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
            Previous
          </button>
          <p className="text-[12px] text-sales-text-muted">Page {payload?.page ?? page} of {pageCount}</p>
          <button type="button" className="min-h-11 px-2 text-[13px] font-semibold text-sales-text-primary disabled:opacity-40" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}
