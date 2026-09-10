import { createAdminClient } from "@/lib/supabase/admin";
import {
  maybeMigrateIntegrationToken,
  sealIntegrationTokenOrNull,
  revealIntegrationToken,
} from "@/lib/integrations/token-vault";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * SECURITY:
 * Facebook page/user tokens and Meta WhatsApp tokens are sealed at rest.
 * Always reveal on the server; never send raw values to the browser.
 */

export async function sealAndStoreFbTokens(
  supabase: AdminClient,
  clientId: string,
  tokens: {
    fb_access_token?: string | null;
    fb_user_access_token?: string | null;
  } & Record<string, unknown>
): Promise<void> {
  const update: Record<string, unknown> = { ...tokens };
  if ("fb_access_token" in tokens) {
    update.fb_access_token = await sealIntegrationTokenOrNull(
      tokens.fb_access_token,
      "fb_page",
      clientId
    );
  }
  if ("fb_user_access_token" in tokens) {
    update.fb_user_access_token = await sealIntegrationTokenOrNull(
      tokens.fb_user_access_token,
      "fb_user",
      clientId
    );
  }
  await supabase.from("clients").update(update).eq("id", clientId);
}

export async function revealFbPageToken(
  stored: string | null | undefined,
  clientId: string
): Promise<string | null> {
  return revealIntegrationToken(stored, "fb_page", clientId);
}

export async function revealFbUserToken(
  stored: string | null | undefined,
  clientId: string
): Promise<string | null> {
  return revealIntegrationToken(stored, "fb_user", clientId);
}

/** Load FB tokens for Graph calls; lazily re-seal plaintext when possible. */
export async function loadClientFbGraphTokens(
  clientId: string,
  supabase: AdminClient = createAdminClient()
): Promise<{
  pageToken: string | null;
  userToken: string | null;
  row: Record<string, unknown> | null;
}> {
  const { data } = await supabase
    .from("clients")
    .select(
      "id, fb_access_token, fb_user_access_token, fb_ad_account_id, fb_page_id, fb_form_id, is_active, is_archived, business_type"
    )
    .eq("id", clientId)
    .maybeSingle();
  if (!data) return { pageToken: null, userToken: null, row: null };

  const pageMig = await maybeMigrateIntegrationToken(
    data.fb_access_token as string | null,
    "fb_page",
    clientId
  );
  const userMig = await maybeMigrateIntegrationToken(
    data.fb_user_access_token as string | null,
    "fb_user",
    clientId
  );

  const migrateUpdate: Record<string, unknown> = {};
  if (pageMig.migrated && pageMig.sealed) migrateUpdate.fb_access_token = pageMig.sealed;
  if (userMig.migrated && userMig.sealed) migrateUpdate.fb_user_access_token = userMig.sealed;
  if (Object.keys(migrateUpdate).length) {
    await supabase.from("clients").update(migrateUpdate).eq("id", clientId);
  }

  return {
    pageToken: pageMig.plaintext,
    userToken: userMig.plaintext,
    row: data as Record<string, unknown>,
  };
}

export async function sealMetaWhatsAppToken(
  plaintext: string | null | undefined,
  clientId: string
): Promise<string | null> {
  return sealIntegrationTokenOrNull(plaintext, "meta_wa", clientId);
}

export async function revealMetaWhatsAppToken(
  stored: string | null | undefined,
  clientId: string
): Promise<string | null> {
  const mig = await maybeMigrateIntegrationToken(stored, "meta_wa", clientId);
  if (mig.migrated && mig.sealed) {
    const supabase = createAdminClient();
    await supabase
      .from("clients")
      .update({ meta_whatsapp_access_token: mig.sealed })
      .eq("id", clientId);
  }
  return mig.plaintext;
}
