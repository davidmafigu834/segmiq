import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { createPresignedDocumentUpload, toDocumentActor } from "@/lib/documents/service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  title: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  documentTypeId: z.string().uuid().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const result = await createPresignedDocumentUpload({
    clientId: params.clientId,
    actor: toDocumentActor(g.session),
    ...parsed.data,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    documentId: result.documentId,
    versionId: result.versionId,
    uploadUrl: result.uploadUrl,
    storageKey: result.storageKey,
  });
}
