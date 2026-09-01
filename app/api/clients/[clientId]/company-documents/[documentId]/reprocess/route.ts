import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { requestDocumentReprocess, toDocumentActor } from "@/lib/documents/service";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(
  req: Request,
  { params }: { params: { clientId: string; documentId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const result = await requestDocumentReprocess({
    clientId: params.clientId,
    documentId: params.documentId,
    actor: toDocumentActor(g.session),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, jobId: result.jobId });
}
