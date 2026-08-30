import { randomBytes } from "crypto";
import type { ListingRow } from "@/types";

/** Generate a per-client website integration API key (hex, 64 chars). */
export function generateWebsiteIntegrationApiKey(): string {
  return `sk_live_${randomBytes(24).toString("hex")}`;
}

/** Append listing IDs to a contact's interested_listing_ids without duplicates or wholesale overwrite. */
export function appendInterestedListingIds(
  existing: unknown,
  toAdd: string | string[]
): string[] {
  const current = Array.isArray(existing)
    ? existing.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  const additions = Array.isArray(toAdd) ? toAdd : [toAdd];
  const set = new Set(current);
  for (const id of additions) {
    if (typeof id === "string" && id.length > 0) set.add(id);
  }
  return Array.from(set);
}

export type BuyerMatchContact = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  buyer_budget_min: number | null;
  buyer_budget_max: number | null;
  buyer_bedrooms_wanted: number | null;
  buyer_area_preference: string | null;
};

/** Basic overlap check: budget, bedrooms, and area preference vs listing. */
export function contactMatchesListing(
  contact: BuyerMatchContact,
  listing: Pick<ListingRow, "price" | "bedrooms" | "suburb">
): boolean {
  const price = listing.price != null ? Number(listing.price) : null;
  const beds = listing.bedrooms != null ? Number(listing.bedrooms) : null;
  const suburb = (listing.suburb ?? "").trim().toLowerCase();

  if (price != null) {
    const min = contact.buyer_budget_min != null ? Number(contact.buyer_budget_min) : null;
    const max = contact.buyer_budget_max != null ? Number(contact.buyer_budget_max) : null;
    if (min != null && price < min) return false;
    if (max != null && price > max) return false;
    if (min == null && max == null) {
      // no budget prefs — still allow if other signals match
    }
  }

  if (beds != null && contact.buyer_bedrooms_wanted != null) {
    if (Number(contact.buyer_bedrooms_wanted) > beds) return false;
  }

  const area = (contact.buyer_area_preference ?? "").trim().toLowerCase();
  if (area && suburb) {
    if (!suburb.includes(area) && !area.includes(suburb)) return false;
  }

  // Require at least one preference signal so we don't match every contact
  const hasSignal =
    contact.buyer_budget_min != null ||
    contact.buyer_budget_max != null ||
    contact.buyer_bedrooms_wanted != null ||
    Boolean((contact.buyer_area_preference ?? "").trim());
  return hasSignal;
}

export function listingLabel(listing: {
  address?: string | null;
  suburb?: string | null;
  external_reference?: string | null;
}): string {
  const parts = [listing.address, listing.suburb].filter(Boolean);
  if (parts.length) return parts.join(", ");
  if (listing.external_reference) return listing.external_reference;
  return "Listing";
}

/** Normalize digits-only phone for agent matching. */
export function phoneDigitsOnly(phone: string | null | undefined): string {
  return String(phone ?? "").replace(/\D/g, "");
}

/** True when two phone strings match on significant trailing digits (8+). */
export function phonesMatchLoose(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = phoneDigitsOnly(a);
  const db = phoneDigitsOnly(b);
  if (!da || !db) return false;
  if (da === db) return true;
  const minLen = 8;
  if (da.length >= minLen && db.length >= minLen) {
    return da.endsWith(db) || db.endsWith(da);
  }
  return false;
}

/** Approve, delete, and unrestricted edit. Salespeople may submit listings for approval. */
export function canManageListings(role: string | null | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "CLIENT_MANAGER";
}
