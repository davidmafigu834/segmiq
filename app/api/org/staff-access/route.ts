import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/rbac/require";
import { P } from "@/lib/auth/rbac/permissions";
import { requireTenantClientId } from "@/lib/auth/tenant-context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  effectiveGrantStatus,
  listGrants,
  supportAccessScopeLabels,
} from "@/lib/security/support-access";

export const dynamic = "force-dynamic";

/**
 * Organisation-side transparency: Settings → Security → SegmiQ Staff Access.
 *
 * Shows the customer when SegmiQ staff held temporary access to their data, the
 * scope, and the window. Internal detail (platform reasons, admin user ids,
 * approval policy) is deliberately withheld.
 */
export async function GET(req: Request) {
  const gate = await requirePermission(P.SECURITY_AUDIT_READ, req);
  if ("error" in gate) return gate.error;

  const clientId = requireTenantClientId({
    userId: gate.auth.userId,
    role: gate.auth.role,
    clientId: gate.auth.clientId ?? null,
    isImpersonating: gate.auth.isImpersonating,
  });

  const grants = await listGrants({ clientId, limit: 50 });

  const adminIds = Array.from(new Set(grants.map((g) => g.adminUserId)));
  const names = new Map<string, string>();
  if (adminIds.length) {
    const supabase = createAdminClient();
    const { data } = await supabase.from("users").select("id, name").in("id", adminIds);
    for (const row of data ?? []) names.set(row.id as string, row.name as string);
  }

  return NextResponse.json({
    sessions: grants
      .filter((g) => g.status !== "PENDING" && g.status !== "DENIED")
      .map((g) => {
        const status = effectiveGrantStatus(g);
        return {
          reference: g.reference,
          staffName: names.get(g.adminUserId) ?? "SegmiQ support",
          purpose: g.accessKind === "BREAK_GLASS" ? "Emergency support" : "Technical support",
          scopeLabel: supportAccessScopeLabels(g.scopes),
          startedAt: g.startedAt,
          endedAt: g.revokedAt ?? g.expiresAt,
          status:
            status === "ACTIVE" ? "active" : status === "REVOKED" ? "ended" : "completed",
        };
      }),
  });
}
