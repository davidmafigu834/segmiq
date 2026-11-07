import { createAdminClient } from "@/lib/supabase/admin";
import type { ListingHouseContext } from "@/lib/real-estate/listing-house";

type OpportunityRow = { id?: string; contact_id?: string | null; owner_name?: string | null };

async function ownerParty(
  supabase: ReturnType<typeof createAdminClient>,
  clientId: string,
  listingId: string,
  opportunityId: string | null
): Promise<ListingHouseContext> {
  const party = await supabase
    .from("real_estate_listing_parties")
    .select("contact_id")
    .eq("client_id", clientId)
    .eq("listing_id", listingId)
    .eq("party_role", "owner")
    .limit(1);
  if (party.error) return { seller: null, opportunityId };
  const contactId = (party.data?.[0]?.contact_id as string | null) ?? null;
  if (!contactId) return { seller: null, opportunityId };
  const contact = await supabase.from("contacts").select("name").eq("id", contactId).eq("client_id", clientId).maybeSingle();
  const name = ((contact.data?.name as string | null) ?? "").trim() || "Seller";
  return { seller: { contactId, name }, opportunityId };
}

/** Seller and inspection already linked to this listing. A missing link stays empty. */
export async function loadListingHouse(clientId: string, listingId: string): Promise<ListingHouseContext> {
  const supabase = createAdminClient();
  const listing = await supabase
    .from("listings")
    .select("acquisition_opportunity_id")
    .eq("id", listingId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (listing.error) return { seller: null, opportunityId: null };

  let opportunityId = (listing.data?.acquisition_opportunity_id as string | null) ?? null;
  const opportunity = opportunityId
    ? await supabase
        .from("real_estate_acquisition_opportunities")
        .select("id, contact_id, owner_name")
        .eq("client_id", clientId)
        .eq("id", opportunityId)
        .limit(1)
    : await supabase
        .from("real_estate_acquisition_opportunities")
        .select("id, contact_id, owner_name")
        .eq("client_id", clientId)
        .eq("converted_listing_id", listingId)
        .limit(1);
  if (opportunity.error) return { seller: null, opportunityId };

  const row = ((opportunity.data ?? [])[0] ?? null) as OpportunityRow | null;
  if (!row) return ownerParty(supabase, clientId, listingId, opportunityId);
  opportunityId = row.id ?? opportunityId;
  const contactId = row.contact_id ?? null;
  let name = row.owner_name?.trim() || null;
  if (contactId) {
    const contact = await supabase.from("contacts").select("name").eq("id", contactId).eq("client_id", clientId).maybeSingle();
    const contactName = ((contact.data?.name as string | null) ?? "").trim();
    if (contactName) name = contactName;
  }
  if (!contactId && !name) return ownerParty(supabase, clientId, listingId, opportunityId);
  return { seller: { contactId, name: name ?? "Seller" }, opportunityId };
}
