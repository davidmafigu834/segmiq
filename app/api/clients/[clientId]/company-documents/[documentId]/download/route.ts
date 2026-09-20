import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { signDocumentDownload } from "@/lib/documents/service";
import { resolveDocumentActor } from "@/lib/documents/actor";
import { recordSupportAccessEvent } from "@/lib/security/support-access";
import { isSuperAdminRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

/**
 * Issuing the signed URL is itself the privileged action — URL secrecy is not
 * the control. Platform staff need a DOCUMENTS/FILES-scoped grant.
 */
export async function GET(
  req: Request,
  { params }: { params: { clientId: string; documentId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const resolved = await resolveDocumentActor(req, params.clientId);
  if (!resolved.ok) return resolved.response;

  const versionId = new URL(req.url).searchParams.get("versionId") ?? undefined;

  const result = await signDocumentDownload({
    clientId: params.clientId,
    documentId: params.documentId,
    actor: resolved.actor,
    versionId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (isSuperAdminRole(resolved.actor.role) && !resolved.actor.isImpersonating) {
    void recordSupportAccessEvent({
      eventType: "CLIENT_FILE_DOWNLOADED",
      clientId: params.clientId,
      actorUserId: resolved.actor.userId,
      actorRole: resolved.actor.role,
      scope: "DOCUMENTS",
      resourceType: "document",
      resourceId: params.documentId,
    });
  }

  return NextResponse.json({ url: result.url });
}
