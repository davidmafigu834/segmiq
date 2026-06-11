import type { SupabaseClient } from "@supabase/supabase-js";

/** Slug reserved for an archived client — frees the public URL for a new client. */
export function archivedResourceSlug(clientId: string, slug: string): string {
  const prefix = clientId.replace(/-/g, "").slice(0, 8);
  const base = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "") || "client";
  return `archived-${prefix}-${base}`.slice(0, 80);
}

/** True when no other active (non-archived) client owns this slug. */
export async function isClientSlugAvailable(
  supabase: SupabaseClient,
  slug: string,
  excludeClientId?: string
): Promise<boolean> {
  let q = supabase.from("clients").select("id, is_archived").eq("slug", slug);
  if (excludeClientId) q = q.neq("id", excludeClientId);
  const { data: rows } = await q;
  return !(rows ?? []).some((r) => (r as { is_archived?: boolean }).is_archived !== true);
}

/** True when no published profile on another active client uses this slug. */
export async function isProfileSlugAvailable(
  supabase: SupabaseClient,
  slug: string,
  excludeClientId: string
): Promise<boolean> {
  const { data: profiles } = await supabase
    .from("client_profiles")
    .select("client_id")
    .eq("slug", slug)
    .neq("client_id", excludeClientId);

  const ownerIds = (profiles ?? []).map((p) => p.client_id as string);
  if (!ownerIds.length) return true;

  const { data: owners } = await supabase.from("clients").select("id, is_archived").in("id", ownerIds);
  return !(owners ?? []).some((c) => (c as { is_archived?: boolean }).is_archived !== true);
}
