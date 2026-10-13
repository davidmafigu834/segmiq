import { resolveApiAuth, type ApiAuth } from "@/lib/auth/resolveApiAuth";
import { assertMfaApiAccess, evaluateMfaAssurance } from "@/lib/auth/mfa/assurance";

/**
 * Cookie session first (web), then Bearer JWT (mobile apps).
 *
 * When `req` is provided, MFA-restricted sessions are denied for non-allowlisted
 * paths inside resolveApiAuth — never fall through to an unrestricted cookie read.
 * Without `req`, enrolment-required sessions fail closed (no CRM authority).
 */
export async function getAuthFromRequest(req?: Request): Promise<ApiAuth | null> {
  if (req) {
    return resolveApiAuth(req);
  }

  const { getOperationalSession } = await import("@/lib/auth/operational-session");
  const session = await getOperationalSession();
  if (!session?.userId) return null;
  if (session.demoGuest) {
    if (session.role === "SUPER_ADMIN") return null;
    return {
      userId: session.userId,
      role: session.role,
      clientId: session.clientId ?? null,
      alsoSells: false,
      sessionId: session.sessionId ?? null,
      demoGuest: true,
      mfaRequired: false,
      mfaSatisfied: true,
      mfaEnrolmentRequired: false,
    };
  }

  const mfa = await evaluateMfaAssurance({
    userId: session.userId,
    role: session.role,
    clientId: session.clientId ?? null,
    sessionId: session.sessionId ?? null,
  });
  // No Request → cannot allowlist; MFA-unsatisfied must not grant CRM auth.
  if (!assertMfaApiAccess(mfa, null).ok) return null;

  return {
    userId: session.userId,
    role: session.role,
    clientId: session.clientId ?? null,
    alsoSells: session.alsoSells,
    sessionVersion: session.sessionVersion,
    sessionId: session.sessionId ?? null,
    mfaRequired: mfa.mfaRequired,
    mfaSatisfied: mfa.mfaSatisfied,
    mfaEnrolmentRequired: mfa.mfaEnrolmentRequired,
  };
}
