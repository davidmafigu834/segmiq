import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { listDocumentsFiltered } from "@/lib/documents/list-service";
import { toDocumentActor } from "@/lib/documents/service";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const offset = Number(url.searchParams.get("offset") ?? "0");
  const includeArchived = url.searchParams.get("includeArchived") === "true";
  const q = url.searchParams.get("q") ?? undefined;
  const collection = url.searchParams.get("collection") ?? undefined;
  const lifecycleStatus = url.searchParams.get("lifecycleStatus") ?? undefined;
  const processingStatus = url.searchParams.get("processingStatus") ?? undefined;
  const documentTypeId = url.searchParams.get("documentTypeId") ?? undefined;
  const summaryOnly = url.searchParams.get("summary") === "true";
  const typesOnly = url.searchParams.get("types") === "true";

  const actor = toDocumentActor(g.session);

  if (typesOnly) {
    const { listDocumentTypes } = await import("@/lib/documents/service");
    const types = await listDocumentTypes(params.clientId);
    return NextResponse.json({ types });
  }

  if (summaryOnly) {
    const { getDocumentsHomeSummary } = await import("@/lib/documents/list-service");
    const summary = await getDocumentsHomeSummary(params.clientId, actor);
    return NextResponse.json({ summary });
  }

  try {
    const { documents, total } = await listDocumentsFiltered({
      clientId: params.clientId,
      actor,
      limit,
      offset,
      filters: {
        q,
        collection,
        lifecycleStatus,
        processingStatus,
        documentTypeId,
        includeArchived,
      },
    });
    return NextResponse.json({ documents, total });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list documents.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
