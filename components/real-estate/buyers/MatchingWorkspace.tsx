"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
/* Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4 */

import { useEffect, useState } from "react";
import { reEmbeddedShell, reSalesShell } from "@/components/real-estate/ui/workspace-shell";
import Link from "next/link";
import { salesMenuTriggerClass } from "@/components/sales/ui/Button";
import { cn } from "@/lib/ui/cn";
import {
  ReEmptyState,
  ReErrorState,
  RePageHeader,
  RePartialNotice,
  ReSection,
  ReSheet,
  ReStatusBadge,
} from "@/components/real-estate/ui";
import { acqFieldClass, acqLabelClass } from "@/components/real-estate/acquisition/acquisition-ui";

type SearchOption = {
  id: string;
  contact_name: string;
  intent: string;
  locations: string[] | null;
  budget_max: number | null;
  currency: string | null;
  bedrooms: number | null;
  property_type: string | null;
};

type ListingOption = {
  id: string;
  address?: string | null;
  suburb?: string | null;
  price?: number | null;
  status?: string | null;
  approval_status?: string | null;
  transaction_type?: string | null;
};

type ListingMatch = {
  listingId: string;
  strength: string;
  score?: number;
  reasons: string[];
  listing: { suburb?: string | null; address?: string | null; price?: number | null; bedrooms?: number | null; bathrooms?: number | null; transaction_type?: string; photos?: unknown } | null;
};

type BuyerMatch = {
  searchId: string;
  strength: string;
  score?: number;
  reasons: string[];
  managedBy: string;
  contactName: string | null;
  phone: string | null;
  canRequestIntroduction: boolean;
};

type Gap = {
  location: string;
  intent: string;
  propertyType: string | null;
  searchCount: number;
  contactCount: number;
  eligibleListingCount: number;
  unmatchedSearchCount: number;
};

const shell = reSalesShell;

function strengthLabel(strength: string): string {
  if (strength === "strong") return "Strong match";
  if (strength === "alternative") return "Alternative";
  if (strength === "partial") return "Partial match";
  return "Match";
}

function searchLine(row: SearchOption): string {
  const place = (row.locations ?? []).filter(Boolean).join(", ") || "Location open";
  const budget = row.budget_max != null ? `Up to ${row.currency ? `${row.currency} ` : ""}${row.budget_max}` : "Budget open";
  return `${row.intent === "rental" ? "Renting" : "Buying"} · ${row.property_type || "Type open"} · ${place} · ${budget}`;
}

function listingLine(row: ListingOption): string {
  return [row.address, row.suburb].filter(Boolean).join(", ") || "Property";
}

