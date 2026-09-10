import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRolesFromRequest } from "@/lib/api-guards";
import { assertBrowserOrigin } from "@/lib/auth/origin-check";
import { elevateSession, requireElevatedSession } from "@/lib/auth/step-up";
import { disableMfa, verifyActiveTotp } from "@/lib/auth/mfa/service";
import { recordSecurityEvent } from "@/lib/auth/security-events";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkSecurityRateLimit } from "@/lib/auth/security-rate-limit";
import { clientIpFromRequest } from "@/lib/auth/user-sessions";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  targetUserId: z.string().uuid(),
  totpCode: z.string().min(6),
  confirm: z.literal(true),
  reason: z.string().min(8).max(500),
});

/**
 * SUPER_ADMIN only — reset another user's MFA after identity verification.
 * Does not expose secrets. Requires admin's own TOTP step-up.
 */
export async function POST(req: Request) {
  const origin = assertBrowserOrigin(req);
  if (!origin.ok) {
    return NextResponse.json({ error: origin.error }, { status: origin.status });
  }

  const g = await requireRolesFromRequest(req, ["SUPER_ADMIN"]);
  if ("error" in g) return g.error;

  const ip = clientIpFromRequest(req);
  const rl = checkSecurityRateLimit({
    key: `admin-mfa-reset:${g.session.userId}:${ip}`,
    limit: 10,
    windowMs: 60 * 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (parsed.data.targetUserId === g.session.userId) {
    return NextResponse.json({ error: "Use Security settings to manage your own MFA" }, { status: 400 });
  }

  if (!(await verifyActiveTotp(g.session.userId, parsed.data.totpCode))) {
    return NextResponse.json({ error: "Authenticator verification failed" }, { status: 403 });
  }

  if (g.session.sessionId) {
    await elevateSession({
      sessionId: g.session.sessionId,
      userId: g.session.userId,
      totpCode: parsed.data.totpCode,
    });
  }
  const elev = await requireElevatedSession({
    sessionId: g.session.sessionId,
    userId: g.session.userId,
  });
  if (!elev.ok) {
    return NextResponse.json({ error: elev.error }, { status: elev.status });
  }

  const supabase = createAdminClient();
  const { data: target } = await supabase
    .from("users")
    .select("id, email, role, client_id")
    .eq("id", parsed.data.targetUserId)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await disableMfa({ userId: target.id as string });

  void recordSecurityEvent({
    eventType: "MFA_ADMIN_RESET",
    userId: target.id as string,
    clientId: (target.client_id as string | null) ?? null,
    sessionId: g.session.sessionId,
    metadata: {
      actorUserId: g.session.userId,
      reason: parsed.data.reason.slice(0, 200),
      targetRole: target.role,
    },
  });

  return NextResponse.json({ ok: true });
}
