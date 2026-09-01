import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { askDocuments } from "@/lib/documents/retrieval";
import { toDocumentActor } from "@/lib/documents/service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  question: z.string().min(1).max(500),
  documentId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(12).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const result = await askDocuments({
    clientId: params.clientId,
    actor: toDocumentActor(g.session),
    question: parsed.data.question,
    documentId: parsed.data.documentId,
    limit: parsed.data.limit,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.result);
}
