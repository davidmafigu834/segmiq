import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { listDocumentsForEntity } from "@/lib/documents/list-service";
import { toDocumentActor } from "@/lib/documents/service";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType");
  const entityId = url.searchParams.get("entityId");
  if (!entityType || !entityId) {
    return NextResponse.json({ error: "entityType and entityId are required." }, { status: 400 });
  }

  const limit = Number(url.searchParams.get("limit") ?? "8");
  const result = await listDocumentsForEntity({
    clientId: params.clientId,
    actor: toDocumentActor(g.session),
    entityType,
    entityId,
    limit,
  });

  return NextResponse.json(result);
}
