"use client";

import { useState } from "react";
import Link from "next/link";

type ListingMatch = {
  listingId: string;
  strength: string;
  reasons: string[];
  listing: { suburb?: string | null; address?: string | null; price?: number | null; bedrooms?: number | null } | null;
};

type BuyerMatch = {
  searchId: string;
  strength: string;
  reasons: string[];
  managedBy: string;
  contactName: string | null;
  phone: string | null;
  canRequestIntroduction: boolean;
};

const fieldClass = "min-h-11 w-full rounded-md border border-sales-border bg-sales-surface px-3 text-sm";

export function MatchingWorkspace({ clientId, buyersPath }: { clientId: string; buyersPath: string }) {
  const [searchId, setSearchId] = useState("");
  const [listingId, setListingId] = useState("");
  const [listings, setListings] = useState<ListingMatch[] | null>(null);
  const [buyers, setBuyers] = useState<BuyerMatch[] | null>(null);
  const [gaps, setGaps] = useState<Array<Record<string, unknown>> | null>(null);
  const [definition, setDefinition] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function findProperties() {
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/matching?searchId=${searchId}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Could not match properties");
      return;
    }
    setListings(json.matches ?? []);
    setBuyers(null);
  }

  async function findBuyers() {
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/matching?listingId=${listingId}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Could not match buyers");
      return;
    }
    setBuyers(json.matches ?? []);
    setListings(null);
  }

  async function loadDemand() {
    const res = await fetch(`/api/clients/${clientId}/buyer-reports?report=demand`);
    if (res.status === 403) {
      setDefinition("Demand gaps are visible to managers.");
      setGaps([]);
      return;
    }
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Could not load demand");
      return;
    }
    setDefinition(json.definition ?? null);
    setGaps(json.gaps ?? []);
  }

  return (
    <div className="space-y-4 px-4 py-4 md:px-6">
      <div>
        <h1 className="text-lg font-semibold">Property matching</h1>
        <p className="text-sm text-sales-text-secondary">Match an approved listing to a search, or a search to live stock. Scores explain the fit. They are not probabilities.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <form className="space-y-2 rounded-lg border border-sales-border p-3" onSubmit={(event) => { event.preventDefault(); void findProperties(); }}>
          <h2 className="text-sm font-semibold">Find properties for a buyer</h2>
          <input required className={fieldClass} placeholder="Search id" value={searchId} onChange={(event) => setSearchId(event.target.value)} />
          <button className="min-h-11 rounded-md bg-sales-text-primary px-3 text-sm font-semibold text-white" type="submit">Find properties</button>
        </form>
        <form className="space-y-2 rounded-lg border border-sales-border p-3" onSubmit={(event) => { event.preventDefault(); void findBuyers(); }}>
          <h2 className="text-sm font-semibold">Find buyers for a property</h2>
          <input required className={fieldClass} placeholder="Listing id" value={listingId} onChange={(event) => setListingId(event.target.value)} />
          <button className="min-h-11 rounded-md border border-sales-border px-3 text-sm" type="submit">Find buyers</button>
        </form>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {listings ? (
        <ul className="space-y-2">
          {listings.length === 0 ? <li className="text-sm text-sales-text-secondary">No eligible listing matched.</li> : null}
          {listings.map((match) => (
            <li key={match.listingId} className="rounded-md border border-sales-border px-3 py-2 text-sm">
              <p className="font-semibold">{match.listing?.suburb || match.listing?.address || match.listingId}</p>
              <p>{match.strength} · {match.reasons.join(". ")}</p>
              <Link href={`${buyersPath}/${searchId}`}>Open search</Link>
            </li>
          ))}
        </ul>
      ) : null}
      {buyers ? (
        <ul className="space-y-2">
          {buyers.length === 0 ? <li className="text-sm text-sales-text-secondary">No active search matched this listing.</li> : null}
          {buyers.map((match) => (
            <li key={match.searchId} className="rounded-md border border-sales-border px-3 py-2 text-sm">
              <p className="font-semibold">{match.contactName ?? `Potential matching buyer — managed by ${match.managedBy}`}</p>
              <p className="text-sales-text-secondary">{match.strength} · {match.reasons.join(". ")}</p>
              {match.phone ? <p>{match.phone}</p> : null}
              {match.canRequestIntroduction ? (
                <button
                  type="button"
                  className="mt-1 min-h-11 text-sm font-semibold"
                  onClick={() => void fetch(`/api/clients/${clientId}/buyer-sales/actions`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "introduction", listingId, searchId: match.searchId }),
                  })}
                >
                  Request buyer introduction
                </button>
              ) : (
                <Link href={`${buyersPath}/${match.searchId}`}>Open search</Link>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <section className="rounded-lg border border-sales-border p-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Recorded demand</h2>
          <button type="button" className="min-h-9 text-xs font-semibold" onClick={() => void loadDemand()}>Load demand gaps</button>
        </div>
        {definition ? <p className="mt-2 text-xs text-sales-text-secondary">{definition}</p> : null}
        <ul className="mt-2 space-y-2 text-sm">
          {(gaps ?? []).map((gap) => (
            <li key={`${gap.location}-${gap.intent}-${gap.propertyType ?? "any"}`} className="rounded-md bg-sales-surface-subtle px-3 py-2">
              {String(gap.searchCount)} active {gap.intent === "rental" ? "tenant" : "buyer"} searches in {String(gap.location)}
              {gap.propertyType ? ` for ${String(gap.propertyType)}` : ""}. {String(gap.eligibleListingCount)} eligible listings. {String(gap.unmatchedSearchCount)} searches have no match.
              <Link className="ml-2 font-semibold" href={buyersPath.replace("/buyers", "/acquisitions")}>Plan acquisition</Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
