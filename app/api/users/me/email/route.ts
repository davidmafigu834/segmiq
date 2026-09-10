import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/api-guards";
import { verifyPassword } from "@/lib/password";
import { assertBrowserOrigin } from "@/lib/auth/origin-check";
import { elevateSession } from "@/lib/auth/step-up";
import { isMfaEnabled, verifyActiveTotp } from "@/lib/auth/mfa/service";
import { recordSecurityEvent } from "@/lib/auth/security-events";
import { revokeAllUserSessions } from "@/lib/auth/user-sessions";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  newEmail: z.string().email("Enter a valid email address"),
  currentPassword: z.string().min(1, "Current password is required"),
  totpCode: z.string().optional(),
});

function normalizeEmail(raw: string): string {
  return raw.toLowerCase().trim();
}

export async function POST(req: Request) {
  const origin = assertBrowserOrigin(req);
  if (!origin.ok) {
    return NextResponse.json({ error: origin.error }, { status: origin.status });
  }

  const g = await requireSession();
  if ("error" in g) return g.error;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const newEmail = normalizeEmail(parsed.data.newEmail);
  const supabase = createAdminClient();

  const { data: row, error: loadErr } = await supabase
    .from("users")
    .select("id, email, password, session_version")
    .eq("id", g.session.userId)
    .single();

  if (loadErr || !row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const current = normalizeEmail(String((row as { email?: string }).email ?? ""));
  if (newEmail === current) {
    return NextResponse.json({ error: "That is already your email address" }, { status: 400 });
  }

  const { data: taken } = await supabase.from("users").select("id").eq("email", newEmail).maybeSingle();
  if (taken && (taken as { id: string }).id !== g.session.userId) {
    return NextResponse.json({ error: "That email is already in use" }, { status: 409 });
  }

  const ok = await verifyPassword(
    parsed.data.currentPassword,
    String((row as { password?: string }).password ?? "")
  );
  if (!ok) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const sessionId = (g.session as { sessionId?: string | null }).sessionId ?? null;
  const mfaOn = await isMfaEnabled(g.session.userId);
  if (mfaOn) {
    if (!parsed.data.totpCode || !(await verifyActiveTotp(g.session.userId, parsed.data.totpCode))) {
      return NextResponse.json({ error: "Authenticator code required" }, { status: 403 });
    }
  } else if (sessionId) {
    await elevateSession({
      sessionId,
      userId: g.session.userId,
      password: parsed.data.currentPassword,
    });
  }

  const nextSv = Number((row as { session_version?: number }).session_version ?? 0) + 1;

  const { error: updateErr } = await supabase
    .from("users")
    .update({ email: newEmail, session_version: nextSv })
    .eq("id", g.session.userId);

  if (updateErr) {
    const isUnique =
      (updateErr as { code?: string; message?: string }).code === "23505" ||
      String(updateErr.message).toLowerCase().includes("unique");
    if (isUnique) {
      return NextResponse.json({ error: "That email is already in use" }, { status: 409 });
    }
    console.error("[users/me/email POST]", updateErr);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  await revokeAllUserSessions({
    userId: g.session.userId,
    reason: "ADMIN_REVOKED",
    exceptSessionId: sessionId,
  });

  void recordSecurityEvent({
    eventType: "EMAIL_CHANGED",
    userId: g.session.userId,
    clientId: g.session.clientId,
    sessionId,
  });

  return NextResponse.json({ ok: true, email: newEmail, sessionVersion: nextSv });
}
