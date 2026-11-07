import { createAdminClient } from "@/lib/supabase/admin";
import { canReadListing, listingVisibilityFilter, type ListingActor } from "@/lib/real-estate/listing-access";
import type { ListingWorkRow } from "@/lib/real-estate/listing-work";

type ListingSource = {
  id: string;
  address: string | null;
  suburb: string | null;
  price: number | string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  description: string | null;
  photos: unknown;
  property_category?: string | null;
  status: string | null;
  transaction_type: string | null;
  acquisition_opportunity_id?: string | null;
  client_id: string;
  agent_id: string | null;
  approval_status: string | null;
};

type OpportunitySource = {
  id: string;
  contact_id: string | null;
  owner_name: string | null;
  converted_listing_id: string | null;
};

const LISTING_COLUMNS = "id, address, suburb, price, bedrooms, bathrooms, description, photos, property_category, status, transaction_type, acquisition_opportunity_id, client_id, agent_id, approval_status";
const LISTING_COLUMNS_FALLBACK = "id, address, suburb, price, bedrooms, bathrooms, description, photos, status, transaction_type, client_id, agent_id, approval_status";

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function amount(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function idsIn<T>(
  load: (ids: string[]) => Promise<{ data: T[] | null; error: { message: string } | null }>
  ,
  ids: string[]
): Promise<T[]> {
  const rows: T[] = [];
  for (let index = 0; index < ids.length; index += 100) {
    const slice = ids.slice(index, index + 100);
    const result = await load(slice);
    if (result.error) return rows;
    rows.push(...(result.data ?? []));
  }
  return rows;
}

/** Houses an agent can open, with the seller and the viewing and offer counts. */
export async function loadListingWork(clientId: string, actor: ListingActor): Promise<ListingWorkRow[]> {
  const supabase = createAdminClient();
  const visibility = listingVisibilityFilter(actor);
  const run = (columns: string) => {
    let query = supabase.from("listings").select(columns).eq("client_id", clientId);
    if (visibility) query = query.or(visibility);
    return query.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(200);
  };
  let listed = await run(LISTING_COLUMNS);
  if (listed.error && /acquisition_opportunity_id|property_category|schema cache/i.test(listed.error.message)) {
    listed = await run(LISTING_COLUMNS_FALLBACK);
  }
  if (listed.error) throw new Error(listed.error.message);

  const listings = ((listed.data ?? []) as unknown as ListingSource[]).filter((row) => row && typeof row.id === "string" && canReadListing(actor, row));
  const listingIds = listings.map((row) => row.id);
  const opportunityIds = [...new Set(listings.map((row) => text(row.acquisition_opportunity_id)).filter((id): id is string => Boolean(id)))];

  const [byId, byListing, viewings, offers, parties] = await Promise.all([
    idsIn<OpportunitySource>(async (ids) => supabase.from("real_estate_acquisition_opportunities").select("id, contact_id, owner_name, converted_listing_id").eq("client_id", clientId).in("id", ids), opportunityIds),
    idsIn<OpportunitySource>(async (ids) => supabase.from("real_estate_acquisition_opportunities").select("id, contact_id, owner_name, converted_listing_id").eq("client_id", clientId).in("converted_listing_id", ids), listingIds),
    idsIn<{ listing_id: string }>(async (ids) => supabase.from("viewings").select("listing_id").eq("client_id", clientId).in("listing_id", ids), listingIds),
    idsIn<{ listing_id: string }>(async (ids) => supabase.from("real_estate_offers").select("listing_id").eq("client_id", clientId).in("listing_id", ids), listingIds),
    idsIn<{ listing_id: string; contact_id: string | null }>(async (ids) => supabase.from("real_estate_listing_parties").select("listing_id, contact_id").eq("client_id", clientId).eq("party_role", "owner").in("listing_id", ids), listingIds),
  ]);

  const opportunityById = new Map(byId.map((row) => [row.id, row]));
  const opportunityByListing = new Map(byListing.filter((row) => row.converted_listing_id).map((row) => [row.converted_listing_id as string, row]));
  const contactIds = [...new Set(
    [...byId, ...byListing].map((row) => text(row.contact_id)).concat(parties.map((row) => text(row.contact_id))).filter((id): id is string => Boolean(id))
  )];
  const contacts = await idsIn<{ id: string; name: string | null }>(
    async (ids) => supabase.from("contacts").select("id, name").eq("client_id", clientId).in("id", ids),
    contactIds
  );
  const contactNames = new Map(contacts.map((row) => [row.id, text(row.name)]));
  const viewingCounts = new Map<string, number>();
  for (const row of viewings) viewingCounts.set(row.listing_id, (viewingCounts.get(row.listing_id) ?? 0) + 1);
  const offerCounts = new Map<string, number>();
  for (const row of offers) offerCounts.set(row.listing_id, (offerCounts.get(row.listing_id) ?? 0) + 1);
  const ownerByListing = new Map(parties.filter((row) => row.contact_id).map((row) => [row.listing_id, row.contact_id as string]));

  return listings.map((row) => {
    const opportunity = (row.acquisition_opportunity_id ? opportunityById.get(row.acquisition_opportunity_id) : null) ?? opportunityByListing.get(row.id) ?? null;
    const partyContactId = ownerByListing.get(row.id) ?? null;
    const contactId = text(opportunity?.contact_id) ?? partyContactId;
    const sellerName = (contactId ? contactNames.get(contactId) : null) ?? text(opportunity?.owner_name);
    return {
      id: row.id,
      address: text(row.address),
      suburb: text(row.suburb),
      price: amount(row.price),
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      description: text(row.description),
      hasPhotos: Array.isArray(row.photos) && row.photos.some((photo) => typeof photo === "string" && photo.trim()),
      propertyCategory: text(row.property_category),
      status: text(row.status) ?? "available",
      transactionType: text(row.transaction_type) ?? "sale",
      sellerName: sellerName ?? null,
      sellerId: contactId ?? text(opportunity?.id),
      viewingCount: viewingCounts.get(row.id) ?? 0,
      offerCount: offerCounts.get(row.id) ?? 0,
    };
  });
}
