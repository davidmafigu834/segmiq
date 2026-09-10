import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRoles } from "@/lib/api-guards";
import { resetCompanyCrm } from "@/lib/clients/reset-crm";
import { assertBrowserOrigin } from "@/lib/auth/origin-check";
import { requireElevatedSession } from "@/lib/auth/step-up";
import { isMfaEnabled } from "@/lib/auth/mfa/service";
import { recordSecurityEvent } from "@/lib/auth/security-events";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/auth/user-sessions";
import { hasPermission } from "@/lib/auth/rbac/resolve";
import { P } from "@/lib/auth/rbac/permissions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  confirmName: z.string().min(1),
});

/**
 * Super-admin only. Wipes operational CRM data so a company can start over
 * without losing the account, team, catalog, or connections.
 */
export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const origin = assertBrowserOrigin(req);
  if (!origin.ok) {
    return NextResponse.json({ error: origin.error }, { status: origin.status });
  }

  const guard = await requireRoles(["SUPER_ADMIN"], req);
  if ("error" in guard) return guard.error;
  const { session } = guard;

  if (
    !hasPermission(
      {
        userId: session.userId,
        role: session.role,
        clientId: session.clientId,
        alsoSells: session.alsoSells,
        isImpersonating: false,
      },
      P.PLATFORM_CLIENTS_MANAGE
    )
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!(await isMfaEnabled(session.userId))) {
    return NextResponse.json(
      { error: "Enable two-step verification before resetting CRM data" },
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

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Type the company name to confirm." }, { status: 400 });
  }

  const ip = clientIpFromRequest(req);
  const ua = userAgentFromRequest(req);
  const supabase = createAdminClient();
  const { data: existing, error } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", params.clientId)
    .maybeSingle();
  if (error || !existing) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const savedName = String(existing.name ?? "").trim();
  if (!savedName || parsed.data.confirmName.trim() !== savedName) {
    return NextResponse.json({ error: "Name does not match — reset cancelled" }, { status: 400 });
  }

  void recordSecurityEvent({
    eventType: "CRM_RESET_INITIATED",
    userId: session.userId,
    clientId: params.clientId,
    sessionId: session.sessionId,
    ip,
    userAgent: ua,
  });

  const result = await resetCompanyCrm(supabase, params.clientId);
  if (!result.ok) {
    void recordSecurityEvent({
      eventType: "CRM_RESET_FAILED",
      userId: session.userId,
      clientId: params.clientId,
      sessionId: session.sessionId,
      ip,
      userAgent: ua,
      metadata: { reason: result.error?.slice(0, 200) },
    });
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  void recordSecurityEvent({
    eventType: "CRM_RESET_COMPLETED",
    userId: session.userId,
    clientId: params.clientId,
    sessionId: session.sessionId,
    ip,
    userAgent: ua,
    metadata: { deleted: result.deleted },
  });

  return NextResponse.json({ ok: true, deleted: result.deleted });
}
