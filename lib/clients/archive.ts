import type { SupabaseClient } from "@supabase/supabase-js";
import { archivedResourceSlug } from "@/lib/clients/slug";

const FB_CLEAR = {
  fb_access_token: null,
  fb_user_access_token: null,
  fb_access_token_expires_at: null,
  fb_page_id: null,
  fb_page_name: null,
  fb_form_id: null,
  fb_form_name: null,
  fb_ad_account_id: null,
  fb_webhook_verified: false,
  fb_token_expired_at: null,
  fb_connected_at: null,
  fb_connected_by_user_id: null,
} as const;

/**
 * Archives a client and releases shared resources (slug, public profile URL, Facebook wiring)
 * so a replacement client can reuse the same name and profile path.
 */
export async function archiveClient(
  supabase: SupabaseClient,
  clientId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: client, error: fetchErr } = await supabase
    .from("clients")
    .select("id, slug, is_archived")
    .eq("id", clientId)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!client) return { ok: false, error: "Client not found" };

  const currentSlug = String((client as { slug?: string }).slug ?? "").trim() || `client-${clientId.slice(0, 8)}`;
  const releasedSlug = archivedResourceSlug(clientId, currentSlug);

  const { error: clientErr } = await supabase
    .from("clients")
    .update({
      is_archived: true,
      is_active: false,
      slug: releasedSlug,
      ...FB_CLEAR,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId);

  if (clientErr) return { ok: false, error: clientErr.message };

  const { data: profile } = await supabase
    .from("client_profiles")
    .select("id, slug")
    .eq("client_id", clientId)
    .maybeSingle();

  if (profile) {
    const profileSlug = String((profile as { slug?: string }).slug ?? currentSlug).trim() || currentSlug;
    const { error: profileErr } = await supabase
      .from("client_profiles")
      .update({
        slug: archivedResourceSlug(clientId, profileSlug),
        is_published: false,
        updated_at: new Date().toISOString(),
      })
      .eq("client_id", clientId);

    if (profileErr) return { ok: false, error: profileErr.message };
  }

  await supabase.from("users").update({ is_active: false }).eq("client_id", clientId);

  return { ok: true };
}
