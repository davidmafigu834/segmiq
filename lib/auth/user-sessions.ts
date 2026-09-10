import { createAdminClient } from "@/lib/supabase/admin";
import {
  ACTIVITY_TOUCH_INTERVAL_MS,
  absoluteTtlMsForRole,
  idleTtlMsForRole,
  isSuperAdminRole,
  type SessionRevokeReason,
  type SessionType,
} from "@/lib/auth/session-policy";
import type { UserRole } from "@/types";

type AdminClient = ReturnType<typeof createAdminClient>;

export type UserSessionRow = {
  id: string;
  user_id: string;
  client_id: string | null;
  session_type: SessionType;
  session_version: number;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  revoked_at: string | null;
  revoked_reason: string | null;
  user_agent: string | null;
  device_id: string | null;
  metadata: Record<string, unknown> | null;
};

export type SessionFailureReason =
  | "missing_session_id"
  | "session_missing"
  | "session_user_mismatch"
  | "session_revoked"
  | "session_expired"
  | "session_idle"
  | "session_version_mismatch";

export type CreateUserSessionInput = {
  userId: string;
  clientId: string | null;
  role: UserRole | string;
  sessionType: SessionType;
  sessionVersion: number;
  ip?: string | null;
  userAgent?: string | null;
  deviceId?: string | null;
  deviceName?: string | null;
  metadata?: Record<string, unknown>;
  /** ISO timestamp when MFA was satisfied for this login */
  mfaVerifiedAt?: string | null;
  authStrength?: "password" | "password_mfa";
  supabase?: AdminClient;
};

