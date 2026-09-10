import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { setSessionToken } from "@/lib/auth/session-token";
import {
  createUserSession,
  revokeSessionById,
  clientIpFromRequest,
  userAgentFromRequest,
} from "@/lib/auth/user-sessions";
import { recordSecurityEvent } from "@/lib/auth/security-events";
import { assertBrowserOrigin } from "@/lib/auth/origin-check";
import type { UserRole } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const origin = assertBrowserOrigin(req);
  if (!origin.ok) {
    return NextResponse.json({ error: origin.error }, { status: origin.status });
  }

  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.isImpersonating || !session.realUserId) {
    return NextResponse.json({ error: "Not impersonating" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: admin } = await supabase
    .from("users")
    .select("id, name, email, role, client_id, is_active, session_version")
    .eq("id", session.realUserId)
    .maybeSingle();

  if (!admin || admin.role !== "SUPER_ADMIN" || !admin.is_active) {
    return NextResponse.json({ error: "Admin session invalid" }, { status: 403 });
  }

  const ip = clientIpFromRequest(req);
  const ua = userAgentFromRequest(req);

  if (session.sessionId) {
    await revokeSessionById({
      sessionId: session.sessionId,
      reason: "IMPERSONATION_END",
    });
  }

  const adminSv = Number((admin as { session_version?: number }).session_version ?? 0);
  const adminSession = await createUserSession({
    userId: admin.id as string,
    clientId: null,
    role: "SUPER_ADMIN",
    sessionType: "WEB",
    sessionVersion: adminSv,
    ip,
    userAgent: ua,
    metadata: { restoredFromImpersonation: true },
  });

  await setSessionToken({
    userId: admin.id as string,
    role: admin.role as UserRole,
    clientId: null,
    clientMode: "team",
    sessionVersion: adminSv,
    sessionId: adminSession.id,
    email: (admin.email as string | null) ?? null,
    name: admin.name as string,
  });

  void recordSecurityEvent({
    eventType: "IMPERSONATION_STOP",
    userId: admin.id as string,
    sessionId: adminSession.id,
    ip,
    userAgent: ua,
    metadata: { previousEffectiveUserId: session.userId },
  });

  return NextResponse.json({ ok: true, redirectTo: "/dashboard" });
}
