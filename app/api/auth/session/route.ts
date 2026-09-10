import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  revokeAllUserSessions,
  revokeSessionById,
  clientIpFromRequest,
  userAgentFromRequest,
} from "@/lib/auth/user-sessions";
import { bumpSessionVersion } from "@/lib/auth/offboard";
import { recordSecurityEvent } from "@/lib/auth/security-events";
import { assertBrowserOrigin } from "@/lib/auth/origin-check";
import { labelSessionDevice, formatRelativeActive } from "@/lib/auth/session-labels";
import { getAuthFromRequest } from "@/lib/auth/getAuthFromRequest";
import {
  sendSecurityNotification,
} from "@/lib/email/templates/security-alert";

export const dynamic = "force-dynamic";

async function resolveAuth(req: Request) {
  const fromReq = await getAuthFromRequest(req);
  if (fromReq?.userId) {
    return {
      userId: fromReq.userId,
      clientId: fromReq.clientId,
      sessionId: fromReq.sessionId ?? null,
    };
  }
  const session = await getServerSession(authOptions);
  if (!session?.userId) return null;
  return {
    userId: session.userId,
    clientId: session.clientId,
    sessionId: session.sessionId ?? null,
  };
}

/**
 * POST body: { scope: "others" | "all" }
 */
export async function POST(req: Request) {
  const origin = assertBrowserOrigin(req);
  if (!origin.ok) {
    return NextResponse.json({ error: origin.error }, { status: origin.status });
  }
  const auth = await resolveAuth(req);
  if (!auth?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { scope?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const scope = body.scope === "others" ? "others" : "all";
  const ip = clientIpFromRequest(req);
  const ua = userAgentFromRequest(req);

  if (scope === "others") {
    const n = await revokeAllUserSessions({
      userId: auth.userId,
      reason: "ADMIN_REVOKED",
      exceptSessionId: auth.sessionId,
    });
    void recordSecurityEvent({
      eventType: "SESSIONS_REVOKED_OTHERS",
      userId: auth.userId,
      clientId: auth.clientId,
      sessionId: auth.sessionId,
      ip,
      userAgent: ua,
      metadata: { scope: "others", count: n },
    });
    return NextResponse.json({ ok: true, revoked: n, scope });
  }

  const supabase = createAdminClient();
  await revokeAllUserSessions({ userId: auth.userId, reason: "LOGOUT_ALL" });
  await bumpSessionVersion(supabase, auth.userId);
  void recordSecurityEvent({
    eventType: "SESSIONS_REVOKED_ALL",
    userId: auth.userId,
    clientId: auth.clientId,
    sessionId: auth.sessionId,
    ip,
    userAgent: ua,
  });

  const { data: userRow } = await supabase.from("users").select("email").eq("id", auth.userId).maybeSingle();
  if (userRow?.email) {
    void sendSecurityNotification({ to: String(userRow.email), kind: "sign_out_everywhere" });
  }

  return NextResponse.json({ ok: true, scope: "all" });
}

/** List own active sessions. Never returns secrets / raw tokens. */
export async function GET(req: Request) {
  const auth = await resolveAuth(req);
  if (!auth?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from("user_sessions")
    .select(
      "id, session_type, created_at, last_seen_at, expires_at, user_agent, device_name, device_id, metadata, auth_strength, mfa_verified_at"
    )
    .eq("user_id", auth.userId)
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .order("last_seen_at", { ascending: false })
    .limit(50);

  const sessions = (data ?? []).map((row) => {
    const labels = labelSessionDevice({
      sessionType: row.session_type,
      userAgent: row.user_agent,
      deviceName: row.device_name,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    });
    return {
      id: row.id,
      current: row.id === auth.sessionId,
      sessionType: row.session_type,
      browser: labels.browser,
      os: labels.os,
      deviceName: labels.deviceName,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
      lastSeenLabel: formatRelativeActive(row.last_seen_at),
      authStrength: row.auth_strength,
      // approximateLocation omitted — no geolocation infrastructure in Phase 4
    };
  });

  return NextResponse.json({ sessions, currentSessionId: auth.sessionId });
}

/** Revoke a single own session by id. */
export async function DELETE(req: Request) {
  const origin = assertBrowserOrigin(req);
  if (!origin.ok) {
    return NextResponse.json({ error: origin.error }, { status: origin.status });
  }
  const auth = await resolveAuth(req);
  if (!auth?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("user_sessions")
    .select("id, user_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!row || row.user_id !== auth.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await revokeSessionById({ sessionId, reason: "ADMIN_REVOKED" });
  void recordSecurityEvent({
    eventType: "SESSION_REVOKED",
    userId: auth.userId,
    clientId: auth.clientId,
    sessionId,
    ip: clientIpFromRequest(req),
    userAgent: userAgentFromRequest(req),
    metadata: { targetSessionId: sessionId, wasCurrent: sessionId === auth.sessionId },
  });
  return NextResponse.json({
    ok: true,
    wasCurrent: sessionId === auth.sessionId,
  });
}
