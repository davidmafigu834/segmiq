import type { SupabaseClient } from "@supabase/supabase-js";
import { listingVisibilityFilter, type ListingAccessRow, type ListingActor } from "./listing-access";
/** Shared query construction means FK fallback retains every security and paging predicate. */
export async function loadListingPage(supabase: SupabaseClient, actor: ListingActor, clientId: string, url: URL, page: number, limit: number) {
  const buildQuery = (embedded: boolean) => {
    let query = supabase.from("listings").select(embedded ? "*, agent:users!listings_agent_id_fkey(id, name), development:developments(id, name)" : "*", { count: "exact" }).eq("client_id", clientId);
    const visibility = listingVisibilityFilter(actor);
    // Use a single AND expression so text-search OR cannot overwrite visibility OR.
    if (visibility && !url.searchParams.get("q")?.trim()) query = query.or(visibility);
    for (const name of ["status", "development_id", "transaction_type"]) {
      const value = url.searchParams.get(name); if (value) query = query.eq(name, value);
    }
    const suburb = url.searchParams.get("suburb")?.trim();
    if (suburb) query = query.ilike("suburb", `%${suburb}%`);
    for (const [name, column, op] of [["min_price", "price", "gte"], ["max_price", "price", "lte"], ["bedrooms", "bedrooms", "gte"]] as const) {
      if (url.searchParams.has(name)) query = query[op](column, Number(url.searchParams.get(name)));
    }
    const q = url.searchParams.get("q")?.trim();
    if (q) {
      const term = q.replace(/[^\p{L}\p{N} \-]/gu, " ").slice(0, 200);
      query = query.or(`and(or(address.ilike.%${term}%,suburb.ilike.%${term}%,description.ilike.%${term}%,external_reference.ilike.%${term}%)${visibility ? `,or(${visibility})` : ""})`);
    }
    return query.order("created_at", { ascending: false }).order("id", { ascending: false }).range((page - 1) * limit, page * limit - 1).returns<(ListingAccessRow & Record<string, unknown>)[]>();
  };
  let result = await buildQuery(true);
  if (result.error && ["PGRST200", "PGRST201"].includes(result.error.code)) result = await buildQuery(false);
  return result;
}
