import { NextResponse } from "next/server";
import { z } from "zod";
import { SOLAR_PHOTO_CATEGORIES } from "@/lib/work-projects/constants";
import { attachAssessmentPhoto } from "@/lib/work-projects/field-service";
import { workProjectActor, workProjectError } from "@/lib/work-projects/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  documentId: z.string().uuid(),
  category: z.enum(SOLAR_PHOTO_CATEGORIES as unknown as [string, ...string[]]),
});

export async function POST(
  req: Request,
  { params }: { params: { projectId: string; visitId: string } }
) {
  const actor = await workProjectActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Choose a photo category." }, { status: 400 });
  const result = await attachAssessmentPhoto(actor, params.projectId, params.visitId, body.data.documentId, body.data.category);
  if (!result.ok) return workProjectError(result);
  return NextResponse.json(result.data);
}
