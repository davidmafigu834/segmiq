import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  credentialsConflict,
  demoGuestHome,
  isDemoGuestApiAllowed,
  isDemoGuestPageAllowed,
  type DemoGuestRole,
} from "@/lib/demo/allowlist";
import { DEMO_SESSION_COOKIE, isGuestAccessEnabled } from "@/lib/demo/deployment";
import { cookieHeaderWithoutDemoSession } from "@/lib/demo/cookie";
import { hashToken } from "@/lib/demo/token-hash";
import { invitationAccess } from "@/lib/demo/invitation-access";
import { findDemoPersona } from "@/lib/demo/personas";
import { fetchMiddlewareFirstRowResult } from "@/lib/supabase/middleware-admin";

type GuestRow = {
  id: string;
  client_id: string;
  persona_key: string;
  expires_at: string;
  revoked_at: string | null;
  invitation_id: string;
};

function clearDemoCookie(response: NextResponse): NextResponse {
  response.cookies.set(DEMO_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

/**
 * Sign-in and sign-out must not run inside a guest session.
 * The route sees no demonstration cookie, and the browser is told to drop it.
 */
export function releaseDemoSession(req: NextRequest): NextResponse {
  const headers = new Headers(req.headers);
  const nextCookie = cookieHeaderWithoutDemoSession(headers.get("cookie"));
  if (nextCookie) headers.set("cookie", nextCookie);
  else headers.delete("cookie");
  const response = NextResponse.next({ request: { headers } });
  return clearDemoCookie(response);
}

async function loadGuest(secret: string): Promise<
  | { ok: true; role: DemoGuestRole }
  | { ok: false; reason: "invalid" | "unavailable" }
> {
  let secretHash = "";
  try {
    secretHash = await hashToken(secret);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  const session = await fetchMiddlewareFirstRowResult<GuestRow>(
    "demo_sessions",
    `select=id,client_id,persona_key,expires_at,revoked_at,invitation_id&secret_hash=eq.${encodeURIComponent(secretHash)}`
  );
  if (session.status === "unavailable") return { ok: false, reason: "unavailable" };
  if (session.status !== "found") return { ok: false, reason: "invalid" };
  const row = session.row;
  if (invitationAccess(row) !== "valid") return { ok: false, reason: "invalid" };

  const invitation = await fetchMiddlewareFirstRowResult<{ revoked_at: string | null; expires_at: string }>(
    "demo_invitations",
    `select=revoked_at,expires_at&id=eq.${encodeURIComponent(row.invitation_id)}`
  );
  if (invitation.status !== "found") return { ok: false, reason: invitation.status === "unavailable" ? "unavailable" : "invalid" };
  if (invitationAccess(invitation.row) !== "valid") {
    return { ok: false, reason: "invalid" };
  }

  const client = await fetchMiddlewareFirstRowResult<{ workspace_mode: string | null }>(
    "clients",
    `select=workspace_mode&id=eq.${encodeURIComponent(row.client_id)}`
  );
  if (client.status !== "found" || client.row.workspace_mode !== "demo") {
    return { ok: false, reason: client.status === "unavailable" ? "unavailable" : "invalid" };
  }

  const industry = await fetchMiddlewareFirstRowResult<{ demo_industry: string | null; demo_scenario: string | null }>(
    "clients",
    `select=demo_industry,demo_scenario&id=eq.${encodeURIComponent(row.client_id)}`
  );
  if (industry.status !== "found") return { ok: false, reason: "unavailable" };
  const persona = findDemoPersona(industry.row.demo_industry, industry.row.demo_scenario, row.persona_key);
  if (!persona) return { ok: false, reason: "invalid" };
  return { ok: true, role: persona.role };
}

function unavailable(req: NextRequest, clear: boolean): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = "/demo/unavailable";
  url.search = "";
  const response = NextResponse.redirect(url);
  return clear ? clearDemoCookie(response) : response;
}

/**
 * Demo cookie on an API request. Returns a response to stop the request, or
 * null when the normal API path should continue.
 */
export async function enforceDemoGuestApi(req: NextRequest): Promise<NextResponse | null> {
  const secret = req.cookies.get(DEMO_SESSION_COOKIE)?.value;
  if (!secret) return null;
  if (req.nextUrl.pathname.startsWith("/api/auth/")) {
    return releaseDemoSession(req);
  }
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (credentialsConflict(Boolean(token), true)) {
    return NextResponse.json({ error: "Conflicting sessions" }, { status: 409 });
  }
  if (!isGuestAccessEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const path = req.nextUrl.pathname;
  if (!isDemoGuestApiAllowed(path, req.method)) {
    return NextResponse.json({ error: "Not available in this demonstration" }, { status: 403 });
  }
  const guest = await loadGuest(secret);
  if (!guest.ok) {
    return NextResponse.json({ error: "Not found" }, { status: 401 });
  }
  return null;
}

/**
 * Demo cookie on a page request. Returns a response when the guest gate
 * handles the request, or null when normal CRM auth should continue.
 */
export async function enforceDemoGuestPage(req: NextRequest): Promise<NextResponse | null> {
  const path = req.nextUrl.pathname;
  if (path.startsWith("/demo/") || path === "/demo") return null;
  const secret = req.cookies.get(DEMO_SESSION_COOKIE)?.value;
  if (!secret) return null;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (credentialsConflict(Boolean(token), true)) {
    return unavailable(req, true);
  }
  if (!isGuestAccessEnabled()) return unavailable(req, true);
  const guest = await loadGuest(secret);
  if (!guest.ok) return unavailable(req, true);
  if (!isDemoGuestPageAllowed(path, guest.role)) {
    const url = req.nextUrl.clone();
    if (path.startsWith("/sales") || path.startsWith("/client") || path.startsWith("/dashboard") || path.startsWith("/solo")) {
      url.pathname = "/demo/unavailable";
      url.search = "";
      return NextResponse.redirect(url);
    }
    const home = req.nextUrl.clone();
    home.pathname = demoGuestHome(guest.role);
    home.search = "";
    return NextResponse.redirect(home);
  }
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
