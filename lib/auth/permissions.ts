import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAuthFromRequest } from "@/lib/auth/getAuthFromRequest";
import { createAdminClient } from "@/lib/supabase/admin";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import type { UserRole } from "@/types";
import type { SupportAccessScope } from "@/lib/security/support-access/scopes";

export const CLIENT_MANAGER_READ_ONLY = "Client managers have read-only access";

/** API routes: require signed-in platform super admin. */
export async function requireSuperAdmin(): Promise<
  { ok: true; userId: string } | { error: string; status: number }
> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return { error: "Unauthorized", status: 401 };
  }
  if (session.role !== "SUPER_ADMIN") {
    return { error: "Forbidden", status: 403 };
  }
  return { ok: true, userId: session.userId };
}

/** @deprecated Use requireSuperAdmin */
export const requireAgencyAdmin = requireSuperAdmin;

type LeadScope = {
  client_id: string;
  assigned_to_id: string | null;
};

type AuthSession = {
  userId?: string | null;
  role?: UserRole | null;
  clientId?: string | null;
  alsoSells?: boolean | null;
  isImpersonating?: boolean | null;
};

/**
 * Platform-staff privileged access, resolved server-side from the Support Access
 * grant store. Never derived from request input.
 */
type PrivilegedLeadAccess = {
  /** An ACTIVE, unexpired, unrevoked grant for this lead's organisation with the LEADS scope. */
  supportAccessGranted?: boolean;
};

/**
 * Pure lead ACL after the row is loaded (Phase 6.1).
 * Tenant mismatch fails closed before assignment checks.
 *
 * SECURITY (Phase 7): SUPER_ADMIN is not an automatic pass. Platform staff need
 * an active Support Access grant covering this lead's organisation.
 */
export function evaluateLeadModifyAccess(
  session: AuthSession,
  scope: LeadScope,
  privileged: PrivilegedLeadAccess = {}
):
  | { allowed: true; lead: LeadScope; userId: string; role: UserRole }
  | { allowed: false; reason: string; status: 401 | 403 | 404 } {
  if (!session?.userId) {
    return { allowed: false, reason: "Unauthorized", status: 401 };
  }
  if (session.role === "SUPER_ADMIN" && !session.isImpersonating) {
    // Support Access is inspection-only. Writes go through impersonation.
    return {
      allowed: false,
      reason: "Support Access cannot modify customer records",
      status: 403,
    };
  }
  if (session.clientId !== scope.client_id) {
    return { allowed: false, reason: "Not found", status: 404 };
  }
  if (session.role === "CLIENT_MANAGER" && !canActAsSalesperson(session)) {
    return { allowed: false, reason: CLIENT_MANAGER_READ_ONLY, status: 403 };
  }
  if (canActAsSalesperson(session)) {
    if (scope.assigned_to_id !== session.userId) {
      return { allowed: false, reason: "Forbidden", status: 403 };
    }
    return {
      allowed: true,
      lead: scope,
      userId: session.userId,
      role: session.role as UserRole,
    };
  }
  return { allowed: false, reason: "Forbidden", status: 403 };
}

export function evaluateLeadReadAccess(
  session: AuthSession,
  scope: LeadScope,
  assignmentMode?: string | null,
  privileged: PrivilegedLeadAccess = {}
): { ok: true } | { ok: false; status: 401 | 403 | 404 } {
  if (!session?.userId) return { ok: false, status: 401 };
  if (session.role === "SUPER_ADMIN" && !session.isImpersonating) {
    return privileged.supportAccessGranted ? { ok: true } : { ok: false, status: 403 };
  }
  if (session.clientId !== scope.client_id) return { ok: false, status: 404 };
  if (session.role === "CLIENT_MANAGER") return { ok: true };
  if (canActAsSalesperson(session)) {
    if (scope.assigned_to_id === session.userId) return { ok: true };
    if (!scope.assigned_to_id && scope.client_id === session.clientId) {
      const mode = assignmentMode ?? "direct";
      if (mode === "pool" || mode === "direct") return { ok: true };
    }
    return { ok: false, status: 404 };
  }
  return { ok: false, status: 404 };
}

export function canReassignLeads(session: {
  userId?: string | null;
  role?: UserRole | null;
  clientId?: string | null;
}, clientId: string): boolean {
  if (!session?.userId) return false;
  if (session.role === "SUPER_ADMIN") return true;
  if (session.role === "CLIENT_MANAGER" && session.clientId === clientId) return true;
  return false;
}

/** Invite, deactivate, or remove salespeople on a client team.
 * Maps to permission `team.manage` (see lib/auth/rbac). */
export function canManageClientTeam(session: {
  userId?: string | null;
  role?: UserRole | null;
  clientId?: string | null;
}, clientId: string): boolean {
  return canReassignLeads(session, clientId);
}

export async function canModifyLead(
  leadId: string,
  req?: Request
): Promise<
  | { allowed: true; lead: LeadScope; userId: string; role: UserRole }
  | { allowed: false; reason: string; status: 401 | 403 | 404 }
