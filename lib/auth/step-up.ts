import { createAdminClient } from "@/lib/supabase/admin";
import { STEP_UP_TTL_MS } from "@/lib/auth/mfa/policy";
import { verifyActiveTotp, isMfaEnabled } from "@/lib/auth/mfa/service";
import { verifyPassword } from "@/lib/password";
import { recordSecurityEvent } from "@/lib/auth/security-events";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Require recent elevated authentication on the current server session.
 */
export async function isSessionElevated(opts: {
  sessionId: string | null | undefined;
  supabase?: AdminClient;
  nowMs?: number;
}): Promise<boolean> {
  if (!opts.sessionId) return false;
  const db = opts.supabase ?? createAdminClient();
  const { data } = await db
    .from("user_sessions")
    .select("elevated_until, revoked_at")
    .eq("id", opts.sessionId)
    .maybeSingle();
  if (!data || data.revoked_at) return false;
  if (!data.elevated_until) return false;
  return new Date(data.elevated_until).getTime() > (opts.nowMs ?? Date.now());
}

export async function elevateSession(opts: {
  sessionId: string;
  userId: string;
  password?: string | null;
  totpCode?: string | null;
  supabase?: AdminClient;
}): Promise<{ ok: true; elevatedUntil: string } | { ok: false; reason: string }> {
  const db = opts.supabase ?? createAdminClient();
  const { data: session } = await db
    .from("user_sessions")
    .select("id, user_id, revoked_at")
    .eq("id", opts.sessionId)
    .maybeSingle();
  if (!session || session.user_id !== opts.userId || session.revoked_at) {
    return { ok: false, reason: "session_invalid" };
  }

  const mfaOn = await isMfaEnabled(opts.userId, db);
  if (mfaOn) {
    if (!opts.totpCode || !(await verifyActiveTotp(opts.userId, opts.totpCode, db))) {
      return { ok: false, reason: "totp_required" };
    }
  } else {
    if (!opts.password) return { ok: false, reason: "password_required" };
    const { data: user } = await db.from("users").select("password").eq("id", opts.userId).single();
    if (!user || !(await verifyPassword(opts.password, String(user.password)))) {
      return { ok: false, reason: "password_invalid" };
    }
  }

  const elevatedUntil = new Date(Date.now() + STEP_UP_TTL_MS).toISOString();
  await db.from("user_sessions").update({ elevated_until: elevatedUntil }).eq("id", opts.sessionId);

  void recordSecurityEvent({
    eventType: "STEP_UP_SUCCESS",
    userId: opts.userId,
    sessionId: opts.sessionId,
  });

  return { ok: true, elevatedUntil };
}

export async function requireElevatedSession(opts: {
  sessionId: string | null | undefined;
  userId: string;
  supabase?: AdminClient;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const elevated = await isSessionElevated({
    sessionId: opts.sessionId,
    supabase: opts.supabase,
  });
  if (!elevated) {
    return { ok: false, status: 403, error: "Step-up authentication required" };
  }
  return { ok: true };
}
