import { getServerSession } from "next-auth";
import { jwtVerify } from "jose";
import { authOptions } from "@/lib/auth";
import { validateAuthClaims } from "@/lib/auth/session-validation";
import { clientIpFromRequest } from "@/lib/auth/user-sessions";
import { assertMfaApiAccess, evaluateMfaAssurance } from "@/lib/auth/mfa/assurance";
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
};

function getSecret(): Uint8Array | null {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

async function verifyBearerToken(req: Request): Promise<ApiAuth | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const token = header.slice(7).trim();
  if (!token) return null;

  const secret = getSecret();
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
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
    if (typeof userId !== "string" || typeof role !== "string") return null;
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
      return null;
    }
    const mfa = await evaluateMfaAssurance({
      userId: valid.claims.userId,
      role: valid.claims.role,
      clientId: valid.claims.clientId,
    });
    // Phase 6.2: restricted enrolment sessions must not authenticate CRM APIs.
    if (!assertMfaApiAccess(mfa, req).ok) return null;
    return {
      userId: valid.claims.userId,
      role: valid.claims.role,
      clientId: valid.claims.clientId,
      alsoSells: Boolean(valid.claims.alsoSells),
      sessionVersion: valid.claims.sessionVersion,
      sessionId: valid.claims.sessionId ?? null,
      mfaRequired: mfa.mfaRequired,
      mfaSatisfied: mfa.mfaSatisfied,
      mfaEnrolmentRequired: mfa.mfaEnrolmentRequired,
    };
  } catch {
    return null;
  }
}

/** Cookie session first (web unchanged), then Bearer JWT for the field app. */
export async function resolveApiAuth(req: Request): Promise<ApiAuth | null> {
  const session = await getServerSession(authOptions);
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
      return null;
    }
    const mfa = await evaluateMfaAssurance({
      userId: valid.claims.userId,
      role: valid.claims.role,
      clientId: valid.claims.clientId,
    });
    // Phase 6.2: restricted enrolment sessions must not authenticate CRM APIs.
    if (!assertMfaApiAccess(mfa, req).ok) return null;
    return {
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
    };
  }
  return verifyBearerToken(req);
}
