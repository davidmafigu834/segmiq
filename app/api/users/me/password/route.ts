import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/api-guards";
import { hashPassword, verifyPassword } from "@/lib/password";
import { revokeAllUserSessions } from "@/lib/auth/user-sessions";
import { recordSecurityEvent } from "@/lib/auth/security-events";
import { assertBrowserOrigin } from "@/lib/auth/origin-check";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
}).refine((d) => /[0-9!@#$%^&*()_+\-=[\]{}|;:'",.<>/?]/.test(d.newPassword), {
  message: "Include at least one number or symbol",
  path: ["newPassword"],
});

/**
 * Voluntary password change:
 * - current session remains valid
 * - all other sessions revoked
 * - session_version is NOT bumped (so this device keeps working)
 *
 * Account recovery / admin reset uses bumpSessionVersion (revokes all).
 */
export async function POST(req: Request) {
  const origin = assertBrowserOrigin(req);
  if (!origin.ok) {
    return NextResponse.json({ error: origin.error }, { status: origin.status });
  }

  const g = await requireSession();
  if ("error" in g) return g.error;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid password rules", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: user } = await supabase.from("users").select("password, session_version").eq("id", g.session.userId).single();
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ok = await verifyPassword(parsed.data.currentPassword, user.password as string);
  if (!ok) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const newHash = await hashPassword(parsed.data.newPassword);

  const { error } = await supabase
    .from("users")
    .update({ password: newHash, password_changed_at: new Date().toISOString() })
    .eq("id", g.session.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const currentSessionId = (g.session as { sessionId?: string | null }).sessionId ?? null;
  const revoked = await revokeAllUserSessions({
    userId: g.session.userId,
    reason: "PASSWORD_CHANGED",
    exceptSessionId: currentSessionId,
  });

  void recordSecurityEvent({
    eventType: "PASSWORD_CHANGED",
    userId: g.session.userId,
    clientId: g.session.clientId,
    sessionId: currentSessionId,
    metadata: { revokedOthers: revoked },
  });

  const { data: me } = await supabase.from("users").select("email").eq("id", g.session.userId).maybeSingle();
  if (me?.email) {
    const { sendSecurityNotification } = await import("@/lib/email/templates/security-alert");
    void sendSecurityNotification({ to: String(me.email), kind: "password_changed" });
  }

  return NextResponse.json({ ok: true, revokedOthers: revoked });
}
