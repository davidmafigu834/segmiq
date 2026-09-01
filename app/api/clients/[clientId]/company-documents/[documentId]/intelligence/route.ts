import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { loadDocumentIntelligenceBundle } from "@/lib/documents/intelligence";
import { getDocumentForActor, toDocumentActor } from "@/lib/documents/service";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { clientId: string; documentId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const actor = toDocumentActor(g.session);
  const access = await getDocumentForActor({
    clientId: params.clientId,
    documentId: params.documentId,
    actor,
  });

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const intelligence = await loadDocumentIntelligenceBundle({
    clientId: params.clientId,
    documentId: params.documentId,
    versionId: access.version?.id ?? null,
  });

  return NextResponse.json(intelligence);
}
