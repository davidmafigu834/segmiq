import type { UserRole } from "@/types";

/**
 * SegmiQ Phase 2 session policy (server-authoritative).
 *
 * SECURITY INVARIANTS (near auth):
 * 1. A valid JWT signature is not enough — user + session record must pass.
 * 2. Revoked / expired sessions never become ACTIVE again.
 * 3. session_version remains the global "revoke all" kill switch.
 * 4. Per-session logout uses user_sessions.revoked_at (not a version bump).
 * 5. WhatsApp QR sessions are unrelated to these records.
 */

export const ACTIVITY_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

/** Absolute lifetime from login */
export const ABSOLUTE_TTL_MS = {
  STANDARD: 7 * 24 * 60 * 60 * 1000, // salesperson / manager
  SUPER_ADMIN: 24 * 60 * 60 * 1000,
} as const;

/** Idle timeout from last_seen_at (human activity only) */
export const IDLE_TTL_MS = {
  STANDARD: 8 * 60 * 60 * 1000,
  SUPER_ADMIN: 2 * 60 * 60 * 1000,
} as const;

export type SessionType = "WEB" | "MOBILE";

export type SessionRevokeReason =
  | "USER_LOGOUT"
  | "LOGOUT_ALL"
  | "PASSWORD_CHANGED"
  | "PASSWORD_RESET"
  | "USER_DISABLED"
  | "ROLE_CHANGED"
  | "TENANT_CHANGED"
  | "ADMIN_REVOKED"
  | "SECURITY_EVENT"
  | "SESSION_EXPIRED"
  | "IDLE_TIMEOUT"
  | "IMPERSONATION_END"
  | "IMPERSONATION_START";

export function isSuperAdminRole(role: UserRole | string | null | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "AGENCY_ADMIN";
}

export function absoluteTtlMsForRole(role: UserRole | string): number {
  return isSuperAdminRole(role) ? ABSOLUTE_TTL_MS.SUPER_ADMIN : ABSOLUTE_TTL_MS.STANDARD;
}

export function idleTtlMsForRole(role: UserRole | string): number {
  return isSuperAdminRole(role) ? IDLE_TTL_MS.SUPER_ADMIN : IDLE_TTL_MS.STANDARD;
}

/** NextAuth / mobile JWT maxAge — upper bound equals standard absolute TTL. */
export const JWT_MAX_AGE_SEC = Math.floor(ABSOLUTE_TTL_MS.STANDARD / 1000);

/**
 * Paths / headers that should not refresh idle timeout (background traffic).
 * Documented policy: notification/inbox polls must not keep abandoned desks alive forever.
 */
export const BACKGROUND_ACTIVITY_HEADER = "x-segmiq-activity";

export function isBackgroundAuthRequest(req: Request | null | undefined): boolean {
  if (!req) return false;
  const flag = req.headers.get(BACKGROUND_ACTIVITY_HEADER)?.trim().toLowerCase();
  if (flag === "0" || flag === "background" || flag === "false") return true;
  try {
    const path = new URL(req.url).pathname;
    if (
      path.startsWith("/api/notifications") ||
      path === "/api/presence" ||
      path.startsWith("/api/whatsapp/gateway") ||
      path.startsWith("/api/agent/jobs")
    ) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
