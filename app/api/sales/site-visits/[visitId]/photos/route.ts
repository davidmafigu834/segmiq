import { NextResponse } from "next/server";
import { solarActor, solarError } from "@/lib/sales/solar-workflow/http";
import { addSalesAssessmentPhoto } from "@/lib/sales/solar-workflow/service";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { visitId: string } }) {
  const actor = await solarActor(req);
  if (!actor) return solarError(401, "Unauthorised.");
  const body = (await req.json().catch(() => null)) as { documentId?: string; category?: string; note?: string | null } | null;
  if (!body?.documentId || !body.category) return solarError(400, "A photo and category are required.");
  const result = await addSalesAssessmentPhoto(actor, params.visitId, {
    documentId: body.documentId,
    category: body.category,
    note: body.note,
  });
  if (!result.ok) return solarError(result.status, result.error);
  return NextResponse.json(result);
}
