import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionFromRequest } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission, type PermissionActor } from "@/lib/auth/rbac/resolve";
import { P } from "@/lib/auth/rbac/permissions";
import {
  DEFAULT_ORG_SECURITY_POLICY,
  parseOrgSecurityPolicy,
  type OrgSecurityPolicy,
} from "@/lib/auth/org-security-policy";
import { assertBrowserOrigin } from "@/lib/auth/origin-check";
import { requireElevatedSession } from "@/lib/auth/step-up";
import { recordSecurityEvent } from "@/lib/auth/security-events";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/auth/user-sessions";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  mfaRequirement: z.enum(["off", "managers", "all"]).optional(),
  idleTtlHours: z.number().nullable().optional(),
  absoluteTtlHours: z.number().nullable().optional(),
  mfaGraceUntil: z.string().nullable().optional(),
  allowDataExports: z.boolean().optional(),
});

function actor(session: PermissionActor): PermissionActor {
  return {
    userId: session.userId,
    role: session.role,
    clientId: session.clientId,
    alsoSells: session.alsoSells,
    isImpersonating: Boolean(session.isImpersonating),
  };
}

/** GET organisation security policy for the caller's tenant. */
export async function GET(req: Request) {
  const g = await requireSessionFromRequest(req);
  if ("error" in g) return g.error;

  if (
    !hasPermission(actor(g.session), P.SECURITY_SETTINGS_MANAGE) &&
    !hasPermission(actor(g.session), P.SECURITY_AUDIT_READ)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clientId = g.session.clientId;
  if (!clientId) {
    return NextResponse.json({ error: "No organisation context" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("clients")
    .select("security_policy, security_suspended_at")
    .eq("id", clientId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const policy = parseOrgSecurityPolicy(data.security_policy);
  return NextResponse.json({
    policy,
    defaults: DEFAULT_ORG_SECURITY_POLICY,
    securitySuspendedAt: data.security_suspended_at ?? null,
  });
}

/** PATCH organisation security policy (managers). */
export async function PATCH(req: Request) {
  const origin = assertBrowserOrigin(req);
  if (!origin.ok) {
    return NextResponse.json({ error: origin.error }, { status: origin.status });
  }

  const g = await requireSessionFromRequest(req);
  if ("error" in g) return g.error;

  if (!hasPermission(actor(g.session), P.SECURITY_SETTINGS_MANAGE)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const elev = await requireElevatedSession({
    sessionId: g.session.sessionId,
    userId: g.session.userId,
  });
  if (!elev.ok) {
    return NextResponse.json({ error: elev.error }, { status: elev.status });
  }

  const clientId = g.session.clientId;
  if (!clientId) {
    return NextResponse.json({ error: "No organisation context" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid policy", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("clients")
    .select("security_policy")
    .eq("id", clientId)
    .maybeSingle();

  const current = parseOrgSecurityPolicy(existing?.security_policy);
  const merged: OrgSecurityPolicy = parseOrgSecurityPolicy({
    ...current,
    ...parsed.data,
  });

  const { error } = await supabase
    .from("clients")
    .update({
      security_policy: merged,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  void recordSecurityEvent({
    eventType: "ORG_SECURITY_POLICY_UPDATED",
    userId: g.session.userId,
    clientId,
    sessionId: g.session.sessionId,
    ip: clientIpFromRequest(req),
    userAgent: userAgentFromRequest(req),
    metadata: {
      mfaRequirement: merged.mfaRequirement,
      idleTtlHours: merged.idleTtlHours,
      absoluteTtlHours: merged.absoluteTtlHours,
      allowDataExports: merged.allowDataExports,
    },
  });

  return NextResponse.json({ ok: true, policy: merged });
}
