import { createAdminClient } from "@/lib/supabase/admin";
import { isDemandSide } from "@/lib/real-estate/requirements";
import {
  legacySearchDivergence,
  omitExistingKeys,
  planContactRoles,
  planLegacyInterests,
  planLegacySearch,
  type LegacyContactFields,
  type LegacyLeadSide,
  type LegacySearchSnapshot,
} from "@/lib/real-estate/foundation-plan";

function tableMissing(error: { message?: string; code?: string } | null): boolean {
  const message = error?.message ?? "";
  return error?.code === "42P01" || message.includes("does not exist") || message.includes("schema cache");
}

const ROLE_BY_SIDE: Record<string, "buyer" | "tenant" | "seller" | "landlord"> = {
  buy_side: "buyer",
  tenant_side: "tenant",
  sell_side: "seller",
  landlord_side: "landlord",
};

/** When an agent classifies an enquiry, record the role. Promote a review search only for buyers and tenants. */
export async function syncClassification(input: {
  clientId: string;
  contactId: string | null;
  dealSide: string | null;
}): Promise<void> {
  if (!input.contactId || !input.dealSide) return;
  const role = ROLE_BY_SIDE[input.dealSide];
  if (!role) return;
  const supabase = createAdminClient();
  const { error } = await supabase.from("real_estate_contact_roles").upsert(
    {
      client_id: input.clientId,
      contact_id: input.contactId,
      role,
      verification_status: "unverified",
      source: "agent_classification",
    },
    { onConflict: "client_id,contact_id,role" }
  );
  if (error && !tableMissing(error)) console.error("[re-role]", error.message);

  if (!isDemandSide(input.dealSide)) return;
  const { error: searchError } = await supabase
    .from("real_estate_buyer_searches")
    .update({ status: "active", intent: input.dealSide === "tenant_side" ? "rental" : "purchase" })
    .eq("client_id", input.clientId)
    .eq("contact_id", input.contactId)
    .eq("provenance", "legacy_contact_fields")
    .eq("status", "needs_review");
  if (searchError && !tableMissing(searchError)) console.error("[re-search-promote]", searchError.message);
}

/**
 * Dual-write for an already classified buyer or tenant.
 * Unclassified and supply-side contacts stay on the legacy columns only.
 */
export async function mirrorBuyerRequirements(input: {
  clientId: string;
  contactId: string;
  dealSide: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  bedrooms?: number | null;
  area?: string | null;
  timeline?: string | null;
}): Promise<void> {
  if (!isDemandSide(input.dealSide)) return;
  const supabase = createAdminClient();
  const patch: Record<string, unknown> = {
    intent: input.dealSide === "tenant_side" ? "rental" : "purchase",
    status: "active",
  };
  if (input.budgetMin !== undefined) patch.budget_min = input.budgetMin;
  if (input.budgetMax !== undefined) patch.budget_max = input.budgetMax;
  if (input.bedrooms !== undefined) patch.bedrooms = input.bedrooms;
  if (input.area !== undefined) {
    const area = (input.area ?? "").trim();
    patch.locations = area ? [area] : [];
  }
  if (input.timeline !== undefined) patch.timeframe = (input.timeline ?? "").trim() || null;
  const { data: existing, error: readError } = await supabase
    .from("real_estate_buyer_searches")
    .select("id")
    .eq("client_id", input.clientId)
    .eq("contact_id", input.contactId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readError) {
    if (!tableMissing(readError)) console.error("[re-search-mirror]", readError.message);
    return;
  }
  const write = existing?.id
    ? await supabase
        .from("real_estate_buyer_searches")
        .update(patch)
        .eq("id", existing.id as string)
        .eq("client_id", input.clientId)
    : await supabase.from("real_estate_buyer_searches").insert({
        ...patch,
        client_id: input.clientId,
        contact_id: input.contactId,
        provenance: "agent_requirements",
      });
  if (write.error && !tableMissing(write.error)) console.error("[re-search-mirror]", write.error.message);
}

export async function recordPropertyInterest(input: {
  clientId: string;
  contactId: string;
  listingId: string;
  agentId?: string | null;
  source: string;
  explicitDemand: boolean;
}): Promise<void> {
  const supabase = createAdminClient();
  const { data: existing, error: lookupError } = await supabase
    .from("real_estate_property_interests")
    .select("id")
    .eq("client_id", input.clientId)
    .eq("contact_id", input.contactId)
    .eq("listing_id", input.listingId)
    .limit(1);
  if (lookupError) {
    if (!tableMissing(lookupError)) console.error("[re-interest]", lookupError.message);
    return;
  }
  if ((existing ?? []).length) return;
  const { error } = await supabase.from("real_estate_property_interests").insert({
    client_id: input.clientId,
    contact_id: input.contactId,
    listing_id: input.listingId,
    agent_id: input.agentId ?? null,
    source: input.source,
    status: input.explicitDemand ? "active" : "needs_review",
  });
  if (error && error.code !== "23505" && !tableMissing(error)) console.error("[re-interest]", error.message);
}

