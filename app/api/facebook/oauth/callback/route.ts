import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFacebookGraphBase } from "@/lib/facebook-graph";
import { fbLog } from "@/lib/facebook/log";

const FB_API = getFacebookGraphBase();

function redirectToFacebookTab(req: Request, clientId: string, query: Record<string, string>) {
  const u = new URL(`/dashboard/clients/${clientId}/facebook`, req.url);
  for (const [k, v] of Object.entries(query)) {
    u.searchParams.set(k, v);
  }
  const res = NextResponse.redirect(u);
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return res;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "SUPER_ADMIN") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const err = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const base = new URL(req.url);

  if (err) {
    const msg = errorDescription || err;
    return NextResponse.redirect(
      new URL(`/dashboard?fbError=${encodeURIComponent(msg)}`, base.origin)
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL("/dashboard?fbError=missing_params", base.origin));
  }

  const cookieStore = cookies();
  const storedState = cookieStore.get("fb_oauth_state")?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(new URL("/dashboard?fbError=state_mismatch", base.origin));
  }

  const sep = state.indexOf(":");
  if (sep <= 0) {
    return NextResponse.redirect(new URL("/dashboard?fbError=invalid_state", base.origin));
  }
  const clientId = state.slice(0, sep);

  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI;
  if (!appId || !appSecret || !redirectUri) {
    return redirectToFacebookTab(req, clientId, { fbError: "Facebook app not configured" });
  }

  try {
    const tokenUrl = new URL(`${FB_API}/oauth/access_token`);
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      error?: { message?: string };
    };
    if (!tokenData.access_token) {
      throw new Error(tokenData.error?.message || "No short-lived token");
    }

    const longUrl = new URL(`${FB_API}/oauth/access_token`);
    longUrl.searchParams.set("grant_type", "fb_exchange_token");
    longUrl.searchParams.set("client_id", appId);
    longUrl.searchParams.set("client_secret", appSecret);
    longUrl.searchParams.set("fb_exchange_token", tokenData.access_token);

    const longLivedRes = await fetch(longUrl.toString());
    const longLivedData = (await longLivedRes.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: { message?: string };
    };
    const userToken = longLivedData.access_token;
    if (!userToken) {
      throw new Error(longLivedData.error?.message || "No long-lived token");
    }

    let expiresAt: string;
    if (typeof longLivedData.expires_in === "number" && longLivedData.expires_in > 0) {
      expiresAt = new Date(Date.now() + longLivedData.expires_in * 1000).toISOString();
    } else {
      expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    }

    const supabase = createAdminClient();
    const { error: upErr } = await supabase
      .from("clients")
      .update({
        fb_access_token: userToken,
        fb_user_access_token: userToken,
        fb_access_token_expires_at: expiresAt,
        fb_token_expired_at: null,
        fb_connected_by_user_id: session.userId,
        fb_connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", clientId);

    if (upErr) {
      throw new Error(upErr.message);
    }

    cookieStore.delete("fb_oauth_state");

    fbLog("fb.oauth.completed", { clientId, userId: session.userId });
    return redirectToFacebookTab(req, clientId, { step: "adaccount" });
  } catch (e: unknown) {
    console.error("[facebook oauth callback]", e);
    const message = e instanceof Error ? e.message : "oauth_failed";
    fbLog("fb.oauth.failed", { clientId, reason: message });
    return redirectToFacebookTab(req, clientId, { fbError: message });
  }
}
