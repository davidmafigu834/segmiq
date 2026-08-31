import { createAdminClient } from "@/lib/supabase/admin";
import { listingLabel, type BuyerMatchContact } from "@/lib/real-estate/helpers";
import {
  evaluateListingMatch,
  listingMatchesSearch,
  type ListingMatchResult,
  type ListingSearchFilters,
  type MatchStrength,
} from "@/lib/real-estate/matching";
import type { ListingRow } from "@/types";

const STRENGTH_RANK: Record<MatchStrength, number> = {
  strong: 3,
  good: 2,
  partial: 1,
};

export type PropertyMatchListing = {
  listingId: string;
  label: string;
  suburb: string | null;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  transactionType: string;
  status: string;
  strength: MatchStrength;
  matchLabel: string;
  reasons: ListingMatchResult["reasons"];
};

export function rankListingMatches<T extends { strength: MatchStrength }>(matches: T[]): T[] {
  return [...matches].sort((a, b) => STRENGTH_RANK[b.strength] - STRENGTH_RANK[a.strength]);
}

function toMatchListing(listing: ListingRow, evald: ListingMatchResult): PropertyMatchListing {
  return {
    listingId: listing.id,
    label: listingLabel(listing),
    suburb: listing.suburb ?? null,
    price: listing.price == null ? null : Number(listing.price),
    bedrooms: listing.bedrooms == null ? null : Number(listing.bedrooms),
    bathrooms: listing.bathrooms == null ? null : Number(listing.bathrooms),
    transactionType: listing.transaction_type,
    status: listing.status,
    strength: evald.strength,
    matchLabel: evald.label,
    reasons: evald.reasons,
  };
}

export function summarizeListingForAgent(listing: ListingRow): Omit<PropertyMatchListing, "strength" | "matchLabel" | "reasons"> {
  return {
    listingId: listing.id,
    label: listingLabel(listing),
    suburb: listing.suburb ?? null,
    price: listing.price == null ? null : Number(listing.price),
    bedrooms: listing.bedrooms == null ? null : Number(listing.bedrooms),
    bathrooms: listing.bathrooms == null ? null : Number(listing.bathrooms),
    transactionType: listing.transaction_type,
    status: listing.status,
  };
}

const LISTING_SELECT =
  "id, client_id, transaction_type, status, price, bedrooms, bathrooms, suburb, address, external_reference, description";

export async function loadAvailableListings(clientId: string): Promise<ListingRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("client_id", clientId)
    .eq("status", "available")
    .order("updated_at", { ascending: false })
    .limit(200);
  return (data ?? []) as ListingRow[];
}

export async function findPropertyMatches(opts: {
  clientId: string;
  contact: BuyerMatchContact;
  limit?: number;
  excludeListingIds?: string[];
}): Promise<PropertyMatchListing[]> {
  const limit = Math.min(Math.max(opts.limit ?? 3, 1), 3);
  const exclude = new Set(opts.excludeListingIds ?? []);
  const listings = await loadAvailableListings(opts.clientId);
  const matches: PropertyMatchListing[] = [];

  for (const listing of listings) {
    if (exclude.has(listing.id)) continue;
    const evald = evaluateListingMatch(opts.contact, listing);
    if (!evald) continue;
    matches.push(toMatchListing(listing, evald));
    if (matches.length >= 50) break;
  }

  return rankListingMatches(matches).slice(0, limit);
}

export async function searchListings(opts: {
  clientId: string;
  filters: ListingSearchFilters;
  limit?: number;
}): Promise<Omit<PropertyMatchListing, "strength" | "matchLabel" | "reasons">[]> {
  const limit = Math.min(Math.max(opts.limit ?? 6, 1), 12);
  const listings = await loadAvailableListings(opts.clientId);
  const results = listings.filter((listing) => listingMatchesSearch(listing, opts.filters));
  return results.slice(0, limit).map(summarizeListingForAgent);
}

export async function getListingForClient(opts: {
  clientId: string;
  listingId: string;
}): Promise<ListingRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("id", opts.listingId)
    .eq("client_id", opts.clientId)
    .maybeSingle();
  return (data as ListingRow | null) ?? null;
}

export async function loadBuyerMatchContact(opts: {
  clientId: string;
  contactId: string;
}): Promise<BuyerMatchContact | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("contacts")
    .select(
      "id, name, phone, email, buyer_budget_min, buyer_budget_max, buyer_bedrooms_wanted, buyer_area_preference"
    )
    .eq("id", opts.contactId)
    .eq("client_id", opts.clientId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    name: (data.name as string | null) ?? null,
    phone: (data.phone as string | null) ?? null,
    email: (data.email as string | null) ?? null,
    buyer_budget_min: data.buyer_budget_min as number | null,
    buyer_budget_max: data.buyer_budget_max as number | null,
    buyer_bedrooms_wanted: data.buyer_bedrooms_wanted as number | null,
    buyer_area_preference: (data.buyer_area_preference as string | null) ?? null,
  };
}
