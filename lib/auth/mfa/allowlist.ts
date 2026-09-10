/**
 * Edge-safe MFA enrolment allowlist (no Node / DB imports).
 * Shared by middleware and API assurance checks.
 */

/** Paths a restricted (enrolment-required) session may call. */
export function isMfaRestrictedAllowlistedPath(pathname: string): boolean {
  const p = pathname.split("?")[0] || pathname;
  if (p === "/api/auth/mfa" || p.startsWith("/api/auth/mfa/")) return true;
  if (p === "/api/auth/home") return true;
  if (p === "/api/auth/session" || p === "/api/auth/session/logout" || p === "/api/auth/sessions") return true;
  if (p === "/api/users/me/security-meta") return true;
  if (p === "/api/auth/csrf") return true;
  return false;
}
