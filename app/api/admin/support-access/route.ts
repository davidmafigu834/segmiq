import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/rbac/require";
import { P } from "@/lib/auth/rbac/permissions";
import { assertBrowserOrigin } from "@/lib/auth/origin-check";
import { isMfaEnabled } from "@/lib/auth/mfa/service";
import {
  clientIpFromRequest,
  userAgentFromRequest,
} from "@/lib/auth/user-sessions";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createGrant,
  listGrants,
  resolveApprovalMode,
  validateSupportAccessRequest,
} from "@/lib/security/support-access";

export const dynamic = "force-dynamic";

/** Support Access log. Reason text is internal support metadata, not customer data. */
export async function GET(req: Request) {
  const gate = await requirePermission(P.SUPPORT_ACCESS_AUDIT_READ, req);
  if ("error" in gate) return gate.error;

  const url = new URL(req.url);
  const clientId = url.searchParams.get("clientId");
  const grants = await listGrants({ clientId: clientId || null, limit: 200 });

  return NextResponse.json({
    approvalMode: resolveApprovalMode(),
    grants: grants.map((g) => ({
      id: g.id,
      reference: g.reference,
      administrator: g.adminName,
      administratorId: g.adminUserId,
      organisation: g.clientName,
      organisationId: g.clientId,
      status: g.status,
      accessKind: g.accessKind,
      approvalMode: g.approvalMode,
      scopes: g.scopes,
      reason: g.reason,
      ticketReference: g.ticketReference,
      durationMinutes: g.durationMinutes,
      requestedAt: g.requestedAt,
      startedAt: g.startedAt,
      expiresAt: g.expiresAt,
      revokedAt: g.revokedAt,
      deniedAt: g.deniedAt,
    })),
  });
}

/** Request Support Access for one organisation. */
export async function POST(req: Request) {
  const origin = assertBrowserOrigin(req);
  if (!origin.ok) {
    return NextResponse.json({ error: origin.error }, { status: origin.status });
  }

  const gate = await requirePermission(P.SUPPORT_ACCESS_REQUEST, req);
  if ("error" in gate) return gate.error;
  const { auth } = gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = validateSupportAccessRequest(body as Record<string, unknown>);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  if (parsed.value.accessKind === "BREAK_GLASS") {
    const breakGlass = await requirePermission(P.PLATFORM_BREAK_GLASS, req);
    if ("error" in breakGlass) return breakGlass.error;
    if (!(await isMfaEnabled(auth.userId))) {
      return NextResponse.json(
        { error: "Enable two-step verification before using emergency access" },
        { status: 403 }
      );
    }
  }

  // The organisation must exist and be a real tenant before a grant is created.
  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", parsed.value.clientId)
    .maybeSingle();
  if (!client) {
    return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
  }

  const result = await createGrant({
    adminUserId: auth.userId,
    adminRole: auth.role,
    clientId: parsed.value.clientId,
    reason: parsed.value.reason,
    ticketReference: parsed.value.ticketReference,
    scopes: parsed.value.scopes,
    durationMinutes: parsed.value.durationMinutes,
    accessKind: parsed.value.accessKind,
    sessionId: auth.sessionId ?? null,
    ip: clientIpFromRequest(req),
    userAgent: userAgentFromRequest(req),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    grant: {
      id: result.grant.id,
      reference: result.grant.reference,
      status: result.grant.status,
      organisationId: result.grant.clientId,
      organisation: client.name as string,
      scopes: result.grant.scopes,
      expiresAt: result.grant.expiresAt,
      durationMinutes: result.grant.durationMinutes,
      approvalMode: result.grant.approvalMode,
    },
  });
}
