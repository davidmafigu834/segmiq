import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAuthFromRequest } from "@/lib/auth/getAuthFromRequest";
import { hasPermission, P, type AuthzContext } from "@/lib/auth/rbac";
import { requirePermission } from "@/lib/auth/rbac/require";
import { isSuperAdminRole } from "@/lib/auth/roles";
import { requireTenantClientId, TenantContextError } from "@/lib/auth/tenant-context";
import { requireClientDataAccess } from "@/lib/security/support-access";

export type TeamReportAction = "view" | "download" | "generate";

function permissionFor(action: TeamReportAction) {
  if (action === "download") return P.REPORTS_TEAM_DOWNLOAD;
  if (action === "generate") return P.REPORTS_TEAM_GENERATE;
  return P.REPORTS_TEAM_VIEW;
}

export async function requireTeamReportAccess(
  req: Request,
  action: TeamReportAction
): Promise<{ ok: true; clientId: string; auth: AuthzContext } | { error: NextResponse }> {
  const permission = permissionFor(action);
  const authFromReq = await getAuthFromRequest(req);
  const session = authFromReq ? null : await getServerSession(authOptions);
  const role = authFromReq?.role ?? session?.role;
  const isPlatform = isSuperAdminRole(role) && !authFromReq?.isImpersonating && !session?.isImpersonating;

  if (isPlatform) {
    if (action === "generate") {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
    const url = new URL(req.url);
    const clientId = url.searchParams.get("clientId");
    const access = await requireClientDataAccess({
      req,
      clientId,
      scope: "CUSTOMER_PROFILES",
      resourceType: "weekly_team_report",
    });
    if (access.error) return { error: access.error };
    return {
      ok: true,
      clientId: access.context.clientId,
      auth: {
        userId: access.context.auth.userId,
        role: access.context.auth.role,
        clientId: access.context.auth.clientId ?? access.context.clientId,
        alsoSells: access.context.auth.alsoSells,
        isImpersonating: Boolean(access.context.auth.isImpersonating),
      },
    };
  }

  const gate = await requirePermission(permission, req);
  if ("error" in gate) return { error: gate.error };
  if (gate.auth.role === "SALESPERSON") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  try {
    const clientId = requireTenantClientId(gate.auth);
    if (!hasPermission(gate.auth, permission)) {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
    return { ok: true, clientId, auth: gate.auth };
  } catch (err) {
    if (err instanceof TenantContextError) {
      return { error: NextResponse.json({ error: err.message }, { status: err.status }) };
    }
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
}
