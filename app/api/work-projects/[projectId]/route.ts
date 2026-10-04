import { NextResponse } from "next/server";
import { z } from "zod";
import { workProjectActor, workProjectError } from "@/lib/work-projects/http";
import { loadWorkProjectWorkspace, updateWorkProjectMetadata } from "@/lib/work-projects/service";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  const actor = await workProjectActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const result = await loadWorkProjectWorkspace(actor, params.projectId);
  if (!result.ok) return workProjectError(result);
  return NextResponse.json(result.data);
}

const patchSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(4000).nullable().optional(),
  projectType: z.string().max(200).nullable().optional(),
  workflowKey: z.enum(["GENERAL_TRADES", "SOLAR_INSTALLATION"]).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  projectValue: z.number().nonnegative().nullable().optional(),
  currency: z.string().max(8).optional(),
  siteName: z.string().max(200).nullable().optional(),
  siteAddress: z.string().max(500).nullable().optional(),
  siteCity: z.string().max(120).nullable().optional(),
  siteNotes: z.string().max(2000).nullable().optional(),
  plannedStartDate: z.string().nullable().optional(),
  scheduledStartAt: z.string().nullable().optional(),
  targetCompletionDate: z.string().nullable().optional(),
  customerRequirements: z.string().max(8000).nullable().optional(),
  internalNotes: z.string().max(8000).nullable().optional(),
  nextStep: z.string().max(500).nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  const actor = await workProjectActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const body = patchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Check the project details." }, { status: 400 });
  const result = await updateWorkProjectMetadata(actor, params.projectId, body.data);
  if (!result.ok) return workProjectError(result);
  return NextResponse.json({ project: result.data.project });
}
