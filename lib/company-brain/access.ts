import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import { isSuperAdminRole } from "@/lib/auth/roles";
import { resolveSupportAccess } from "@/lib/security/support-access/guard";

/**
 * Company Brain holds the organisation's own knowledge base: customer records,
 * playbooks, examples and operational rules. It is client business data, so
 * platform staff need an AGENT_ACTIVITY-scoped Support Access grant for the
 * requested organisation — the SUPER_ADMIN role alone no longer suffices.
 */
export async function requireCompanyBrainManager(req: Request): Promise<
  | { ok: true; clientId: string; userId: string; role: string }
  | { ok: false; status: number; error: string; code?: string }
> {
  const auth = await resolveApiAuth(req);
  if (!auth) return { ok: false, status: 401, error: "Unauthorized" };
  const url = new URL(req.url);
  const requested = url.searchParams.get("clientId");
  if (isSuperAdminRole(auth.role) && !auth.isImpersonating) {
    const clientId = requested ?? auth.clientId;
    if (!clientId) return { ok: false, status: 400, error: "clientId required" };
    const access = await resolveSupportAccess({
      userId: auth.userId,
      role: auth.role,
      isImpersonating: false,
      clientId,
      scope: "AGENT_ACTIVITY",
    });
    if (!access.granted) {
      return {
        ok: false,
        status: 403,
        code: "SUPPORT_ACCESS_REQUIRED",
        error:
          "This organisation's Company Brain is restricted. Start Support Access with the Agent activity scope.",
      };
    }
    return { ok: true, clientId, userId: auth.userId, role: auth.role };
  }
  if (auth.role !== "CLIENT_MANAGER" || !auth.clientId) {
    return { ok: false, status: 403, error: "Only company managers can manage Company Brain" };
  }
  if (requested && requested !== auth.clientId) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return { ok: true, clientId: auth.clientId, userId: auth.userId, role: auth.role };
}
