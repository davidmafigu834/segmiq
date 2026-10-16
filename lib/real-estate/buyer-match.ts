import { isListingLive } from "@/lib/real-estate/listings";

/** Coarse lifecycle stored in real_estate_buyer_searches.status. Matching uses only active. */
export const COARSE_SEARCH_STATUSES = ["active", "paused", "completed", "closed", "needs_review"] as const;

/**
 * Agent-facing stage. Stored in pipeline_stage.
 * Existing rows with a null stage are treated as actively_searching when status is active.
 */
export const SEARCH_STAGES = [
  "new_enquiry",
  "requirements_discovery",
  "actively_searching",
  "viewings_in_progress",
  "decision_pending",
  "paused",
  "completed",
  "closed",
] as const;

export type SearchStage = (typeof SEARCH_STAGES)[number];

export const STAGE_LABEL: Record<SearchStage, string> = {
  new_enquiry: "New enquiry",
  requirements_discovery: "Requirements discovery",
  actively_searching: "Actively searching",
  viewings_in_progress: "Viewings in progress",
  decision_pending: "Decision pending",
  paused: "Paused",
  completed: "Completed",
  closed: "Closed",
};

export const REJECTION_REASONS = [
  "wrong_location",
  "above_budget",
  "too_small",
  "condition",
  "layout",
  "financing",
  "changed_plans",
  "other",
] as const;

export type RejectionReason = (typeof REJECTION_REASONS)[number];

export const REJECTION_LABEL: Record<RejectionReason, string> = {
  wrong_location: "Wrong location",
  above_budget: "Above budget",
  too_small: "Too small",
  condition: "Condition concerns",
  layout: "Unsuitable layout",
  financing: "Financing concern",
  changed_plans: "Changed plans",
  other: "Other",
};

export const INTEREST_STATES = [
  "matched",
  "recommended",
  "sent",
  "interested",
  "not_interested",
  "viewing_requested",
  "viewing_completed",
  "offer",
] as const;

export type InterestState = (typeof INTEREST_STATES)[number];

export const VIEWING_CONFIRMATIONS = [
  "tentative",
  "awaiting_confirmation",
  "confirmed",
  "rescheduled",
] as const;

export const VIEWING_OUTCOMES = [
  "interested",
  "considering",
  "second_viewing",
  "wants_offer",
  "too_expensive",
  "location_unsuitable",
  "condition",
  "not_interested",
  "no_show",
] as const;

export const RENTAL_APPLICATION_STATUSES = ["submitted", "under_review", "accepted", "declined"] as const;
export const DEPOSIT_STATUSES = ["expected", "reported", "verified"] as const;

export const PROPERTY_CATEGORIES = [
  "house",
  "apartment",
  "townhouse",
  "residential_stand",
  "commercial",
  "industrial",
  "agricultural",
  "other",
] as const;

export type PropertyCategory = (typeof PROPERTY_CATEGORIES)[number];

export const PROPERTY_CATEGORY_LABEL: Record<PropertyCategory, string> = {
  house: "House",
  apartment: "Apartment",
  townhouse: "Townhouse",
  residential_stand: "Residential stand",
  commercial: "Commercial",
  industrial: "Industrial",
  agricultural: "Agricultural",
  other: "Other",
};

/** Exact category ids only. Free text such as "3 bed house" is not classified. */
export function asPropertyCategory(value: unknown): PropertyCategory | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return (PROPERTY_CATEGORIES as readonly string[]).includes(key) ? (key as PropertyCategory) : null;
}

export function asPropertyCategories(values: unknown): PropertyCategory[] {
  if (!Array.isArray(values)) return [];
  const out = new Set<PropertyCategory>();
  for (const value of values) {
    const category = asPropertyCategory(value);
    if (category) out.add(category);
  }
  return [...out];
}

