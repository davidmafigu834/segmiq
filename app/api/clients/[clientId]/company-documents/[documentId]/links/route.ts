import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import {
  createManualDocumentLink,
  loadDocumentEntityLinks,
  searchContactCandidates,
  searchQuotationCandidates,
} from "@/lib/documents/linking";
import type { DocumentEntityType } from "@/lib/documents/linking";
import { canEditDocument } from "@/lib/documents/permissions";
import { getDocumentForActor, toDocumentActor } from "@/lib/documents/service";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { clientId: string; documentId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const actor = toDocumentActor(g.session);
  const access = await getDocumentForActor({
    clientId: params.clientId,
    documentId: params.documentId,
    actor,
  });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const url = new URL(req.url);
  const searchQ = url.searchParams.get("q")?.trim();
  const entityType = url.searchParams.get("entityType") as DocumentEntityType | null;

  if (searchQ && entityType === "CUSTOMER") {
    const candidates = await searchContactCandidates(params.clientId, { name: searchQ });
    return NextResponse.json({ candidates });
  }

  if (searchQ && entityType === "QUOTATION") {
    const candidates = await searchQuotationCandidates(params.clientId, searchQ);
    return NextResponse.json({ candidates });
  }

  const links = await loadDocumentEntityLinks(params.clientId, params.documentId);
  return NextResponse.json({ links });
}

const createSchema = z.object({
  entityType: z.enum(["CUSTOMER", "LEAD", "DEAL", "QUOTATION"]),
  entityId: z.string().uuid(),
  linkType: z
    .enum([
      "PRIMARY_CUSTOMER",
      "RELATED_CUSTOMER",
      "SOURCE_LEAD",
      "SOURCE_DEAL",
      "SOURCE_QUOTATION",
      "GENERATED_FROM",
      "RELATED",
      "MANUAL",
    ])
    .optional(),
  label: z.string().optional(),
  subtitle: z.string().nullable().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { clientId: string; documentId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const actor = toDocumentActor(g.session);
  if (!canEditDocument(actor)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const access = await getDocumentForActor({
    clientId: params.clientId,
    documentId: params.documentId,
    actor,
  });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const link = await createManualDocumentLink({
    clientId: params.clientId,
    documentId: params.documentId,
    actorUserId: g.session.userId,
    candidate: {
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      linkType: parsed.data.linkType ?? "MANUAL",
      confidence: "HIGH",
      matchReason: "manual link",
      label: parsed.data.label ?? parsed.data.entityType,
      subtitle: parsed.data.subtitle ?? null,
    },
  });

  if (!link) {
    return NextResponse.json({ error: "Could not create link." }, { status: 500 });
  }

  return NextResponse.json({ link }, { status: 201 });
}
