import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeUserRole } from "@/lib/auth/roles";
import {
  validateUserSession,
  type SessionFailureReason,
} from "@/lib/auth/user-sessions";
import { isBackgroundAuthRequest } from "@/lib/auth/session-policy";
import type { UserRole } from "@/types";

/**
 * SECURITY INVARIANTS:
 * 1. JWT signature alone is insufficient.
 * 2. User must exist and is_active.
 * 3. sessionVersion must match (global revoke-all).
 * 4. sessionId must reference an active, non-expired, non-idle user_sessions row.
 * 5. Revoked sessions never become valid again.
 * 6. WhatsApp connection sessions are independent of SegmiQ user sessions.
 */

export type AuthClaims = {
  userId: string;
  role: UserRole;
  clientId: string | null;
  alsoSells?: boolean;
  sessionVersion?: number;
  realUserId?: string | null;
  sessionId?: string | null;
};

type AuthUserRow = {
  id: string;
  role: string;
  client_id: string | null;
  is_active: boolean;
  session_version: number | null;
  also_sells?: boolean | null;
};

export type AuthValidationFailureReason =
  | "missing_user_id"
  | "missing_session_version"
  | "target_missing"
  | "target_inactive"
  | "target_mismatch"
  | "real_missing"
  | "real_inactive"
  | "real_not_super_admin"
  | "session_version_mismatch"
  | "client_inactive"
  | "client_security_suspended"
  | SessionFailureReason;

export type AuthValidationResult =
  | {
      ok: true;
      claims: Required<
        Pick<AuthClaims, "userId" | "role" | "clientId" | "sessionVersion">
      > &
        Pick<AuthClaims, "alsoSells" | "realUserId" | "sessionId">;
    }
  | { ok: false; reason: AuthValidationFailureReason };

async function fetchAuthUserById(userId: string): Promise<AuthUserRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("users")
    .select("id, role, client_id, is_active, session_version, also_sells")
    .eq("id", userId)
    .maybeSingle();
  return (data as AuthUserRow | null) ?? null;
}

function normalizedRole(role: string | UserRole): UserRole | null {
  return normalizeUserRole(role) ?? null;
}

type ValidateDeps = {
  fetchUserById?: (userId: string) => Promise<AuthUserRow | null>;
  /** Skip user_sessions lookup (unit tests for claim-only checks). */
  skipSessionRegistry?: boolean;
  touchActivity?: boolean;
  request?: Request | null;
  ip?: string | null;
  nowMs?: number;
};

export async function validateAuthClaims(
  claims: AuthClaims,
  deps: ValidateDeps = {}
): Promise<AuthValidationResult> {
  if (!claims.userId) {
    return { ok: false, reason: "missing_user_id" };
  }
  if (!Number.isInteger(claims.sessionVersion)) {
    return { ok: false, reason: "missing_session_version" };
  }

  const fetchUserById = deps.fetchUserById ?? fetchAuthUserById;
  const targetUser = await fetchUserById(claims.userId);
  if (!targetUser) {
    return { ok: false, reason: "target_missing" };
  }
  if (!targetUser.is_active) {
    return { ok: false, reason: "target_inactive" };
  }

  const targetRole = normalizedRole(targetUser.role);
  const claimRole = normalizedRole(claims.role);
  const targetClientId = targetUser.client_id ?? null;
  const targetAlsoSells = Boolean(targetUser.also_sells);
  if (
    !targetRole ||
    !claimRole ||
    targetRole !== claimRole ||
    targetClientId !== (claims.clientId ?? null) ||
    targetAlsoSells !== Boolean(claims.alsoSells)
  ) {
    return { ok: false, reason: "target_mismatch" };
  }

  if (claims.realUserId) {
    const realUser = await fetchUserById(claims.realUserId);
    if (!realUser) {
      return { ok: false, reason: "real_missing" };
    }
    if (!realUser.is_active) {
      return { ok: false, reason: "real_inactive" };
    }
    if (normalizedRole(realUser.role) !== "SUPER_ADMIN") {
      return { ok: false, reason: "real_not_super_admin" };
    }
    if (Number(realUser.session_version ?? 0) !== claims.sessionVersion) {
      return { ok: false, reason: "session_version_mismatch" };
    }
  } else if (Number(targetUser.session_version ?? 0) !== claims.sessionVersion) {
    return { ok: false, reason: "session_version_mismatch" };
  }

  if (!deps.skipSessionRegistry) {
    const background = isBackgroundAuthRequest(deps.request);
    const touch =
      deps.touchActivity !== false && !background && Boolean(deps.request || deps.touchActivity);
    // Session registry is mandatory for Phase 2 tokens. Legacy JWTs without sessionId fail closed.
    const sessionCheck = await validateUserSession({
      sessionId: claims.sessionId,
      userId: claims.realUserId ? claims.userId : claims.userId,
      // Impersonation sessions are owned by the effective (target) user id.
      sessionVersion: claims.sessionVersion!,
      role: claimRole,
      touchActivity: touch,
      ip: deps.ip,
      nowMs: deps.nowMs,
    });
    if (!sessionCheck.ok) {
      return { ok: false, reason: sessionCheck.reason };
    }
  }

  // Tenant lockout after session validity — inactive / security-suspended clients.
  const effectiveClientId = targetClientId;
  if (
    !deps.skipSessionRegistry &&
    effectiveClientId &&
    targetRole !== "SUPER_ADMIN"
  ) {
    const supabase = createAdminClient();
    const { data: clientRow } = await supabase
      .from("clients")
      .select("is_active, is_archived, security_suspended_at")
      .eq("id", effectiveClientId)
      .maybeSingle();
    if (clientRow) {
      if (clientRow.is_active === false || clientRow.is_archived === true) {
        return { ok: false, reason: "client_inactive" };
      }
      if (clientRow.security_suspended_at) {
        return { ok: false, reason: "client_security_suspended" };
      }
    }
  }

  return {
    ok: true,
    claims: {
      userId: claims.userId,
      role: claimRole,
      clientId: claims.clientId ?? null,
      alsoSells: Boolean(claims.alsoSells),
      sessionVersion: claims.sessionVersion,
      realUserId: claims.realUserId ?? null,
      sessionId: claims.sessionId ?? null,
    },
  };
}
