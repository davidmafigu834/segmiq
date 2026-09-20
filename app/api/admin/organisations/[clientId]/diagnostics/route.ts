import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/auth/rbac/require";
import { P } from "@/lib/auth/rbac/permissions";
import { fetchOrganisationDiagnostics } from "@/lib/security/support-access/diagnostics";

export const dynamic = "force-dynamic";

/**
 * Operational metadata for one organisation.
 *
 * Available to platform staff WITHOUT Support Access: counts, health states,
 * error codes, timestamps. Contains no customer records or integration secrets.
 */
export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const gate = await requireAnyPermission(
    [P.PLATFORM_CLIENTS_READ, P.PLATFORM_INTEGRATIONS_DIAGNOSE],
    req
  );
  if ("error" in gate) return gate.error;

  const diagnostics = await fetchOrganisationDiagnostics(params.clientId);
  if (!diagnostics) {
    return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
  }

  return NextResponse.json(diagnostics);
}
