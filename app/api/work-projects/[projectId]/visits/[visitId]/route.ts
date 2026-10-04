import { NextResponse } from "next/server";
import { z } from "zod";
import { cancelProjectVisit, rescheduleProjectVisit } from "@/lib/work-projects/field-service";
import { workProjectActor, workProjectError } from "@/lib/work-projects/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["reschedule", "cancel"]),
  startAt: z.string().optional(),
  durationMinutes: z.number().int().optional(),
  reason: z.string().max(200).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { projectId: string; visitId: string } }
) {
  const actor = await workProjectActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Check the visit update." }, { status: 400 });
  if (body.data.action === "cancel") {
    const result = await cancelProjectVisit(actor, params.projectId, params.visitId, body.data.reason || "");
    if (!result.ok) return workProjectError(result);
    return NextResponse.json(result.data);
  }
  const result = await rescheduleProjectVisit(actor, params.projectId, params.visitId, {
    startAt: body.data.startAt || "",
    durationMinutes: body.data.durationMinutes || 0,
  });
  if (!result.ok) return workProjectError(result);
  return NextResponse.json(result.data);
}
