import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/rbac/require";
import { P } from "@/lib/auth/rbac/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  effectiveGrantStatus,
  grantRemainingMs,
  listActiveGrantsForAdmin,
} from "@/lib/security/support-access";

export const dynamic = "force-dynamic";

/**
 * The administrator's own live grants — drives the privileged-mode banner.
 * The server expiry is authoritative; the client timer is informational.
 */
export async function GET(req: Request) {
  const gate = await requirePermission(P.SUPPORT_ACCESS_REQUEST, req);
  if ("error" in gate) return gate.error;

  const grants = await listActiveGrantsForAdmin(gate.auth.userId);
  const live = grants.filter((g) => effectiveGrantStatus(g) === "ACTIVE");

  const names = new Map<string, string>();
  if (live.length) {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("clients")
      .select("id, name")
      .in("id", live.map((g) => g.clientId));
    for (const row of data ?? []) names.set(row.id as string, row.name as string);
  }

  return NextResponse.json({
    sessions: live.map((g) => ({
      id: g.id,
      reference: g.reference,
      organisationId: g.clientId,
      organisation: names.get(g.clientId) ?? null,
      scopes: g.scopes,
      accessKind: g.accessKind,
      expiresAt: g.expiresAt,
      remainingMs: grantRemainingMs(g),
    })),
    pending: grants
      .filter((g) => effectiveGrantStatus(g) === "PENDING")
      .map((g) => ({
        id: g.id,
        reference: g.reference,
        organisationId: g.clientId,
        scopes: g.scopes,
      })),
  });
}
