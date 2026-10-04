import { NextResponse } from "next/server";
import { z } from "zod";
import { WORK_PROJECT_STATUSES, type WorkProjectStatus } from "@/lib/work-projects/constants";
import { workProjectActor, workProjectError } from "@/lib/work-projects/http";
import { updateWorkProjectStatus } from "@/lib/work-projects/service";

export const dynamic = "force-dynamic";

const schema = z.object({
  status: z.enum(WORK_PROJECT_STATUSES as unknown as [WorkProjectStatus, ...WorkProjectStatus[]]),
  reason: z.string().max(500).nullable().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  const actor = await workProjectActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Unknown project status." }, { status: 400 });
  const result = await updateWorkProjectStatus(actor, params.projectId, body.data.status, body.data.reason);
  if (!result.ok) return workProjectError(result);
  return NextResponse.json({ project: result.data.project });
}
