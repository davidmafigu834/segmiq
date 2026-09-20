import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/rbac/require";
import { P } from "@/lib/auth/rbac/permissions";
import { assertBrowserOrigin } from "@/lib/auth/origin-check";
import {
  clientIpFromRequest,
  userAgentFromRequest,
} from "@/lib/auth/user-sessions";
import { approveGrant, denyGrant } from "@/lib/security/support-access";

export const dynamic = "force-dynamic";

/**
 * Approve or deny a PENDING request.
 * Used under SECOND_ADMIN_REQUIRED and CLIENT_APPROVAL policy modes.
 */
export async function POST(req: Request, { params }: { params: { grantId: string } }) {
  const origin = assertBrowserOrigin(req);
  if (!origin.ok) {
    return NextResponse.json({ error: origin.error }, { status: origin.status });
  }

  const gate = await requirePermission(P.SUPPORT_ACCESS_APPROVE, req);
  if ("error" in gate) return gate.error;

  let body: { decision?: unknown; reason?: unknown };
  try {
    body = (await req.json()) as { decision?: unknown; reason?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (body.decision === "DENY") {
    const denied = await denyGrant({
      grantId: params.grantId,
      deciderUserId: gate.auth.userId,
      reason: typeof body.reason === "string" ? body.reason : null,
    });
    if (!denied.ok) {
      return NextResponse.json({ error: denied.error }, { status: denied.status });
    }
    return NextResponse.json({ ok: true, grant: { id: denied.grant.id, status: "DENIED" } });
  }

  if (body.decision !== "APPROVE") {
    return NextResponse.json({ error: "decision must be APPROVE or DENY" }, { status: 400 });
  }

  const approved = await approveGrant({
    grantId: params.grantId,
    approverUserId: gate.auth.userId,
    approverKind: "PLATFORM_ADMIN",
    ip: clientIpFromRequest(req),
    userAgent: userAgentFromRequest(req),
  });
  if (!approved.ok) {
    return NextResponse.json({ error: approved.error }, { status: approved.status });
  }

  return NextResponse.json({
    ok: true,
    grant: {
      id: approved.grant.id,
      status: approved.grant.status,
      expiresAt: approved.grant.expiresAt,
    },
  });
}
