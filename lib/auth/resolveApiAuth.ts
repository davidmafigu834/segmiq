import { getServerSession } from "next-auth";
import { jwtVerify } from "jose";
import { authOptions } from "@/lib/auth";
import { validateAuthClaims, type AuthValidationFailureReason } from "@/lib/auth/session-validation";
import { clientIpFromRequest } from "@/lib/auth/user-sessions";
import { assertMfaApiAccess, evaluateMfaAssurance, type MfaAssurance } from "@/lib/auth/mfa/assurance";
import type { UserRole } from "@/types";

export type ApiAuth = {
  userId: string;
  role: UserRole;
  clientId: string | null;
  alsoSells?: boolean;
  isImpersonating?: boolean;
  sessionVersion?: number;
  sessionId?: string | null;
  mfaRequired?: boolean;
  mfaSatisfied?: boolean;
  mfaEnrolmentRequired?: boolean;
  /** Demonstration guest. Never a platform administrator. */
  demoGuest?: boolean;
  personaKey?: string | null;
};

/** Why API authentication failed. Used by mobile endpoints to return precise error codes. */
export type ApiAuthFailureReason =
  | "no_credentials"
  | "credentials_conflict"
  | "demo_guest_invalid"
  | "token_invalid"
  | "token_expired"
  | "server_misconfigured"
  | "mfa_required"
  | "mfa_enrolment_required"
  | "auth_unavailable"
  | AuthValidationFailureReason;

export type ApiAuthResolution =
  | {
      ok: true;
      auth: ApiAuth;
      /** Bearer JWT `exp` in epoch milliseconds; absent for cookie sessions. */
      tokenExpiresAt?: number | null;
    }
  | { ok: false; reason: ApiAuthFailureReason };

function getSecret(): Uint8Array | null {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

function mfaFailureReason(mfa: MfaAssurance): ApiAuthFailureReason {
  return mfa.mfaEnrolmentRequired ? "mfa_enrolment_required" : "mfa_required";
}

/**
 * Verify a Bearer JWT and its server-side session. Never throws: database or
 * dependency failures are reported as `auth_unavailable`.
 */
export async function verifyBearerTokenDetailed(req: Request): Promise<ApiAuthResolution> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return { ok: false, reason: "no_credentials" };

  const token = header.slice(7).trim();
  if (!token) return { ok: false, reason: "no_credentials" };

  const secret = getSecret();
  if (!secret) return { ok: false, reason: "server_misconfigured" };

  let payload: Awaited<ReturnType<typeof jwtVerify>>["payload"];
  try {
    ({ payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] }));
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    return { ok: false, reason: code === "ERR_JWT_EXPIRED" ? "token_expired" : "token_invalid" };
  }

  try {
    const userId = payload.userId;
    const role = payload.role;
    const clientId = payload.clientId;
    const alsoSells = payload.alsoSells;
    const sessionId =
      typeof payload.sessionId === "string"
        ? payload.sessionId
        : payload.sessionId === null
          ? null
          : undefined;
    const sessionVersion =
      typeof payload.sessionVersion === "number"
        ? payload.sessionVersion
        : Number.isInteger(payload.sessionVersion)
          ? Number(payload.sessionVersion)
          : undefined;
    if (typeof userId !== "string" || typeof role !== "string") {
      return { ok: false, reason: "token_invalid" };
    }
    const valid = await validateAuthClaims(
      {
        userId,
        role: role as UserRole,
        clientId: typeof clientId === "string" ? clientId : clientId === null ? null : null,
        alsoSells: typeof alsoSells === "boolean" ? alsoSells : Boolean(alsoSells),
        sessionVersion,
        sessionId: sessionId ?? null,
      },
      {
        request: req,
        touchActivity: true,
        ip: clientIpFromRequest(req),
      }
    );
    if (!valid.ok) {
      console.warn("[auth] Bearer token rejected:", valid.reason);
      return { ok: false, reason: valid.reason };
    }
    const mfa = await evaluateMfaAssurance({
      userId: valid.claims.userId,
      role: valid.claims.role,
      clientId: valid.claims.clientId,
      sessionId: valid.claims.sessionId ?? null,
    });
    // Phase 6.2: restricted enrolment / MFA-unproven sessions must not authenticate CRM APIs.
    if (!assertMfaApiAccess(mfa, req).ok) return { ok: false, reason: mfaFailureReason(mfa) };
    return {
      ok: true,
      auth: {
        userId: valid.claims.userId,
        role: valid.claims.role,
        clientId: valid.claims.clientId,
        alsoSells: Boolean(valid.claims.alsoSells),
        sessionVersion: valid.claims.sessionVersion,
        sessionId: valid.claims.sessionId ?? null,
        mfaRequired: mfa.mfaRequired,
        mfaSatisfied: mfa.mfaSatisfied,
        mfaEnrolmentRequired: mfa.mfaEnrolmentRequired,
      },
      tokenExpiresAt: typeof payload.exp === "number" ? payload.exp * 1000 : null,
    };
  } catch (error) {
    console.warn("[auth] Bearer token validation unavailable:", error instanceof Error ? error.message : error);
    return { ok: false, reason: "auth_unavailable" };
  }
}

