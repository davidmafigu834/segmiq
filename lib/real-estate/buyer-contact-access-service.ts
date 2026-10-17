import { createAdminClient } from "@/lib/supabase/admin";
import type { BuyerIntroductionAccessFact, BuyerSearchAccessFact } from "@/lib/real-estate/buyer-contact-access";

export type BuyerContactAccessFacts = {
  ok: true;
  searches: BuyerSearchAccessFact[];
  introductions: BuyerIntroductionAccessFact[];
};

function missingTable(error: { message?: string; code?: string } | null): boolean {
  const message = error?.message ?? "";
  return error?.code === "42P01" || /does not exist|schema cache/i.test(message);
}

function chunk<T>(values: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < values.length; index += size) groups.push(values.slice(index, index + size));
  return groups;
}

/** Loads buyer-search and introduction facts for a contact set. Empty when the tables are not present. */
export async function loadBuyerContactAccessFacts(
  clientId: string,
  contactIds: string[]
): Promise<BuyerContactAccessFacts | { ok: false; error: string }> {
  const ids = [...new Set(contactIds.filter(Boolean))];
  if (!ids.length) return { ok: true, searches: [], introductions: [] };
  const supabase = createAdminClient();
  const searches: BuyerSearchAccessFact[] = [];
  for (const group of chunk(ids, 200)) {
    const result = await supabase
      .from("real_estate_buyer_searches")
      .select("id, client_id, contact_id, assigned_agent_id, status, pipeline_stage")
      .eq("client_id", clientId)
      .in("contact_id", group);
    if (result.error) {
      if (missingTable(result.error)) return { ok: true, searches: [], introductions: [] };
      return { ok: false, error: "Could not check buyer access." };
    }
    for (const row of result.data ?? []) {
      searches.push({
        id: String(row.id),
        clientId: String(row.client_id),
        contactId: String(row.contact_id),
        assignedAgentId: (row.assigned_agent_id as string | null) ?? null,
        status: String(row.status ?? ""),
        pipelineStage: (row.pipeline_stage as string | null) ?? null,
      });
    }
  }
  const searchIds = searches.map((row) => row.id);
  const introductions: BuyerIntroductionAccessFact[] = [];
  for (const group of chunk(searchIds, 200)) {
    const result = await supabase
      .from("real_estate_buyer_introductions")
      .select("client_id, listing_id, search_id, requesting_agent_id, status")
      .eq("client_id", clientId)
      .in("search_id", group);
    if (result.error) {
      if (missingTable(result.error)) return { ok: true, searches, introductions: [] };
      return { ok: false, error: "Could not check buyer access." };
    }
    for (const row of result.data ?? []) {
      introductions.push({
        clientId: String(row.client_id),
        listingId: String(row.listing_id),
        searchId: String(row.search_id),
        requestingAgentId: (row.requesting_agent_id as string | null) ?? null,
        status: String(row.status ?? ""),
      });
    }
  }
  return { ok: true, searches, introductions };
}
