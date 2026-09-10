import { createAdminClient } from "@/lib/supabase/admin";
import { revokeAllUserSessions } from "@/lib/auth/user-sessions";
import { recordSecurityEvent } from "@/lib/auth/security-events";
import type { SessionRevokeReason } from "@/lib/auth/session-policy";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * SECURITY:
 * Bumping `session_version` invalidates web JWT cookies (Phase 0 session callback +
 * middleware) and mobile Bearer tokens that include sessionVersion.
 * Always bump when deactivating, resetting passwords, or changing roles.
 * Also revoke all user_sessions rows for auditability (Phase 2).
 */
export async function bumpSessionVersion(
  supabase: AdminClient,
  userId: string,
  opts?: { revokeReason?: SessionRevokeReason; skipSessionRevoke?: boolean }
): Promise<number> {
  const { data: row } = await supabase
    .from("users")
    .select("session_version")
    .eq("id", userId)
    .maybeSingle();
  const next = Number((row as { session_version?: number } | null)?.session_version ?? 0) + 1;
  await supabase.from("users").update({ session_version: next }).eq("id", userId);
  if (!opts?.skipSessionRevoke) {
    await revokeAllUserSessions({
      userId,
      reason: opts?.revokeReason ?? "SECURITY_EVENT",
      supabase,
    });
  }
  return next;
}

export type DeactivateOrgUserResult =
  | { ok: true; sessionVersion: number }
  | { ok: false; error: string; status: 400 | 404 | 500 };

/**
 * Preferred organisation employee offboarding path:
 * ACTIVE → INACTIVE (preserve history / FKs) + revoke sessions.
 */
export async function deactivateOrgUser(opts: {
  supabase: AdminClient;
  clientId: string;
  userId: string;
  actorUserId: string;
}): Promise<DeactivateOrgUserResult> {
  if (opts.userId === opts.actorUserId) {
    return { ok: false, error: "You cannot deactivate yourself", status: 400 };
  }

  const { data: target } = await opts.supabase
    .from("users")
    .select("id, role, client_id, is_active")
    .eq("id", opts.userId)
    .maybeSingle();

  if (!target || target.client_id !== opts.clientId) {
    return { ok: false, error: "Not found", status: 404 };
  }

  const role = target.role as string;
  if (role !== "SALESPERSON" && role !== "CLIENT_MANAGER") {
    return { ok: false, error: "Not found", status: 404 };
  }

  if (role === "CLIENT_MANAGER") {
    const { count } = await opts.supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("client_id", opts.clientId)
      .eq("role", "CLIENT_MANAGER")
      .eq("is_active", true);
    if ((count ?? 0) <= 1) {
      return { ok: false, error: "At least one company manager is required.", status: 400 };
    }
  }

  const { error } = await opts.supabase
    .from("users")
    .update({ is_active: false, also_sells: false, round_robin_order: 0 })
    .eq("id", opts.userId)
    .eq("client_id", opts.clientId);

  if (error) {
    return { ok: false, error: error.message, status: 500 };
  }

  const sessionVersion = await bumpSessionVersion(opts.supabase, opts.userId, {
    revokeReason: "USER_DISABLED",
  });
  void recordSecurityEvent({
    eventType: "USER_DISABLED",
    userId: opts.userId,
    clientId: opts.clientId,
    metadata: { actorUserId: opts.actorUserId },
  });
  return { ok: true, sessionVersion };
}
