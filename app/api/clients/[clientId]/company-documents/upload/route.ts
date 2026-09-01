import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { DOCUMENT_SERVER_UPLOAD_MAX_BYTES } from "@/lib/documents/constants";
import { toDocumentActor, uploadDocument } from "@/lib/documents/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "File is required." }, { status: 400 });
  }

  if (file.size > DOCUMENT_SERVER_UPLOAD_MAX_BYTES) {
    return NextResponse.json(
      {
        error: `File exceeds ${DOCUMENT_SERVER_UPLOAD_MAX_BYTES / (1024 * 1024)}MB direct upload limit. Use presigned upload.`,
        code: "USE_PRESIGN",
      },
      { status: 413 }
    );
  }

  const title = form?.get("title");
  const description = form?.get("description");
  const documentTypeId = form?.get("documentTypeId");
  const forceUpload = form?.get("forceUpload") === "true";

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadDocument({
    clientId: params.clientId,
    actor: toDocumentActor(g.session),
    file: {
      buffer,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
    },
    title: typeof title === "string" ? title : undefined,
    description: typeof description === "string" ? description : undefined,
    documentTypeId: typeof documentTypeId === "string" ? documentTypeId : undefined,
    forceUploadDespiteDuplicate: forceUpload,
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

  return NextResponse.json(
    {
      document: result.document,
      version: result.version,
      duplicate: result.duplicate ?? null,
      processingJobId: result.processingJobId,
    },
    { status: 201 }
  );
}
