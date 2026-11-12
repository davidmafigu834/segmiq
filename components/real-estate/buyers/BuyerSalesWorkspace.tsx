"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { UsersRound } from "lucide-react";
import { salesMenuTriggerClass } from "@/components/sales/ui/Button";
import { cn } from "@/lib/ui/cn";
import { reEmbeddedShell, reSalesShell } from "@/components/real-estate/ui/workspace-shell";
import {
  ReEmptyState,
  ReErrorState,
  RePageHeader,
  ReSection,
  ReSkeletonRows,
} from "@/components/real-estate/ui";
import { acqFieldClass, FilterChips, WorkLine } from "@/components/real-estate/acquisition/acquisition-ui";

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
  const [rows, setRows] = useState<PersonRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [intent, setIntent] = useState("");
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

  return (
    <div className={framed ? reEmbeddedShell : shell}>
      <RePageHeader
        mobileTitle
        context="Buyer and tenant sales"
        title="Buyers"
        description="People who want to buy or rent, and the search you are working."
      />
      <label>
        <span className="sr-only">Search buyers</span>
        <input className={acqFieldClass} placeholder="Name or phone" value={q} onChange={(event) => setQ(event.target.value)} />
      </label>
      <FilterChips
        label="Buying or renting"
        value={intent}
        options={[
          { id: "", label: "All" },
          { id: "purchase", label: "Buying" },
          { id: "rental", label: "Renting" },
        ]}
        onChange={setIntent}
      />
      {error ? <ReErrorState title="Buyers didn't load" description={error} onRetry={() => void load()} /> : null}
      {loading ? <ReSkeletonRows rows={4} label="Loading buyers and tenants" /> : null}
      {!loading && !error && rows.length === 0 ? (
        <ReEmptyState
          framed
          icon={<UsersRound />}
          title="No buyers or tenants yet"
          description="A profile is created when someone signs a viewing form for a property."
          action={<Link href={listingsPath} className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "min-h-11")}>Open a property</Link>}
        />
      ) : null}
      {!loading && !error && rows.length > 0 ? (
        <ReSection id="buyers" title="Searches" count={rows.length} flush>
          <ul>
            {rows.map((row) => {
              const name = row.contact_name || "Unnamed customer";
              const role = row.intent === "rental" ? "Tenant" : "Buyer";
              return (
                <WorkLine
                  key={row.id}
                  name={name}
                  meta={`${role} · ${row.house}`}
                  detail={row.letter || "No letter yet"}
                  action="Open"
                  href={`${basePath}/${row.id}`}
                />
              );
            })}
          </ul>
        </ReSection>
      ) : null}
    </div>
  );
}
