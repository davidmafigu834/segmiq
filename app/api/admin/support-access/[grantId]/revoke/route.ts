import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/auth/rbac/require";
import { P } from "@/lib/auth/rbac/permissions";
import { assertBrowserOrigin } from "@/lib/auth/origin-check";
import {
  clientIpFromRequest,
  userAgentFromRequest,
} from "@/lib/auth/user-sessions";
import { findGrantById, revokeGrant } from "@/lib/security/support-access";

export const dynamic = "force-dynamic";

/** End Support Access immediately. Own grants, or any grant with revoke authority. */
export async function POST(req: Request, { params }: { params: { grantId: string } }) {
  const origin = assertBrowserOrigin(req);
  if (!origin.ok) {
    return NextResponse.json({ error: origin.error }, { status: origin.status });
  }

  const gate = await requireAnyPermission(
    [P.SUPPORT_ACCESS_REQUEST, P.SUPPORT_ACCESS_REVOKE],
    req
  );
  if ("error" in gate) return gate.error;
  const { auth } = gate;

  const grant = await findGrantById(params.grantId);
  if (!grant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Ending someone else's session requires explicit revoke authority.
  if (grant.adminUserId !== auth.userId) {
    const revoker = await requireAnyPermission([P.SUPPORT_ACCESS_REVOKE], req);
    if ("error" in revoker) return revoker.error;
  }

  const result = await revokeGrant({
    grantId: grant.id,
    actorUserId: auth.userId,
    actorRole: auth.role,
    reason: grant.adminUserId === auth.userId ? "ENDED_BY_ADMINISTRATOR" : "REVOKED_BY_PLATFORM",
    ip: clientIpFromRequest(req),
    userAgent: userAgentFromRequest(req),
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    grant: { id: result.grant.id, status: "REVOKED", organisationId: result.grant.clientId },
  });
}
