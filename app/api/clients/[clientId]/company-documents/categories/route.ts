import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import {
  createCategory,
  getCategoryDocumentCounts,
  mergeCategories,
} from "@/lib/documents/classification";
import { canEditDocument } from "@/lib/documents/permissions";
import { toDocumentActor } from "@/lib/documents/service";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const categories = await getCategoryDocumentCounts(params.clientId);
  return NextResponse.json({ categories });
}

const createSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const actor = toDocumentActor(g.session);
  if (!canEditDocument(actor)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const category = await createCategory({
    clientId: params.clientId,
    name: parsed.data.name,
    description: parsed.data.description,
    createdBy: g.session.userId,
    creationSource: "HUMAN",
  });

  if (!category) {
    return NextResponse.json({ error: "Could not create category." }, { status: 500 });
  }

  return NextResponse.json({ category }, { status: 201 });
}

const mergeSchema = z.object({
  sourceCategoryId: z.string().uuid(),
  targetCategoryId: z.string().uuid(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const actor = toDocumentActor(g.session);
  if (!canEditDocument(actor)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const parsed = mergeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const result = await mergeCategories({
    clientId: params.clientId,
    sourceCategoryId: parsed.data.sourceCategoryId,
    targetCategoryId: parsed.data.targetCategoryId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
