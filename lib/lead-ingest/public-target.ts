import { createAdminClient } from "@/lib/supabase/admin";

export type PublicLeadTarget = {
  clientId: string;
  profileSlug: string;
};

type ProfileRow = {
  client_id: string;
  slug: string;
  is_published: boolean | null;
};

export async function resolvePublishedProfileLeadTarget(
  profileSlug: string
): Promise<PublicLeadTarget | null> {
  const slug = profileSlug.trim().toLowerCase();
  if (!slug) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("client_profiles")
    .select("client_id, slug, is_published")
    .eq("slug", slug)
    .maybeSingle();

  const row = (data as ProfileRow | null) ?? null;
  if (!row || row.is_published !== true || !row.client_id) {
    return null;
  }

  return {
    clientId: row.client_id,
    profileSlug: row.slug,
  };
}
