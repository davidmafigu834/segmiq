import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/rbac/require";
import { P } from "@/lib/auth/rbac/permissions";
import {
  findGrantById,
  listGrantEvents,
  supportAccessEventLabel,
} from "@/lib/security/support-access";

export const dynamic = "force-dynamic";

/** Event timeline for one grant. Identifiers and outcomes only. */
export async function GET(req: Request, { params }: { params: { grantId: string } }) {
  const gate = await requirePermission(P.SUPPORT_ACCESS_AUDIT_READ, req);
  if ("error" in gate) return gate.error;

  const grant = await findGrantById(params.grantId);
  if (!grant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const events = await listGrantEvents(grant.id);
  return NextResponse.json({
    grant: {
      id: grant.id,
      reference: grant.reference,
      status: grant.status,
      organisationId: grant.clientId,
      scopes: grant.scopes,
      reason: grant.reason,
      ticketReference: grant.ticketReference,
      requestedAt: grant.requestedAt,
      startedAt: grant.startedAt,
      expiresAt: grant.expiresAt,
      revokedAt: grant.revokedAt,
    },
    events: events.map((e) => ({
      id: e.id,
      at: e.createdAt,
      type: e.eventType,
      label: supportAccessEventLabel(e),
      scope: e.scope,
      outcome: e.outcome,
    })),
  });
}