export function MatchingWorkspace({ clientId, buyersPath, framed = false }: { clientId: string; buyersPath: string; framed?: boolean }) {
  const listingsPath = buyersPath.replace("/buyers", "/listings");
  const acquisitionsPath = buyersPath.replace("/buyers", "/acquisitions");
  const [mode, setMode] = useState<"properties" | "buyers">("properties");
  const [searches, setSearches] = useState<SearchOption[]>([]);
  const [searchTotal, setSearchTotal] = useState<number | null>(null);
  const [listingsOptions, setListingsOptions] = useState<ListingOption[]>([]);
  const [searchId, setSearchId] = useState("");
  const [listingId, setListingId] = useState("");
  const [picker, setPicker] = useState<"search" | "listing" | null>(null);
  const [query, setQuery] = useState("");
  const [listings, setListings] = useState<ListingMatch[] | null>(null);
  const [buyers, setBuyers] = useState<BuyerMatch[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [detail, setDetail] = useState<ListingMatch | null>(null);
  const [gaps, setGaps] = useState<Gap[] | null>(null);
  const [definition, setDefinition] = useState<string | null>(null);
  const [demandIncomplete, setDemandIncomplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);
  const [requested, setRequested] = useState<Record<string, string>>({});

  useEffect(() => {
    void fetch(`/api/clients/${clientId}/buyer-searches?status=active`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!json) return;
        setSearches(json.searches ?? []);
        setSearchTotal(typeof json.total === "number" ? json.total : null);
      })
      .catch(() => setSearches([]));
    void fetch(`/api/clients/${clientId}/listings?status=available&limit=80`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setListingsOptions(json?.listings ?? []))
      .catch(() => setListingsOptions([]));
  }, [clientId]);

  const selectedSearch = searches.find((row) => row.id === searchId) ?? null;
  const selectedListing = listingsOptions.find((row) => row.id === listingId) ?? null;

  async function findProperties(id = searchId) {
    setError(null);
    setNotice(null);
    setMatching(true);
    const res = await fetch(`/api/clients/${clientId}/matching?searchId=${id}`);
    const json = await res.json().catch(() => ({}));
    setMatching(false);
    if (!res.ok) {
      setError(json.error ?? "Could not match properties");
      setListings(null);
      return;
    }
    setListings(json.matches ?? []);
    setBuyers(null);
    setNotice(json.notice ?? null);
  }

  async function findBuyers(id = listingId) {
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/clients/${clientId}/matching?listingId=${id}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Could not match buyers");
      setBuyers(null);
      return;
    }
    setBuyers(json.matches ?? []);
    setListings(null);
    setNotice(json.notice ?? null);
  }

  async function loadDemand() {
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/buyer-reports?report=demand`);
    const json = await res.json().catch(() => ({}));
    if (res.status === 403) {
      setDefinition("Demand gaps are visible to managers.");
      setGaps([]);
      return;
    }
    if (!res.ok) {
      setError(json.error ?? "Could not load demand");
      return;
    }
    setDefinition(json.definition ?? null);
    setGaps(json.gaps ?? []);
    setDemandIncomplete(Boolean(json.incomplete));
  }

  async function requestIntroduction(match: BuyerMatch) {
    setBusyId(match.searchId);
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/buyer-sales/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "introduction", listingId, searchId: match.searchId }),
    });
    const json = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setError(json.error ?? "Could not request an introduction");
      return;
    }
    setRequested((current) => ({ ...current, [match.searchId]: "requested" }));
  }

  const filteredSearches = searches.filter((row) => {
    const hay = `${row.contact_name} ${searchLine(row)}`.toLowerCase();
    return hay.includes(query.trim().toLowerCase());
  });
  const filteredListings = listingsOptions.filter((row) => listingLine(row).toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className={framed ? reEmbeddedShell : shell}>
      <RePageHeader
        title="Property matching"
        description="Find suitable properties for active buyers and tenants."
      />
      <div className="grid h-11 w-full grid-cols-2 rounded-[var(--re-radius-control,8px)] border border-sales-border p-0.5 sm:inline-flex sm:w-auto" role="tablist" aria-label="Matching direction">
        {([
          ["properties", "Properties for a buyer"],
          ["buyers", "Buyers for a property"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            onClick={() => setMode(id)}
            className={cn("re-focus inline-flex h-full items-center justify-center whitespace-nowrap rounded-[6px] px-3 text-[13px] font-semibold", mode === id ? "bg-sales-text-primary text-sales-surface" : "text-sales-text-secondary")}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "properties" ? (
        <ReSection id="search-pick" title="Select buyer search" description="Find properties that fit this search." hideMobileDescription>
          <button type="button" className={cn(acqFieldClass, "text-left")} onClick={() => { setQuery(""); setPicker("search"); }}>
            {selectedSearch ? selectedSearch.contact_name : "Choose an active search"}
          </button>
          {selectedSearch ? <p className="mt-2 text-[13px] text-sales-text-secondary">{searchLine(selectedSearch)}</p> : null}
          <button type="button" className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "mt-3 min-h-11")} disabled={!searchId || matching} onClick={() => void findProperties()}>{matching ? "Finding…" : "Find properties"}</button>
        </ReSection>
      ) : (
        <ReSection id="listing-pick" title="Property">
          <button type="button" className={cn(acqFieldClass, "text-left")} onClick={() => { setQuery(""); setPicker("listing"); }}>
            {selectedListing ? listingLine(selectedListing) : "Choose an available listing"}
          </button>
          {selectedListing?.price != null ? <p className="mt-2 text-[13px] text-sales-text-secondary">Asking {Number(selectedListing.price).toLocaleString()}</p> : null}
          <button type="button" className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "mt-3 min-h-11")} disabled={!listingId} onClick={() => void findBuyers()}>Find buyers</button>
        </ReSection>
      )}

      {error ? <ReErrorState title="Matching didn't complete" description={error} /> : null}
      {notice ? <p className="rounded-[8px] border border-sales-warning/30 bg-sales-warning-soft px-3 py-2 text-[13px] text-sales-warning-fg">{notice}</p> : null}

      {listings ? (
        <ReSection id="property-matches" title="Matching properties" count={listings.length}>
          {listings.length === 0 ? (
            <ReEmptyState title="No suitable properties found" description="Review the search requirements, or look through available listings." action={<Link className={cn(salesMenuTriggerClass({ variant: "secondary", size: "md" }), "min-h-11")} href={listingsPath}>Open listings</Link>} />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {listings.map((match) => {
                const image = Array.isArray(match.listing?.photos) && typeof match.listing?.photos[0] === "string" ? match.listing.photos[0] : null;
                const title = [match.listing?.address, match.listing?.suburb].filter(Boolean).join(", ") || "Property";
                return (
                  <li key={match.listingId} className="min-w-0 overflow-hidden rounded-[12px] border border-sales-border-subtle">
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt="" className="aspect-[4/3] w-full object-cover" />
                    ) : <div className="flex aspect-[4/3] items-center justify-center bg-sales-surface-subtle text-[12px] text-sales-text-muted">No photograph</div>}
                    <div className="space-y-1 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 text-[14px] font-semibold [overflow-wrap:anywhere]">{title}</p>
                        <ReStatusBadge label={strengthLabel(match.strength)} />
                      </div>
                      <p className="text-[13px] text-sales-text-secondary">
                        {match.listing?.price != null ? Number(match.listing.price).toLocaleString() : "Price not recorded"}
                        {match.listing?.bedrooms != null ? ` · ${match.listing.bedrooms} bed` : ""}
                      </p>
                      {typeof match.score === "number" ? <p className="text-[12px] text-sales-text-muted">Match score {match.score}. Not a chance of closing.</p> : null}
                      {match.reasons[0] ? <p className="text-[13px] text-sales-text-secondary">{match.reasons[0]}</p> : null}
                      <button type="button" className="re-focus min-h-11 text-[13px] font-semibold" onClick={() => setDetail(match)}>View match details</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ReSection>
      ) : null}

      {buyers ? (
        <ReSection id="buyer-matches" title="Matching buyer searches" count={buyers.length} description="Contact details appear only when this account is allowed to see them.">
          {buyers.length === 0 ? <ReEmptyState title="No matching buyer searches" description="No active search matched this listing." /> : (
            <ul className="space-y-2">
              {buyers.map((match) => (
                <li key={match.searchId} className="rounded-[12px] border border-sales-border-subtle px-3 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-[14px] font-semibold [overflow-wrap:anywhere]">
                      {match.contactName ?? "Matching buyer search"}
                    </p>
                    <ReStatusBadge label={strengthLabel(match.strength)} />
                  </div>
                  <p className="mt-1 text-[13px] text-sales-text-secondary">Managed by {match.managedBy}</p>
                  {match.phone ? <p className="mt-1 text-[13px]">{match.phone}</p> : null}
                  {match.reasons[0] ? <p className="mt-1 text-[13px] text-sales-text-secondary">{match.reasons.join(" ")}</p> : null}
                  {typeof match.score === "number" ? <p className="mt-1 text-[12px] text-sales-text-muted">Match score {match.score}</p> : null}
                  <div className="mt-2">
                    {match.canRequestIntroduction ? (
                      requested[match.searchId] ? (
                        <p className="text-[13px] font-semibold">Introduction requested</p>
                      ) : (
                        <button type="button" className={cn(salesMenuTriggerClass({ variant: "secondary", size: "sm" }), "min-h-11")} disabled={busyId === match.searchId} onClick={() => void requestIntroduction(match)}>
                          {busyId === match.searchId ? "Sending…" : "Request introduction"}
                        </button>
                      )
                    ) : (
                      <Link className="re-focus inline-flex min-h-11 items-center text-[13px] font-semibold" href={`${buyersPath}/${match.searchId}`}>Open search</Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ReSection>
      ) : null}

      <ReSection
        id="demand"
        title="Buyer demand insights"
        description="Recorded gaps between what customers want and the stock you can offer."
        hideMobileDescription
        action={<button type="button" className={cn(salesMenuTriggerClass({ variant: "secondary", size: "md" }), "min-h-11")} onClick={() => void loadDemand()}>{definition || gaps ? "Refresh" : "View insights"}</button>}
      >
        {definition ? <p className="text-[13px] text-sales-text-secondary">{definition}</p> : <p className="text-[13px] text-sales-text-muted">Open this when you need the recorded demand gaps.</p>}
        {demandIncomplete ? <RePartialNotice>This demand view is incomplete. The scan stopped at the existing listing or search limit.</RePartialNotice> : null}
        <ul className={cn("mt-3 grid gap-2 md:grid-cols-2", !gaps && "hidden")}>
          {(gaps ?? []).map((gap) => (
            <li key={`${gap.location}-${gap.intent}-${gap.propertyType ?? "any"}`} className="rounded-[10px] border border-sales-border-subtle px-3 py-2.5">
              <p className="text-[14px] font-semibold [overflow-wrap:anywhere]">{gap.location}</p>
              <p className="mt-0.5 text-[12px] text-sales-text-secondary">{gap.intent === "rental" ? "Renting" : "Buying"}{gap.propertyType ? ` · ${gap.propertyType}` : ""}</p>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                <div><dt className="text-sales-text-muted">Searches</dt><dd className="font-semibold tabular-nums">{gap.searchCount}</dd></div>
                <div><dt className="text-sales-text-muted">People</dt><dd className="font-semibold tabular-nums">{gap.contactCount}</dd></div>
                <div><dt className="text-sales-text-muted">Eligible listings</dt><dd className="font-semibold tabular-nums">{gap.eligibleListingCount}</dd></div>
                <div><dt className="text-sales-text-muted">No match</dt><dd className="font-semibold tabular-nums">{gap.unmatchedSearchCount}</dd></div>
              </dl>
              <Link className="re-focus mt-2 inline-flex min-h-11 items-center text-[13px] font-semibold" href={acquisitionsPath}>View property opportunities</Link>
            </li>
          ))}
        </ul>
      </ReSection>

      {picker ? (
        <ReSheet title={picker === "search" ? "Choose a search" : "Choose a property"} placement="bottom" onClose={() => setPicker(null)}>
          <label className={acqLabelClass} htmlFor="match-query">Search</label>
          <input id="match-query" className={acqFieldClass} value={query} onChange={(event) => setQuery(event.target.value)} />
          {picker === "search" && searchTotal != null && searchTotal > searches.length ? (
            <p className="mt-2 text-[12px] text-sales-text-muted">Showing {searches.length} of {searchTotal} searches.</p>
          ) : null}
          <ul className="mt-3 space-y-1">
            {(picker === "search" ? filteredSearches : filteredListings).map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="re-focus min-h-12 w-full rounded-[10px] px-2 py-2 text-left hover:bg-sales-surface-hover"
                  onClick={() => {
                    if (picker === "search") {
                      setSearchId(row.id);
                      setPicker(null);
                      void findProperties(row.id);
                    } else {
                      setListingId(row.id);
                      setPicker(null);
                      void findBuyers(row.id);
                    }
                  }}
                >
                  <span className="block text-[14px] font-semibold [overflow-wrap:anywhere]">{picker === "search" ? (row as SearchOption).contact_name : listingLine(row as ListingOption)}</span>
                  {picker === "search" ? <span className="mt-0.5 block text-[12px] text-sales-text-secondary">{searchLine(row as SearchOption)}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </ReSheet>
      ) : null}

      {detail ? (
        <ReSheet title={[detail.listing?.address, detail.listing?.suburb].filter(Boolean).join(", ") || "Property"} description={detail.listing?.price != null ? Number(detail.listing.price).toLocaleString() : "Price not recorded"} onClose={() => setDetail(null)}>
          <h3 className="text-[13px] font-semibold">Why it matches</h3>
          <ul className="mt-1 space-y-1 text-[13px] text-sales-text-secondary">
            {detail.reasons.length ? detail.reasons.map((reason) => <li key={reason}>{reason}</li>) : <li>The matcher did not return an explanation.</li>}
          </ul>
          {typeof detail.score === "number" ? <p className="mt-2 text-[12px] text-sales-text-muted">Match score {detail.score}. This is not a chance of closing.</p> : null}
          <div className="mt-4 flex flex-col gap-2">
            {searchId ? <Link href={`${buyersPath}/${searchId}`} className="re-focus inline-flex min-h-11 items-center text-[13px] font-semibold">Open search</Link> : null}
            <Link href={listingsPath} className="re-focus inline-flex min-h-11 items-center text-[13px] font-semibold">Open listings</Link>
          </div>
        </ReSheet>
      ) : null}
    </div>
  );
}