export async function backfillRealEstateFoundation(clientId: string): Promise<{
  searchesCreated: number;
  interestsCreated: number;
  rolesCreated: number;
  reviewListingIds: string[];
}> {
  const supabase = createAdminClient();
  const [{ data: contacts }, { data: leads }, { data: listings }] = await Promise.all([
    supabase
      .from("contacts")
      .select(
        "id, client_id, buyer_budget_min, buyer_budget_max, buyer_bedrooms_wanted, buyer_area_preference, buyer_timeline, interested_listing_ids"
      )
      .eq("client_id", clientId),
    supabase.from("leads").select("id, contact_id, deal_side").eq("client_id", clientId),
    supabase.from("listings").select("id").eq("client_id", clientId),
  ]);

  const leadsByContact = new Map<string, LegacyLeadSide[]>();
  for (const lead of leads ?? []) {
    const contactId = lead.contact_id as string | null;
    if (!contactId) continue;
    const list = leadsByContact.get(contactId) ?? [];
    list.push({ dealSide: (lead.deal_side as string | null) ?? null });
    leadsByContact.set(contactId, list);
  }
  const listingIds = new Set((listings ?? []).map((l) => l.id as string));

  const plannedSearches = [];
  const plannedInterests = [];
  const plannedRoles = [];
  const reviewListingIds: string[] = [];

  for (const row of contacts ?? []) {
    const contact: LegacyContactFields = {
      clientId,
      contactId: row.id as string,
      buyerBudgetMin: (row.buyer_budget_min as number | null) ?? null,
      buyerBudgetMax: (row.buyer_budget_max as number | null) ?? null,
      buyerBedroomsWanted: (row.buyer_bedrooms_wanted as number | null) ?? null,
      buyerAreaPreference: (row.buyer_area_preference as string | null) ?? null,
      buyerTimeline: (row.buyer_timeline as string | null) ?? null,
      interestedListingIds: Array.isArray(row.interested_listing_ids)
        ? (row.interested_listing_ids as unknown[]).filter((id): id is string => typeof id === "string")
        : [],
    };
    const contactLeads = leadsByContact.get(contact.contactId) ?? [];
    const search = planLegacySearch(contact, contactLeads);
    if (search) plannedSearches.push(search);
    const demand = contactLeads.some((l) => isDemandSide(l.dealSide));
    const interests = planLegacyInterests(contact, listingIds, demand);
    plannedInterests.push(...interests.interests);
    reviewListingIds.push(...interests.reviewListingIds);
    plannedRoles.push(...planContactRoles(contact.contactId, clientId, contactLeads));
  }

  const { data: existingSearches } = await supabase
    .from("real_estate_buyer_searches")
    .select("contact_id, provenance")
    .eq("client_id", clientId)
    .eq("provenance", "legacy_contact_fields");
  const searchKeys = new Set((existingSearches ?? []).map((s) => s.contact_id as string));
  const newSearches = omitExistingKeys(plannedSearches, searchKeys, (s) => s.contactId);

  if (newSearches.length) {
    const { error } = await supabase.from("real_estate_buyer_searches").insert(
      newSearches.map((s) => ({
        client_id: s.clientId,
        contact_id: s.contactId,
        intent: s.intent,
        budget_min: s.budgetMin,
        budget_max: s.budgetMax,
        locations: s.locations,
        bedrooms: s.bedrooms,
        timeframe: s.timeframe,
        status: s.status,
        provenance: s.provenance,
      }))
    );
    if (error && !tableMissing(error)) throw new Error(error.message);
  }

  const { data: existingInterests } = await supabase
    .from("real_estate_property_interests")
    .select("contact_id, listing_id")
    .eq("client_id", clientId);
  const interestKeys = new Set(
    (existingInterests ?? []).map((i) => `${i.contact_id as string}:${i.listing_id as string}`)
  );
  const newInterests = omitExistingKeys(
    plannedInterests,
    interestKeys,
    (i) => `${i.contactId}:${i.listingId}`
  );
  if (newInterests.length) {
    const { error } = await supabase.from("real_estate_property_interests").insert(
      newInterests.map((i) => ({
        client_id: i.clientId,
        contact_id: i.contactId,
        listing_id: i.listingId,
        source: i.source,
        status: i.status,
      }))
    );
    if (error && !tableMissing(error)) throw new Error(error.message);
  }

  const { data: existingRoles } = await supabase
    .from("real_estate_contact_roles")
    .select("contact_id, role")
    .eq("client_id", clientId);
  const roleKeys = new Set(
    (existingRoles ?? []).map((r) => `${r.contact_id as string}:${r.role as string}`)
  );
  const newRoles = omitExistingKeys(plannedRoles, roleKeys, (r) => `${r.contactId}:${r.role}`);
  if (newRoles.length) {
    const { error } = await supabase.from("real_estate_contact_roles").insert(
      newRoles.map((r) => ({
        client_id: r.clientId,
        contact_id: r.contactId,
        role: r.role,
        verification_status: r.verificationStatus,
        source: r.source,
      }))
    );
    if (error && !tableMissing(error)) throw new Error(error.message);
  }

  const reviewReasons: Array<{ entityId: string; reason: string }> = [];
  const existingSearchByContact = new Map<string, LegacySearchSnapshot>();
  const { data: searchRows, error: searchReadError } = await supabase
    .from("real_estate_buyer_searches")
    .select("contact_id, budget_min, budget_max, bedrooms, timeframe, locations, provenance")
    .eq("client_id", clientId)
    .eq("provenance", "legacy_contact_fields");
  if (!searchReadError) {
    for (const row of searchRows ?? []) {
      existingSearchByContact.set(row.contact_id as string, {
        budgetMin: (row.budget_min as number | null) ?? null,
        budgetMax: (row.budget_max as number | null) ?? null,
        bedrooms: (row.bedrooms as number | null) ?? null,
        timeframe: (row.timeframe as string | null) ?? null,
        locations: Array.isArray(row.locations) ? (row.locations as string[]) : [],
      });
    }
  }
  for (const row of contacts ?? []) {
    const contact: LegacyContactFields = {
      clientId,
      contactId: row.id as string,
      buyerBudgetMin: (row.buyer_budget_min as number | null) ?? null,
      buyerBudgetMax: (row.buyer_budget_max as number | null) ?? null,
      buyerBedroomsWanted: (row.buyer_bedrooms_wanted as number | null) ?? null,
      buyerAreaPreference: (row.buyer_area_preference as string | null) ?? null,
      buyerTimeline: (row.buyer_timeline as string | null) ?? null,
      interestedListingIds: [],
    };
    const reason = legacySearchDivergence(contact, existingSearchByContact.get(contact.contactId) ?? null);
    if (reason && existingSearchByContact.has(contact.contactId)) {
      reviewReasons.push({ entityId: contact.contactId, reason });
    }
  }
  if (reviewReasons.length && !searchReadError) {
    const { data: existingReviews } = await supabase
      .from("real_estate_migration_reviews")
      .select("entity_id, reason")
      .eq("client_id", clientId);
    const known = new Set(
      (existingReviews ?? []).map((r) => `${(r.entity_id as string | null) ?? ""}:${r.reason as string}`)
    );
    const fresh = reviewReasons.filter((r) => !known.has(`${r.entityId}:${r.reason}`));
    if (fresh.length) {
      const { error } = await supabase.from("real_estate_migration_reviews").insert(
        fresh.map((r) => ({
          client_id: clientId,
          entity_type: r.entityId ? "contact" : "interested_listing_id",
          entity_id: r.entityId || null,
          reason: r.reason,
        }))
      );
      if (error && !tableMissing(error)) console.error("[re-migration-review]", error.message);
    }
  }

  return {
    searchesCreated: newSearches.length,
    interestsCreated: newInterests.length,
    rolesCreated: newRoles.length,
    reviewListingIds,
  };
}

export async function loadExplicitDemandContactIds(clientId: string): Promise<Set<string>> {
  const supabase = createAdminClient();
  const ids = new Set<string>();
  const { data: leads } = await supabase
    .from("leads")
    .select("contact_id, deal_side")
    .eq("client_id", clientId)
    .in("deal_side", ["buy_side", "tenant_side"]);
  for (const lead of leads ?? []) {
    if (lead.contact_id && isDemandSide(lead.deal_side as string)) ids.add(lead.contact_id as string);
  }
  const searches = await supabase
    .from("real_estate_buyer_searches")
    .select("contact_id")
    .eq("client_id", clientId)
    .eq("status", "active");
  if (!searches.error) {
    for (const row of searches.data ?? []) {
      if (row.contact_id) ids.add(row.contact_id as string);
    }
  }
  return ids;
}