/** Categories the search asks for. A legacy free-text type counts only when it equals a category id. */
export function wantedCategories(search: { propertyCategories?: readonly string[] | null; propertyType: string | null }): PropertyCategory[] {
  const explicit = asPropertyCategories(search.propertyCategories ?? []);
  if (explicit.length) return explicit;
  const legacy = asPropertyCategory(search.propertyType);
  return legacy ? [legacy] : [];
}

export type CategoryFit = "no_preference" | "confirmed" | "unknown" | "conflict";

export function categoryFit(wanted: readonly PropertyCategory[], listingCategory: string | null | undefined): CategoryFit {
  if (!wanted.length) return "no_preference";
  const actual = asPropertyCategory(listingCategory);
  if (!actual) return "unknown";
  return wanted.includes(actual) ? "confirmed" : "conflict";
}

export type MatchListing = {
  id: string;
  clientId: string;
  transactionType: string;
  status: string | null;
  approvalStatus: string | null;
  price: number | null;
  suburb: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sizeSqm: number | null;
  propertyType: string | null;
  /** Structured category. Null means not recorded, which is not a confirmed match. */
  propertyCategory?: string | null;
  agentId?: string | null;
};

export type MatchSearch = {
  id: string;
  clientId: string;
  contactId: string;
  intent: "purchase" | "rental";
  status: string;
  pipelineStage: string | null;
  propertyType: string | null;
  propertyCategories?: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  locations: string[];
  bedrooms: number | null;
  bathrooms: number | null;
  allowAboveBudget: boolean;
  allowAlternateLocations: boolean;
  assignedAgentId?: string | null;
};

export type MatchStrength = "strong" | "alternative" | "partial";

export type MatchExplanation = {
  listingId: string;
  searchId: string;
  strength: MatchStrength;
  /** Deterministic points. Not a probability. See scoreMatch. */
  score: number;
  reasons: string[];
  hardPassed: string[];
};

const MATCHABLE_STAGES = new Set<string>([
  "new_enquiry",
  "requirements_discovery",
  "actively_searching",
  "viewings_in_progress",
  "decision_pending",
]);

export function coarseStatusForStage(stage: SearchStage): "active" | "paused" | "completed" | "closed" {
  if (stage === "paused") return "paused";
  if (stage === "completed") return "completed";
  if (stage === "closed") return "closed";
  return "active";
}

export function effectiveStage(search: { status: string; pipelineStage: string | null }): string {
  if (search.pipelineStage && (SEARCH_STAGES as readonly string[]).includes(search.pipelineStage)) {
    return search.pipelineStage;
  }
  if (search.status === "paused") return "paused";
  if (search.status === "completed") return "completed";
  if (search.status === "closed") return "closed";
  if (search.status === "needs_review") return "needs_review";
  return "actively_searching";
}

export function searchIsMatchable(search: { status: string; pipelineStage: string | null }): boolean {
  if (search.status !== "active") return false;
  return MATCHABLE_STAGES.has(effectiveStage(search));
}

/** A rejected or withdrawn offer never closes the search or other interests. */
export function searchAfterOfferOutcome(stage: string): { stage: string; closeSearch: false } {
  return { stage, closeSearch: false };
}

/** An accepted offer starts a transaction. It does not complete the sale or unrelated searches. */
export function searchAfterAcceptedOffer(stage: string): { stage: string; closeSearch: false } {
  return { stage, closeSearch: false };
}

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function locationHit(locations: string[], suburb: string | null): boolean {
  const area = norm(suburb);
  if (!area) return false;
  return locations.some((location) => {
    const wanted = norm(location);
    return wanted.length > 0 && (area.includes(wanted) || wanted.includes(area));
  });
}

function intentAllows(intent: "purchase" | "rental", transactionType: string): boolean {
  if (intent === "rental") return transactionType === "rental";
  return transactionType === "sale" || transactionType === "new_development";
}

function typesConflict(wanted: string | null, listingType: string | null): boolean {
  const a = norm(wanted);
  const b = norm(listingType);
  if (!a || !b) return false;
  return a !== b;
}

