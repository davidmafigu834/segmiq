import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { dueDiligenceEnabled } from "@/lib/real-estate/due-diligence/flag";
import { documentTypeSchema } from "@/lib/real-estate/due-diligence/schema";
import { addDocument, type DueDiligenceActor } from "@/lib/real-estate/due-diligence/service";

export const dynamic = "force-dynamic";

function actorFrom(session: { userId: string; role: string; user?: { name?: string | null } }): DueDiligenceActor {
  return { id: session.userId, role: session.role, name: session.user?.name ?? "Agent" };
}

export async function POST(req: Request, { params }: { params: { clientId: string; mandateId: string } }) {
  if (!dueDiligenceEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const guard = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in guard && guard.error) return guard.error;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const parsedType = documentTypeSchema.safeParse(form?.get("documentType"));
  if (!parsedType.success) return NextResponse.json({ error: "Choose a document type." }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer());
  const result = await addDocument({
    clientId: params.clientId,
    mandateId: params.mandateId,
    actor: actorFrom(guard.session),
    documentType: parsedType.data,
    fileName: file.name || "document",
    contentType: file.type || "application/octet-stream",
    bytes,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ document: result.document }, { status: 201 });
}
