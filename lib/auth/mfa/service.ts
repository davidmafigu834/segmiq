import { createAdminClient } from "@/lib/supabase/admin";
import { sealMfaTotpSecret, revealMfaTotpSecret, type EncryptedEnvelope } from "@/lib/auth/account-security-crypto";
import {
  buildOtpAuthUri,
  generateTotpSecret,
  verifyTotpCode,
} from "@/lib/auth/mfa/totp";
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
  generateChallengeToken,
  hashChallengeToken,
  challengeHashesEqual,
} from "@/lib/auth/mfa/recovery-codes";
import {
  MFA_SETUP_TTL_MS,
  MFA_LOGIN_CHALLENGE_TTL_MS,
  RECOVERY_CODE_COUNT,
  mustHaveMfaToLogin,
} from "@/lib/auth/mfa/policy";
import { recordSecurityEvent } from "@/lib/auth/security-events";
import type { UserRole } from "@/types";

type AdminClient = ReturnType<typeof createAdminClient>;

export type MfaMethodRow = {
  id: string;
  user_id: string;
  type: "TOTP";
  status: "pending" | "active" | "disabled";
  secret_encrypted: EncryptedEnvelope;
  created_at: string;
  setup_expires_at: string | null;
  enabled_at: string | null;
  last_used_at: string | null;
};

export async function getActiveMfaMethod(
  userId: string,
  supabase?: AdminClient
): Promise<MfaMethodRow | null> {
  const db = supabase ?? createAdminClient();
  const { data } = await db
    .from("user_mfa_methods")
    .select("*")
    .eq("user_id", userId)
    .eq("type", "TOTP")
    .eq("status", "active")
    .maybeSingle();
  return (data as MfaMethodRow | null) ?? null;
}

export async function isMfaEnabled(userId: string, supabase?: AdminClient): Promise<boolean> {
  const method = await getActiveMfaMethod(userId, supabase);
  return Boolean(method);
}