export async function createUserSession(input: CreateUserSessionInput): Promise<UserSessionRow> {
  const supabase = input.supabase ?? createAdminClient();
  const now = Date.now();

  let absoluteMs = absoluteTtlMsForRole(input.role);
  let idleMs = idleTtlMsForRole(input.role);
  const meta: Record<string, unknown> = { ...(input.metadata ?? {}) };

  if (input.clientId && !isSuperAdminRole(input.role)) {
    try {
      const { data: clientRow } = await supabase
        .from("clients")
        .select("security_policy")
        .eq("id", input.clientId)
        .maybeSingle();
      if (clientRow?.security_policy) {
        const { parseOrgSecurityPolicy, absoluteTtlMsFromOrgPolicy, idleTtlMsFromOrgPolicy } =
          await import("@/lib/auth/org-security-policy");
        const policy = parseOrgSecurityPolicy(clientRow.security_policy);
        absoluteMs = absoluteTtlMsFromOrgPolicy(policy, absoluteMs);
        idleMs = idleTtlMsFromOrgPolicy(policy, idleMs);
      }
    } catch {
      /* use role defaults */
    }
  }
  meta.idleTtlMs = idleMs;

  const expiresAt = new Date(now + absoluteMs).toISOString();
  const authStrength = input.authStrength ?? (input.mfaVerifiedAt ? "password_mfa" : "password");
  const { data, error } = await supabase
    .from("user_sessions")
    .insert({
      user_id: input.userId,
      client_id: input.clientId,
      session_type: input.sessionType,
      session_version: input.sessionVersion,
      created_at: new Date(now).toISOString(),
      last_seen_at: new Date(now).toISOString(),
      expires_at: expiresAt,
      created_ip: input.ip ?? null,
      last_ip: input.ip ?? null,
      user_agent: input.userAgent ?? null,
      device_id: input.deviceId ?? null,
      device_name: input.deviceName ?? null,
      metadata: meta,
      mfa_verified_at: input.mfaVerifiedAt ?? null,
      auth_strength: authStrength,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create user session");
  }
  return data as UserSessionRow;
}

export type ValidateSessionOpts = {
  sessionId: string | null | undefined;
  userId: string;
  sessionVersion: number;
  role: UserRole | string;
  /** When true, throttle-update last_seen_at */
  touchActivity?: boolean;
  ip?: string | null;
  supabase?: AdminClient;
  nowMs?: number;
  /** Injected row for tests */
  sessionRow?: UserSessionRow | null;
};

export async function validateUserSession(
  opts: ValidateSessionOpts
): Promise<{ ok: true; session: UserSessionRow } | { ok: false; reason: SessionFailureReason }> {
  if (!opts.sessionId) {
    return { ok: false, reason: "missing_session_id" };
  }

  let row = opts.sessionRow;
  const skipSideEffects = opts.sessionRow !== undefined;
  if (row === undefined) {
    const supabase = opts.supabase ?? createAdminClient();
    const { data } = await supabase
      .from("user_sessions")
      .select("*")
      .eq("id", opts.sessionId)
      .maybeSingle();
    row = (data as UserSessionRow | null) ?? null;
  }
  if (!row) return { ok: false, reason: "session_missing" };
  if (row.user_id !== opts.userId) return { ok: false, reason: "session_user_mismatch" };
  if (row.revoked_at) return { ok: false, reason: "session_revoked" };

  const now = opts.nowMs ?? Date.now();
  if (new Date(row.expires_at).getTime() <= now) {
    if (!skipSideEffects) {
      await revokeSessionById({
        sessionId: row.id,
        reason: "SESSION_EXPIRED",
        supabase: opts.supabase,
        onlyIfActive: true,
      });
    }
    return { ok: false, reason: "session_expired" };
  }

  const idleFromMeta =
    row.metadata && typeof (row.metadata as { idleTtlMs?: unknown }).idleTtlMs === "number"
      ? Number((row.metadata as { idleTtlMs: number }).idleTtlMs)
      : null;
  const idleMs =
    idleFromMeta && Number.isFinite(idleFromMeta) && idleFromMeta > 0
      ? idleFromMeta
      : idleTtlMsForRole(opts.role);
  if (new Date(row.last_seen_at).getTime() + idleMs <= now) {
    if (!skipSideEffects) {
      await revokeSessionById({
        sessionId: row.id,
        reason: "IDLE_TIMEOUT",
        supabase: opts.supabase,
        onlyIfActive: true,
      });
    }
    return { ok: false, reason: "session_idle" };
  }

  if (Number(row.session_version) !== Number(opts.sessionVersion)) {
    return { ok: false, reason: "session_version_mismatch" };
  }

  if (opts.touchActivity && !skipSideEffects) {
    const supabase = opts.supabase ?? createAdminClient();
    const lastSeen = new Date(row.last_seen_at).getTime();
    if (now - lastSeen >= ACTIVITY_TOUCH_INTERVAL_MS) {
      const patch: Record<string, unknown> = { last_seen_at: new Date(now).toISOString() };
      if (opts.ip) patch.last_ip = opts.ip;
      await supabase.from("user_sessions").update(patch).eq("id", row.id).is("revoked_at", null);
      row = { ...row, last_seen_at: patch.last_seen_at as string };
    }
  }

  return { ok: true, session: row };
}

export async function revokeSessionById(opts: {
  sessionId: string;
  reason: SessionRevokeReason;
  supabase?: AdminClient;
  onlyIfActive?: boolean;
}): Promise<boolean> {
  const supabase = opts.supabase ?? createAdminClient();
  let q = supabase
    .from("user_sessions")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_reason: opts.reason,
    })
    .eq("id", opts.sessionId);
  if (opts.onlyIfActive !== false) {
    q = q.is("revoked_at", null);
  }
  const { error } = await q;
  if (error) {
    console.warn("[user-sessions] revoke failed:", error.message);
    return false;
  }
  return true;
}

export async function revokeAllUserSessions(opts: {
  userId: string;
  reason: SessionRevokeReason;
  exceptSessionId?: string | null;
  supabase?: AdminClient;
}): Promise<number> {
  const supabase = opts.supabase ?? createAdminClient();
  let q = supabase
    .from("user_sessions")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_reason: opts.reason,
    })
    .eq("user_id", opts.userId)
    .is("revoked_at", null);
  if (opts.exceptSessionId) {
    q = q.neq("id", opts.exceptSessionId);
  }
  const { data, error } = await q.select("id");
  if (error) {
    console.warn("[user-sessions] revokeAll failed:", error.message);
    return 0;
  }
  return data?.length ?? 0;
}

/** Retention cleanup: delete sessions ended more than `retainDays` ago. */
export async function cleanupOldSessions(retainDays = 90): Promise<number> {
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - retainDays * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("user_sessions")
    .delete()
    .lt("expires_at", cutoff)
    .not("revoked_at", "is", null)
    .select("id");
  if (error) {
    console.warn("[user-sessions] cleanup failed:", error.message);
    return 0;
  }
  return data?.length ?? 0;
}

export function clientIpFromRequest(req: Request | null | undefined): string | null {
  if (!req) return null;
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip");
}

export function userAgentFromRequest(req: Request | null | undefined): string | null {
  if (!req) return null;
  const ua = req.headers.get("user-agent");
  return ua ? ua.slice(0, 512) : null;
}
