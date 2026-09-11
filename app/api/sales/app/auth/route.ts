import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { verifyCredentials } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import {
  createUserSession,
  clientIpFromRequest,
  userAgentFromRequest,
} from "@/lib/auth/user-sessions";
import { recordSecurityEvent, hashLoginIdentifier } from "@/lib/auth/security-events";
import { checkDbRateLimit } from "@/lib/auth/db-rate-limit";
import { JWT_MAX_AGE_SEC } from "@/lib/auth/session-policy";
import { userNeedsMfaChallenge, createLoginChallenge, mustEnrollMfa } from "@/lib/auth/mfa/service";
import { labelSessionDevice } from "@/lib/auth/session-labels";
import {
  sendSecurityNotification,
  shouldSendNewSignInEmail,
} from "@/lib/email/templates/security-alert";

export const dynamic = "force-dynamic";

function parseLoginBody(parsed: unknown): {
  email?: string;
  password?: string;
  deviceId?: string;
  deviceName?: string;
} {
  let body: unknown = parsed;
  if (typeof body === "string") {
    body = JSON.parse(body) as unknown;
  }
  if (body && typeof body === "object" && "value" in body) {
    const wrapped = (body as { value?: unknown }).value;
    if (wrapped !== undefined) {
      body = typeof wrapped === "string" ? (JSON.parse(wrapped) as unknown) : wrapped;
    }
  }
  return body as {
    email?: string;
    password?: string;
    deviceId?: string;
    deviceName?: string;
  };
}

export async function POST(req: Request) {
  let body: {
    email?: string;
    password?: string;
    deviceId?: string;
    deviceName?: string;
  };
  try {
    body = parseLoginBody(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const ip = clientIpFromRequest(req);
  const ua = userAgentFromRequest(req);
  if (!email || !password) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const emailHash = await hashLoginIdentifier(email);
  const rl = await checkDbRateLimit({
    key: `mobile-sales-login:${emailHash}:${ip ?? "unknown"}`,
    limit: 10,
    windowMs: 15 * 60_000,
  });
  if (!rl.ok) {
    void recordSecurityEvent({
      eventType: "LOGIN_FAILED",
      ip,
      userAgent: ua,
      metadata: { emailHash, channel: "mobile_sales", reason: "rate_limited" },
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifyCredentials(email, password);
  if (!user) {
    void recordSecurityEvent({
      eventType: "LOGIN_FAILED",
      ip,
      userAgent: ua,
      metadata: {
        emailHash: await hashLoginIdentifier(email),
        channel: "mobile_sales",
      },
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canActAsSalesperson(user)) {
    return NextResponse.json(
      { error: "Segmiq Sales is for salesperson and selling manager accounts only." },
      { status: 403 }
    );
  }

  if (!user.clientId) {
    return NextResponse.json(
      { error: "Your account is not linked to a client." },
      { status: 403 }
    );
  }

  const mfaNeed = await userNeedsMfaChallenge(user.id, user.role);
  if (mfaNeed.required) {
    const challenge = await createLoginChallenge({ userId: user.id, ip, userAgent: ua });
    return NextResponse.json({
      mfaRequired: true,
      challengeId: challenge.challengeId,
      challengeToken: challenge.challengeToken,
      expiresAt: challenge.expiresAt,
    });
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const deviceId =
    typeof body.deviceId === "string" && body.deviceId.trim()
      ? body.deviceId.trim().slice(0, 128)
      : null;
  const deviceName =
    typeof body.deviceName === "string" && body.deviceName.trim()
      ? body.deviceName.trim().slice(0, 120)
      : null;

  const enrolmentRequired = await mustEnrollMfa(user.id, user.role, {
    clientId: user.clientId,
  });

  if (enrolmentRequired) {
    const sessionRow = await createUserSession({
      userId: user.id,
      clientId: user.clientId,
      role: user.role,
      sessionType: "MOBILE",
      sessionVersion: user.sessionVersion,
      ip,
      userAgent: ua,
      deviceId,
      deviceName,
      authStrength: "password",
      metadata: {
        channel: "sales_app",
        mfaEnrolmentRequired: true,
        restricted: true,
      },
    });

    void recordSecurityEvent({
      eventType: "LOGIN_SUCCESS",
      userId: user.id,
      clientId: user.clientId,
      sessionId: sessionRow.id,
      ip,
      userAgent: ua,
      metadata: {
        sessionType: "MOBILE",
        channel: "sales_app",
        mfaEnrolmentRequired: true,
      },
    });

    const token = await new SignJWT({
      userId: user.id,
      role: user.role,
      clientId: user.clientId,
      clientMode: user.clientMode,
      alsoSells: user.alsoSells,
      sessionVersion: user.sessionVersion,
      sessionId: sessionRow.id,
      name: user.name,
      mfaEnrolmentRequired: true,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + JWT_MAX_AGE_SEC)
      .sign(new TextEncoder().encode(secret));

    return NextResponse.json({
      mfaEnrolmentRequired: true,
      token,
      user: {
        userId: user.id,
        name: user.name,
        clientId: user.clientId,
        role: user.role,
        clientMode: user.clientMode,
        alsoSells: user.alsoSells,
        sessionId: sessionRow.id,
      },
    });
  }

  const sessionRow = await createUserSession({
    userId: user.id,
    clientId: user.clientId,
    role: user.role,
    sessionType: "MOBILE",
    sessionVersion: user.sessionVersion,
    ip,
    userAgent: ua,
    deviceId,
    deviceName,
    authStrength: "password",
    metadata: { channel: "sales_app" },
  });

  void recordSecurityEvent({
    eventType: "LOGIN_SUCCESS",
    userId: user.id,
    clientId: user.clientId,
    sessionId: sessionRow.id,
    ip,
    userAgent: ua,
    metadata: { sessionType: "MOBILE", channel: "sales_app" },
  });

  const label = labelSessionDevice({
    sessionType: "MOBILE",
    userAgent: ua,
    deviceName,
    metadata: { channel: "sales_app" },
  });
  if (shouldSendNewSignInEmail(user.id, deviceId || label.deviceName)) {
    void sendSecurityNotification({
      to: user.email,
      kind: "new_sign_in",
      deviceLabel: label.deviceName,
    });
  }

  const token = await new SignJWT({
    userId: user.id,
    role: user.role,
    clientId: user.clientId,
    clientMode: user.clientMode,
    alsoSells: user.alsoSells,
    sessionVersion: user.sessionVersion,
    sessionId: sessionRow.id,
    name: user.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + JWT_MAX_AGE_SEC)
    .sign(new TextEncoder().encode(secret));

  return NextResponse.json({
    token,
    user: {
      userId: user.id,
      name: user.name,
      clientId: user.clientId,
      role: user.role,
      clientMode: user.clientMode,
      alsoSells: user.alsoSells,
      sessionId: sessionRow.id,
    },
  });
}