/**
 * Score weights, all explicit:
 * 40 location preference met, 25 price inside the stated maximum,
 * 20 bedrooms met, 10 bathrooms met, 5 property type met.
 * A missing preference is not awarded and is not a penalty.
 */
export function scoreMatch(input: {
  locationMet: boolean;
  hasLocationPreference: boolean;
  budgetMet: boolean;
  bedroomsMet: boolean;
  hasBedroomPreference: boolean;
  bathroomsMet: boolean;
  hasBathroomPreference: boolean;
  typeMet: boolean;
  hasTypePreference: boolean;
}): number {
  let score = 0;
  if (input.hasLocationPreference && input.locationMet) score += 40;
  if (input.budgetMet) score += 25;
  if (input.hasBedroomPreference && input.bedroomsMet) score += 20;
  if (input.hasBathroomPreference && input.bathroomsMet) score += 10;
  if (input.hasTypePreference && input.typeMet) score += 5;
  return score;
}

export function explainSearchListing(
  search: MatchSearch,
  listing: MatchListing,
  rejectedListingIds: ReadonlySet<string>
): MatchExplanation | null {
  if (search.clientId !== listing.clientId) return null;
  if (!searchIsMatchable(search)) return null;
  if (rejectedListingIds.has(listing.id)) return null;
  if (!isListingLive({ status: listing.status, approval_status: listing.approvalStatus })) return null;
  if (!intentAllows(search.intent, listing.transactionType)) return null;
  const wanted = wantedCategories(search);
  const fit = categoryFit(wanted, listing.propertyCategory);
  if (fit === "conflict") return null;
  if (!wanted.length && typesConflict(search.propertyType, listing.propertyType)) return null;

  const hardPassed = [
    search.intent === "rental" ? "Rental listing" : "Sale listing",
    "Approved and available",
  ];
  if (fit === "confirmed") hardPassed.push("Property type matches");

  if (search.budgetMax != null && listing.price != null && listing.price > search.budgetMax) {
    if (!search.allowAboveBudget) return null;
    hardPassed.push("Above the stated maximum because the customer allowed it");
  }
  if (search.bedrooms != null && listing.bedrooms != null && listing.bedrooms < search.bedrooms) return null;
  if (search.bathrooms != null && listing.bathrooms != null && listing.bathrooms < search.bathrooms) return null;

  const hasLocation = search.locations.some((location) => norm(location).length > 0);
  const locationMet = !hasLocation || locationHit(search.locations, listing.suburb);
  if (hasLocation && !locationMet && !search.allowAlternateLocations) return null;

  const budgetMet =
    listing.price == null || search.budgetMax == null || listing.price <= search.budgetMax || search.allowAboveBudget;
  const bedroomsMet = search.bedrooms == null || listing.bedrooms == null || listing.bedrooms >= search.bedrooms;
  const bathroomsMet = search.bathrooms == null || listing.bathrooms == null || listing.bathrooms >= search.bathrooms;
  const typeMet = wanted.length
    ? fit === "confirmed"
    : !typesConflict(search.propertyType, listing.propertyType) && Boolean(norm(search.propertyType) && norm(listing.propertyType));

  const reasons: string[] = [];
  if (fit === "confirmed") reasons.push(`Property type is ${PROPERTY_CATEGORY_LABEL[asPropertyCategory(listing.propertyCategory) ?? "other"].toLowerCase()}`);
  if (fit === "unknown") reasons.push("Property type is not recorded on the listing");
  if (hasLocation && locationMet) reasons.push(`Location matches ${listing.suburb ?? "the preferred area"}`);
  if (hasLocation && !locationMet) reasons.push(`Outside the first preferred location${listing.suburb ? ` (${listing.suburb})` : ""}`);
  if (search.budgetMax != null && listing.price != null && listing.price <= search.budgetMax) {
    reasons.push("Within the stated budget");
  } else if (listing.price == null) {
    reasons.push("Asking price is not recorded");
  }
  if (search.bedrooms != null && listing.bedrooms != null && listing.bedrooms >= search.bedrooms) {
    reasons.push(`${listing.bedrooms} bedrooms meets the requirement`);
  }
  if (search.bedrooms != null && listing.bedrooms == null) reasons.push("Bedroom count is not recorded");
  if (!reasons.length) reasons.push("Meets the hard requirements on file");

  const alternative = hasLocation && !locationMet;
  const missingFacts =
    (search.bedrooms != null && listing.bedrooms == null) || listing.price == null || fit === "unknown";
  const strength: MatchStrength = alternative ? "alternative" : missingFacts ? "partial" : "strong";

  return {
    listingId: listing.id,
    searchId: search.id,
    strength,
    score: scoreMatch({
      locationMet,
      hasLocationPreference: hasLocation,
      budgetMet,
      bedroomsMet,
      hasBedroomPreference: search.bedrooms != null,
      bathroomsMet,
      hasBathroomPreference: search.bathrooms != null,
      typeMet,
      hasTypePreference: wanted.length > 0 || Boolean(norm(search.propertyType)),
    }),
    reasons,
    hardPassed,
  };
}

