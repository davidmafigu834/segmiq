import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types";

type Actor = { id: string; name: string; role: UserRole };

type LeadScope = { client_id: string; assigned_to_id: string | null };

/**
 * Quotations can be created/managed by the agency admin, the client manager
 * (for any lead in their client), and the assigned salesperson. This is
 * intentionally broader than canModifyLead (which makes managers read-only),
 * because managers are expected to build and send quotes too.
 */
export async function canManageQuotationForLead(leadId: string): Promise<
  | { allowed: true; lead: LeadScope; actor: Actor }
  | { allowed: false; reason: string; status: 401 | 403 | 404 }
> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return { allowed: false, reason: "Unauthorized", status: 401 };

  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("client_id, assigned_to_id")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return { allowed: false, reason: "Not found", status: 404 };

  const scope: LeadScope = {
    client_id: lead.client_id as string,
    assigned_to_id: (lead.assigned_to_id as string | null) ?? null,
  };
  const actor: Actor = {
    id: session.userId,
    name: session.user?.name ?? "Unknown",
    role: (session.role ?? "SALESPERSON") as UserRole,
  };

  if (session.role === "AGENCY_ADMIN") return { allowed: true, lead: scope, actor };
  if (session.role === "CLIENT_MANAGER") {
    if (session.clientId !== scope.client_id) return { allowed: false, reason: "Forbidden", status: 403 };
    return { allowed: true, lead: scope, actor };
  }
  if (session.role === "SALESPERSON") {
    if (scope.assigned_to_id !== session.userId) return { allowed: false, reason: "Forbidden", status: 403 };
    return { allowed: true, lead: scope, actor };
  }
  return { allowed: false, reason: "Forbidden", status: 403 };
}

/** Same access rules, resolved from a quotation id. */
export async function canManageQuotation(quotationId: string): Promise<
  | { allowed: true; lead: LeadScope; actor: Actor; clientId: string; leadId: string }
  | { allowed: false; reason: string; status: 401 | 403 | 404 }
> {
  const supabase = createAdminClient();
  const { data: quote } = await supabase
    .from("quotations")
    .select("lead_id, client_id")
    .eq("id", quotationId)
    .maybeSingle();
  if (!quote) return { allowed: false, reason: "Not found", status: 404 };

  const inner = await canManageQuotationForLead(quote.lead_id as string);
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
  return role === "AGENCY_ADMIN" || role === "CLIENT_MANAGER";
}
