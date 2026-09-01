import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { hasDocumentPermission } from "@/lib/documents/permissions";
import { searchDocuments } from "@/lib/documents/retrieval";
import { toDocumentActor } from "@/lib/documents/service";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const actor = toDocumentActor(g.session);
  if (!hasDocumentPermission(actor, "documents.ask")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ error: "Query parameter q is required." }, { status: 400 });
  }

  const limit = Number(url.searchParams.get("limit") ?? "25");
  const offset = Number(url.searchParams.get("offset") ?? "0");
  const lifecycleStatus = url.searchParams.get("lifecycleStatus") ?? undefined;
  const processingStatus = url.searchParams.get("processingStatus") ?? undefined;
  const documentTypeId = url.searchParams.get("documentTypeId") ?? undefined;
  const entityType = url.searchParams.get("entityType") ?? undefined;
  const entityId = url.searchParams.get("entityId") ?? undefined;
  const documentId = url.searchParams.get("documentId") ?? undefined;

  const result = await searchDocuments({
    clientId: params.clientId,
    actor: toDocumentActor(g.session),
    query: q,
    limit,
    offset,
    filters: {
      lifecycleStatus,
      processingStatus,
      documentTypeId,
      entityType,
      entityId,
      documentId,
    },
  });

  return NextResponse.json(result);
}
