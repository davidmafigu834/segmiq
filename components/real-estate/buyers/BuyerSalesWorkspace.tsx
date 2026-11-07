"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { salesMenuTriggerClass } from "@/components/sales/ui/Button";
import { cn } from "@/lib/ui/cn";
import { reEmbeddedShell, reSalesShell } from "@/components/real-estate/ui/workspace-shell";
import {
  ReActionMenu,
  ReEmptyState,
  ReErrorState,
  RePageHeader,
  ReRowAction,
  ReSection,
  ReSkeletonRows,
  ReStatusBadge,
  ReWorkItem,
} from "@/components/real-estate/ui";
import { acqFieldClass } from "@/components/real-estate/acquisition/acquisition-ui";

type SearchRow = {
  id: string;
  contact_id: string;
  contact_name: string;
  phone: string | null;
  intent: string;
};

type ViewingRow = {
  listing_id?: string | null;
  buyer_search_id?: string | null;
  contact_id?: string | null;
  scheduled_at?: string | null;
  outcome?: string | null;
  listing?: { id?: string; address?: string | null; suburb?: string | null } | null;
};

type OfferRow = {
  id: string;
  listingId: string;
  propertyLabel: string;
  buyerSearchId: string | null;
  contactId: string;
  sellerLetter: string;
};

type PersonRow = SearchRow & {
  house: string;
  listingId: string | null;
  offerId: string | null;
  letter: string | null;
};

const shell = reSalesShell;

function houseLabel(viewing: ViewingRow | undefined): { label: string; listingId: string | null } {
  if (!viewing) return { label: "No property yet", listingId: null };
  const listing = viewing.listing;
  const label = [listing?.address, listing?.suburb].filter(Boolean).join(", ") || "Property";
  return { label, listingId: viewing.listing_id || listing?.id || null };
}

export function BuyerSalesWorkspace({ clientId, basePath, framed = false }: { clientId: string; basePath: string; framed?: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState<PersonRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [intent, setIntent] = useState("");
  const offersPath = basePath.replace(/\/buyers$/, "/offers");
  const listingsPath = basePath.replace(/\/buyers$/, "/listings");

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(q.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ pageSize: "100" });
    if (query) params.set("q", query);
    if (intent) params.set("intent", intent);
    const [listRes, viewingRes, offerRes] = await Promise.all([
      fetch(`/api/clients/${clientId}/buyer-searches?${params}`, { cache: "no-store" }),
      fetch(`/api/clients/${clientId}/viewings`, { cache: "no-store" }),
      fetch(`/api/clients/${clientId}/offers?tab=all`, { cache: "no-store" }),
    ]);
    const listJson = await listRes.json().catch(() => ({}));
    const viewingJson = await viewingRes.json().catch(() => ({}));
    const offerJson = await offerRes.json().catch(() => ({}));
    setLoading(false);
    if (!listRes.ok) {
      setError(listJson.error ?? "Could not load buyers.");
      return;
    }
    const searches = (listJson.searches ?? []) as SearchRow[];
    const viewings = (viewingJson.viewings ?? []) as ViewingRow[];
    const offers = (offerJson.offers ?? []) as OfferRow[];
    setError(null);
    setRows(searches.map((search) => {
      const viewing = viewings.find((row) => row.buyer_search_id === search.id) ?? viewings.find((row) => row.contact_id === search.contact_id);
      const house = houseLabel(viewing);
      const offer = offers.find((row) => row.buyerSearchId === search.id)
        ?? offers.find((row) => house.listingId && row.listingId === house.listingId && row.contactId === search.contact_id);
      return {
        ...search,
        house: offer?.propertyLabel && house.label === "No property yet" ? offer.propertyLabel : house.label,
        listingId: house.listingId ?? offer?.listingId ?? null,
        offerId: offer?.id ?? null,
        letter: offer?.sellerLetter ?? null,
      };
    }));
  }, [clientId, query, intent]);

  useEffect(() => {
    void load();
  }, [load]);

  const letterHref = (row: PersonRow) => {
    if (row.offerId) return `${offersPath}?offerId=${row.offerId}`;
    const params = new URLSearchParams();
    if (row.listingId) params.set("listingId", row.listingId);
    if (row.contact_id) params.set("contactId", row.contact_id);
    const query = params.toString();
    return query ? `${offersPath}?${query}` : `${basePath}/${row.id}`;
  };

  return (
    <div className={framed ? reEmbeddedShell : shell}>
      <RePageHeader
        title="Buyers & tenants"
        description="A signed viewing form opens a person here, linked to the house they asked to see. The offer letter starts from that person."
      />
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search buyers</span>
          <input className={acqFieldClass} placeholder="Name or phone" value={q} onChange={(event) => setQ(event.target.value)} />
        </label>
        <select className={`${acqFieldClass} w-[160px]`} aria-label="Buying or renting" value={intent} onChange={(event) => setIntent(event.target.value)}>
          <option value="">Buyer or tenant</option>
          <option value="purchase">Buying</option>
          <option value="rental">Renting</option>
        </select>
      </div>
      {error ? <ReErrorState title="Buyers didn't load" description={error} onRetry={() => void load()} /> : null}
      {loading ? <ReSkeletonRows rows={4} label="Loading buyers and tenants" /> : null}
      {!loading && !error && rows.length === 0 ? (
        <ReEmptyState
          framed
          title="No buyers or tenants yet"
          description="A profile is created when someone signs a viewing form for a property."
          action={<Link href={listingsPath} className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "min-h-11")}>Open a property</Link>}
        />
      ) : null}
      {!loading && !error && rows.length > 0 ? (
        <ReSection id="buyers" title="Buyers and tenants" count={rows.length} flush>
          <ul className="divide-y divide-sales-border-subtle">
            {rows.map((row) => {
              const name = row.contact_name || "Unnamed customer";
              const role = row.intent === "rental" ? "Tenant" : "Buyer";
              return (
                <ReWorkItem
                  key={row.id}
                  icon={<Users />}
                  title={name}
                  reason={`${role} · ${row.house}`}
                  status={row.letter ? <ReStatusBadge label={row.letter} /> : <ReStatusBadge label="No letter yet" />}
                  action={<ReRowAction label="Open buyer" srContext={name} href={`${basePath}/${row.id}`} />}
                  menu={
                    <ReActionMenu
                      label={`Actions for ${name}`}
                      sheetTitle={name}
                      actions={[
                        { id: "open", label: "Open buyer", onSelect: () => router.push(`${basePath}/${row.id}`) },
                        { id: "house", label: "Open property", onSelect: () => router.push(row.listingId ? `${listingsPath}/${row.listingId}` : listingsPath) },
                        { id: "letter", label: row.offerId ? "Open offer letter" : "Generate offer letter", onSelect: () => router.push(letterHref(row)) },
                        ...(row.phone
                          ? [
                              { id: "call", label: "Call", onSelect: () => { window.location.href = `tel:${row.phone}`; } },
                              { id: "wa", label: "WhatsApp", onSelect: () => { window.location.href = `https://wa.me/${String(row.phone).replace(/\D/g, "")}`; } },
                            ]
                          : []),
                      ]}
                    />
                  }
                />
              );
            })}
          </ul>
        </ReSection>
      ) : null}
    </div>
  );
}
