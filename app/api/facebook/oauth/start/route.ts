import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAgencyAdmin } from "@/lib/auth/permissions";
import { fbLog } from "@/lib/facebook/log";

const FB_VERSION = process.env.FACEBOOK_API_VERSION || "v19.0";

export async function GET(req: Request) {
  const check = await requireAgencyAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const reconnect = searchParams.get("reconnect") === "1";

  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }

  const appId = process.env.FACEBOOK_APP_ID;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI;
  if (!appId || !redirectUri) {
    return NextResponse.json({ error: "Facebook app not configured" }, { status: 500 });
  }

  if (reconnect) {
    const supabase = createAdminClient();
    await supabase
      .from("clients")
      .update({
        fb_access_token: null,
        fb_user_access_token: null,
        fb_access_token_expires_at: null,
        fb_page_id: null,
        fb_page_name: null,
        fb_form_id: null,
        fb_form_name: null,
        fb_form_questions: null,
        fb_qualification_enabled: false,
        fb_qualification_rules: null,
        fb_ad_account_id: null,
        fb_webhook_verified: false,
        fb_token_expired_at: null,
        fb_connected_at: null,
        fb_connected_by_user_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", clientId);
  }

  const nonce = randomBytes(16).toString("hex");
  const state = `${clientId}:${nonce}`;
  const cookieStore = cookies();
  cookieStore.set("fb_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  const scopes = [
    "leads_retrieval",
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_metadata",
    "pages_manage_ads",
    "business_management",
    "ads_read",
  ].join(",");

  const url = new URL(`https://www.facebook.com/${FB_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", scopes);
  url.searchParams.set("response_type", "code");

  fbLog("fb.oauth.started", { clientId, reconnect });
  return NextResponse.redirect(url.toString());
}
