import { NextResponse } from "next/server";
import { z } from "zod";
import { WORK_PROJECT_TASK_STATUSES } from "@/lib/work-projects/constants";
import { updateProjectTask } from "@/lib/work-projects/field-service";
import { workProjectActor, workProjectError } from "@/lib/work-projects/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  status: z.enum(WORK_PROJECT_TASK_STATUSES as unknown as [string, ...string[]]).optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200).optional(),
  dueAt: z.string().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { projectId: string; taskId: string } }
) {
  const actor = await workProjectActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Check the task details." }, { status: 400 });
  const result = await updateProjectTask(actor, params.projectId, params.taskId, body.data);
  if (!result.ok) return workProjectError(result);
  return NextResponse.json(result.data);
}
