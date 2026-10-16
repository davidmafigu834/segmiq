/**
 * Idempotent plans for the Phase 1 foundation backfill.
 * Contact columns stay. These plans do not guess that an unclassified person is a buyer.
 */

export type LegacyLeadSide = {
  dealSide: string | null;
};

export type LegacyContactFields = {
  clientId: string;
  contactId: string;
  buyerBudgetMin: number | null;
  buyerBudgetMax: number | null;
  buyerBedroomsWanted: number | null;
  buyerAreaPreference: string | null;
  buyerTimeline: string | null;
  interestedListingIds: string[];
};

export type PlannedSearch = {
  clientId: string;
  contactId: string;
  intent: "purchase" | "rental";
  budgetMin: number | null;
  budgetMax: number | null;
  locations: string[];
  bedrooms: number | null;
  timeframe: string | null;
  status: "active" | "needs_review";
  provenance: "legacy_contact_fields";
};

export type PlannedInterest = {
  clientId: string;
  contactId: string;
  listingId: string;
  source: "interested_listing_ids";
  status: "active" | "needs_review";
};

export type PlannedRole = {
  clientId: string;
  contactId: string;
  role: "buyer" | "tenant" | "seller" | "landlord";
  verificationStatus: "unverified";
  source: "lead_deal_side";
};

const ROLE_BY_SIDE: Record<string, PlannedRole["role"]> = {
  buy_side: "buyer",
  tenant_side: "tenant",
  sell_side: "seller",
  landlord_side: "landlord",
};

export function explicitDemandIntent(
  leads: LegacyLeadSide[]
): "purchase" | "rental" | null {
  const sides = new Set(leads.map((l) => l.dealSide).filter(Boolean));
  if (sides.has("buy_side")) return "purchase";
  if (sides.has("tenant_side")) return "rental";
  return null;
}

export function planContactRoles(contactId: string, clientId: string, leads: LegacyLeadSide[]): PlannedRole[] {
  const roles = new Set<PlannedRole["role"]>();
  for (const lead of leads) {
    const role = lead.dealSide ? ROLE_BY_SIDE[lead.dealSide] : undefined;
    if (role) roles.add(role);
  }
  return [...roles].map((role) => ({
    clientId,
    contactId,
    role,
    verificationStatus: "unverified" as const,
    source: "lead_deal_side" as const,
  }));
}

/** A search is created only when buyer columns exist. Unclassified intent is needs_review, not active. */
export function planLegacySearch(
  contact: LegacyContactFields,
  leads: LegacyLeadSide[]
): PlannedSearch | null {
  const hasSignal =
    contact.buyerBudgetMin != null ||
    contact.buyerBudgetMax != null ||
    contact.buyerBedroomsWanted != null ||
    Boolean((contact.buyerAreaPreference ?? "").trim()) ||
    Boolean((contact.buyerTimeline ?? "").trim());
  if (!hasSignal) return null;
  const intent = explicitDemandIntent(leads);
  const area = (contact.buyerAreaPreference ?? "").trim();
  return {
    clientId: contact.clientId,
    contactId: contact.contactId,
    intent: intent === "rental" ? "rental" : "purchase",
    budgetMin: contact.buyerBudgetMin,
    budgetMax: contact.buyerBudgetMax,
    locations: area ? [area] : [],
    bedrooms: contact.buyerBedroomsWanted,
    timeframe: contact.buyerTimeline,
    status: intent ? "active" : "needs_review",
    provenance: "legacy_contact_fields",
  };
}

export function planLegacyInterests(
  contact: LegacyContactFields,
  listingIdsInTenant: Set<string>,
  hasExplicitDemand: boolean
): { interests: PlannedInterest[]; reviewListingIds: string[] } {
  const interests: PlannedInterest[] = [];
  const reviewListingIds: string[] = [];
  const seen = new Set<string>();
  for (const raw of contact.interestedListingIds) {
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    if (!listingIdsInTenant.has(raw)) {
      reviewListingIds.push(raw);
      continue;
    }
    interests.push({
      clientId: contact.clientId,
      contactId: contact.contactId,
      listingId: raw,
      source: "interested_listing_ids",
      status: hasExplicitDemand ? "active" : "needs_review",
    });
  }
  return { interests, reviewListingIds };
}

export function omitExistingKeys<T>(rows: T[], existing: Set<string>, keyOf: (row: T) => string): T[] {
  return rows.filter((row) => !existing.has(keyOf(row)));
}

export type LegacySearchSnapshot = {
  budgetMin: number | null;
  budgetMax: number | null;
  bedrooms: number | null;
  timeframe: string | null;
  locations: string[];
};

function sameNumber(left: number | null | undefined, right: number | null | undefined): boolean {
  if (left == null && right == null) return true;
  if (left == null || right == null) return false;
  return Number(left) === Number(right);
}

/** Detects drift between contact columns and a legacy search without rewriting either side. */
export function legacySearchDivergence(
  contact: LegacyContactFields,
  search: LegacySearchSnapshot | null
): string | null {
  const planned = planLegacySearch(contact, []);
  if (!planned) return null;
  if (!search) return "legacy buyer fields have no search row";
  const drifted: string[] = [];
  if (!sameNumber(search.budgetMin, contact.buyerBudgetMin)) drifted.push("budget min");
  if (!sameNumber(search.budgetMax, contact.buyerBudgetMax)) drifted.push("budget max");
  if (!sameNumber(search.bedrooms, contact.buyerBedroomsWanted)) drifted.push("bedrooms");
  const timeframe = (contact.buyerTimeline ?? "").trim() || null;
  const searchTimeframe = (search.timeframe ?? "").trim() || null;
  if (timeframe !== searchTimeframe) drifted.push("timeframe");
  const area = (contact.buyerAreaPreference ?? "").trim();
  if (area && !(search.locations ?? []).includes(area)) drifted.push("area");
  if (!drifted.length) return null;
  return `legacy contact fields diverge from the search: ${drifted.join(", ")}`;
}
