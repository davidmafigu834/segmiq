import { NextResponse } from "next/server";
import { completeSiteAssessment, saveAssessmentDraft } from "@/lib/work-projects/field-service";
import { workProjectActor, workProjectError } from "@/lib/work-projects/http";

export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  { params }: { params: { projectId: string; visitId: string } }
) {
  const actor = await workProjectActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const result = await saveAssessmentDraft(actor, params.projectId, params.visitId, await req.json().catch(() => null));
  if (!result.ok) return workProjectError(result);
  return NextResponse.json(result.data);
}

export async function POST(
  req: Request,
  { params }: { params: { projectId: string; visitId: string } }
) {
  const actor = await workProjectActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const result = await completeSiteAssessment(actor, params.projectId, params.visitId, await req.json().catch(() => null));
  if (!result.ok) return workProjectError(result);
  return NextResponse.json(result.data);
}
