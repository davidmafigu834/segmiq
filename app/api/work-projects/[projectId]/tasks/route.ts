import { NextResponse } from "next/server";
import { z } from "zod";
import { WORK_PROJECT_PRIORITIES, WORK_PROJECT_TASK_TYPES } from "@/lib/work-projects/constants";
import { createProjectTask } from "@/lib/work-projects/field-service";
import { workProjectActor, workProjectError } from "@/lib/work-projects/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  taskType: z.enum(WORK_PROJECT_TASK_TYPES as unknown as [string, ...string[]]).optional(),
  priority: z.enum(WORK_PROJECT_PRIORITIES as unknown as [string, ...string[]]).optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  dueAt: z.string().nullable().optional(),
});

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  const actor = await workProjectActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Check the task details." }, { status: 400 });
  const result = await createProjectTask(actor, params.projectId, body.data);
  if (!result.ok) return workProjectError(result);
  return NextResponse.json(result.data, { status: 201 });
}
