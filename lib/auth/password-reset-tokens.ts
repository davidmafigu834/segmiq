import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/** Hash a password-reset token for at-rest storage. Never store the raw token. */
export function hashPasswordResetToken(token: string): string {
  return createHash("sha256").update(`segmiq-reset:${token}`).digest("hex");
}

export function generatePasswordResetToken(): string {
  return randomBytes(32).toString("hex");
}

export function tokensEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

type ResetTokenRow = {
  id: string;
  user_id: string;
  expires_at: string;
  used: boolean;
};

/**
 * Atomically claim an unused, unexpired reset token.
 * Returns null if missing, used, or expired.
 */
export async function claimPasswordResetToken(
  rawToken: string
): Promise<ResetTokenRow | null> {
  const tokenHash = hashPasswordResetToken(rawToken);
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // Prefer hashed lookup; fall back to legacy plaintext rows during migration window.
  const { data: hashed } = await supabase
    .from("password_reset_tokens")
    .select("id, user_id, expires_at, used")
    .eq("token", tokenHash)
    .maybeSingle();

  let row = hashed as ResetTokenRow | null;
  if (!row) {
    const { data: legacy } = await supabase
      .from("password_reset_tokens")
      .select("id, user_id, expires_at, used")
      .eq("token", rawToken)
      .maybeSingle();
    row = (legacy as ResetTokenRow | null) ?? null;
  }

  if (!row || row.used) return null;
  if (new Date(row.expires_at) < new Date()) return null;

  const { data: claimed, error } = await supabase
    .from("password_reset_tokens")
    .update({ used: true })
    .eq("id", row.id)
    .eq("used", false)
    .gt("expires_at", now)
    .select("id, user_id, expires_at, used")
    .maybeSingle();

  if (error || !claimed) return null;
  return claimed as ResetTokenRow;
}

export async function findValidPasswordResetToken(
  rawToken: string
): Promise<(ResetTokenRow & { users?: { name: string; email: string } | null }) | null> {
  const tokenHash = hashPasswordResetToken(rawToken);
  const supabase = createAdminClient();

  const select = "id, user_id, expires_at, used, users(name, email)";
  const { data: hashed } = await supabase
    .from("password_reset_tokens")
    .select(select)
    .eq("token", tokenHash)
    .maybeSingle();

  let row = hashed as (ResetTokenRow & { users?: { name: string; email: string } | null }) | null;
  if (!row) {
    const { data: legacy } = await supabase
      .from("password_reset_tokens")
      .select(select)
      .eq("token", rawToken)
      .maybeSingle();
    row =
      (legacy as (ResetTokenRow & { users?: { name: string; email: string } | null }) | null) ??
      null;
  }

  if (!row || row.used) return null;
  if (new Date(row.expires_at) < new Date()) return null;
  return row;
}

export async function invalidateUnusedResetTokens(userId: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("password_reset_tokens")
    .update({ used: true })
    .eq("user_id", userId)
    .eq("used", false);
}

export async function insertPasswordResetToken(opts: {
  userId: string;
  rawToken: string;
  expiresAt: string;
}): Promise<{ ok: true } | { ok: false; error: unknown }> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("password_reset_tokens").insert({
    user_id: opts.userId,
    token: hashPasswordResetToken(opts.rawToken),
    expires_at: opts.expiresAt,
    used: false,
  });
  if (error) return { ok: false, error };
  return { ok: true };
}
