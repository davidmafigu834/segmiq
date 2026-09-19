import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { P } from "@/lib/auth/rbac/permissions";
import { requireSocialInbox } from "@/lib/social-inbox/api-auth";

export const dynamic = "force-dynamic";

const FB_VERSION = process.env.FACEBOOK_API_VERSION || "v19.0";

const SOCIAL_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_metadata",
  "pages_messaging",
  "pages_manage_engagement",
  "instagram_basic",
  "instagram_manage_messages",
  "instagram_manage_comments",
  "business_management",
].join(",");

export async function GET(req: Request) {
  const gate = await requireSocialInbox(req, P.SOCIAL_INBOX_MANAGE_CHANNELS);
  if (!gate.ok) return gate.response;

  const appId = process.env.FACEBOOK_APP_ID;
  const origin = new URL(req.url).origin;
  const redirectUri =
    process.env.SOCIAL_INBOX_OAUTH_REDIRECT_URI || `${origin}/api/social-inbox/oauth/callback`;
  if (!appId) {
    return NextResponse.json(
      { error: "Meta app is not configured. Set FACEBOOK_APP_ID to connect Facebook and Instagram." },
      { status: 500 }
    );
  }

  const nonce = randomBytes(16).toString("hex");
  const state = `${gate.actor.clientId}:${nonce}`;
  cookies().set("social_inbox_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  const url = new URL(`https://www.facebook.com/${FB_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", SOCIAL_SCOPES);
  url.searchParams.set("response_type", "code");
  return NextResponse.redirect(url.toString());
}
