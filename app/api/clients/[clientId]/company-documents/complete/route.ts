import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { completePresignedDocumentUpload, toDocumentActor } from "@/lib/documents/service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  documentId: z.string().uuid(),
  versionId: z.string().uuid(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/i),
  forceUpload: z.boolean().optional(),
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

  const result = await completePresignedDocumentUpload({
    clientId: params.clientId,
    actor: toDocumentActor(g.session),
    documentId: parsed.data.documentId,
    versionId: parsed.data.versionId,
    checksum: parsed.data.checksum.toLowerCase(),
    forceUploadDespiteDuplicate: parsed.data.forceUpload ?? false,
  });

  if (!result.ok) {
    if (result.error === "DUPLICATE_FILE" && result.duplicate) {
      return NextResponse.json(
        {
          error: "This file appears identical to an existing document.",
          code: "DUPLICATE_FILE",
          duplicate: result.duplicate,
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    document: result.document,
    version: result.version,
    processingJobId: result.processingJobId,
  });
}
