import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { listDocumentActivity } from "@/lib/documents/list-service";
import { toDocumentActor } from "@/lib/documents/service";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { clientId: string; documentId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const limit = Number(new URL(req.url).searchParams.get("limit") ?? "50");

  const activity = await listDocumentActivity({
    clientId: params.clientId,
    documentId: params.documentId,
    actor: toDocumentActor(g.session),
    limit,
  });

  return NextResponse.json({ activity });
}
