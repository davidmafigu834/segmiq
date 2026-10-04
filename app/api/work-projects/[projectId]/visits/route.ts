import { NextResponse } from "next/server";
import { z } from "zod";
import { WORK_PROJECT_VISIT_TYPES } from "@/lib/work-projects/constants";
import { scheduleProjectVisit } from "@/lib/work-projects/field-service";
import { workProjectActor, workProjectError } from "@/lib/work-projects/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  visitType: z.enum(WORK_PROJECT_VISIT_TYPES as unknown as [string, ...string[]]),
  startAt: z.string().min(1),
  durationMinutes: z.number().int().min(15).max(1440),
  assigneeIds: z.array(z.string().uuid()).min(1).max(12),
  siteAddress: z.string().max(300).nullable().optional(),
  instructions: z.string().max(2000).nullable().optional(),
  notifyCustomer: z.boolean().optional(),
});

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  const actor = await workProjectActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Check the visit details." }, { status: 400 });
  const result = await scheduleProjectVisit(actor, params.projectId, body.data);
  if (!result.ok) return workProjectError(result);
  return NextResponse.json(result.data, { status: 201 });
}
