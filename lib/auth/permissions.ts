import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAuthFromRequest } from "@/lib/auth/getAuthFromRequest";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types";

export const CLIENT_MANAGER_READ_ONLY = "Client managers have read-only access";

/** API routes: require signed-in agency admin. */
export async function requireAgencyAdmin(): Promise<
  { ok: true; userId: string } | { error: string; status: number }
> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return { error: "Unauthorized", status: 401 };
  }
  if (session.role !== "AGENCY_ADMIN") {
    return { error: "Forbidden", status: 403 };
  }
  return { ok: true, userId: session.userId };
}

type LeadScope = {
  client_id: string;
  assigned_to_id: string | null;
};

export function canReassignLeads(session: {
  userId?: string | null;
  role?: UserRole | null;
  clientId?: string | null;
}, clientId: string): boolean {
  if (!session?.userId) return false;
  if (session.role === "AGENCY_ADMIN") return true;
  if (session.role === "CLIENT_MANAGER" && session.clientId === clientId) return true;
  return false;
}

/** Invite, deactivate, or remove salespeople on a client team. */
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
  const auth = req ? await getAuthFromRequest(req) : null;
  const session = auth ?? (await getServerSession(authOptions));
  if (!session?.userId) {
    return { allowed: false, reason: "Unauthorized", status: 401 };
  }
  if (session.role === "CLIENT_MANAGER") {
    return { allowed: false, reason: CLIENT_MANAGER_READ_ONLY, status: 403 };
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

  if (session.role === "AGENCY_ADMIN") {
    return { allowed: true, lead: scope, userId: session.userId, role: session.role };
  }

  if (session.role === "SALESPERSON") {
    if (scope.assigned_to_id !== session.userId) {
      return { allowed: false, reason: "Forbidden", status: 403 };
    }
    return { allowed: true, lead: scope, userId: session.userId, role: session.role };
  }

  return { allowed: false, reason: "Forbidden", status: 403 };
}

/** Client-scoped resource access: agency admin can touch any client; everyone else only their own. */
export function canAccessClient(
  userRole: string,
  userClientId: string | null,
  requestedClientId: string
): boolean {
  if (userRole === "AGENCY_ADMIN") return true;
  return userClientId === requestedClientId;
}

/** Company profile & branding: managers edit their own client; agency admin can edit any. */
export function canManageClientProfile(role: string | null | undefined): boolean {
  return role === "AGENCY_ADMIN" || role === "CLIENT_MANAGER";
}

/** SegmiQ Cloud settings, billing, team invites: managers on their client; agency admin on any. */
export function canManageCloudSettings(
  session: {
    userId?: string | null;
    role?: UserRole | null;
    clientId?: string | null;
  },
  clientId: string
): boolean {
  if (!session?.userId) return false;
  if (session.role === "AGENCY_ADMIN") return true;
  if (session.role === "CLIENT_MANAGER" && session.clientId === clientId) return true;
  return false;
}

/** Client-side / role-only check for Cloud admin surfaces. */
export { isCloudAdminRole } from "@/lib/auth/roles";

/** Read access: wrong scope returns notFound (404) to avoid leaking lead existence. */
export async function canReadLead(
  leadId: string,
  req?: Request
): Promise<{ ok: true } | { ok: false; status: 401 | 404 }> {
  const auth = req ? await getAuthFromRequest(req) : null;
  const session = auth ?? (await getServerSession(authOptions));
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

  if (session.role === "AGENCY_ADMIN") {
    return { ok: true };
  }

  if (session.role === "CLIENT_MANAGER") {
    if (lead.client_id !== session.clientId) {
      return { ok: false, status: 404 };
    }
    return { ok: true };
  }

  if (session.role === "SALESPERSON") {
    if (lead.assigned_to_id === session.userId) {
      return { ok: true };
    }
    if (
      !lead.assigned_to_id &&
      lead.client_id === session.clientId
    ) {
      const { data: client } = await supabase
        .from("clients")
        .select("assignment_mode")
        .eq("id", lead.client_id as string)
        .maybeSingle();
      const mode = (client?.assignment_mode as string | null) ?? "direct";
      if (mode === "pool" || mode === "direct") {
        return { ok: true };
      }
    }
    return { ok: false, status: 404 };
  }

  return { ok: false, status: 404 };
}