export async function getMfaStatus(userId: string, supabase?: AdminClient) {
  const db = supabase ?? createAdminClient();
  const active = await getActiveMfaMethod(userId, db);
  const { count } = await db
    .from("user_mfa_recovery_codes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("used_at", null);
  return {
    enabled: Boolean(active),
    enabledAt: active?.enabled_at ?? null,
    recoveryCodesRemaining: count ?? 0,
  };
}

/** Start TOTP setup — secret pending until verified. */
export async function startTotpSetup(opts: {
  userId: string;
  email: string;
  supabase?: AdminClient;
}): Promise<{ otpauthUrl: string; manualKey: string; setupExpiresAt: string }> {
  const db = opts.supabase ?? createAdminClient();
  // Discard any prior pending setup
  await db
    .from("user_mfa_methods")
    .update({ status: "disabled", disabled_at: new Date().toISOString() })
    .eq("user_id", opts.userId)
    .eq("status", "pending");

  const existingActive = await getActiveMfaMethod(opts.userId, db);
  if (existingActive) {
    throw new Error("MFA_ALREADY_ENABLED");
  }

  const secret = generateTotpSecret();
  const envelope = await sealMfaTotpSecret(secret, opts.userId);
  const setupExpiresAt = new Date(Date.now() + MFA_SETUP_TTL_MS).toISOString();

  const { error } = await db.from("user_mfa_methods").insert({
    user_id: opts.userId,
    type: "TOTP",
    status: "pending",
    secret_encrypted: envelope,
    setup_expires_at: setupExpiresAt,
  });
  if (error) throw new Error(error.message);

  void recordSecurityEvent({
    eventType: "MFA_SETUP_STARTED",
    userId: opts.userId,
  });

  const accountLabel = opts.email.toLowerCase().trim();
  return {
    otpauthUrl: buildOtpAuthUri({ secret, accountLabel }),
    manualKey: secret,
    setupExpiresAt,
  };
}

export async function confirmTotpSetup(opts: {
  userId: string;
  code: string;
  supabase?: AdminClient;
}): Promise<{ recoveryCodes: string[] }> {
  const db = opts.supabase ?? createAdminClient();
  const { data: pending } = await db
    .from("user_mfa_methods")
    .select("*")
    .eq("user_id", opts.userId)
    .eq("status", "pending")
    .eq("type", "TOTP")
    .maybeSingle();

  if (!pending) throw new Error("NO_PENDING_SETUP");
  const row = pending as MfaMethodRow;
  if (row.setup_expires_at && new Date(row.setup_expires_at).getTime() < Date.now()) {
    await db.from("user_mfa_methods").update({ status: "disabled", disabled_at: new Date().toISOString() }).eq("id", row.id);
    throw new Error("SETUP_EXPIRED");
  }

  const secret = await revealMfaTotpSecret(row.secret_encrypted, opts.userId);
  if (!verifyTotpCode(secret, opts.code)) {
    throw new Error("INVALID_CODE");
  }

  const now = new Date().toISOString();
  const { error } = await db
    .from("user_mfa_methods")
    .update({
      status: "active",
      enabled_at: now,
      setup_expires_at: null,
      last_used_at: now,
    })
    .eq("id", row.id);
  if (error) throw new Error(error.message);

  const recoveryCodes = await replaceRecoveryCodes(opts.userId, db);

  void recordSecurityEvent({
    eventType: "MFA_ENABLED",
    userId: opts.userId,
  });

  return { recoveryCodes };
}

async function replaceRecoveryCodes(userId: string, db: AdminClient): Promise<string[]> {
  // Invalidate unused previous codes
  await db
    .from("user_mfa_recovery_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("used_at", null);

  const codes = generateRecoveryCodes(RECOVERY_CODE_COUNT);
  const batchId = crypto.randomUUID();
  const rows = await Promise.all(
    codes.map(async (code) => ({
      user_id: userId,
      code_hash: await hashRecoveryCode(code, userId),
      batch_id: batchId,
    }))
  );
  const { error } = await db.from("user_mfa_recovery_codes").insert(rows);
  if (error) throw new Error(error.message);
  return codes;
}

export async function regenerateRecoveryCodes(opts: {
  userId: string;
  supabase?: AdminClient;
}): Promise<string[]> {
  const db = opts.supabase ?? createAdminClient();
  const active = await getActiveMfaMethod(opts.userId, db);
  if (!active) throw new Error("MFA_NOT_ENABLED");
  const codes = await replaceRecoveryCodes(opts.userId, db);
  void recordSecurityEvent({
    eventType: "RECOVERY_CODES_REGENERATED",
    userId: opts.userId,
  });
  return codes;
}

export async function disableMfa(opts: {
  userId: string;
  supabase?: AdminClient;
}): Promise<void> {
  const db = opts.supabase ?? createAdminClient();
  await db
    .from("user_mfa_methods")
    .update({ status: "disabled", disabled_at: new Date().toISOString() })
    .eq("user_id", opts.userId)
    .in("status", ["pending", "active"]);

  await db
    .from("user_mfa_recovery_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", opts.userId)
    .is("used_at", null);

  void recordSecurityEvent({
    eventType: "MFA_DISABLED",
    userId: opts.userId,
  });
}

export async function createLoginChallenge(opts: {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
  supabase?: AdminClient;
}): Promise<{ challengeId: string; challengeToken: string; expiresAt: string }> {
  const db = opts.supabase ?? createAdminClient();
  const challengeToken = generateChallengeToken();
  const tokenHash = await hashChallengeToken(challengeToken);
  const expiresAt = new Date(Date.now() + MFA_LOGIN_CHALLENGE_TTL_MS).toISOString();
  const { data, error } = await db
    .from("user_auth_challenges")
    .insert({
      user_id: opts.userId,
      purpose: "login",
      token_hash: tokenHash,
      expires_at: expiresAt,
      ip_address: opts.ip ?? null,
      user_agent: opts.userAgent ? opts.userAgent.slice(0, 512) : null,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to create challenge");
  return { challengeId: data.id as string, challengeToken, expiresAt };
}

export type ChallengeVerifyResult =
  | { ok: true; userId: string }
  | { ok: false; reason: string };

/**
 * Verify login MFA challenge with TOTP or recovery code.
 * Consumes challenge on success (single-use).
 */
export async function verifyLoginChallenge(opts: {
  challengeId: string;
  challengeToken: string;
  totpCode?: string | null;
  recoveryCode?: string | null;
  supabase?: AdminClient;
}): Promise<ChallengeVerifyResult> {
  const db = opts.supabase ?? createAdminClient();
  const { data: row } = await db
    .from("user_auth_challenges")
    .select("*")
    .eq("id", opts.challengeId)
    .eq("purpose", "login")
    .maybeSingle();

  if (!row) return { ok: false, reason: "challenge_missing" };
  if (row.consumed_at) return { ok: false, reason: "challenge_consumed" };
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return { ok: false, reason: "challenge_expired" };
  }
  if (Number(row.attempt_count) >= Number(row.max_attempts)) {
    return { ok: false, reason: "too_many_attempts" };
  }

  const expectedHash = await hashChallengeToken(opts.challengeToken);
  if (!challengeHashesEqual(expectedHash, String(row.token_hash ?? ""))) {
    return { ok: false, reason: "challenge_invalid" };
  }

  const userId = row.user_id as string;
  await db
    .from("user_auth_challenges")
    .update({ attempt_count: Number(row.attempt_count) + 1 })
    .eq("id", row.id);

  let success = false;
  let usedRecovery = false;

  if (opts.totpCode) {
    const method = await getActiveMfaMethod(userId, db);
    if (!method) return { ok: false, reason: "mfa_not_enabled" };
    try {
      const secret = await revealMfaTotpSecret(method.secret_encrypted, userId);
      success = verifyTotpCode(secret, opts.totpCode);
      if (success) {
        await db
          .from("user_mfa_methods")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", method.id);
      }
    } catch {
      success = false;
    }
  } else if (opts.recoveryCode) {
    const normalized = normalizeRecoveryCode(opts.recoveryCode);
    if (!normalized) return { ok: false, reason: "invalid_code" };
    const codeHash = await hashRecoveryCode(normalized, userId);
    const { data: codeRow } = await db
      .from("user_mfa_recovery_codes")
      .select("id")
      .eq("user_id", userId)
      .eq("code_hash", codeHash)
      .is("used_at", null)
      .maybeSingle();
    if (codeRow) {
      const { data: updated } = await db
        .from("user_mfa_recovery_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("id", codeRow.id)
        .is("used_at", null)
        .select("id")
        .maybeSingle();
      success = Boolean(updated);
      usedRecovery = success;
    }
  } else {
    return { ok: false, reason: "code_required" };
  }

  if (!success) {
    void recordSecurityEvent({
      eventType: "MFA_CHALLENGE_FAILED",
      userId,
      metadata: { challengeId: opts.challengeId },
    });
    return { ok: false, reason: "invalid_code" };
  }

  await db
    .from("user_auth_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id);

  void recordSecurityEvent({
    eventType: usedRecovery ? "RECOVERY_CODE_USED" : "MFA_CHALLENGE_SUCCESS",
    userId,
    metadata: { challengeId: opts.challengeId },
  });

  return { ok: true, userId };
}

/** Verify TOTP against active method (for step-up / disable). */
export async function verifyActiveTotp(userId: string, code: string, supabase?: AdminClient): Promise<boolean> {
  const method = await getActiveMfaMethod(userId, supabase);
  if (!method) return false;
  try {
    const secret = await revealMfaTotpSecret(method.secret_encrypted, userId);
    return verifyTotpCode(secret, code);
  } catch {
    return false;
  }
}

/**
 * Login MFA challenge only when the user already has MFA enabled.
 * SUPER_ADMIN policy enforcement uses post-login enrolment redirect (see mustEnrollMfa).
 */
export async function userNeedsMfaChallenge(
  userId: string,
  _role: UserRole | string,
  supabase?: AdminClient
): Promise<{ required: boolean; reason: "enabled" | null }> {
  const enabled = await isMfaEnabled(userId, supabase);
  if (enabled) return { required: true, reason: "enabled" };
  return { required: false, reason: null };
}

export async function mustEnrollMfa(
  userId: string,
  role: UserRole | string,
  opts?: {
    clientId?: string | null;
    supabase?: AdminClient;
  }
): Promise<boolean> {
  const supabase = opts?.supabase;
  if (await isMfaEnabled(userId, supabase)) return false;

  // Platform SUPER_ADMIN policy
  if (mustHaveMfaToLogin(role, false)) return true;

  // Organisation policy (managers / all) — fail closed if policy cannot be loaded.
  const clientId = opts?.clientId ?? null;
  if (clientId && (role === "CLIENT_MANAGER" || role === "SALESPERSON")) {
    const db = supabase ?? createAdminClient();
    const { data, error } = await db
      .from("clients")
      .select("security_policy")
      .eq("id", clientId)
      .maybeSingle();
    if (error) {
      console.warn("[mfa] org policy load failed — requiring enrolment:", error.message);
      return true;
    }
    if (data?.security_policy) {
      const { parseOrgSecurityPolicy, orgMfaRequiredForRole } = await import(
        "@/lib/auth/org-security-policy"
      );
      const policy = parseOrgSecurityPolicy(data.security_policy);
      if (orgMfaRequiredForRole(policy, role)) return true;
    }
  }
  return false;
}
