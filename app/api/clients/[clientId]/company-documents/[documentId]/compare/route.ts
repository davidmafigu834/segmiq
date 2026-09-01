import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { compareDocumentVersionText } from "@/lib/documents/compare-versions";
import { hasDocumentPermission } from "@/lib/documents/permissions";
import { getDocumentForActor, getDocumentVersionContent, toDocumentActor } from "@/lib/documents/service";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { clientId: string; documentId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const actor = toDocumentActor(g.session);
  if (!hasDocumentPermission(actor, "documents.versions.view")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const url = new URL(req.url);
  const fromVersionId = url.searchParams.get("from");
  const toVersionId = url.searchParams.get("to");
  if (!fromVersionId || !toVersionId) {
    return NextResponse.json({ error: "from and to version ids are required." }, { status: 400 });
  }

  const access = await getDocumentForActor({
    clientId: params.clientId,
    documentId: params.documentId,
    actor,
    recordView: false,
  });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const [fromContent, toContent] = await Promise.all([
    getDocumentVersionContent(params.clientId, params.documentId, fromVersionId, actor),
    getDocumentVersionContent(params.clientId, params.documentId, toVersionId, actor),
  ]);

  if (!fromContent || !toContent) {
    return NextResponse.json({ error: "Version content not found." }, { status: 404 });
  }

  const diffs = compareDocumentVersionText(
    (fromContent.plain_text as string | null) ?? "",
    (toContent.plain_text as string | null) ?? ""
  );

  return NextResponse.json({ diffs });
}
