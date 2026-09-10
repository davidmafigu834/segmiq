import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions, resolveClientMode } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canBeImpersonated, homeForRole } from "@/lib/auth/impersonation";
import { setSessionToken } from "@/lib/auth/session-token";
import {
  createUserSession,
  revokeSessionById,
  clientIpFromRequest,
  userAgentFromRequest,
} from "@/lib/auth/user-sessions";
import { recordSecurityEvent } from "@/lib/auth/security-events";
import { assertBrowserOrigin } from "@/lib/auth/origin-check";
import { requireElevatedSession } from "@/lib/auth/step-up";
import { isMfaEnabled } from "@/lib/auth/mfa/service";
import { hasPermission } from "@/lib/auth/rbac/resolve";
import { P } from "@/lib/auth/rbac/permissions";
import type { ClientMode, UserRole } from "@/types";

export const dynamic = "force-dynamic";

/** Impersonation sessions expire after 60 minutes max. */
export const IMPERSONATION_TTL_MS = 60 * 60 * 1000;

const bodySchema = z.object({
  userId: z.string().uuid(),
  reason: z
    .string()
    .min(8, "Provide a support reason")
    .max(500)
    .transform((s) => s.trim()),
});

export async function POST(req: Request) {
  const origin = assertBrowserOrigin(req);
  if (!origin.ok) {
    return NextResponse.json({ error: origin.error }, { status: origin.status });
  }

  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.isImpersonating) {
    return NextResponse.json({ error: "Already impersonating — stop first" }, { status: 400 });
  }
  if (session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (
    !hasPermission(
      {
        userId: session.userId,
        role: session.role,
        clientId: session.clientId,
        alsoSells: session.alsoSells,
        isImpersonating: false,
      },
      P.PLATFORM_IMPERSONATE
    )
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Require MFA enrolled for the real admin (platform policy).
  if (!(await isMfaEnabled(session.userId))) {
    return NextResponse.json(
      { error: "Enable two-step verification before impersonating customers" },
      { status: 403 }
    );
  }

  const elev = await requireElevatedSession({
    sessionId: session.sessionId,
    userId: session.userId,
  });
  if (!elev.ok) {
    return NextResponse.json({ error: elev.error }, { status: elev.status });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request — userId and reason required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const [{ data: admin }, { data: target }] = await Promise.all([
    supabase
      .from("users")
      .select("id, name, email, role, session_version")
      .eq("id", session.userId)
      .maybeSingle(),
    supabase
      .from("users")
      .select("id, name, email, role, client_id, is_active, also_sells")
      .eq("id", body.userId)
      .maybeSingle(),
  ]);

  if (!admin || admin.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (!canBeImpersonated(target as { role: string; client_id: string | null; is_active: boolean })) {
    return NextResponse.json({ error: "This user cannot be impersonated" }, { status: 403 });
  }

  const clientId = target.client_id as string;
  const clientMode = await resolveClientMode(clientId);
  const role = target.role as UserRole;
  const adminSv = Number((admin as { session_version?: number }).session_version ?? 0);
  const ip = clientIpFromRequest(req);
  const ua = userAgentFromRequest(req);

  if (session.sessionId) {
    await revokeSessionById({
      sessionId: session.sessionId,
      reason: "IMPERSONATION_START",
    });
  }

  const impersonationSession = await createUserSession({
    userId: target.id as string,
    clientId,
    role,
    sessionType: "WEB",
    sessionVersion: adminSv,
    ip,
    userAgent: ua,
    metadata: {
      impersonation: true,
      realUserId: admin.id,
      reason: body.reason.slice(0, 200),
      impersonationExpiresAt: new Date(Date.now() + IMPERSONATION_TTL_MS).toISOString(),
    },
  });

  // Cap absolute expiry for impersonation sessions.
  await supabase
    .from("user_sessions")
    .update({
      expires_at: new Date(Date.now() + IMPERSONATION_TTL_MS).toISOString(),
    })
    .eq("id", impersonationSession.id);

  await setSessionToken({
    userId: target.id as string,
    role,
    clientId,
    clientMode,
    alsoSells: Boolean((target as { also_sells?: boolean }).also_sells),
    sessionVersion: adminSv,
    sessionId: impersonationSession.id,
    email: (target.email as string | null) ?? null,
    name: target.name as string,
    realUserId: admin.id as string,
    realUserName: admin.name as string,
  });

  void recordSecurityEvent({
    eventType: "IMPERSONATION_STARTED",
    userId: target.id as string,
    clientId,
    sessionId: impersonationSession.id,
    ip,
    userAgent: ua,
    metadata: {
      realUserId: admin.id as string,
      reason: body.reason.slice(0, 200),
      ttlMinutes: IMPERSONATION_TTL_MS / 60000,
    },
  });

  return NextResponse.json({
    ok: true,
    redirectTo: homeForRole(role, clientMode as ClientMode),
    user: {
      id: target.id,
      name: target.name,
      role,
      clientId,
      clientMode,
    },
  });
}