const STRENGTH_ORDER: Record<MatchStrength, number> = { strong: 0, alternative: 1, partial: 2 };

export function matchListingsForSearch(
  search: MatchSearch,
  listings: MatchListing[],
  rejectedListingIds: Iterable<string>
): MatchExplanation[] {
  const rejected = new Set(rejectedListingIds);
  return listings
    .map((listing) => explainSearchListing(search, listing, rejected))
    .filter((row): row is MatchExplanation => row != null)
    .sort((a, b) => STRENGTH_ORDER[a.strength] - STRENGTH_ORDER[b.strength] || b.score - a.score);
}

export function matchSearchesForListing(
  listing: MatchListing,
  searches: MatchSearch[],
  rejectedBySearch: ReadonlyMap<string, ReadonlySet<string>>
): MatchExplanation[] {
  return searches
    .map((search) => explainSearchListing(search, listing, rejectedBySearch.get(search.id) ?? new Set()))
    .filter((row): row is MatchExplanation => row != null)
    .sort((a, b) => STRENGTH_ORDER[a.strength] - STRENGTH_ORDER[b.strength] || b.score - a.score);
}

export type MatchPair = { listingId: string; searchId: string; agentId: string | null; fingerprint: string };

export function listingFingerprint(listing: { price: number | null; suburb: string | null; status: string | null }): string {
  const price = listing.price == null ? "none" : String(Math.round(Number(listing.price)));
  return `${price}|${norm(listing.suburb)}|${norm(listing.status)}`;
}

/** Internal notifications only. The same listing, search and fingerprint is not notified twice. */
export function newMatchNotifications(
  pairs: MatchPair[],
  alreadyNotified: ReadonlySet<string>
): MatchPair[] {
  const seen = new Set<string>();
  const fresh: MatchPair[] = [];
  for (const pair of pairs) {
    const key = `${pair.listingId}:${pair.searchId}:${pair.fingerprint}`;
    if (alreadyNotified.has(key) || seen.has(key)) continue;
    seen.add(key);
    fresh.push(pair);
  }
  return fresh;
}

export function notificationKey(pair: { listingId: string; searchId: string; fingerprint: string }): string {
  return `${pair.listingId}:${pair.searchId}:${pair.fingerprint}`;
}

/**
 * Live notifications are never repeated. A notification invalidated because the
 * listing left the market is revived once when the same listing is live again.
 */
export function notificationPlan(
  pairs: MatchPair[],
  existing: ReadonlyArray<{ key: string; invalidated: boolean }>
): { insert: MatchPair[]; revive: MatchPair[] } {
  const live = new Set(existing.filter((row) => !row.invalidated).map((row) => row.key));
  const invalidated = new Set(existing.filter((row) => row.invalidated).map((row) => row.key));
  const insert: MatchPair[] = [];
  const revive: MatchPair[] = [];
  const seen = new Set<string>();
  for (const pair of pairs) {
    const key = notificationKey(pair);
    if (seen.has(key) || live.has(key)) continue;
    seen.add(key);
    if (invalidated.has(key)) revive.push(pair);
    else insert.push(pair);
  }
  return { insert, revive };
}

