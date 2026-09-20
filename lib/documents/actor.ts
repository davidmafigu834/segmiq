import type { NextResponse } from "next/server";
import { requirePrivilegedTenantAccess } from "@/lib/security/support-access/guard";
import type { DocumentActor } from "@/lib/documents/types";

/**
 * Build the document actor for one organisation.
 *
 * Tenant users keep their existing document permissions. Platform staff get an
 * actor whose permissions come from a verified Support Access grant — with no
 * grant the guard denies the request, so issuing a download URL, opening a
 * contract, or reading extracted content all fail closed.
 *
 * Enforcement lives in requirePrivilegedTenantAccess; this only translates the
 * verified context into the shape the documents module already consumes.
 */
export async function resolveDocumentActor(
  req: Request,
  clientId: string
): Promise<{ ok: true; actor: DocumentActor } | { ok: false; response: NextResponse }> {
  const result = await requirePrivilegedTenantAccess({
    req,
    clientId,
    scope: "DOCUMENTS",
    resourceType: "document",
    // The route records the specific view/download event once it succeeds.
    skipAudit: true,
  });

  if (!result.ok) return { ok: false, response: result.error };

  const { auth, grant, isTenantMember } = result.context;

  return {
    ok: true,
    actor: {
      userId: auth.userId,
      role: auth.role,
      clientId: auth.clientId ?? null,
      isImpersonating: Boolean(auth.isImpersonating),
      supportAccessScopes: isTenantMember ? undefined : grant?.scopes,
      supportAccessClientId: isTenantMember ? undefined : clientId,
    },
  };
}
