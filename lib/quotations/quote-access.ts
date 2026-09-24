import { getAuthFromRequest } from "@/lib/auth/getAuthFromRequest";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types";

type Actor = { id: string; name: string; role: UserRole };

type LeadScope = { client_id: string; assigned_to_id: string | null };

async function hasQuotationSupportAccess(
  userId: string,
  role: string,
  clientId: string
): Promise<boolean> {
  const { resolveSupportAccess } = await import("@/lib/security/support-access/guard");
  const access = await resolveSupportAccess({
    userId,
    role,
    isImpersonating: false,
    clientId,
    scope: "QUOTATIONS",
  });
  return access.granted;
}

/**
 * Quotations can be created/managed by the agency admin, the client manager
 * (for any lead in their client), and the assigned salesperson. This is
 * intentionally broader than canModifyLead (which makes managers read-only),
 * because managers are expected to build and send quotes too.
 */
export async function canManageQuotationForLead(
  leadId: string,
  req?: Request
): Promise<
  | { allowed: true; lead: LeadScope; actor: Actor }
  | { allowed: false; reason: string; status: 401 | 403 | 404 }
> {
  // Never fall through to getServerSession after MFA/auth denial.
  const session = await getAuthFromRequest(req);
  if (!session?.userId) return { allowed: false, reason: "Unauthorized", status: 401 };

  const { lookupDemoLead } = await import("@/lib/demo/acl");
  const demoLead = await lookupDemoLead(session.clientId, leadId);
  let scope: LeadScope;
  if (demoLead.mode === "demo") {
    if (!demoLead.row) return { allowed: false, reason: "Not found", status: 404 };
    scope = {
      client_id: demoLead.row.client_id,
      assigned_to_id: demoLead.row.assigned_to_id,
    };
  } else {
    const supabase = createAdminClient();
    const { data: lead } = await supabase
      .from("leads")
      .select("client_id, assigned_to_id")
      .eq("id", leadId)
      .maybeSingle();
    if (!lead) return { allowed: false, reason: "Not found", status: 404 };
    scope = {
      client_id: lead.client_id as string,
      assigned_to_id: (lead.assigned_to_id as string | null) ?? null,
    };
  }

  const actor: Actor = {
    id: session.userId,
    name: (session as { user?: { name?: string | null } }).user?.name ?? "Unknown",
    role: (session.role ?? "SALESPERSON") as UserRole,
  };

  if (session.role === "SUPER_ADMIN" && !session.isImpersonating) {
    const isRead = !req || req.method === "GET" || req.method === "HEAD";
    if (!isRead) return { allowed: false, reason: "Forbidden", status: 403 };
    const granted = await hasQuotationSupportAccess(session.userId, session.role, scope.client_id);
    return granted
      ? { allowed: true, lead: scope, actor }
      : { allowed: false, reason: "Forbidden", status: 403 };
  }
  if (session.role === "CLIENT_MANAGER") {
    if (session.clientId !== scope.client_id) return { allowed: false, reason: "Forbidden", status: 403 };
    return { allowed: true, lead: scope, actor };
  }
  if (session.role === "SALESPERSON") {
    if (session.clientId !== scope.client_id) {
      return { allowed: false, reason: "Not found", status: 404 };
    }
    if (scope.assigned_to_id !== session.userId) return { allowed: false, reason: "Forbidden", status: 403 };
    return { allowed: true, lead: scope, actor };
  }
  return { allowed: false, reason: "Forbidden", status: 403 };
}

/** Same access rules, resolved from a quotation id. */
export async function canManageQuotation(
  quotationId: string,
  req?: Request
): Promise<
  | { allowed: true; lead: LeadScope; actor: Actor; clientId: string; leadId: string }
  | { allowed: false; reason: string; status: 401 | 403 | 404 }
> {
  const session = await getAuthFromRequest(req);
  const { lookupDemoQuote } = await import("@/lib/demo/acl");
  const demoQuote = await lookupDemoQuote(session?.clientId, quotationId);
  if (demoQuote.mode === "demo") {
    if (!demoQuote.row) return { allowed: false, reason: "Not found", status: 404 };
    const inner = await canManageQuotationForLead(demoQuote.row.lead_id, req);
    if (!inner.allowed) return inner;
    return {
      allowed: true,
      lead: inner.lead,
      actor: inner.actor,
      clientId: demoQuote.row.client_id,
      leadId: demoQuote.row.lead_id,
    };
  }

  const supabase = createAdminClient();
  const { data: quote } = await supabase
    .from("quotations")
    .select("lead_id, client_id")
    .eq("id", quotationId)
    .maybeSingle();
  if (!quote) return { allowed: false, reason: "Not found", status: 404 };

  const inner = await canManageQuotationForLead(quote.lead_id as string, req);
  if (!inner.allowed) return inner;
  return {
    allowed: true,
    lead: inner.lead,
    actor: inner.actor,
    clientId: quote.client_id as string,
    leadId: quote.lead_id as string,
  };
}

/** Catalog & quote settings: writes restricted to manager/admin. */
export function canManageCatalog(role: string | null | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "CLIENT_MANAGER";
}