export type InterestRecord = {
  searchId: string | null;
  listingId: string;
  state: string | null;
  rejectionReason?: string | null;
  rejectedFingerprint?: string | null;
};

const PRICE_SENSITIVE_REJECTIONS = new Set(["above_budget", "financing"]);

function fingerprintPrice(fingerprint: string | null | undefined): number | null {
  if (!fingerprint) return null;
  const raw = fingerprint.split("|")[0];
  if (!raw || raw === "none") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * A price-based rejection lapses only when the asking price has dropped since
 * the customer declined. Other reasons hold until an agent resets them.
 */
export function rejectionStillApplies(
  interest: Pick<InterestRecord, "rejectionReason" | "rejectedFingerprint">,
  currentFingerprint: string | null
): boolean {
  if (!interest.rejectionReason || !PRICE_SENSITIVE_REJECTIONS.has(interest.rejectionReason)) return true;
  const before = fingerprintPrice(interest.rejectedFingerprint);
  const now = fingerprintPrice(currentFingerprint);
  if (before == null || now == null) return true;
  return now >= before;
}

/**
 * Listings excluded for one search.
 * A rejection in this search always applies (until reset or a price drop for a price reason).
 * A rejection by the same person in another search, or before searches existed,
 * applies unless this search holds its own non-rejected record for the listing.
 */
export function rejectedListingsForSearch(
  searchId: string,
  interests: readonly InterestRecord[],
  currentFingerprints: ReadonlyMap<string, string> = new Map()
): Set<string> {
  const ownActive = new Set<string>();
  const rejected = new Set<string>();
  for (const row of interests) {
    if (row.searchId === searchId && row.state !== "not_interested") ownActive.add(row.listingId);
  }
  for (const row of interests) {
    if (row.state !== "not_interested") continue;
    if (row.searchId !== searchId && ownActive.has(row.listingId)) continue;
    if (!rejectionStillApplies(row, currentFingerprints.get(row.listingId) ?? null)) continue;
    rejected.add(row.listingId);
  }
  return rejected;
}

/** The interest state change resets an earlier rejection for this search. */
export function isRejectionReset(previousState: string | null | undefined, nextState: string): boolean {
  return previousState === "not_interested" && nextState !== "not_interested";
}

export const MATCH_PAGE_SIZE = 500;
export const MATCH_SCAN_CEILING = 5000;

function orGroups(groups: string[][]): string | null {
  const filled = groups.filter((group) => group.length > 0);
  if (!filled.length) return null;
  let combos: string[][] = [[]];
  for (const group of filled) {
    const next: string[][] = [];
    for (const combo of combos) for (const clause of group) next.push([...combo, clause]);
    combos = next;
  }
  if (filled.length === 1) return filled[0].join(",");
  return combos.map((combo) => `and(${combo.join(",")})`).join(",");
}

/**
 * PostgREST `or` filter for listing candidates. Unknown price and unknown
 * category stay in the candidate set so they can be shown as partial matches.
 */
export function listingCandidateFilter(input: {
  budgetMax: number | null;
  allowAboveBudget: boolean;
  categories: readonly PropertyCategory[];
  includeCategory?: boolean;
}): string | null {
  const price =
    input.budgetMax != null && !input.allowAboveBudget && Number.isFinite(input.budgetMax)
      ? ["price.is.null", `price.lte.${input.budgetMax}`]
      : [];
  const category =
    input.includeCategory !== false && input.categories.length
      ? ["property_category.is.null", `property_category.in.(${input.categories.join(",")})`]
      : [];
  return orGroups([price, category]);
}

/** PostgREST `or` filter for searches that could accept a listing at this price. */
export function searchCandidateFilter(listingPrice: number | null): string | null {
  if (listingPrice == null || !Number.isFinite(listingPrice)) return null;
  return `budget_max.is.null,budget_max.gte.${listingPrice},allow_above_budget.eq.true`;
}

export function canSeeBuyerContact(input: {
  requesterId: string;
  ownerAgentId: string | null;
  role: string | null | undefined;
  introductionAccepted: boolean;
}): boolean {
  if (input.role === "SUPER_ADMIN" || input.role === "CLIENT_MANAGER") return true;
  if (input.ownerAgentId && input.ownerAgentId === input.requesterId) return true;
  return input.introductionAccepted;
}

export type DemandGap = {
  location: string;
  intent: "purchase" | "rental";
  propertyType: string | null;
  searchCount: number;
  contactCount: number;
  eligibleListingCount: number;
  unmatchedSearchCount: number;
};

/**
 * Agency recorded demand, not a market survey.
 * searchCount is active searches. contactCount is distinct people in that group.
 */
export function demandGaps(searches: MatchSearch[], listings: MatchListing[]): DemandGap[] {
  const groups = new Map<string, { searches: MatchSearch[]; location: string; intent: "purchase" | "rental"; propertyType: string | null }>();
  for (const search of searches) {
    if (!searchIsMatchable(search)) continue;
    const location = search.locations.map((item) => item.trim()).find(Boolean) ?? "Unspecified area";
    const categories = wantedCategories(search);
    const propertyType = categories.length
      ? categories.map((category) => PROPERTY_CATEGORY_LABEL[category]).join(" / ")
      : search.propertyType?.trim() || null;
    const key = `${search.intent}|${location.toLowerCase()}|${(propertyType ?? "any").toLowerCase()}`;
    const group = groups.get(key) ?? { searches: [], location, intent: search.intent, propertyType };
    group.searches.push(search);
    groups.set(key, group);
  }

  const gaps: DemandGap[] = [];
  for (const group of groups.values()) {
    const listingIds = new Set<string>();
    let unmatched = 0;
    for (const search of group.searches) {
      const hits = matchListingsForSearch(search, listings, []);
      if (hits.length === 0) unmatched += 1;
      for (const hit of hits) listingIds.add(hit.listingId);
    }
    gaps.push({
      location: group.location,
      intent: group.intent,
      propertyType: group.propertyType,
      searchCount: group.searches.length,
      contactCount: new Set(group.searches.map((search) => search.contactId)).size,
      eligibleListingCount: listingIds.size,
      unmatchedSearchCount: unmatched,
    });
  }
  return gaps.sort((a, b) => b.unmatchedSearchCount - a.unmatchedSearchCount || b.searchCount - a.searchCount);
}

export type SearchSnapshot = {
  budgetMin: number | null;
  budgetMax: number | null;
  locations: string[];
  propertyType: string | null;
  timeframe: string | null;
  pipelineStage: string | null;
  assignedAgentId: string | null;
};

export function searchFieldChanges(
  before: SearchSnapshot,
  after: SearchSnapshot
): Array<{ field: string; from: string | null; to: string | null }> {
  const changes: Array<{ field: string; from: string | null; to: string | null }> = [];
  const pairs: Array<[string, string | null, string | null]> = [
    ["budget_min", before.budgetMin == null ? null : String(before.budgetMin), after.budgetMin == null ? null : String(after.budgetMin)],
    ["budget_max", before.budgetMax == null ? null : String(before.budgetMax), after.budgetMax == null ? null : String(after.budgetMax)],
    ["locations", before.locations.join(", ") || null, after.locations.join(", ") || null],
    ["property_type", before.propertyType, after.propertyType],
    ["timeframe", before.timeframe, after.timeframe],
    ["pipeline_stage", before.pipelineStage, after.pipelineStage],
    ["assigned_agent_id", before.assignedAgentId, after.assignedAgentId],
  ];
  for (const [field, from, to] of pairs) {
    if (from !== to) changes.push({ field, from, to });
  }
  return changes;
}

export function viewingOverlapWarning(
  existing: Array<{ agentId: string | null; scheduledAt: string; id?: string }>,
  next: { agentId: string | null; scheduledAt: string; ignoreId?: string }
): string | null {
  if (!next.agentId) return null;
  const start = new Date(next.scheduledAt).getTime();
  if (!Number.isFinite(start)) return null;
  const clash = existing.some((row) => {
    if (row.id && row.id === next.ignoreId) return false;
    if (row.agentId !== next.agentId) return false;
    const other = new Date(row.scheduledAt).getTime();
    return Number.isFinite(other) && Math.abs(other - start) < 90 * 60 * 1000;
  });
  return clash ? "This agent already has a viewing within 90 minutes. Confirm only if the times can both be kept." : null;
}

export function isDuplicateViewing(
  existing: Array<{ contactId: string; listingId: string; scheduledAt: string }>,
  next: { contactId: string; listingId: string; scheduledAt: string }
): boolean {
  const start = new Date(next.scheduledAt).getTime();
  return existing.some((row) => {
    if (row.contactId !== next.contactId || row.listingId !== next.listingId) return false;
    const other = new Date(row.scheduledAt).getTime();
    return Number.isFinite(start) && Number.isFinite(other) && Math.abs(other - start) < 60 * 1000;
  });
}

export function nextDepositStatus(input: {
  action: "report" | "verify";
  role: string | null | undefined;
}): { ok: true; status: "reported" | "verified" } | { ok: false; error: string } {
  if (input.action === "report") return { ok: true, status: "reported" };
  if (input.role === "CLIENT_MANAGER" || input.role === "SUPER_ADMIN") {
    return { ok: true, status: "verified" };
  }
  return { ok: false, error: "Only a manager can mark a deposit verified. An upload is not verification." };
}

export function buyerRailMode(dealSide: string | null | undefined): "buyer" | "seller" | "unclassified" {
  if (dealSide === "buy_side" || dealSide === "tenant_side") return "buyer";
  if (dealSide === "sell_side" || dealSide === "landlord_side") return "seller";
  return "unclassified";
}

export function canLinkEnquiry(input: {
  leadClientId: string;
  searchClientId: string;
  leadContactId: string | null;
  searchContactId: string;
}): boolean {
  return input.leadClientId === input.searchClientId && input.leadContactId === input.searchContactId;
}

export function agentPriorities(input: {
  now: Date;
  searches: Array<{
    id: string;
    contactName: string;
    stage: string;
    nextActionAt: string | null;
    status: string;
  }>;
  viewingsToday: Array<{ id: string; contactName: string; listingLabel: string; scheduledAt: string }>;
  offersWaiting: Array<{ id: string; contactName: string; status: string }>;
  freshMatches: Array<{ searchId: string; contactName: string; count: number }>;
}): Array<{ id: string; title: string; detail: string; action: string }> {
  const items: Array<{ id: string; title: string; detail: string; action: string }> = [];
  for (const viewing of input.viewingsToday) {
    items.push({
      id: `viewing-${viewing.id}`,
      title: viewing.contactName,
      detail: `Viewing ${viewing.listingLabel}`,
      action: "Open viewing",
    });
  }
  for (const offer of input.offersWaiting) {
    items.push({
      id: `offer-${offer.id}`,
      title: offer.contactName,
      detail: `Offer is ${offer.status.replaceAll("_", " ")}`,
      action: "Review offer",
    });
  }
  for (const match of input.freshMatches) {
    items.push({
      id: `match-${match.searchId}`,
      title: match.contactName,
      detail:
        match.count === 1
          ? "1 approved property now matches this search"
          : `${match.count} approved properties now match this search`,
      action: "Review matches",
    });
  }
  for (const search of input.searches) {
    if (search.status !== "active" || !search.nextActionAt) continue;
    if (new Date(search.nextActionAt).getTime() > input.now.getTime()) continue;
    items.push({
      id: `follow-${search.id}`,
      title: search.contactName,
      detail: "Follow-up is due",
      action: "Open search",
    });
  }
  return items;
}
