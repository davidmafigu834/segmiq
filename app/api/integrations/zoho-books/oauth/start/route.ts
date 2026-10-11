import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireZohoBooksManager } from "@/lib/zoho-books/access";
import { readZohoBooksConfig } from "@/lib/zoho-books/config";
import { buildAuthorizeUrl } from "@/lib/zoho-books/protocol";
import { createOAuthState, migrationRequired } from "@/lib/zoho-books/store";

export const dynamic = "force-dynamic";

function settingsRedirect(req: Request, reason: string) {
  const url = new URL("/client/settings/integrations/zoho-books", req.url);
  url.searchParams.set("zoho", reason);
  return NextResponse.redirect(url);
}

export async function GET(req: Request) {
  const gate = await requireZohoBooksManager(req);
  if (!gate.ok) {
    if (gate.response.status === 401) return NextResponse.redirect(new URL("/login", req.url));
    return settingsRedirect(req, "forbidden");
  }
  const config = readZohoBooksConfig();
  if (!config) return settingsRedirect(req, "unconfigured");
  const rawState = randomBytes(32).toString("hex");
  try {
    await createOAuthState({
      rawState,
      clientId: gate.actor.clientId,
      userId: gate.actor.userId,
      sessionId: gate.actor.sessionId,
    });
  } catch (error) {
    if (migrationRequired(error)) return settingsRedirect(req, "migration");
    return settingsRedirect(req, "denied");
  }
  cookies().set("zoho_books_oauth_state", rawState, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  const authorize = buildAuthorizeUrl({
    accountsServer: config.accountsUrl,
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    state: rawState,
  });
  if (!authorize) return settingsRedirect(req, "region");
  return NextResponse.redirect(authorize);
}
