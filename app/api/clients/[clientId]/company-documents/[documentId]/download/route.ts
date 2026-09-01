import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { signDocumentDownload, toDocumentActor } from "@/lib/documents/service";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { clientId: string; documentId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const versionId = new URL(req.url).searchParams.get("versionId") ?? undefined;

  const result = await signDocumentDownload({
    clientId: params.clientId,
    documentId: params.documentId,
    actor: toDocumentActor(g.session),
    versionId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ url: result.url });
}