/**
 * Cookie session first (web unchanged), then Bearer JWT for the field app.
 * Reports the failure reason. Cookie-session lookup errors propagate, as in `resolveApiAuth`.
 */
export async function resolveApiAuthDetailed(req: Request): Promise<ApiAuthResolution> {
  const { readDemoSessionCookie } = await import("@/lib/demo/cookie");
  const { credentialsConflict } = await import("@/lib/demo/allowlist");
  const demoSecret = readDemoSessionCookie(req.headers.get("cookie"));
  const session = await getServerSession(authOptions);
  if (credentialsConflict(Boolean(session?.userId), Boolean(demoSecret))) {
    return { ok: false, reason: "credentials_conflict" };
  }
  if (!session?.userId && demoSecret) {
    const { loadGuestBySecret, bindGuest } = await import("@/lib/demo/guest-session");
    const guest = await loadGuestBySecret(demoSecret);
    if (!guest) return { ok: false, reason: "demo_guest_invalid" };
    bindGuest(guest);
    return {
      ok: true,
      auth: {
        userId: guest.userId,
        role: guest.role,
        clientId: guest.clientId,
        alsoSells: false,
        isImpersonating: false,
        sessionId: guest.sessionId,
        demoGuest: true,
        personaKey: guest.personaKey,
        mfaRequired: false,
        mfaSatisfied: true,
        mfaEnrolmentRequired: false,
      },
    };
  }
  if (session?.userId) {
    // Re-validate with request context so idle/absolute/revocation + activity touch apply.
    const valid = await validateAuthClaims(
      {
        userId: session.userId,
        role: session.role,
        clientId: session.clientId ?? null,
        alsoSells: session.alsoSells,
        sessionVersion: session.sessionVersion,
        realUserId: session.realUserId,
        sessionId: session.sessionId ?? null,
      },
      {
        request: req,
        touchActivity: true,
        ip: clientIpFromRequest(req),
      }
    );
    if (!valid.ok) {
      console.warn("[auth] Cookie session rejected on API:", valid.reason);
      return { ok: false, reason: valid.reason };
    }
    const mfa = await evaluateMfaAssurance({
      userId: valid.claims.userId,
      role: valid.claims.role,
      clientId: valid.claims.clientId,
      sessionId: valid.claims.sessionId ?? null,
    });
    // Phase 6.2: restricted enrolment / MFA-unproven sessions must not authenticate CRM APIs.
    if (!assertMfaApiAccess(mfa, req).ok) return { ok: false, reason: mfaFailureReason(mfa) };
    return {
      ok: true,
      auth: {
        userId: valid.claims.userId,
        role: valid.claims.role,
        clientId: valid.claims.clientId,
        alsoSells: Boolean(valid.claims.alsoSells),
        isImpersonating: Boolean(valid.claims.realUserId),
        sessionVersion: valid.claims.sessionVersion,
        sessionId: valid.claims.sessionId ?? null,
        mfaRequired: mfa.mfaRequired,
        mfaSatisfied: mfa.mfaSatisfied,
        mfaEnrolmentRequired: mfa.mfaEnrolmentRequired,
      },
    };
  }
  return verifyBearerTokenDetailed(req);
}

/** Cookie session first (web unchanged), then Bearer JWT for the field app. */
export async function resolveApiAuth(req: Request): Promise<ApiAuth | null> {
  const resolution = await resolveApiAuthDetailed(req);
  return resolution.ok ? resolution.auth : null;
}
