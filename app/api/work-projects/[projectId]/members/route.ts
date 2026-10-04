import { NextResponse } from "next/server";
import { z } from "zod";
import { WORK_PROJECT_ASSIGNABLE_ROLES } from "@/lib/work-projects/constants";
import { addProjectMember, removeProjectMember } from "@/lib/work-projects/field-service";
import { workProjectActor, workProjectError } from "@/lib/work-projects/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  userId: z.string().uuid(),
  role: z.enum(WORK_PROJECT_ASSIGNABLE_ROLES as unknown as [string, ...string[]]),
});

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  const actor = await workProjectActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Choose a team member and role." }, { status: 400 });
  const result = await addProjectMember(actor, params.projectId, body.data.userId, body.data.role);
  if (!result.ok) return workProjectError(result);
  return NextResponse.json(result.data);
}

export async function DELETE(req: Request, { params }: { params: { projectId: string } }) {
  const actor = await workProjectActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const userId = new URL(req.url).searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "Choose a team member." }, { status: 400 });
  const result = await removeProjectMember(actor, params.projectId, userId);
  if (!result.ok) return workProjectError(result);
  return NextResponse.json(result.data);
}
