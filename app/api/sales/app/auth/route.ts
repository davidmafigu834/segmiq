import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { AuthDatabaseUnavailableError, verifyCredentials, type VerifiedUser } from "@/lib/auth";
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
import { mobileApiError } from "@/lib/mobile/sales-app/errors";
import {
  evaluateMobileSalesEligibility,
  loadOrganisationAccessState,
} from "@/lib/mobile/sales-app/eligibility";
import { SALES_APP_TOKEN_CHANNEL } from "@/lib/mobile/sales-app/subscription-gate";

export const dynamic = "force-dynamic";

async function signSalesAppToken(
  user: VerifiedUser,
  sessionId: string,
  secret: string,
  extra: Record<string, unknown> = {}
): Promise<{ token: string; expiresAtMs: number }> {
  const expSec = Math.floor(Date.now() / 1000) + JWT_MAX_AGE_SEC;
  const token = await new SignJWT({
    userId: user.id,
    role: user.role,
    clientId: user.clientId,
    clientMode: user.clientMode,
    alsoSells: user.alsoSells,
    sessionVersion: user.sessionVersion,
    sessionId,
    name: user.name,
    channel: SALES_APP_TOKEN_CHANNEL,
    ...extra,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expSec)
    .sign(new TextEncoder().encode(secret));
  return { token, expiresAtMs: expSec * 1000 };
}

function earliestIso(sessionExpiresAt: string | null | undefined, tokenExpiresAtMs: number): string {
  const sessionMs = sessionExpiresAt ? Date.parse(sessionExpiresAt) : NaN;
  return new Date(
    Number.isFinite(sessionMs) ? Math.min(sessionMs, tokenExpiresAtMs) : tokenExpiresAtMs
  ).toISOString();
}

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

/**
 * SegmiQ Sales password sign-in. Contract and error codes:
 * docs/android-integration/01-auth-and-bootstrap.md
 */
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
    return mobileApiError("INVALID_REQUEST", { error: "Invalid JSON" });
  }

  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const ip = clientIpFromRequest(req);
  const ua = userAgentFromRequest(req);
  if (!email || !password) {
    return mobileApiError("INVALID_CREDENTIALS", { error: "Unauthorized" });
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
    return mobileApiError("RATE_LIMITED", { error: "Unauthorized" });
  }

  let user: VerifiedUser | null;
  try {
    user = await verifyCredentials(email, password);
  } catch (error) {
    if (error instanceof AuthDatabaseUnavailableError) {
      return mobileApiError("SERVICE_UNAVAILABLE");
    }
    throw error;
  }
  if (!user) {
    void recordSecurityEvent({
      eventType: "LOGIN_FAILED",
      ip,
      userAgent: ua,
      metadata: { emailHash, channel: "mobile_sales" },
    });
    return mobileApiError("INVALID_CREDENTIALS", { error: "Unauthorized" });
  }

  let organisationState: Awaited<ReturnType<typeof loadOrganisationAccessState>> | null = null;
  if (user.clientId) {
    try {
      organisationState = await loadOrganisationAccessState(user.clientId);
    } catch (error) {
      console.error("[sales/app/auth] organisation lookup failed", error);
      return mobileApiError("SERVICE_UNAVAILABLE");
    }
  }
  const eligibility = evaluateMobileSalesEligibility(
    {
      userId: user.id,
      role: user.role,
      alsoSells: user.alsoSells,
      clientId: user.clientId,
      isActive: true,
    },
    organisationState
  );
  if (!eligibility.ok) {
    void recordSecurityEvent({
      eventType: "LOGIN_FAILED",
      userId: user.id,
      clientId: user.clientId,
      ip,
      userAgent: ua,
      metadata: { emailHash, channel: "mobile_sales", reason: eligibility.code },
    });
    return mobileApiError(eligibility.code, { error: eligibility.error });
  }
  const clientId = user.clientId as string;

  const mfaNeed = await userNeedsMfaChallenge(user.id, user.role);
  if (mfaNeed.required) {
    const challenge = await createLoginChallenge({ userId: user.id, ip, userAgent: ua });
    return NextResponse.json(
      {
        mfaRequired: true,
        challengeId: challenge.challengeId,
        challengeToken: challenge.challengeToken,
        expiresAt: challenge.expiresAt,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return mobileApiError("SERVER_MISCONFIGURED", { error: "Server misconfigured" });
  }

  const deviceId =
    typeof body.deviceId === "string" && body.deviceId.trim()
      ? body.deviceId.trim().slice(0, 128)
      : null;
  const deviceName =
    typeof body.deviceName === "string" && body.deviceName.trim()
      ? body.deviceName.trim().slice(0, 120)
      : null;

  const enrolmentRequired = await mustEnrollMfa(user.id, user.role, { clientId });

  const sessionMetadata: Record<string, unknown> = enrolmentRequired
    ? { channel: SALES_APP_TOKEN_CHANNEL, mfaEnrolmentRequired: true, restricted: true }
    : { channel: SALES_APP_TOKEN_CHANNEL };

  let sessionRow: Awaited<ReturnType<typeof createUserSession>>;
  try {
    sessionRow = await createUserSession({
      userId: user.id,
      clientId,
      role: user.role,
      sessionType: "MOBILE",
      sessionVersion: user.sessionVersion,
      ip,
      userAgent: ua,
      deviceId,
      deviceName,
      authStrength: "password",
      metadata: sessionMetadata,
    });
  } catch (error) {
    console.error("[sales/app/auth] session creation failed", error);
    return mobileApiError("SERVICE_UNAVAILABLE");
  }

  void recordSecurityEvent({
    eventType: "LOGIN_SUCCESS",
    userId: user.id,
    clientId,
    sessionId: sessionRow.id,
    ip,
    userAgent: ua,
    metadata: enrolmentRequired
      ? { sessionType: "MOBILE", channel: SALES_APP_TOKEN_CHANNEL, mfaEnrolmentRequired: true }
      : { sessionType: "MOBILE", channel: SALES_APP_TOKEN_CHANNEL },
  });

  if (!enrolmentRequired) {
    const label = labelSessionDevice({
      sessionType: "MOBILE",
      userAgent: ua,
      deviceName,
      metadata: { channel: SALES_APP_TOKEN_CHANNEL },
    });
    if (shouldSendNewSignInEmail(user.id, deviceId || label.deviceName)) {
      void sendSecurityNotification({
        to: user.email,
        kind: "new_sign_in",
        deviceLabel: label.deviceName,
      });
    }
  }

  const { token, expiresAtMs } = await signSalesAppToken(
    user,
    sessionRow.id,
    secret,
    enrolmentRequired ? { mfaEnrolmentRequired: true } : {}
  );

  return NextResponse.json(
    {
      ...(enrolmentRequired ? { mfaEnrolmentRequired: true } : {}),
      token,
      expiresAt: earliestIso(sessionRow.expires_at, expiresAtMs),
      user: {
        userId: user.id,
        name: user.name,
        clientId,
        role: user.role,
        clientMode: user.clientMode,
        alsoSells: user.alsoSells,
        sessionId: sessionRow.id,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
