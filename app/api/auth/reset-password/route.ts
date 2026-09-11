import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/password";
import { bumpSessionVersion } from "@/lib/auth/offboard";
import { recordSecurityEvent } from "@/lib/auth/security-events";
import { claimPasswordResetToken } from "@/lib/auth/password-reset-tokens";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(64),
  password: z.string().min(12).max(128),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Token and a password of at least 12 characters are required" },
      { status: 400 }
    );
  }

  const { token, password } = parsed.data;
  const claimed = await claimPasswordResetToken(token);
  if (!claimed) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
  }

  const hashed = await hashPassword(password);
  const supabase = createAdminClient();

  const { error: updateErr } = await supabase
    .from("users")
    .update({ password: hashed, password_changed_at: new Date().toISOString() })
    .eq("id", claimed.user_id);

  if (updateErr) {
    console.error("[reset-password] password update failed:", updateErr);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }

  await bumpSessionVersion(supabase, claimed.user_id, { revokeReason: "PASSWORD_RESET" });
  void recordSecurityEvent({
    eventType: "PASSWORD_RESET",
    userId: claimed.user_id,
  });

  const { data: userRow } = await supabase
    .from("users")
    .select("email")
    .eq("id", claimed.user_id)
    .maybeSingle();
  if (userRow?.email) {
    const { sendSecurityNotification } = await import("@/lib/email/templates/security-alert");
    void sendSecurityNotification({ to: String(userRow.email), kind: "password_reset" });
  }

  return NextResponse.json({ ok: true });
}
