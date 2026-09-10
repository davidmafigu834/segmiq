import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/password";
import { bumpSessionVersion } from "@/lib/auth/offboard";
import { recordSecurityEvent } from "@/lib/auth/security-events";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(64),
  password: z.string().min(8),
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
    return NextResponse.json({ error: "Token and password are required" }, { status: 400 });
  }

  const { token, password } = parsed.data;
  const supabase = createAdminClient();

  const { data: resetToken } = await supabase
    .from("password_reset_tokens")
    .select("id, user_id, expires_at, used")
    .eq("token", token)
    .maybeSingle();

  if (!resetToken) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const typedToken = resetToken as { id: string; user_id: string; expires_at: string; used: boolean };

  if (typedToken.used) {
    return NextResponse.json({ error: "Token already used" }, { status: 400 });
  }

  if (new Date(typedToken.expires_at) < new Date()) {
    return NextResponse.json({ error: "Token has expired" }, { status: 400 });
  }

  const hashed = await hashPassword(password);

  const { error: updateErr } = await supabase
    .from("users")
    .update({ password: hashed, password_changed_at: new Date().toISOString() })
    .eq("id", typedToken.user_id);

  if (updateErr) {
    console.error("[reset-password] password update failed:", updateErr);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }

  await bumpSessionVersion(supabase, typedToken.user_id, { revokeReason: "PASSWORD_RESET" });
  void recordSecurityEvent({
    eventType: "PASSWORD_RESET",
    userId: typedToken.user_id,
  });

  const { data: userRow } = await supabase
    .from("users")
    .select("email")
    .eq("id", typedToken.user_id)
    .maybeSingle();
  if (userRow?.email) {
    const { sendSecurityNotification } = await import("@/lib/email/templates/security-alert");
    void sendSecurityNotification({ to: String(userRow.email), kind: "password_reset" });
  }

  await supabase.from("password_reset_tokens").update({ used: true }).eq("id", typedToken.id);

  return NextResponse.json({ ok: true });
}
