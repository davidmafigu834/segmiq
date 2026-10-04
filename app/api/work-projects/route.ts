import { NextResponse } from "next/server";
import { z } from "zod";
import { workProjectActor, workProjectError } from "@/lib/work-projects/http";
import { createManualWorkProject, listWorkProjects } from "@/lib/work-projects/service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await workProjectActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const url = new URL(req.url);
  const result = await listWorkProjects(actor, {
    status: url.searchParams.get("status"),
    ownerId: url.searchParams.get("ownerId"),
    workflow: url.searchParams.get("workflow"),
    q: url.searchParams.get("q"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
  });
  if (!result.ok) return workProjectError(result);
  return NextResponse.json({ projects: result.data });
}

const createSchema = z.object({
  contactId: z.string().uuid(),
  title: z.string().min(1).max(200),
  workflowKey: z.enum(["GENERAL_TRADES", "SOLAR_INSTALLATION"]),
  dealId: z.string().uuid().nullable().optional(),
  quotationId: z.string().uuid().nullable().optional(),
  siteName: z.string().max(200).nullable().optional(),
  siteAddress: z.string().max(500).nullable().optional(),
  siteCity: z.string().max(120).nullable().optional(),
  siteNotes: z.string().max(2000).nullable().optional(),
  projectValue: z.number().nonnegative().nullable().optional(),
  currency: z.string().max(8).nullable().optional(),
  plannedStartDate: z.string().nullable().optional(),
  scheduledStartAt: z.string().nullable().optional(),
  targetCompletionDate: z.string().nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  customerRequirements: z.string().max(8000).nullable().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  projectType: z.string().max(200).nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
});

export async function POST(req: Request) {
  const actor = await workProjectActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const body = createSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Check the project details." }, { status: 400 });
  const result = await createManualWorkProject(actor, body.data);
  if (!result.ok) return workProjectError(result);
  return NextResponse.json(result.data, { status: result.data.created ? 201 : 200 });
}
