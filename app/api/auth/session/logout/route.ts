import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  revokeSessionById,
  revokeAllUserSessions,
  clientIpFromRequest,
  userAgentFromRequest,
} from "@/lib/auth/user-sessions";
import { clearSessionCookie } from "@/lib/auth/session-token";
import { recordSecurityEvent } from "@/lib/auth/security-events";
import { assertBrowserOrigin } from "@/lib/auth/origin-check";
import { jwtVerify } from "jose";

export const dynamic = "force-dynamic";

/**
 * SECURITY: Logout revokes the current server session only (not session_version).
 * Use POST /api/auth/session/revoke-all for sign-out-everywhere.
 */
export async function POST(req: Request) {
  const origin = assertBrowserOrigin(req);
  if (!origin.ok) {
    return NextResponse.json({ error: origin.error }, { status: origin.status });
  }

  const session = await getServerSession(authOptions);
  let sessionId = session?.sessionId ?? null;
  let userId = session?.userId ?? null;
  let clientId = session?.clientId ?? null;

  // Mobile Bearer logout
  if (!sessionId) {
    const header = req.headers.get("authorization");
    if (header?.startsWith("Bearer ")) {
      const secret = process.env.NEXTAUTH_SECRET;
      if (secret) {
        try {
          const { payload } = await jwtVerify(
            header.slice(7).trim(),
            new TextEncoder().encode(secret),
            { algorithms: ["HS256"] }
          );
          if (typeof payload.sessionId === "string") sessionId = payload.sessionId;
          if (typeof payload.userId === "string") userId = payload.userId;
          if (typeof payload.clientId === "string") clientId = payload.clientId;
        } catch {
          /* ignore */
        }
      }
    }
  }

  if (sessionId) {
    await revokeSessionById({ sessionId, reason: "USER_LOGOUT" });
    void recordSecurityEvent({
      eventType: "LOGOUT",
      userId,
      clientId,
      sessionId,
      ip: clientIpFromRequest(req),
      userAgent: userAgentFromRequest(req),
    });
  }

  await clearSessionCookie();

  // Multi-tab logout signal (non-secret).
  const res = NextResponse.json({ ok: true });
  res.headers.set("Clear-Site-Data", '"cookies"');
  return res;
}

/** Sign out all devices for the authenticated user. */
export async function DELETE(req: Request) {
  const origin = assertBrowserOrigin(req);
  if (!origin.ok) {
    return NextResponse.json({ error: origin.error }, { status: origin.status });
  }

  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await revokeAllUserSessions({
    userId: session.userId,
    reason: "LOGOUT_ALL",
  });
  void recordSecurityEvent({
    eventType: "LOGOUT_ALL",
    userId: session.userId,
    clientId: session.clientId,
    sessionId: session.sessionId,
    ip: clientIpFromRequest(req),
    userAgent: userAgentFromRequest(req),
  });
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
