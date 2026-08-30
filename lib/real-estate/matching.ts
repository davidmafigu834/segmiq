import type { ListingRow } from "@/types";
import { contactMatchesListing, type BuyerMatchContact } from "@/lib/real-estate/helpers";

export type MatchReason = {
  id: "budget" | "area" | "bedrooms";
  label: string;
  met: boolean;
};

export type MatchStrength = "strong" | "good" | "partial";

export type ListingMatchResult = {
  listingId: string;
  reasons: MatchReason[];
  strength: MatchStrength;
  label: string;
};

function areaMatches(preference: string | null | undefined, suburb: string | null | undefined): boolean {
  const area = (preference ?? "").trim().toLowerCase();
  const sub = (suburb ?? "").trim().toLowerCase();
  if (!area || !sub) return !area;
  const tokens = area.split(/[,/|]+/).map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.some((t) => sub.includes(t) || t.includes(sub));
}

export function listingMatchReasons(
  contact: BuyerMatchContact,
  listing: Pick<ListingRow, "price" | "bedrooms" | "suburb">
): MatchReason[] {
  const price = listing.price != null ? Number(listing.price) : null;
  const beds = listing.bedrooms != null ? Number(listing.bedrooms) : null;
  const min = contact.buyer_budget_min != null ? Number(contact.buyer_budget_min) : null;
  const max = contact.buyer_budget_max != null ? Number(contact.buyer_budget_max) : null;
  const wantedBeds = contact.buyer_bedrooms_wanted != null ? Number(contact.buyer_bedrooms_wanted) : null;
  const reasons: MatchReason[] = [];

  if (min != null || max != null) {
    const met =
      price == null || ((min == null || price >= min) && (max == null || price <= max));
    reasons.push({ id: "budget", label: "Within budget", met });
  }
  if ((contact.buyer_area_preference ?? "").trim()) {
    reasons.push({
      id: "area",
      label: "Preferred area",
      met: areaMatches(contact.buyer_area_preference, listing.suburb),
    });
  }
  if (wantedBeds != null) {
    reasons.push({
      id: "bedrooms",
      label: "Bedroom requirement",
      met: beds == null || beds >= wantedBeds,
    });
  }
  return reasons;
}

export function listingMatchStrength(reasons: MatchReason[]): MatchStrength {
  const considered = reasons.length;
  const met = reasons.filter((r) => r.met).length;
  if (considered === 0) return "partial";
  if (met === considered && considered >= 3) return "strong";
  if (met === considered && considered === 2) return "good";
  if (met >= 2) return "good";
  return "partial";
}

export function listingMatchLabel(strength: MatchStrength): string {
  if (strength === "strong") return "STRONG MATCH";
  if (strength === "good") return "GOOD MATCH";
  return "Matches requirements";
}

export function evaluateListingMatch(
  contact: BuyerMatchContact,
  listing: Pick<ListingRow, "id" | "price" | "bedrooms" | "suburb">
): ListingMatchResult | null {
  if (!contactMatchesListing(contact, listing)) return null;
  const reasons = listingMatchReasons(contact, listing);
  const strength = listingMatchStrength(reasons);
  return {
    listingId: listing.id,
    reasons,
    strength,
    label: listingMatchLabel(strength),
  };
}

export type ListingSearchFilters = {
  q?: string;
  suburb?: string;
  transactionType?: "sale" | "rental" | "new_development" | "property_management";
  status?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
};

export function listingMatchesSearch(
  listing: Pick<
    ListingRow,
    "address" | "suburb" | "description" | "external_reference" | "transaction_type" | "status" | "price" | "bedrooms"
  >,
  filters: ListingSearchFilters
): boolean {
  if (filters.status && listing.status !== filters.status) return false;
  if (filters.transactionType && listing.transaction_type !== filters.transactionType) return false;
  if (filters.suburb) {
    const sub = (listing.suburb ?? "").toLowerCase();
    if (!sub.includes(filters.suburb.trim().toLowerCase())) return false;
  }
  if (filters.minPrice != null && listing.price != null && Number(listing.price) < filters.minPrice) {
    return false;
  }
  if (filters.maxPrice != null && listing.price != null && Number(listing.price) > filters.maxPrice) {
    return false;
  }
  if (filters.bedrooms != null && listing.bedrooms != null && Number(listing.bedrooms) < filters.bedrooms) {
    return false;
  }
  const q = filters.q?.trim().toLowerCase();
  if (q) {
    const hay = [listing.address, listing.suburb, listing.description, listing.external_reference]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}
