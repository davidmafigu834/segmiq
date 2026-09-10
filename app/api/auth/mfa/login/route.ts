import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyCredentials, AuthDatabaseUnavailableError } from "@/lib/auth";
import {
  createLoginChallenge,
  userNeedsMfaChallenge,
  verifyLoginChallenge,
} from "@/lib/auth/mfa/service";
import {
  clientIpFromRequest,
  userAgentFromRequest,
  createUserSession,
} from "@/lib/auth/user-sessions";
import { recordSecurityEvent, hashLoginIdentifier } from "@/lib/auth/security-events";
import { checkSecurityRateLimit } from "@/lib/auth/security-rate-limit";
import { labelSessionDevice } from "@/lib/auth/session-labels";
import {
  sendSecurityNotification,
  shouldSendNewSignInEmail,
} from "@/lib/email/templates/security-alert";
import { SignJWT } from "jose";
import { JWT_MAX_AGE_SEC } from "@/lib/auth/session-policy";
import { setSessionToken } from "@/lib/auth/session-token";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const prepareSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * POST /api/auth/mfa/login
 * action=prepare → password check; returns mfaRequired + challenge if needed
 * action=complete → verify challenge; creates web session cookie OR returns mobile token
 */
export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  const ua = userAgentFromRequest(req);
  const rl = checkSecurityRateLimit({
    key: `login-mfa:${ip}`,
    limit: 40,
    windowMs: 15 * 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action === "complete" ? "complete" : "prepare";

  if (action === "prepare") {
    const parsed = prepareSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
    }
    let user;
    try {
      user = await verifyCredentials(parsed.data.email, parsed.data.password);
    } catch (e) {
      if (e instanceof AuthDatabaseUnavailableError) {
        return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
      }
      user = null;
    }
    if (!user) {
      void recordSecurityEvent({
        eventType: "LOGIN_FAILED",
        ip,
        userAgent: ua,
        metadata: { emailHash: await hashLoginIdentifier(parsed.data.email) },
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const need = await userNeedsMfaChallenge(user.id, user.role);
    if (!need.required) {
      return NextResponse.json({ mfaRequired: false });
    }

    const challenge = await createLoginChallenge({
      userId: user.id,
      ip,
      userAgent: ua,
    });
    return NextResponse.json({
      mfaRequired: true,
      challengeId: challenge.challengeId,
      challengeToken: challenge.challengeToken,
      expiresAt: challenge.expiresAt,
    });
  }

  // complete
  const challengeId = typeof body.challengeId === "string" ? body.challengeId : "";
  const challengeToken = typeof body.challengeToken === "string" ? body.challengeToken : "";
  const totpCode = typeof body.totpCode === "string" ? body.totpCode : null;
  const recoveryCode = typeof body.recoveryCode === "string" ? body.recoveryCode : null;
  const channel = body.channel === "mobile_sales" || body.channel === "mobile_cloud" ? body.channel : "web";
  const deviceId = typeof body.deviceId === "string" ? body.deviceId.slice(0, 128) : null;
  const deviceName = typeof body.deviceName === "string" ? body.deviceName.slice(0, 120) : null;

  if (!challengeId || !challengeToken) {
    return NextResponse.json({ error: "Challenge required" }, { status: 400 });
  }

  const verified = await verifyLoginChallenge({
    challengeId,
    challengeToken,
    totpCode,
    recoveryCode,
  });
  if (!verified.ok) {
    return NextResponse.json({ error: "Verification failed", reason: verified.reason }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: userRow } = await supabase
    .from("users")
    .select("id, name, email, role, client_id, also_sells, session_version, is_active")
    .eq("id", verified.userId)
    .single();
  if (!userRow || !userRow.is_active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fetchClientMode } = await import("@/lib/supabase/auth-rest");
  const clientId = (userRow.client_id as string | null) ?? null;
  const clientMode = clientId ? await fetchClientMode(clientId) : "team";
  const role = userRow.role as string;
  const sessionVersion = Number(userRow.session_version ?? 0);
  const mfaVerifiedAt = new Date().toISOString();

  const sessionType = channel === "web" ? "WEB" : "MOBILE";
  const sessionRow = await createUserSession({
    userId: userRow.id as string,
    clientId,
    role,
    sessionType,
    sessionVersion,
    ip,
    userAgent: ua,
    deviceId,
    deviceName,
    mfaVerifiedAt,
    authStrength: "password_mfa",
    metadata: { channel },
  });

  void recordSecurityEvent({
    eventType: "LOGIN_SUCCESS",
    userId: userRow.id as string,
    clientId,
    sessionId: sessionRow.id,
    ip,
    userAgent: ua,
    metadata: { sessionType, mfa: true },
  });

  const label = labelSessionDevice({
    sessionType,
    userAgent: ua,
    deviceName,
    metadata: { channel },
  });
  const email = String(userRow.email ?? "");
  if (email && shouldSendNewSignInEmail(userRow.id as string, deviceId || label.deviceName)) {
    void sendSecurityNotification({
      to: email,
      kind: recoveryCode ? "recovery_code_used" : "new_sign_in",
      deviceLabel: label.deviceName,
    });
  }

  if (channel === "web") {
    await setSessionToken({
      userId: userRow.id as string,
      role: role as "SUPER_ADMIN" | "CLIENT_MANAGER" | "SALESPERSON",
      clientId,
      clientMode,
      alsoSells: Boolean(userRow.also_sells),
      sessionVersion,
      sessionId: sessionRow.id,
      email,
      name: String(userRow.name ?? ""),
    });
    return NextResponse.json({
      ok: true,
      sessionId: sessionRow.id,
    });
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const token = await new SignJWT({
    userId: userRow.id,
    role,
    clientId,
    clientMode,
    alsoSells: Boolean(userRow.also_sells),
    sessionVersion,
    sessionId: sessionRow.id,
    name: userRow.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + JWT_MAX_AGE_SEC)
    .sign(new TextEncoder().encode(secret));

  return NextResponse.json({
    ok: true,
    token,
    user: {
      userId: userRow.id,
      name: userRow.name,
      clientId,
      role,
      clientMode,
      alsoSells: Boolean(userRow.also_sells),
      sessionId: sessionRow.id,
    },
  });
}
