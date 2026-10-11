import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireZohoBooksManager } from "@/lib/zoho-books/access";
import { readZohoBooksConfig } from "@/lib/zoho-books/config";
import { buildTokenRequest, parseTokenResponse } from "@/lib/zoho-books/protocol";
import { resolveZohoRegion } from "@/lib/zoho-books/regions";
import { consumeOAuthState, migrationRequired, saveGrantedTokens } from "@/lib/zoho-books/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function finish(req: Request, reason: string) {
  const url = new URL("/client/settings/integrations/zoho-books", req.url);
  url.searchParams.set("zoho", reason);
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const gate = await requireZohoBooksManager(req);
  const cookieState = cookies().get("zoho_books_oauth_state")?.value;
  cookies().set("zoho_books_oauth_state", "", { path: "/", maxAge: 0 });
  if (!gate.ok) return finish(req, gate.response.status === 401 ? "forbidden" : "forbidden");
  const state = url.searchParams.get("state");
  if (!state || !cookieState || state !== cookieState) return finish(req, "denied");
  if (url.searchParams.get("error")) return finish(req, "denied");
  const code = url.searchParams.get("code");
  if (!code) return finish(req, "denied");

  let decision: Awaited<ReturnType<typeof consumeOAuthState>>;
  try {
    decision = await consumeOAuthState({ rawState: state, session: gate.actor });
  } catch (error) {
    if (migrationRequired(error)) return finish(req, "migration");
    return finish(req, "denied");
  }
  if (!decision.ok) {
    return finish(req, decision.reason === "replay" ? "replay" : decision.reason);
  }

  const config = readZohoBooksConfig();
  if (!config) return finish(req, "unconfigured");
  const region = resolveZohoRegion({
    accountsServer: url.searchParams.get("accounts-server"),
    location: url.searchParams.get("location"),
  });
  if (!region) return finish(req, "region");
  const request = buildTokenRequest(region.accounts, {
    grant_type: "authorization_code",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    code,
  });
  if (!request) return finish(req, "region");

  const response = await fetch(request.url, { method: "POST", cache: "no-store" });
  const body = await response.json().catch(() => null);
  const parsed = parseTokenResponse(body);
  const confirmed = parsed
    ? resolveZohoRegion({
        accountsServer: region.accounts,
        apiDomain: parsed.apiDomain,
        location: region.location,
      })
    : null;
  if (!response.ok || !parsed?.refreshToken || !confirmed) return finish(req, parsed ? "region" : "token");

  try {
    await saveGrantedTokens({
      clientId: gate.actor.clientId,
      userId: gate.actor.userId,
      region: confirmed,
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresIn: parsed.expiresIn,
    });
  } catch (error) {
    if (migrationRequired(error)) return finish(req, "migration");
    return finish(req, "token");
  }
  return finish(req, "choose");
}