> {
  // Never fall through to getServerSession after MFA/auth denial.
  const session = (await getAuthFromRequest(req)) as AuthSession | null;
  if (!session?.userId) {
    return { allowed: false, reason: "Unauthorized", status: 401 };
  }

  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("client_id, assigned_to_id")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) {
    return { allowed: false, reason: "Not found", status: 404 };
  }

  const scope: LeadScope = {
    client_id: lead.client_id as string,
    assigned_to_id: (lead.assigned_to_id as string | null) ?? null,
  };

  // SECURITY: the grant is resolved against the LEAD's organisation, so swapping
  // a lead id for another tenant's record cannot ride an existing grant (IDOR).
  return evaluateLeadModifyAccess(session, scope, {
    supportAccessGranted: await hasLeadSupportAccess(session, scope.client_id),
  });
}

/**
 * Resolve whether platform staff currently hold LEADS-scoped Support Access for
 * one organisation. Tenant users never reach this path.
 */
async function hasLeadSupportAccess(
  session: AuthSession,
  clientId: string,
  scope: SupportAccessScope = "LEADS"
): Promise<boolean> {
  if (session.role !== "SUPER_ADMIN" || session.isImpersonating) return false;
  if (!session.userId) return false;
  const { resolveSupportAccess } = await import("@/lib/security/support-access/guard");
  const access = await resolveSupportAccess({
    userId: session.userId,
    role: session.role,
    isImpersonating: Boolean(session.isImpersonating),
    clientId,
    scope,
  });
  return access.granted;
}

/**
 * Organisation *configuration* access: platform staff may administer any
 * organisation; everyone else only their own.
 *
 * SECURITY: this is not authorisation for client business data. Endpoints that
 * return leads, contacts, deals, conversations, quotations, documents or files
 * must additionally call requireClientDataAccess (lib/security/support-access).
 */
export function canAccessClient(
  userRole: string,
  userClientId: string | null,
  requestedClientId: string
): boolean {
  if (userRole === "SUPER_ADMIN") return true;
  return userClientId === requestedClientId;
}

/** Company profile & branding: managers and salespeople edit their own client; super admin can edit any. */
export function canManageClientProfile(role: string | null | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "CLIENT_MANAGER" || role === "SALESPERSON";
}

/** SegmiQ Cloud settings & team admin: managers on their client; super admin on any.
 * SECURITY: salespeople must not manage Cloud team or company settings. */
export function canManageCloudSettings(
  session: {
    userId?: string | null;
    role?: UserRole | null;
    clientId?: string | null;
  },
  clientId: string
): boolean {
  if (!session?.userId) return false;
  if (session.role === "SUPER_ADMIN") return true;
  if (session.role === "CLIENT_MANAGER" && session.clientId === clientId) {
    return true;
  }
  return false;
}

/** Client-side / role-only check for Cloud admin surfaces. */
export { isCloudAdminRole } from "@/lib/auth/roles";

/** Read access: wrong scope returns notFound (404) to avoid leaking lead existence. */
export async function canReadLead(
  leadId: string,
  req?: Request,
  /**
   * Scope platform staff must hold for this surface. Conversation and quotation
   * endpoints pass their own category so a LEADS-only grant cannot read them.
   */
  options?: { scope?: SupportAccessScope }
): Promise<{ ok: true } | { ok: false; status: 401 | 403 | 404 }> {
  // Never fall through to getServerSession after MFA/auth denial.
  const session = (await getAuthFromRequest(req)) as AuthSession | null;
  if (!session?.userId) {
    return { ok: false, status: 401 };
  }

  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("client_id, assigned_to_id")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) {
    return { ok: false, status: 404 };
  }

  const scope: LeadScope = {
    client_id: lead.client_id as string,
    assigned_to_id: (lead.assigned_to_id as string | null) ?? null,
  };

  if (session.role === "SUPER_ADMIN" && !session.isImpersonating) {
    // SECURITY: resolved against the lead's own organisation — a grant for
    // organisation A can never unlock a record owned by organisation B.
    return (await hasLeadSupportAccess(session, scope.client_id, options?.scope))
      ? { ok: true }
      : { ok: false, status: 403 };
  }

  if (session.clientId !== lead.client_id) {
    return { ok: false, status: 404 };
  }

  if (session.role === "CLIENT_MANAGER") {
    return { ok: true };
  }

  if (canActAsSalesperson(session)) {
    if (lead.assigned_to_id === session.userId) {
      return { ok: true };
    }
    if (!lead.assigned_to_id && lead.client_id === session.clientId) {
      const { data: client } = await supabase
        .from("clients")
        .select("assignment_mode")
        .eq("id", lead.client_id as string)
        .maybeSingle();
      return evaluateLeadReadAccess(
        session,
        scope,
        (client?.assignment_mode as string | null) ?? "direct"
      );
    }
    return { ok: false, status: 404 };
  }

  return { ok: false, status: 404 };
}
