import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { confirmDocumentEntityLink, removeDocumentEntityLink } from "@/lib/documents/linking";
import { canEditDocument } from "@/lib/documents/permissions";
import { toDocumentActor } from "@/lib/documents/service";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  action: z.enum(["confirm", "remove"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: { clientId: string; documentId: string; linkId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const actor = toDocumentActor(g.session);
  if (!canEditDocument(actor)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (parsed.data.action === "remove") {
    const ok = await removeDocumentEntityLink({
      clientId: params.clientId,
      documentId: params.documentId,
      linkId: params.linkId,
    });
    if (!ok) return NextResponse.json({ error: "Link not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  const ok = await confirmDocumentEntityLink({
    clientId: params.clientId,
    documentId: params.documentId,
    linkId: params.linkId,
    actorUserId: g.session.userId,
  });
  if (!ok) return NextResponse.json({ error: "Link not found." }, { status: 404 });

  return NextResponse.json({ ok: true });
}
