import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import {
  archiveDocument,
  getDocumentForActor,
  toDocumentActor,
  updateDocumentMetadata,
} from "@/lib/documents/service";
import { resolveDocumentActor } from "@/lib/documents/actor";
import { recordSupportAccessEvent } from "@/lib/security/support-access";
import { isSuperAdminRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).nullable().optional(),
  documentTypeId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  lifecycleStatus: z
    .enum([
      "DRAFT",
      "UNDER_REVIEW",
      "FINAL",
      "SIGNED",
      "ACTIVE",
      "EXPIRED",
      "TERMINATED",
      "SUPERSEDED",
      "ARCHIVED",
    ])
    .optional(),
});

export async function GET(
  req: Request,
  { params }: { params: { clientId: string; documentId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const resolved = await resolveDocumentActor(req, params.clientId);
  if (!resolved.ok) return resolved.response;

  const result = await getDocumentForActor({
    clientId: params.clientId,
    documentId: params.documentId,
    actor: resolved.actor,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (isSuperAdminRole(resolved.actor.role) && !resolved.actor.isImpersonating) {
    void recordSupportAccessEvent({
      eventType: "CLIENT_DOCUMENT_VIEWED",
      clientId: params.clientId,
      actorUserId: resolved.actor.userId,
      actorRole: resolved.actor.role,
      scope: "DOCUMENTS",
      resourceType: "document",
      resourceId: params.documentId,
    });
  }

  return NextResponse.json({
    document: result.document,
    version: result.version,
    policy: result.policy,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: { clientId: string; documentId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const result = await updateDocumentMetadata({
    clientId: params.clientId,
    documentId: params.documentId,
    actor: toDocumentActor(g.session),
    patch: {
      title: parsed.data.title,
      description: parsed.data.description,
      documentTypeId: parsed.data.documentTypeId,
      categoryId: parsed.data.categoryId,
      lifecycleStatus: parsed.data.lifecycleStatus,
    },
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ document: result.document });
}

export async function DELETE(
  req: Request,
  { params }: { params: { clientId: string; documentId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const result = await archiveDocument({
    clientId: params.clientId,
    documentId: params.documentId,
    actor: toDocumentActor(g.session),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
