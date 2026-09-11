/**
 * Decide whether an API 401 means the SegmiQ login session is dead.
 * NextAuth protocol routes and pre-login MFA challenge must not force a logout loop.
 */
export function shouldTreatApi401AsSessionExpiry(url: string): boolean {
  if (!url.includes("/api/")) return false;
  try {
    const path = new URL(url, "https://segmiq.local").pathname;
    // NextAuth owned endpoints
    if (
      path === "/api/auth/session" ||
      path === "/api/auth/csrf" ||
      path === "/api/auth/signin" ||
      path === "/api/auth/signout" ||
      path === "/api/auth/providers" ||
      path === "/api/auth/error" ||
      path.startsWith("/api/auth/callback") ||
      path.startsWith("/api/auth/signin/") ||
      path === "/api/auth/_log"
    ) {
      return false;
    }
    // Pre-session login MFA challenge (no cookie session yet)
    if (path === "/api/auth/mfa/login") return false;
    return true;
  } catch {
    // Relative "/api/..." strings
    if (url.includes("/api/auth/mfa/login")) return false;
    if (/\/api\/auth\/(session|csrf|signin|signout|providers|error|_log)(\?|$|\/)/.test(url)) {
      return false;
    }
    if (url.includes("/api/auth/callback")) return false;
    return url.includes("/api/");
  }
}
