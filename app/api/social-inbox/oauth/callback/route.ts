import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { graphCall, getFacebookGraphBase } from "@/lib/facebook/graph";
import { sealIntegrationToken } from "@/lib/integrations/token-vault";
import { logSocialAudit } from "@/lib/social-inbox/audit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = cookies().get("social_inbox_oauth_state")?.value;
  const returnCookie = cookies().get("social_inbox_oauth_return")?.value;
  const settingsPath =
    returnCookie &&
    (returnCookie.startsWith("/sales/social-inbox") ||
      returnCookie.startsWith("/client/social-inbox") ||
      returnCookie.startsWith("/client/settings/integrations/channels"))
      ? returnCookie.split("?")[0]
      : "/client/settings/integrations/channels";
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`${settingsPath}?social=${reason}`, url.origin));

  if (!code || !state || !cookieState || state !== cookieState) {
    return fail("denied");
  }
  const clientId = state.split(":")[0];
  if (!clientId) {
    return fail("denied");
  }

  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const redirectUri =
    process.env.SOCIAL_INBOX_OAUTH_REDIRECT_URI || `${url.origin}/api/social-inbox/oauth/callback`;
  if (!appId || !appSecret) {
    return fail("unconfigured");
  }

  const tokenUrl = new URL(`${getFacebookGraphBase()}/oauth/access_token`);
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);
  const tokenRes = await fetch(tokenUrl.toString(), { cache: "no-store" });
  const tokenJson = (await tokenRes.json().catch(() => ({}))) as { access_token?: string };
  const userToken = tokenJson.access_token;
  if (!userToken) {
    return fail("token_failed");
  }

  const pages = await graphCall<{ data?: Array<{ id: string; name?: string; access_token?: string; instagram_business_account?: { id: string } }> }>(
    `/me/accounts?fields=id,name,access_token,instagram_business_account`,
    userToken,
    { clientId }
  );
  if (!pages.ok || !pages.data.data?.length) {
    return fail("no_pages");
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  for (const page of pages.data.data) {
    if (!page.access_token || !page.id) continue;
    const sealed = await sealIntegrationToken(page.access_token, "fb_page", clientId);
    await supabase.from("social_channel_connections").upsert(
      {
        client_id: clientId,
        provider: "facebook",
        channel_kind: "page",
        status: "connected",
        external_account_id: page.id,
        display_name: page.name ?? null,
        page_id: page.id,
        token_sealed: sealed,
        scopes: ["pages_messaging", "pages_manage_engagement"],
        connected_at: now,
        updated_at: now,
        last_error: null,
      },
      { onConflict: "client_id,provider,external_account_id" }
    );
    await graphCall(`/${page.id}/subscribed_apps`, page.access_token, {
      method: "POST",
      body: { subscribed_fields: "feed,messages,conversations,mention" },
      clientId,
    });
    if (page.instagram_business_account?.id) {
      await supabase.from("social_channel_connections").upsert(
        {
          client_id: clientId,
          provider: "instagram",
          channel_kind: "ig_business",
          status: "connected",
          external_account_id: page.instagram_business_account.id,
          display_name: page.name ?? "Instagram",
          page_id: page.id,
          ig_account_id: page.instagram_business_account.id,
          token_sealed: sealed,
          scopes: ["instagram_manage_messages", "instagram_manage_comments"],
          connected_at: now,
          updated_at: now,
          last_error: null,
        },
        { onConflict: "client_id,provider,external_account_id" }
      );
    }
  }

  await logSocialAudit({
    clientId,
    eventType: "channel_connected",
    metadata: { provider: "facebook", pages: pages.data.data.length },
  });
  cookies().set("social_inbox_oauth_state", "", { path: "/", maxAge: 0 });
  cookies().set("social_inbox_oauth_return", "", { path: "/", maxAge: 0 });
  return NextResponse.redirect(new URL(`${settingsPath}?social=connected`, url.origin));
}
